import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateThoughtDto, UpdateThoughtDto } from './thought.dto';

const thoughtSelect = {
  content: true,
  createdAt: true,
  deletedAt: true,
  id: true,
  imageUrl: true,
  isPinned: true,
  mood: true,
  publishedAt: true,
  scheduledAt: true,
  sortOrder: true,
  status: true,
  summary: true,
  updatedAt: true,
  visibility: true,
} satisfies Prisma.ThoughtSelect;

type ThoughtRecord = Prisma.ThoughtGetPayload<{ select: typeof thoughtSelect }>;
type ThoughtView = Omit<ThoughtRecord, 'deletedAt'> & {
  likeCount: number;
  liked: boolean;
  tags: Array<{ id: number; name: string; slug: string; color: string | null }>;
};

@Injectable()
export class ThoughtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listPublic(query: PaginationQuery & { tag?: string }, visitorId?: string): Promise<{
    items: ThoughtView[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const pagination = parsePagination(query);
    const where: Prisma.ThoughtWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
    };

    const tagTargetIds = await this.resolveTagTargetIds(query.tag);
    if (tagTargetIds) {
      where.id = { in: tagTargetIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.thought.findMany({
        where,
        select: thoughtSelect,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.thought.count({ where }),
    ]);

    return withPagination(
      await this.attachMeta(items, normalizeVisitorId(visitorId)),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async listAdmin(query: PaginationQuery & { tag?: string }): Promise<{
    items: ThoughtView[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const pagination = parsePagination(query);
    const where: Prisma.ThoughtWhereInput = {
      deletedAt: null,
    };

    if (pagination.search) {
      where.OR = [
        { content: { contains: pagination.search } },
        { summary: { contains: pagination.search } },
      ];
    }

    const tagTargetIds = await this.resolveTagTargetIds(query.tag);
    if (tagTargetIds) {
      where.id = { in: tagTargetIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.thought.findMany({
        where,
        select: thoughtSelect,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.thought.count({ where }),
    ]);

    return withPagination(await this.attachMeta(items), pagination.page, pagination.pageSize, total);
  }

  async listPublicTags(): Promise<Array<{ id: number; name: string; slug: string; color: string | null }>> {
    return this.prisma.tag.findMany({
      where: {
        isEnabled: true,
        scopes: {
          some: {
            targetType: TargetType.THOUGHT,
          },
        },
      },
      select: {
        color: true,
        id: true,
        name: true,
        slug: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async togglePublicLike(id: number, visitorId: string | undefined): Promise<{ liked: boolean; likeCount: number }> {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    if (!normalizedVisitorId) {
      throw new BadRequestException('X-Visitor-Id header is required.');
    }

    await this.findPublicThought(id);
    const where = {
      visitorId_targetType_targetId: {
        targetId: String(id),
        targetType: TargetType.THOUGHT,
        visitorId: normalizedVisitorId,
      },
    };
    const existing = await this.prisma.like.findUnique({ where });

    if (existing) {
      await this.prisma.like.delete({ where });
    } else {
      await this.prisma.like.create({
        data: {
          targetId: String(id),
          targetType: TargetType.THOUGHT,
          visitorId: normalizedVisitorId,
        },
      });
    }

    const likeCount = await this.prisma.like.count({
      where: {
        targetId: String(id),
        targetType: TargetType.THOUGHT,
      },
    });

    return {
      likeCount,
      liked: !existing,
    };
  }

  async createAdmin(dto: CreateThoughtDto, adminId: number, ip?: string): Promise<ThoughtView> {
    const status = parsePublishStatus(dto.status ?? PublishStatus.DRAFT);
    const thought = await this.prisma.thought.create({
      data: {
        content: assertTrimmedString(dto.content, 'content'),
        imageUrl: optionalTrimmedString(dto.imageUrl),
        isPinned: dto.isPinned ?? false,
        publishedAt: status === PublishStatus.PUBLISHED ? new Date() : undefined,
        sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
        status,
        summary: optionalTrimmedString(dto.summary),
        visibility: parseVisibility(dto.visibility ?? Visibility.PUBLIC),
      },
      select: thoughtSelect,
    });

    await this.syncTags(thought.id, dto.tagNames);
    await this.operationLogService.write({
      adminId,
      action: OperationType.CREATE,
      objectId: String(thought.id),
      objectType: TargetType.THOUGHT,
      ip,
      detail: {
        status: thought.status,
        visibility: thought.visibility,
      },
    });

    return (await this.attachMeta([thought]))[0];
  }

  async updateAdmin(id: number, dto: UpdateThoughtDto, adminId: number, ip?: string): Promise<ThoughtView> {
    const current = await this.findExistingThought(id);
    const status = dto.status === undefined ? current.status : parsePublishStatus(dto.status);
    const thought = await this.prisma.thought.update({
      where: { id },
      data: {
        content: dto.content === undefined ? undefined : assertTrimmedString(dto.content, 'content'),
        imageUrl: dto.imageUrl === undefined ? undefined : optionalTrimmedString(dto.imageUrl),
        isPinned: dto.isPinned,
        publishedAt:
          status === PublishStatus.PUBLISHED && current.publishedAt === null ? new Date() : undefined,
        sortOrder:
          dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
        status,
        summary: dto.summary === undefined ? undefined : optionalTrimmedString(dto.summary),
        visibility: dto.visibility === undefined ? undefined : parseVisibility(dto.visibility),
      },
      select: thoughtSelect,
    });

    if (dto.tagNames !== undefined) {
      await this.syncTags(thought.id, dto.tagNames);
    }

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE,
      objectId: String(thought.id),
      objectType: TargetType.THOUGHT,
      ip,
      detail: {
        status: thought.status,
        visibility: thought.visibility,
      },
    });

    return (await this.attachMeta([thought]))[0];
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const thought = await this.findExistingThought(id);
    const deletedAt = new Date();

    await this.prisma.thought.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(thought.id),
        objectType: TargetType.THOUGHT,
        snapshot: toJsonObject(thought),
        summary: thought.summary,
        title: thought.summary ?? `碎碎念 #${thought.id}`,
      },
    });
    await this.operationLogService.write({
      adminId,
      action: OperationType.DELETE,
      objectId: String(thought.id),
      objectType: TargetType.THOUGHT,
      ip,
      detail: {
        summary: thought.summary,
      },
    });

    return { ok: true };
  }

  private async findExistingThought(id: number): Promise<ThoughtRecord> {
    const thought = await this.prisma.thought.findFirst({
      where: { id, deletedAt: null },
      select: thoughtSelect,
    });

    if (!thought) {
      throw new NotFoundException('Thought not found.');
    }

    return thought;
  }

  private async findPublicThought(id: number): Promise<ThoughtRecord> {
    const thought = await this.prisma.thought.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
      },
      select: thoughtSelect,
    });

    if (!thought) {
      throw new NotFoundException('Thought not found.');
    }

    return thought;
  }

  private async resolveTagTargetIds(tag: string | undefined): Promise<number[] | undefined> {
    const normalized = tag?.trim();
    if (!normalized) {
      return undefined;
    }

    const tagRecord = await this.prisma.tag.findFirst({
      where: {
        isEnabled: true,
        OR: [{ name: normalized }, { slug: normalized }],
      },
      select: { id: true },
    });

    if (!tagRecord) {
      return [];
    }

    const relations = await this.prisma.tagRelation.findMany({
      where: {
        tagId: tagRecord.id,
        targetType: TargetType.THOUGHT,
      },
      select: { targetId: true },
    });

    return relations.map((relation) => Number(relation.targetId)).filter(Number.isInteger);
  }

  private async attachMeta(items: ThoughtRecord[], visitorId?: string): Promise<ThoughtView[]> {
    if (items.length === 0) {
      return [];
    }

    const targetIds = items.map((item) => String(item.id));
    const relations = await this.prisma.tagRelation.findMany({
      where: {
        tag: {
          isEnabled: true,
        },
        targetId: { in: targetIds },
        targetType: TargetType.THOUGHT,
      },
      include: {
        tag: {
          select: {
            color: true,
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
    const tagMap = new Map<string, ThoughtView['tags']>();

    for (const relation of relations) {
      const tags = tagMap.get(relation.targetId) ?? [];
      tags.push(relation.tag);
      tagMap.set(relation.targetId, tags);
    }

    const likeCounts = await this.prisma.like.groupBy({
      by: ['targetId'],
      where: {
        targetId: { in: targetIds },
        targetType: TargetType.THOUGHT,
      },
      _count: {
        _all: true,
      },
    });
    const likeCountMap = new Map(likeCounts.map((item) => [item.targetId, item._count._all]));
    const likedRelations = visitorId
      ? await this.prisma.like.findMany({
          where: {
            targetId: { in: targetIds },
            targetType: TargetType.THOUGHT,
            visitorId,
          },
          select: { targetId: true },
        })
      : [];
    const likedSet = new Set(likedRelations.map((item) => item.targetId));

    return items.map(({ deletedAt: _deletedAt, ...item }) => {
      void _deletedAt;
      const targetId = String(item.id);

      return {
        ...item,
        likeCount: likeCountMap.get(targetId) ?? 0,
        liked: likedSet.has(targetId),
        tags: tagMap.get(targetId) ?? [],
      };
    });
  }

  private async syncTags(thoughtId: number, tagNames: string[] | undefined): Promise<void> {
    const names = normalizeTagNames(tagNames);
    await this.prisma.tagRelation.deleteMany({
      where: {
        targetId: String(thoughtId),
        targetType: TargetType.THOUGHT,
      },
    });

    if (names.length === 0) {
      return;
    }

    const tags = await this.prisma.tag.findMany({
      where: {
        isEnabled: true,
        name: { in: names },
        scopes: {
          some: {
            targetType: TargetType.THOUGHT,
          },
        },
      },
      select: { id: true, name: true },
    });
    const tagMap = new Map(tags.map((tag) => [tag.name, tag.id]));
    const missingName = names.find((name) => !tagMap.has(name));

    if (missingName) {
      throw new BadRequestException(`Tag "${missingName}" is not available for thoughts.`);
    }

    for (const name of names) {
      await this.prisma.tagRelation.create({
        data: {
          tagId: tagMap.get(name) as number,
          targetId: String(thoughtId),
          targetType: TargetType.THOUGHT,
        },
      });
    }
  }
}

function withPagination<T>(items: T[], page: number, pageSize: number, total: number) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
    },
  };
}

function parsePublishStatus(value: PublishStatus): PublishStatus {
  if (!Object.values(PublishStatus).includes(value)) {
    throw new BadRequestException('status is invalid.');
  }

  return value;
}

function parseVisibility(value: Visibility): Visibility {
  if (!Object.values(Visibility).includes(value)) {
    throw new BadRequestException('visibility is invalid.');
  }

  return value;
}

function assertTrimmedString(value: string | undefined, field: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new BadRequestException(`${field} is required.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return value.trim() || null;
}

function parseOptionalInteger(value: number | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value)) {
    throw new BadRequestException(`${field} must be an integer.`);
  }

  return value;
}

function normalizeTagNames(tagNames: string[] | undefined): string[] {
  return [...new Set((tagNames ?? []).map((name) => name.trim()).filter(Boolean))].slice(0, 10);
}

function normalizeVisitorId(visitorId: string | undefined): string | undefined {
  const normalized = visitorId?.trim();

  return normalized || undefined;
}

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
