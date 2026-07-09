import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Mascot, MascotLine, OperationType, Prisma, TargetType } from '@prisma/client';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMascotLineDto, UpdateMascotConfigDto, UpdateMascotLineDto } from './mascot.dto';

type MascotLineView = {
  id: number;
  key: string;
  pageKey: string;
  content: string;
  weight: number;
  isRandom: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MascotConfigView = {
  id: number;
  key: string;
  name: string;
  imageUrl: string | null;
  displayScopes: string[];
  live2dConfig: Prisma.JsonValue;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_MASCOT_KEY = 'default';
const DEFAULT_DISPLAY_SCOPES = ['*'];

@Injectable()
export class MascotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async getAdminConfig(): Promise<MascotConfigView> {
    const mascot = await this.ensureDefaultMascot();

    return toMascotConfigView(mascot);
  }

  async updateAdminConfig(
    dto: UpdateMascotConfigDto,
    adminId: number,
    ip?: string,
  ): Promise<MascotConfigView> {
    const current = await this.ensureDefaultMascot();
    const name = dto.name === undefined ? current.name : normalizeRequiredString(dto.name, 'name');
    const imageUrl = dto.imageUrl === undefined ? current.imageUrl : normalizeNullableString(dto.imageUrl);
    const displayScopes =
      dto.displayScopes === undefined ? normalizeDisplayScopes(current.displayScopes) : normalizeDisplayScopes(dto.displayScopes);
    const live2dConfig = dto.live2dConfig === undefined ? current.live2dConfig : dto.live2dConfig;
    const isEnabled = dto.isEnabled ?? current.isEnabled;

    const mascot = await this.prisma.mascot.update({
      where: { id: current.id },
      data: {
        displayScopes,
        imageUrl,
        isEnabled,
        live2dConfig: (live2dConfig ?? { reserved: true }) as Prisma.InputJsonValue,
        name,
      },
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE_SETTING,
      objectType: TargetType.MASCOT,
      objectId: mascot.key,
      ip,
      detail: {
        displayScopes,
        isEnabled,
        name,
      },
    });

    return toMascotConfigView(mascot);
  }

  async listAdminLines(): Promise<MascotLineView[]> {
    const mascot = await this.ensureDefaultMascot();
    const lines = await this.prisma.mascotLine.findMany({
      where: {
        mascotId: mascot.id,
      },
      orderBy: [{ isRandom: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    return lines.map(toMascotLineView);
  }

  async createAdminLine(
    dto: CreateMascotLineDto,
    adminId: number,
    ip?: string,
  ): Promise<MascotLineView> {
    const mascot = await this.ensureDefaultMascot();
    const line = await this.prisma.mascotLine.create({
      data: {
        content: normalizeRequiredString(dto.content, 'content'),
        isEnabled: dto.isEnabled ?? true,
        isRandom: dto.isRandom ?? false,
        key: normalizeKey(dto.key),
        mascotId: mascot.id,
        pageKey: normalizePageKey(dto.pageKey),
        sortOrder: normalizeInteger(dto.sortOrder, 0, 'sortOrder'),
        weight: normalizeInteger(dto.weight, 1, 'weight', 1),
      },
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.CREATE,
      objectType: TargetType.MASCOT,
      objectId: line.key,
      ip,
      detail: {
        isRandom: line.isRandom,
        pageKey: line.pageKey,
      },
    });

    return toMascotLineView(line);
  }

  async updateAdminLine(
    id: number,
    dto: UpdateMascotLineDto,
    adminId: number,
    ip?: string,
  ): Promise<MascotLineView> {
    await this.assertLineExists(id);
    const line = await this.prisma.mascotLine.update({
      where: { id },
      data: {
        content: dto.content === undefined ? undefined : normalizeRequiredString(dto.content, 'content'),
        isEnabled: dto.isEnabled,
        isRandom: dto.isRandom,
        pageKey: dto.pageKey === undefined ? undefined : normalizePageKey(dto.pageKey),
        sortOrder: dto.sortOrder === undefined ? undefined : normalizeInteger(dto.sortOrder, 0, 'sortOrder'),
        weight: dto.weight === undefined ? undefined : normalizeInteger(dto.weight, 1, 'weight', 1),
      },
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE,
      objectType: TargetType.MASCOT,
      objectId: line.key,
      ip,
      detail: {
        isEnabled: line.isEnabled,
        isRandom: line.isRandom,
        pageKey: line.pageKey,
      },
    });

    return toMascotLineView(line);
  }

  async deleteAdminLine(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const existing = await this.assertLineExists(id);
    await this.prisma.mascotLine.delete({
      where: { id },
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.DELETE,
      objectType: TargetType.MASCOT,
      objectId: existing.key,
      ip,
      detail: {
        pageKey: existing.pageKey,
      },
    });

    return { ok: true };
  }

  async getPublicConfig(pageKeyInput: string | undefined): Promise<{
    id: number;
    name: string;
    imageUrl: string | null;
    pageKey: string;
    pageLine: MascotLineView | null;
    randomLines: MascotLineView[];
  } | null> {
    const pageKey = normalizePageKey(pageKeyInput || 'home');
    const mascot = await this.prisma.mascot.findFirst({
      where: {
        key: DEFAULT_MASCOT_KEY,
        isEnabled: true,
      },
    });

    if (!mascot || !isPageInScopes(pageKey, normalizeDisplayScopes(mascot.displayScopes))) {
      return null;
    }

    const [pageLine, randomLines] = await Promise.all([
      this.prisma.mascotLine.findFirst({
        where: {
          mascotId: mascot.id,
          isEnabled: true,
          isRandom: false,
          pageKey: { in: [pageKey, '*'] },
        },
        orderBy: [{ pageKey: pageKey === '*' ? 'asc' : 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.mascotLine.findMany({
        where: {
          mascotId: mascot.id,
          isEnabled: true,
          isRandom: true,
          pageKey: { in: [pageKey, '*'] },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      id: mascot.id,
      imageUrl: mascot.imageUrl,
      name: mascot.name,
      pageKey,
      pageLine: pageLine ? toMascotLineView(pageLine) : null,
      randomLines: randomLines.map(toMascotLineView),
    };
  }

  private async ensureDefaultMascot(): Promise<Mascot> {
    return this.prisma.mascot.upsert({
      where: { key: DEFAULT_MASCOT_KEY },
      update: {},
      create: {
        displayScopes: DEFAULT_DISPLAY_SCOPES,
        imageUrl: '/uploads/site/mascot/placeholder.png',
        isEnabled: true,
        key: DEFAULT_MASCOT_KEY,
        live2dConfig: { reserved: true },
        name: '默认看板娘',
      },
    });
  }

  private async assertLineExists(id: number): Promise<MascotLine> {
    const line = await this.prisma.mascotLine.findUnique({
      where: { id },
    });

    if (!line) {
      throw new NotFoundException('Mascot line not found.');
    }

    return line;
  }
}

function toMascotConfigView(mascot: Mascot): MascotConfigView {
  return {
    createdAt: mascot.createdAt,
    displayScopes: normalizeDisplayScopes(mascot.displayScopes),
    id: mascot.id,
    imageUrl: mascot.imageUrl,
    isEnabled: mascot.isEnabled,
    key: mascot.key,
    live2dConfig: mascot.live2dConfig,
    name: mascot.name,
    updatedAt: mascot.updatedAt,
  };
}

function toMascotLineView(line: MascotLine): MascotLineView {
  return {
    content: line.content,
    createdAt: line.createdAt,
    id: line.id,
    isEnabled: line.isEnabled,
    isRandom: line.isRandom,
    key: line.key,
    pageKey: line.pageKey,
    sortOrder: line.sortOrder,
    updatedAt: line.updatedAt,
    weight: line.weight,
  };
}

function normalizeRequiredString(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BadRequestException(`${field} is required.`);
  }

  return normalized;
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized || null;
}

function normalizeDisplayScopes(value: Prisma.JsonValue | string[] | undefined | null): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_DISPLAY_SCOPES;
  }

  const scopes: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      scopes.push(normalizePageKey(item));
    }
  }

  return Array.from(new Set(scopes));
}

function normalizePageKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestException('pageKey is required.');
  }

  return normalized.slice(0, 80);
}

function normalizeKey(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized) {
    return normalized.slice(0, 80);
  }

  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeInteger(value: number | undefined, fallback: number, field: string, min?: number): number {
  const numericValue = value ?? fallback;
  if (!Number.isInteger(numericValue) || (min !== undefined && numericValue < min)) {
    throw new BadRequestException(`${field} is invalid.`);
  }

  return numericValue;
}

function isPageInScopes(pageKey: string, scopes: string[]): boolean {
  return scopes.includes('*') || scopes.includes(pageKey);
}
