import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumDto, CreatePhotoDto, SortPhotosDto, UpdateAlbumDto, UpdatePhotoDto } from './photo.dto';

const albumSelect = {
  coverUrl: true,
  createdAt: true,
  deletedAt: true,
  description: true,
  id: true,
  isEnabled: true,
  name: true,
  slug: true,
  sortOrder: true,
  status: true,
  updatedAt: true,
  visibility: true,
} satisfies Prisma.AlbumSelect;

const photoSelect = {
  album: {
    select: { id: true, name: true, slug: true },
  },
  albumId: true,
  createdAt: true,
  deletedAt: true,
  description: true,
  id: true,
  largeUrl: true,
  originalUrl: true,
  sortOrder: true,
  status: true,
  thumbUrl: true,
  title: true,
  updatedAt: true,
  visibility: true,
} satisfies Prisma.PhotoSelect;

type AlbumRecord = Prisma.AlbumGetPayload<{ select: typeof albumSelect }>;
type AlbumView = Omit<AlbumRecord, 'deletedAt'>;
type PhotoRecord = Prisma.PhotoGetPayload<{ select: typeof photoSelect }>;
type PhotoView = Omit<PhotoRecord, 'deletedAt'> & { likeCount: number; liked: boolean };

@Injectable()
export class PhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listPublicAlbums(): Promise<AlbumView[]> {
    const albums = await this.prisma.album.findMany({
      where: publicAlbumWhere(),
      select: albumSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return albums.map(stripDeletedAt);
  }

  async listAdminAlbums(
    query: PaginationQuery & { search?: string },
  ): Promise<{ items: AlbumView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.AlbumWhereInput = { deletedAt: null };

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search } },
        { slug: { contains: pagination.search } },
        { description: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.album.findMany({
        where,
        select: albumSelect,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.album.count({ where }),
    ]);

    return withPagination(items.map(stripDeletedAt), pagination.page, pagination.pageSize, total);
  }

  async createAlbumAdmin(dto: CreateAlbumDto, adminId: number, ip?: string): Promise<AlbumView> {
    const album = await this.prisma.album.create({
      data: normalizeAlbumCreate(dto),
      select: albumSelect,
    });
    await this.writeLog(OperationType.CREATE, TargetType.ALBUM, album.id, adminId, ip, { name: album.name });

    return stripDeletedAt(album);
  }

  async updateAlbumAdmin(id: number, dto: UpdateAlbumDto, adminId: number, ip?: string): Promise<AlbumView> {
    await this.findAlbum(id);
    const album = await this.prisma.album.update({
      where: { id },
      data: normalizeAlbumUpdate(dto),
      select: albumSelect,
    });
    await this.writeLog(OperationType.UPDATE, TargetType.ALBUM, album.id, adminId, ip, { name: album.name });

    return stripDeletedAt(album);
  }

  async disableAlbumAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const album = await this.findAlbum(id);
    await this.prisma.album.update({ where: { id }, data: { isEnabled: false } });
    await this.writeLog(OperationType.DELETE, TargetType.ALBUM, album.id, adminId, ip, { name: album.name });

    return { ok: true };
  }

  async listPublicPhotos(
    query: PaginationQuery & { albumId?: string },
    visitorId?: string,
  ): Promise<{ items: PhotoView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.PhotoWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
      OR: [{ albumId: null }, { album: publicAlbumWhere() }],
    };
    applyAlbumFilter(where, query.albumId);

    const [items, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: photoSelect,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return withPagination(
      await this.attachLikes(items, normalizeVisitorId(visitorId)),
      pagination.page,
      pagination.pageSize,
      total,
    );
  }

  async listAdminPhotos(
    query: PaginationQuery & { albumId?: string },
  ): Promise<{ items: PhotoView[]; pagination: { page: number; pageSize: number; total: number } }> {
    const pagination = parsePagination(query);
    const where: Prisma.PhotoWhereInput = { deletedAt: null };

    if (pagination.search) {
      where.OR = [
        { title: { contains: pagination.search } },
        { description: { contains: pagination.search } },
      ];
    }

    applyAlbumFilter(where, query.albumId);
    const [items, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: photoSelect,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return withPagination(await this.attachLikes(items), pagination.page, pagination.pageSize, total);
  }

  async createPhotoAdmin(dto: CreatePhotoDto, adminId: number, ip?: string): Promise<PhotoView> {
    const albumId = await this.parseAlbumId(dto.albumId);
    const photo = await this.prisma.photo.create({
      data: {
        albumId,
        description: optionalTrimmedString(dto.description),
        largeUrl: optionalTrimmedString(dto.largeUrl),
        originalUrl: assertTrimmedString(dto.originalUrl, 'originalUrl'),
        sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
        status: parsePublishStatus(dto.status ?? PublishStatus.PUBLISHED),
        thumbUrl: optionalTrimmedString(dto.thumbUrl),
        title: assertTrimmedString(dto.title, 'title'),
        visibility: parseVisibility(dto.visibility ?? Visibility.PUBLIC),
      },
      select: photoSelect,
    });
    await this.writeLog(OperationType.CREATE, TargetType.PHOTO, photo.id, adminId, ip, { title: photo.title });

    return (await this.attachLikes([photo]))[0];
  }

  async updatePhotoAdmin(id: number, dto: UpdatePhotoDto, adminId: number, ip?: string): Promise<PhotoView> {
    await this.findPhoto(id);
    const albumId = dto.albumId === undefined ? undefined : await this.parseAlbumId(dto.albumId);
    const photo = await this.prisma.photo.update({
      where: { id },
      data: {
        albumId,
        description: dto.description === undefined ? undefined : optionalTrimmedString(dto.description),
        largeUrl: dto.largeUrl === undefined ? undefined : optionalTrimmedString(dto.largeUrl),
        originalUrl: dto.originalUrl === undefined ? undefined : assertTrimmedString(dto.originalUrl, 'originalUrl'),
        sortOrder:
          dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
        status: dto.status === undefined ? undefined : parsePublishStatus(dto.status),
        thumbUrl: dto.thumbUrl === undefined ? undefined : optionalTrimmedString(dto.thumbUrl),
        title: dto.title === undefined ? undefined : assertTrimmedString(dto.title, 'title'),
        visibility: dto.visibility === undefined ? undefined : parseVisibility(dto.visibility),
      },
      select: photoSelect,
    });
    await this.writeLog(OperationType.UPDATE, TargetType.PHOTO, photo.id, adminId, ip, { title: photo.title });

    return (await this.attachLikes([photo]))[0];
  }

  async sortPhotosAdmin(dto: SortPhotosDto, adminId: number, ip?: string): Promise<{ ok: true }> {
    const items = normalizePhotoSortItems(dto.items);
    const ids = items.map((item) => item.id);
    const existing = await this.prisma.photo.findMany({
      where: { deletedAt: null, id: { in: ids } },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new NotFoundException('Photo not found.');
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.photo.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
          select: { id: true },
        }),
      ),
    );
    await this.writeLog(OperationType.UPDATE, TargetType.PHOTO, 'sort', adminId, ip, {
      action: 'reorder',
      items,
    });

    return { ok: true };
  }

  async deletePhotoAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const photo = await this.findPhoto(id);
    const deletedAt = new Date();

    await this.prisma.photo.update({ where: { id }, data: { deletedAt } });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(photo.id),
        objectType: TargetType.PHOTO,
        snapshot: toJsonObject(photo),
        summary: photo.description,
        title: photo.title,
      },
    });
    await this.writeLog(OperationType.DELETE, TargetType.PHOTO, photo.id, adminId, ip, { title: photo.title });

    return { ok: true };
  }

  async togglePublicLike(id: number, visitorId: string | undefined): Promise<{ liked: boolean; likeCount: number }> {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    if (!normalizedVisitorId) {
      throw new BadRequestException('X-Visitor-Id header is required.');
    }

    await this.findPublicPhoto(id);
    const where = {
      visitorId_targetType_targetId: {
        targetId: String(id),
        targetType: TargetType.PHOTO,
        visitorId: normalizedVisitorId,
      },
    };
    const existing = await this.prisma.like.findUnique({ where });

    if (existing) {
      await this.prisma.like.delete({ where });
    } else {
      await this.prisma.like.create({ data: { targetId: String(id), targetType: TargetType.PHOTO, visitorId: normalizedVisitorId } });
    }

    const likeCount = await this.prisma.like.count({ where: { targetId: String(id), targetType: TargetType.PHOTO } });

    return { likeCount, liked: !existing };
  }

  private async findAlbum(id: number): Promise<AlbumRecord> {
    const album = await this.prisma.album.findFirst({ where: { id, deletedAt: null }, select: albumSelect });
    if (!album) {
      throw new NotFoundException('Album not found.');
    }

    return album;
  }

  private async findPhoto(id: number): Promise<PhotoRecord> {
    const photo = await this.prisma.photo.findFirst({ where: { id, deletedAt: null }, select: photoSelect });
    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    return photo;
  }

  private async findPublicPhoto(id: number): Promise<PhotoRecord> {
    const photo = await this.prisma.photo.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
        OR: [{ albumId: null }, { album: publicAlbumWhere() }],
      },
      select: photoSelect,
    });
    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    return photo;
  }

  private async parseAlbumId(value: number | null | undefined): Promise<number | null> {
    if (value === null || value === undefined) {
      return null;
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('albumId is invalid.');
    }

    await this.findAlbum(value);
    return value;
  }

  private async attachLikes(items: PhotoRecord[], visitorId?: string): Promise<PhotoView[]> {
    if (items.length === 0) {
      return [];
    }

    const targetIds = items.map((item) => String(item.id));
    const likeCounts = await this.prisma.like.groupBy({
      by: ['targetId'],
      where: { targetId: { in: targetIds }, targetType: TargetType.PHOTO },
      _count: { _all: true },
    });
    const likeCountMap = new Map(likeCounts.map((item) => [item.targetId, item._count._all]));
    const likedRelations = visitorId
      ? await this.prisma.like.findMany({
          where: { targetId: { in: targetIds }, targetType: TargetType.PHOTO, visitorId },
          select: { targetId: true },
        })
      : [];
    const likedSet = new Set(likedRelations.map((item) => item.targetId));

    return items.map(({ deletedAt: _deletedAt, ...item }) => {
      void _deletedAt;
      const targetId = String(item.id);

      return { ...item, likeCount: likeCountMap.get(targetId) ?? 0, liked: likedSet.has(targetId) };
    });
  }

  private writeLog(action: OperationType, objectType: TargetType, id: number | string, adminId: number, ip?: string, detail?: object) {
    return this.operationLogService.write({
      action,
      adminId,
      detail,
      ip,
      objectId: String(id),
      objectType,
    });
  }
}

function publicAlbumWhere(): Prisma.AlbumWhereInput {
  return {
    deletedAt: null,
    isEnabled: true,
    status: PublishStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
  };
}

function normalizePhotoSortItems(items: SortPhotosDto['items']): Array<{ id: number; sortOrder: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('items is required.');
  }

  if (items.length > 100) {
    throw new BadRequestException('items must contain no more than 100 photos.');
  }

  const seen = new Set<number>();

  return items.map((item) => {
    const id = parseRequiredPositiveInteger(item?.id, 'id');
    const sortOrder = parseOptionalInteger(item?.sortOrder, 'sortOrder');

    if (sortOrder === undefined) {
      throw new BadRequestException('sortOrder is required.');
    }

    if (seen.has(id)) {
      throw new BadRequestException('items contains duplicate photo ids.');
    }
    seen.add(id);

    return { id, sortOrder };
  });
}

function normalizeAlbumCreate(dto: CreateAlbumDto): Prisma.AlbumCreateInput {
  return {
    coverUrl: optionalTrimmedString(dto.coverUrl),
    description: optionalTrimmedString(dto.description),
    isEnabled: dto.isEnabled ?? true,
    name: assertTrimmedString(dto.name, 'name'),
    slug: assertSlug(dto.slug),
    sortOrder: parseOptionalInteger(dto.sortOrder, 'sortOrder') ?? 0,
    status: parsePublishStatus(dto.status ?? PublishStatus.PUBLISHED),
    visibility: parseVisibility(dto.visibility ?? Visibility.PUBLIC),
  };
}

function normalizeAlbumUpdate(dto: UpdateAlbumDto): Prisma.AlbumUpdateInput {
  return {
    coverUrl: dto.coverUrl === undefined ? undefined : optionalTrimmedString(dto.coverUrl),
    description: dto.description === undefined ? undefined : optionalTrimmedString(dto.description),
    isEnabled: dto.isEnabled,
    name: dto.name === undefined ? undefined : assertTrimmedString(dto.name, 'name'),
    slug: dto.slug === undefined ? undefined : assertSlug(dto.slug),
    sortOrder: dto.sortOrder === undefined ? undefined : parseOptionalInteger(dto.sortOrder, 'sortOrder'),
    status: dto.status === undefined ? undefined : parsePublishStatus(dto.status),
    visibility: dto.visibility === undefined ? undefined : parseVisibility(dto.visibility),
  };
}

function applyAlbumFilter(where: Prisma.PhotoWhereInput, albumId: string | undefined) {
  const normalized = albumId?.trim();
  if (!normalized) {
    return;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('albumId is invalid.');
  }

  where.albumId = parsed;
}

function withPagination<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, pagination: { page, pageSize, total } };
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
  if (!/^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/i.test(slug) && !/^[a-z0-9]$/i.test(slug)) {
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

function parseRequiredPositiveInteger(value: number | undefined, field: string): number {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

function stripDeletedAt<T extends { deletedAt: Date | null }>(item: T): Omit<T, 'deletedAt'> {
  const { deletedAt: _deletedAt, ...rest } = item;
  void _deletedAt;

  return rest;
}

function normalizeVisitorId(visitorId: string | undefined): string | undefined {
  const normalized = visitorId?.trim();

  return normalized || undefined;
}

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
