import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEssayCategoryDto,
  CreateEssayDto,
  UpdateEssayCategoryDto,
  UpdateEssayDto,
} from './essay.dto';

const categorySelect = {
  createdAt: true,
  description: true,
  id: true,
  isEnabled: true,
  name: true,
  slug: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.EssayCategorySelect;

const essaySelect = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  categoryId: true,
  content: true,
  coverUrl: true,
  createdAt: true,
  deletedAt: true,
  id: true,
  isPinned: true,
  publishedAt: true,
  scheduledAt: true,
  slug: true,
  sortOrder: true,
  status: true,
  summary: true,
  title: true,
  updatedAt: true,
  visibility: true,
} satisfies Prisma.EssaySelect;

type EssayRecord = Prisma.EssayGetPayload<{ select: typeof essaySelect }>;
type CategoryRecord = Prisma.EssayCategoryGetPayload<{ select: typeof categorySelect }>;
type EssayView = Omit<EssayRecord, 'deletedAt'> & {
  likeCount: number;
  liked: boolean;
  tags: Array<{ id: number; name: string; slug: string; color: string | null }>;
};

@Injectable()
export class EssayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listPublicCategories(): Promise<CategoryRecord[]> {
    return this.prisma.essayCategory.findMany({
      where: { isEnabled: true },
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAdminCategories(): Promise<CategoryRecord[]> {
    return this.prisma.essayCategory.findMany({
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createCategoryAdmin(
    dto: CreateEssayCategoryDto,
    adminId: number,
    ip?: string,
  ): Promise<CategoryRecord> {
    const category = await this.prisma.essayCategory.create({
      data: {
        description: optionalTrimmedString(dto.description),
        isEnabled: dto.isEnabled ?? true,
        name: assertTrimmedString(dto.name, 'name'),
        slug: assertSlug(dto.slug),
        sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
      },
      select: categorySelect,
    });

    await this.operationLogService.write({
      action: OperationType.CREATE,
      adminId,
      detail: { name: category.name },
      ip,
      objectId: String(category.id),
      objectType: TargetType.ESSAY_CATEGORY,
    });

    return category;
  }

  async updateCategoryAdmin(
    id: number,
    dto: UpdateEssayCategoryDto,
    adminId: number,
    ip?: string,
  ): Promise<CategoryRecord> {
    await this.findCategory(id);
    const category = await this.prisma.essayCategory.update({
      where: { id },
      data: {
        description: dto.description === undefined ? undefined : optionalTrimmedString(dto.description),
        isEnabled: dto.isEnabled,
        name: dto.name === undefined ? undefined : assertTrimmedString(dto.name, 'name'),
        slug: dto.slug === undefined ? undefined : assertSlug(dto.slug),
        sortOrder:
          dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
      },
      select: categorySelect,
    });

    await this.operationLogService.write({
      action: OperationType.UPDATE,
      adminId,
      detail: { name: category.name },
      ip,
      objectId: String(category.id),
      objectType: TargetType.ESSAY_CATEGORY,
    });

    return category;
  }

  async disableCategoryAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const category = await this.findCategory(id);
    await this.prisma.essayCategory.update({
      where: { id },
      data: { isEnabled: false },
    });
    await this.operationLogService.write({
      action: OperationType.DELETE,
      adminId,
      detail: { name: category.name },
      ip,
      objectId: String(category.id),
      objectType: TargetType.ESSAY_CATEGORY,
    });

    return { ok: true };
  }

  async listPublic(
    query: PaginationQuery & { category?: string; tag?: string },
    visitorId?: string,
  ): Promise<{ items: EssayView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.EssayWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
    };

    await this.applyCategoryFilter(where, query.category, true);
    const tagTargetIds = await this.resolveTagTargetIds(query.tag);
    if (tagTargetIds) {
      where.id = { in: tagTargetIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.essay.findMany({
        where,
        select: essaySelect,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.essay.count({ where }),
    ]);

    return withPagination(
      await this.attachMeta(items, normalizeVisitorId(visitorId)),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async getPublicDetail(idOrSlug: string, visitorId?: string): Promise<EssayView> {
    const where: Prisma.EssayWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
      OR: buildIdOrSlugWhere(idOrSlug),
    };
    const essay = await this.prisma.essay.findFirst({ where, select: essaySelect });

    if (!essay) {
      throw new NotFoundException('Essay not found.');
    }

    return (await this.attachMeta([essay], normalizeVisitorId(visitorId)))[0];
  }

  async listAdmin(
    query: PaginationQuery & { category?: string; tag?: string },
  ): Promise<{ items: EssayView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.EssayWhereInput = { deletedAt: null };

    if (pagination.search) {
      where.OR = [
        { title: { contains: pagination.search } },
        { summary: { contains: pagination.search } },
        { content: { contains: pagination.search } },
      ];
    }

    await this.applyCategoryFilter(where, query.category, false);
    const tagTargetIds = await this.resolveTagTargetIds(query.tag);
    if (tagTargetIds) {
      where.id = { in: tagTargetIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.essay.findMany({
        where,
        select: essaySelect,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.essay.count({ where }),
    ]);

    return withPagination(await this.attachMeta(items), pagination.page, pagination.pageSize, total);
  }

  async createAdmin(dto: CreateEssayDto, adminId: number, ip?: string): Promise<EssayView> {
    const status = parsePublishStatus(dto.status ?? PublishStatus.DRAFT);
    const categoryId = await this.parseCategoryId(dto.categoryId);
    const essay = await this.prisma.essay.create({
      data: {
        categoryId,
        content: assertTrimmedString(dto.content, 'content'),
        coverUrl: optionalTrimmedString(dto.coverUrl),
        isPinned: dto.isPinned ?? false,
        publishedAt: status === PublishStatus.PUBLISHED ? new Date() : undefined,
        slug: assertSlug(dto.slug),
        sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
        status,
        summary: optionalTrimmedString(dto.summary),
        title: assertTrimmedString(dto.title, 'title'),
        visibility: parseVisibility(dto.visibility ?? Visibility.PUBLIC),
      },
      select: essaySelect,
    });

    await this.syncTags(essay.id, dto.tagNames);
    await this.operationLogService.write({
      action: OperationType.CREATE,
      adminId,
      detail: { status: essay.status, title: essay.title, visibility: essay.visibility },
      ip,
      objectId: String(essay.id),
      objectType: TargetType.ESSAY,
    });

    return (await this.attachMeta([essay]))[0];
  }

  async updateAdmin(id: number, dto: UpdateEssayDto, adminId: number, ip?: string): Promise<EssayView> {
    const current = await this.findExistingEssay(id);
    const status = dto.status === undefined ? current.status : parsePublishStatus(dto.status);
    const categoryId =
      dto.categoryId === undefined ? undefined : await this.parseCategoryId(dto.categoryId);
    const essay = await this.prisma.essay.update({
      where: { id },
      data: {
        categoryId,
        content: dto.content === undefined ? undefined : assertTrimmedString(dto.content, 'content'),
        coverUrl: dto.coverUrl === undefined ? undefined : optionalTrimmedString(dto.coverUrl),
        isPinned: dto.isPinned,
        publishedAt:
          status === PublishStatus.PUBLISHED && current.publishedAt === null ? new Date() : undefined,
        slug: dto.slug === undefined ? undefined : assertSlug(dto.slug),
        sortOrder:
          dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
        status,
        summary: dto.summary === undefined ? undefined : optionalTrimmedString(dto.summary),
        title: dto.title === undefined ? undefined : assertTrimmedString(dto.title, 'title'),
        visibility: dto.visibility === undefined ? undefined : parseVisibility(dto.visibility),
      },
      select: essaySelect,
    });

    if (dto.tagNames !== undefined) {
      await this.syncTags(essay.id, dto.tagNames);
    }

    await this.operationLogService.write({
      action: OperationType.UPDATE,
      adminId,
      detail: { status: essay.status, title: essay.title, visibility: essay.visibility },
      ip,
      objectId: String(essay.id),
      objectType: TargetType.ESSAY,
    });

    return (await this.attachMeta([essay]))[0];
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const essay = await this.findExistingEssay(id);
    const deletedAt = new Date();

    await this.prisma.essay.update({ where: { id }, data: { deletedAt } });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(essay.id),
        objectType: TargetType.ESSAY,
        snapshot: toJsonObject(essay),
        summary: essay.summary,
        title: essay.title,
      },
    });
    await this.operationLogService.write({
      action: OperationType.DELETE,
      adminId,
      detail: { title: essay.title },
      ip,
      objectId: String(essay.id),
      objectType: TargetType.ESSAY,
    });

    return { ok: true };
  }

  async togglePublicLike(id: number, visitorId: string | undefined): Promise<{ liked: boolean; likeCount: number }> {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    if (!normalizedVisitorId) {
      throw new BadRequestException('X-Visitor-Id header is required.');
    }

    await this.findPublicEssay(id);
    const where = {
      visitorId_targetType_targetId: {
        targetId: String(id),
        targetType: TargetType.ESSAY,
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
          targetType: TargetType.ESSAY,
          visitorId: normalizedVisitorId,
        },
      });
    }

    const likeCount = await this.prisma.like.count({
      where: { targetId: String(id), targetType: TargetType.ESSAY },
    });

    return { likeCount, liked: !existing };
  }

  private async findCategory(id: number): Promise<CategoryRecord> {
    const category = await this.prisma.essayCategory.findUnique({ where: { id }, select: categorySelect });

    if (!category) {
      throw new NotFoundException('Essay category not found.');
    }

    return category;
  }

  private async parseCategoryId(value: number | null | undefined): Promise<number | null> {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('categoryId is invalid.');
    }

    await this.findCategory(value);
    return value;
  }

  private async findExistingEssay(id: number): Promise<EssayRecord> {
    const essay = await this.prisma.essay.findFirst({ where: { id, deletedAt: null }, select: essaySelect });

    if (!essay) {
      throw new NotFoundException('Essay not found.');
    }

    return essay;
  }

  private async findPublicEssay(id: number): Promise<EssayRecord> {
    const essay = await this.prisma.essay.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
      },
      select: essaySelect,
    });

    if (!essay) {
      throw new NotFoundException('Essay not found.');
    }

    return essay;
  }

  private async applyCategoryFilter(
    where: Prisma.EssayWhereInput,
    category: string | undefined,
    onlyEnabled: boolean,
  ): Promise<void> {
    const normalized = category?.trim();
    if (!normalized) {
      return;
    }

    const parsedId = Number(normalized);
    const categoryWhere: Prisma.EssayCategoryWhereInput = Number.isInteger(parsedId)
      ? { id: parsedId }
      : { slug: normalized };
    const categoryRecord = await this.prisma.essayCategory.findFirst({
      where: onlyEnabled ? { ...categoryWhere, isEnabled: true } : categoryWhere,
      select: { id: true },
    });

    where.categoryId = categoryRecord ? categoryRecord.id : -1;
  }

  private async resolveTagTargetIds(tag: string | undefined): Promise<number[] | undefined> {
    const normalized = tag?.trim();
    if (!normalized) {
      return undefined;
    }

    const tagRecord = await this.prisma.tag.findFirst({
      where: { isEnabled: true, OR: [{ name: normalized }, { slug: normalized }] },
      select: { id: true },
    });

    if (!tagRecord) {
      return [];
    }

    const relations = await this.prisma.tagRelation.findMany({
      where: { tagId: tagRecord.id, targetType: TargetType.ESSAY },
      select: { targetId: true },
    });

    return relations.map((relation) => Number(relation.targetId)).filter(Number.isInteger);
  }

  private async attachMeta(items: EssayRecord[], visitorId?: string): Promise<EssayView[]> {
    if (items.length === 0) {
      return [];
    }

    const targetIds = items.map((item) => String(item.id));
    const relations = await this.prisma.tagRelation.findMany({
      where: { tag: { isEnabled: true }, targetId: { in: targetIds }, targetType: TargetType.ESSAY },
      include: {
        tag: {
          select: { color: true, id: true, name: true, slug: true },
        },
      },
    });
    const tagMap = new Map<string, EssayView['tags']>();

    for (const relation of relations) {
      const tags = tagMap.get(relation.targetId) ?? [];
      tags.push(relation.tag);
      tagMap.set(relation.targetId, tags);
    }

    const likeCounts = await this.prisma.like.groupBy({
      by: ['targetId'],
      where: { targetId: { in: targetIds }, targetType: TargetType.ESSAY },
      _count: { _all: true },
    });
    const likeCountMap = new Map(likeCounts.map((item) => [item.targetId, item._count._all]));
    const likedRelations = visitorId
      ? await this.prisma.like.findMany({
          where: { targetId: { in: targetIds }, targetType: TargetType.ESSAY, visitorId },
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

  private async syncTags(essayId: number, tagNames: string[] | undefined): Promise<void> {
    const names = normalizeTagNames(tagNames);
    await this.prisma.tagRelation.deleteMany({
      where: { targetId: String(essayId), targetType: TargetType.ESSAY },
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
            targetType: TargetType.ESSAY,
          },
        },
      },
      select: { id: true, name: true },
    });
    const tagMap = new Map(tags.map((tag) => [tag.name, tag.id]));
    const missingName = names.find((name) => !tagMap.has(name));

    if (missingName) {
      throw new BadRequestException(`Tag "${missingName}" is not available for essays.`);
    }

    for (const name of names) {
      await this.prisma.tagRelation.create({
        data: { tagId: tagMap.get(name) as number, targetId: String(essayId), targetType: TargetType.ESSAY },
      });
    }
  }
}

function withPagination<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, pagination: { page, pageSize, total } };
}

function buildIdOrSlugWhere(idOrSlug: string): Prisma.EssayWhereInput[] {
  const normalized = idOrSlug.trim();
  const id = Number(normalized);

  return Number.isInteger(id) && id > 0 ? [{ id }, { slug: normalized }] : [{ slug: normalized }];
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

function assertSlug(value: string | undefined): string {
  const slug = assertTrimmedString(value, 'slug');

  if (!/^[a-z0-9][a-z0-9-]{0,178}[a-z0-9]$/i.test(slug) && slug.length !== 1) {
    throw new BadRequestException('slug is invalid.');
  }

  return slug;
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
