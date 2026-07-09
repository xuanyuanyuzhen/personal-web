import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NavigationType, OperationType, Prisma, PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNavigationDto, UpdateNavigationDto } from './navigation.dto';

const navigationAdminSelect = {
  id: true,
  key: true,
  title: true,
  type: true,
  path: true,
  url: true,
  target: true,
  icon: true,
  parentId: true,
  pageId: true,
  sortOrder: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
  parent: {
    select: {
      id: true,
      title: true,
      key: true,
    },
  },
  page: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      visibility: true,
    },
  },
} satisfies Prisma.NavigationSelect;

const navigationPublicSelect = {
  id: true,
  key: true,
  title: true,
  type: true,
  path: true,
  url: true,
  target: true,
  icon: true,
  parentId: true,
  pageId: true,
  sortOrder: true,
  isEnabled: true,
  deletedAt: true,
  page: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      visibility: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.NavigationSelect;

type PublicNavigationRecord = Prisma.NavigationGetPayload<{ select: typeof navigationPublicSelect }>;
type PublicNavigationItem = {
  id: number;
  key: string;
  title: string;
  type: NavigationType;
  path: string | null;
  url: string | null;
  target: string | null;
  icon: string | null;
  page: { id: number; title: string; slug: string } | null;
  children: PublicNavigationItem[];
};

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listPublic(includeAdminVisible = false): Promise<PublicNavigationItem[]> {
    const navigations = await this.prisma.navigation.findMany({
      where: {
        deletedAt: null,
        isEnabled: true,
      },
      select: navigationPublicSelect,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const visibleItems = navigations
      .filter((navigation) => this.isPublicNavigationVisible(navigation, includeAdminVisible))
      .map((navigation) => this.toPublicNavigation(navigation));
    const itemMap = new Map(visibleItems.map((item) => [item.id, item]));
    const roots: PublicNavigationItem[] = [];

    for (const item of visibleItems) {
      const source = navigations.find((navigation) => navigation.id === item.id);
      const parent = source?.parentId ? itemMap.get(source.parentId) : undefined;

      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  async listAdmin(query: PaginationQuery): Promise<{
    items: Prisma.NavigationGetPayload<{ select: typeof navigationAdminSelect }>[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const pagination = parsePagination(query);
    const where: Prisma.NavigationWhereInput = {
      deletedAt: null,
    };

    if (pagination.search) {
      where.OR = [
        { key: { contains: pagination.search } },
        { title: { contains: pagination.search } },
        { path: { contains: pagination.search } },
        { url: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.navigation.findMany({
        where,
        select: navigationAdminSelect,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.navigation.count({ where }),
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
    dto: CreateNavigationDto,
    adminId: number,
    ip?: string,
  ): Promise<Prisma.NavigationGetPayload<{ select: typeof navigationAdminSelect }>> {
    const data = await this.buildCreateData(dto);
    const navigation = await this.prisma.navigation.create({
      data,
      select: navigationAdminSelect,
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.CREATE,
      objectType: TargetType.NAVIGATION,
      objectId: String(navigation.id),
      ip,
      detail: {
        title: navigation.title,
        key: navigation.key,
        type: navigation.type,
      },
    });

    return navigation;
  }

  async updateAdmin(
    id: number,
    dto: UpdateNavigationDto,
    adminId: number,
    ip?: string,
  ): Promise<Prisma.NavigationGetPayload<{ select: typeof navigationAdminSelect }>> {
    const current = await this.findExistingNavigation(id);
    const data = await this.buildUpdateData(id, current, dto);
    const navigation = await this.prisma.navigation.update({
      where: { id },
      data,
      select: navigationAdminSelect,
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE,
      objectType: TargetType.NAVIGATION,
      objectId: String(navigation.id),
      ip,
      detail: {
        title: navigation.title,
        key: navigation.key,
        type: navigation.type,
      },
    });

    return navigation;
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const navigation = await this.findExistingNavigation(id);
    const deletedAt = new Date();

    await this.prisma.navigation.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        objectType: TargetType.NAVIGATION,
        objectId: String(navigation.id),
        title: navigation.title,
        summary: navigation.path ?? navigation.url ?? navigation.key,
        snapshot: toJsonObject(navigation),
        deletedById: adminId,
        deletedAt,
      },
    });
    await this.operationLogService.write({
      adminId,
      action: OperationType.DELETE,
      objectType: TargetType.NAVIGATION,
      objectId: String(navigation.id),
      ip,
      detail: {
        title: navigation.title,
        key: navigation.key,
      },
    });

    return { ok: true };
  }

  private isPublicNavigationVisible(
    navigation: PublicNavigationRecord,
    includeAdminVisible: boolean,
  ): boolean {
    if (!navigation.isEnabled || navigation.deletedAt !== null) {
      return false;
    }

    if (navigation.type !== NavigationType.PAGE) {
      return true;
    }

    if (includeAdminVisible) {
      return navigation.page?.deletedAt === null;
    }

    return (
      navigation.page?.status === PublishStatus.PUBLISHED &&
      navigation.page.visibility === Visibility.PUBLIC &&
      navigation.page.deletedAt === null
    );
  }

  private toPublicNavigation(navigation: PublicNavigationRecord): PublicNavigationItem {
    return {
      id: navigation.id,
      key: navigation.key,
      title: navigation.title,
      type: navigation.type,
      path: navigation.path,
      url: navigation.url,
      target: navigation.target,
      icon: navigation.icon,
      page:
        navigation.page && navigation.type === NavigationType.PAGE
          ? {
              id: navigation.page.id,
              title: navigation.page.title,
              slug: navigation.page.slug,
            }
          : null,
      children: [],
    };
  }

  private async buildCreateData(dto: CreateNavigationDto): Promise<Prisma.NavigationCreateInput> {
    const type = parseNavigationType(dto.type ?? NavigationType.INTERNAL);
    const key = assertTrimmedString(dto.key, 'key');
    const title = assertTrimmedString(dto.title, 'title');

    await this.assertRelations(dto.parentId, dto.pageId, type);
    this.assertTypeTarget(type, dto);

    return {
      key,
      title,
      type,
      path: optionalTrimmedString(dto.path),
      url: optionalTrimmedString(dto.url),
      target: optionalTrimmedString(dto.target),
      icon: optionalTrimmedString(dto.icon),
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      page: dto.pageId ? { connect: { id: dto.pageId } } : undefined,
      sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
      isEnabled: dto.isEnabled ?? true,
    };
  }

  private async buildUpdateData(
    id: number,
    current: Prisma.NavigationGetPayload<Record<string, never>>,
    dto: UpdateNavigationDto,
  ): Promise<Prisma.NavigationUpdateInput> {
    const type = parseNavigationType(dto.type ?? current.type);
    const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;
    const pageId = dto.pageId === undefined ? current.pageId : dto.pageId;

    if (parentId === id) {
      throw new BadRequestException('parentId cannot point to the navigation itself.');
    }

    await this.assertRelations(parentId, pageId, type);
    this.assertTypeTarget(type, {
      path: dto.path === undefined ? current.path : dto.path,
      url: dto.url === undefined ? current.url : dto.url,
    });

    return {
      key: dto.key === undefined ? undefined : assertTrimmedString(dto.key, 'key'),
      title: dto.title === undefined ? undefined : assertTrimmedString(dto.title, 'title'),
      type,
      path: dto.path === undefined ? undefined : optionalTrimmedString(dto.path),
      url: dto.url === undefined ? undefined : optionalTrimmedString(dto.url),
      target: dto.target === undefined ? undefined : optionalTrimmedString(dto.target),
      icon: dto.icon === undefined ? undefined : optionalTrimmedString(dto.icon),
      parent: parentId === null ? { disconnect: true } : dto.parentId === undefined ? undefined : { connect: { id: parentId } },
      page: pageId === null ? { disconnect: true } : dto.pageId === undefined ? undefined : { connect: { id: pageId } },
      sortOrder:
        dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
      isEnabled: dto.isEnabled,
    };
  }

  private async assertRelations(
    parentId: number | null | undefined,
    pageId: number | null | undefined,
    type: NavigationType,
  ): Promise<void> {
    if (parentId) {
      const parent = await this.prisma.navigation.findFirst({
        where: { id: parentId, deletedAt: null },
        select: { id: true },
      });

      if (!parent) {
        throw new BadRequestException('parentId does not point to an existing navigation.');
      }
    }

    if (type === NavigationType.PAGE) {
      if (!pageId) {
        throw new BadRequestException('pageId is required for PAGE navigation.');
      }

      const page = await this.prisma.customPage.findFirst({
        where: { id: pageId, deletedAt: null },
        select: { id: true },
      });

      if (!page) {
        throw new BadRequestException('pageId does not point to an existing page.');
      }
    }
  }

  private assertTypeTarget(
    type: NavigationType,
    dto: Pick<CreateNavigationDto, 'path' | 'url'>,
  ): void {
    if (type === NavigationType.INTERNAL && !optionalTrimmedString(dto.path)) {
      throw new BadRequestException('path is required for INTERNAL navigation.');
    }

    if (type === NavigationType.EXTERNAL && !optionalTrimmedString(dto.url)) {
      throw new BadRequestException('url is required for EXTERNAL navigation.');
    }
  }

  private async findExistingNavigation(
    id: number,
  ): Promise<Prisma.NavigationGetPayload<Record<string, never>>> {
    const navigation = await this.prisma.navigation.findFirst({
      where: { id, deletedAt: null },
    });

    if (!navigation) {
      throw new NotFoundException('Navigation not found.');
    }

    return navigation;
  }
}

function parseNavigationType(value: NavigationType): NavigationType {
  if (!Object.values(NavigationType).includes(value)) {
    throw new BadRequestException('type is invalid.');
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
