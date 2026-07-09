import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from './page.dto';

const pageAdminSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  status: true,
  visibility: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  isPinned: true,
  sortOrder: true,
  publishedAt: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomPageSelect;

const pagePublicSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  status: true,
  visibility: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  publishedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomPageSelect;

type PublicPageRecord = Prisma.CustomPageGetPayload<{ select: typeof pagePublicSelect }>;
type PublicPageItem = Omit<PublicPageRecord, 'status' | 'visibility' | 'deletedAt'>;

@Injectable()
export class PageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async getPublicBySlug(slug: string, includeAdminVisible = false): Promise<PublicPageItem> {
    const trimmedSlug = assertTrimmedString(slug, 'slug');
    const page = await this.prisma.customPage.findFirst({
      where: includeAdminVisible
        ? {
            slug: trimmedSlug,
            deletedAt: null,
          }
        : {
            slug: trimmedSlug,
            status: PublishStatus.PUBLISHED,
            visibility: Visibility.PUBLIC,
            deletedAt: null,
          },
      select: pagePublicSelect,
    });

    if (
      !page ||
      (!includeAdminVisible &&
        (page.status !== PublishStatus.PUBLISHED || page.visibility !== Visibility.PUBLIC)) ||
      page.deletedAt !== null
    ) {
      throw new NotFoundException('Page not found.');
    }

    return toPublicPage(page);
  }

  async listAdmin(query: PaginationQuery): Promise<{
    items: Prisma.CustomPageGetPayload<{ select: typeof pageAdminSelect }>[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const pagination = parsePagination(query);
    const where: Prisma.CustomPageWhereInput = {
      deletedAt: null,
    };

    if (pagination.search) {
      where.OR = [
        { title: { contains: pagination.search } },
        { slug: { contains: pagination.search } },
        { summary: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customPage.findMany({
        where,
        select: pageAdminSelect,
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.customPage.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
    };
  }

  async createAdmin(
    dto: CreatePageDto,
    adminId: number,
    ip?: string,
  ): Promise<Prisma.CustomPageGetPayload<{ select: typeof pageAdminSelect }>> {
    const data = this.buildCreateData(dto);
    const page = await this.prisma.customPage.create({
      data,
      select: pageAdminSelect,
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.CREATE,
      objectType: TargetType.PAGE,
      objectId: String(page.id),
      ip,
      detail: {
        title: page.title,
        slug: page.slug,
        status: page.status,
        visibility: page.visibility,
      },
    });

    return page;
  }

  async updateAdmin(
    id: number,
    dto: UpdatePageDto,
    adminId: number,
    ip?: string,
  ): Promise<Prisma.CustomPageGetPayload<{ select: typeof pageAdminSelect }>> {
    const current = await this.findExistingPage(id);
    const data = this.buildUpdateData(current, dto);
    const page = await this.prisma.customPage.update({
      where: { id },
      data,
      select: pageAdminSelect,
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE,
      objectType: TargetType.PAGE,
      objectId: String(page.id),
      ip,
      detail: {
        title: page.title,
        slug: page.slug,
        status: page.status,
        visibility: page.visibility,
      },
    });

    return page;
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const page = await this.findExistingPage(id);
    const deletedAt = new Date();

    await this.prisma.customPage.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        objectType: TargetType.PAGE,
        objectId: String(page.id),
        title: page.title,
        summary: page.summary,
        snapshot: toJsonObject(page),
        deletedById: adminId,
        deletedAt,
      },
    });
    await this.operationLogService.write({
      adminId,
      action: OperationType.DELETE,
      objectType: TargetType.PAGE,
      objectId: String(page.id),
      ip,
      detail: {
        title: page.title,
        slug: page.slug,
      },
    });

    return { ok: true };
  }

  private buildCreateData(dto: CreatePageDto): Prisma.CustomPageCreateInput {
    const status = parsePublishStatus(dto.status ?? PublishStatus.DRAFT);

    return {
      title: assertTrimmedString(dto.title, 'title'),
      slug: assertTrimmedString(dto.slug, 'slug'),
      summary: optionalTrimmedString(dto.summary),
      content: assertTrimmedString(dto.content, 'content'),
      status,
      visibility: parseVisibility(dto.visibility ?? Visibility.PUBLIC),
      seoTitle: optionalTrimmedString(dto.seoTitle),
      seoDescription: optionalTrimmedString(dto.seoDescription),
      seoKeywords: optionalTrimmedString(dto.seoKeywords),
      isPinned: dto.isPinned ?? false,
      sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
      publishedAt: status === PublishStatus.PUBLISHED ? new Date() : undefined,
    };
  }

  private buildUpdateData(
    current: Prisma.CustomPageGetPayload<Record<string, never>>,
    dto: UpdatePageDto,
  ): Prisma.CustomPageUpdateInput {
    const status = dto.status === undefined ? current.status : parsePublishStatus(dto.status);

    return {
      title: dto.title === undefined ? undefined : assertTrimmedString(dto.title, 'title'),
      slug: dto.slug === undefined ? undefined : assertTrimmedString(dto.slug, 'slug'),
      summary: dto.summary === undefined ? undefined : optionalTrimmedString(dto.summary),
      content: dto.content === undefined ? undefined : assertTrimmedString(dto.content, 'content'),
      status,
      visibility: dto.visibility === undefined ? undefined : parseVisibility(dto.visibility),
      seoTitle: dto.seoTitle === undefined ? undefined : optionalTrimmedString(dto.seoTitle),
      seoDescription:
        dto.seoDescription === undefined ? undefined : optionalTrimmedString(dto.seoDescription),
      seoKeywords: dto.seoKeywords === undefined ? undefined : optionalTrimmedString(dto.seoKeywords),
      isPinned: dto.isPinned,
      sortOrder:
        dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
      publishedAt:
        status === PublishStatus.PUBLISHED && current.publishedAt === null ? new Date() : undefined,
    };
  }

  private async findExistingPage(
    id: number,
  ): Promise<Prisma.CustomPageGetPayload<Record<string, never>>> {
    const page = await this.prisma.customPage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException('Page not found.');
    }

    return page;
  }
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

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function toPublicPage(page: PublicPageRecord): PublicPageItem {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    summary: page.summary,
    content: page.content,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoKeywords: page.seoKeywords,
    publishedAt: page.publishedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}
