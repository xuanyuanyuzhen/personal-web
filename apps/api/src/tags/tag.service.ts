import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, TargetType } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto, UpdateTagDto } from './tag.dto';

const tagSelect = {
  color: true,
  createdAt: true,
  id: true,
  isEnabled: true,
  name: true,
  scopes: {
    select: {
      targetType: true,
    },
  },
  slug: true,
  updatedAt: true,
} satisfies Prisma.TagSelect;

type TagRecord = Prisma.TagGetPayload<{ select: typeof tagSelect }>;
type TagView = Omit<TagRecord, 'scopes'> & { scopes: TargetType[] };

const allowedScopes = new Set<TargetType>([TargetType.THOUGHT, TargetType.ESSAY, TargetType.PHOTO]);

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listAdmin(
    query: PaginationQuery & { scope?: TargetType; isEnabled?: string },
  ): Promise<{ items: TagView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.TagWhereInput = {};

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search } },
        { slug: { contains: pagination.search } },
      ];
    }

    if (query.scope) {
      where.scopes = { some: { targetType: parseScope(query.scope) } };
    }

    if (query.isEnabled !== undefined) {
      where.isEnabled = parseBooleanString(query.isEnabled);
    }

    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        select: tagSelect,
        orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.tag.count({ where }),
    ]);

    return {
      items: items.map(toTagView),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
    };
  }

  async listPublic(scope?: TargetType): Promise<TagView[]> {
    const where: Prisma.TagWhereInput = { isEnabled: true };

    if (scope) {
      where.scopes = { some: { targetType: parseScope(scope) } };
    }

    const items = await this.prisma.tag.findMany({
      where,
      select: tagSelect,
      orderBy: [{ name: 'asc' }],
    });

    return items.map(toTagView);
  }

  async createAdmin(dto: CreateTagDto, adminId: number, ip?: string): Promise<TagView> {
    const scopes = normalizeScopes(dto.scopes);
    const tag = await this.prisma.tag.create({
      data: {
        color: normalizeColor(dto.color),
        isEnabled: dto.isEnabled ?? true,
        name: assertTrimmedString(dto.name, 'name'),
        scopes: {
          create: scopes.map((targetType) => ({ targetType })),
        },
        slug: assertSlug(dto.slug),
      },
      select: tagSelect,
    });

    await this.operationLogService.write({
      action: OperationType.CREATE,
      adminId,
      detail: { name: tag.name, scopes },
      ip,
      objectId: String(tag.id),
      objectType: TargetType.TAG,
    });

    return toTagView(tag);
  }

  async updateAdmin(id: number, dto: UpdateTagDto, adminId: number, ip?: string): Promise<TagView> {
    await this.findExistingTag(id);
    const scopes = dto.scopes === undefined ? undefined : normalizeScopes(dto.scopes);
    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        color: dto.color === undefined ? undefined : normalizeColor(dto.color),
        isEnabled: dto.isEnabled,
        name: dto.name === undefined ? undefined : assertTrimmedString(dto.name, 'name'),
        scopes:
          scopes === undefined
            ? undefined
            : {
                deleteMany: {},
                create: scopes.map((targetType) => ({ targetType })),
              },
        slug: dto.slug === undefined ? undefined : assertSlug(dto.slug),
      },
      select: tagSelect,
    });

    await this.operationLogService.write({
      action: OperationType.UPDATE,
      adminId,
      detail: { name: tag.name, scopes: tag.scopes.map((scope) => scope.targetType) },
      ip,
      objectId: String(tag.id),
      objectType: TargetType.TAG,
    });

    return toTagView(tag);
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const tag = await this.findExistingTag(id);
    await this.prisma.tag.update({
      where: { id },
      data: { isEnabled: false },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt: new Date(),
        deletedById: adminId,
        objectId: String(tag.id),
        objectType: TargetType.TAG,
        snapshot: toJsonObject(tag),
        summary: tag.slug,
        title: tag.name,
      },
    });
    await this.operationLogService.write({
      action: OperationType.DELETE,
      adminId,
      detail: { name: tag.name },
      ip,
      objectId: String(tag.id),
      objectType: TargetType.TAG,
    });

    return { ok: true };
  }

  private async findExistingTag(id: number): Promise<TagRecord> {
    const tag = await this.prisma.tag.findUnique({ where: { id }, select: tagSelect });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    return tag;
  }
}

function toTagView(tag: TagRecord): TagView {
  return {
    color: tag.color,
    createdAt: tag.createdAt,
    id: tag.id,
    isEnabled: tag.isEnabled,
    name: tag.name,
    scopes: tag.scopes.map((scope) => scope.targetType),
    slug: tag.slug,
    updatedAt: tag.updatedAt,
  };
}

function normalizeScopes(scopes: TargetType[] | undefined): TargetType[] {
  const normalized = [...new Set(scopes ?? [])].map(parseScope);

  if (normalized.length === 0) {
    throw new BadRequestException('scopes is required.');
  }

  return normalized;
}

function parseScope(value: TargetType): TargetType {
  if (!allowedScopes.has(value)) {
    throw new BadRequestException('scope is invalid.');
  }

  return value;
}

function parseBooleanString(value: string): boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new BadRequestException('isEnabled is invalid.');
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

  if (!/^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/i.test(slug) && !/^[a-z0-9]$/i.test(slug)) {
    throw new BadRequestException('slug is invalid.');
  }

  return slug;
}

function normalizeColor(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  const color = value.trim();
  if (!color) {
    return null;
  }

  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new BadRequestException('color must be a hex color.');
  }

  return color;
}

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
