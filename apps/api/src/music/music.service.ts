import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Music, OperationType, Prisma, TargetType } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMusicDto, UpdateMusicDto } from './music.dto';

type MusicView = Omit<Music, 'deletedAt'>;

@Injectable()
export class MusicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listPublic(): Promise<MusicView[]> {
    const items = await this.prisma.music.findMany({
      where: {
        deletedAt: null,
        isEnabled: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map(stripDeletedAt);
  }

  async listAdmin(query: PaginationQuery): Promise<{
    items: MusicView[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const pagination = parsePagination(query);
    const where: Prisma.MusicWhereInput = {
      deletedAt: null,
    };

    if (pagination.search) {
      where.OR = [
        { title: { contains: pagination.search } },
        { artist: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.music.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.music.count({ where }),
    ]);

    return {
      items: items.map(stripDeletedAt),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      },
    };
  }

  async createAdmin(dto: CreateMusicDto, adminId: number, ip?: string): Promise<MusicView> {
    const data = normalizeCreatePayload(dto);
    const music = await this.prisma.music.create({
      data,
    });

    await this.operationLogService.write({
      action: OperationType.CREATE,
      adminId,
      detail: {
        artist: music.artist,
        title: music.title,
      },
      ip,
      objectId: String(music.id),
      objectType: TargetType.MUSIC,
    });

    return stripDeletedAt(music);
  }

  async updateAdmin(id: number, dto: UpdateMusicDto, adminId: number, ip?: string): Promise<MusicView> {
    const current = await this.findExistingMusic(id);
    const data = normalizeUpdatePayload(current, dto);
    const music = await this.prisma.music.update({
      where: { id },
      data,
    });

    await this.operationLogService.write({
      action: OperationType.UPDATE,
      adminId,
      detail: {
        artist: music.artist,
        isEnabled: music.isEnabled,
        title: music.title,
      },
      ip,
      objectId: String(music.id),
      objectType: TargetType.MUSIC,
    });

    return stripDeletedAt(music);
  }

  async deleteAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const music = await this.findExistingMusic(id);
    const deletedAt = new Date();

    await this.prisma.music.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(music.id),
        objectType: TargetType.MUSIC,
        snapshot: toJsonObject(music),
        summary: music.artist,
        title: music.title,
      },
    });
    await this.operationLogService.write({
      action: OperationType.DELETE,
      adminId,
      detail: {
        artist: music.artist,
        title: music.title,
      },
      ip,
      objectId: String(music.id),
      objectType: TargetType.MUSIC,
    });

    return { ok: true };
  }

  private async findExistingMusic(id: number): Promise<Music> {
    const music = await this.prisma.music.findFirst({
      where: {
        deletedAt: null,
        id,
      },
    });

    if (!music) {
      throw new NotFoundException('Music not found.');
    }

    return music;
  }
}

function normalizeCreatePayload(dto: CreateMusicDto): Prisma.MusicCreateInput {
  const localUrl = optionalTrimmedString(dto.localUrl) ?? null;
  const externalUrl = optionalTrimmedString(dto.externalUrl) ?? null;
  assertAudioSource(localUrl, externalUrl);

  return {
    artist: assertTrimmedString(dto.artist, 'artist'),
    externalUrl,
    isEnabled: dto.isEnabled ?? true,
    localUrl,
    lyricFileUrl: optionalTrimmedString(dto.lyricFileUrl) ?? null,
    lyricText: optionalTrimmedString(dto.lyricText) ?? null,
    sortOrder: parseInteger(dto.sortOrder, 0, 'sortOrder'),
    title: assertTrimmedString(dto.title, 'title'),
  };
}

function normalizeUpdatePayload(current: Music, dto: UpdateMusicDto): Prisma.MusicUpdateInput {
  const localUrl = dto.localUrl === undefined ? current.localUrl : optionalTrimmedString(dto.localUrl) ?? null;
  const externalUrl = dto.externalUrl === undefined ? current.externalUrl : optionalTrimmedString(dto.externalUrl) ?? null;
  assertAudioSource(localUrl, externalUrl);

  return {
    artist: dto.artist === undefined ? undefined : assertTrimmedString(dto.artist, 'artist'),
    externalUrl,
    isEnabled: dto.isEnabled,
    localUrl,
    lyricFileUrl: dto.lyricFileUrl === undefined ? undefined : optionalTrimmedString(dto.lyricFileUrl),
    lyricText: dto.lyricText === undefined ? undefined : optionalTrimmedString(dto.lyricText),
    sortOrder: dto.sortOrder === undefined ? undefined : parseInteger(dto.sortOrder, 0, 'sortOrder'),
    title: dto.title === undefined ? undefined : assertTrimmedString(dto.title, 'title'),
  };
}

function assertAudioSource(localUrl: string | null, externalUrl: string | null): void {
  if (!localUrl && !externalUrl) {
    throw new BadRequestException('localUrl or externalUrl is required.');
  }
}

function assertTrimmedString(value: string | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return value.trim() || null;
}

function parseInteger(value: number | undefined, fallback: number, field: string): number {
  const normalized = value ?? fallback;
  if (!Number.isInteger(normalized)) {
    throw new BadRequestException(`${field} is invalid.`);
  }

  return normalized;
}

function stripDeletedAt({ deletedAt: _deletedAt, ...music }: Music): MusicView {
  void _deletedAt;

  return music;
}

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}
