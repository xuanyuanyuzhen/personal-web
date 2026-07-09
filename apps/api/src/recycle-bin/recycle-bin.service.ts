import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationType, Prisma, RecycleStatus, TargetType } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';

type RecycleBinQuery = PaginationQuery & {
  objectType?: string;
};

const recycleInclude = {
  deletedBy: {
    select: {
      displayName: true,
      id: true,
      username: true,
    },
  },
} satisfies Prisma.RecycleBinItemInclude;

@Injectable()
export class RecycleBinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async list(query: RecycleBinQuery) {
    const pagination = parsePagination(query);
    const objectType = parseTargetType(query.objectType);
    const where: Prisma.RecycleBinItemWhereInput = {
      status: RecycleStatus.ACTIVE,
    };

    if (objectType) {
      where.objectType = objectType;
    }
    if (pagination.search) {
      where.OR = [
        { title: { contains: pagination.search } },
        { summary: { contains: pagination.search } },
        { objectId: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.recycleBinItem.findMany({
        where,
        include: recycleInclude,
        orderBy: [{ deletedAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.recycleBinItem.count({ where }),
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

  async restore(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const item = await this.findActiveItem(id);
    await this.restoreTarget(item.objectType, item.objectId);
    await this.prisma.recycleBinItem.update({
      where: { id },
      data: {
        restoredAt: new Date(),
        status: RecycleStatus.RESTORED,
      },
    });
    await this.operationLogService.write({
      action: OperationType.RESTORE,
      adminId,
      detail: {
        recycleBinItemId: item.id,
        title: item.title,
      },
      ip,
      objectId: item.objectId,
      objectType: item.objectType,
    });

    return { ok: true };
  }

  async purge(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const item = await this.findActiveItem(id);
    await this.purgeTarget(item.objectType, item.objectId);
    await this.prisma.recycleBinItem.update({
      where: { id },
      data: {
        purgedAt: new Date(),
        status: RecycleStatus.PURGED,
      },
    });
    await this.operationLogService.write({
      action: OperationType.PERMANENT_DELETE,
      adminId,
      detail: {
        recycleBinItemId: item.id,
        title: item.title,
      },
      ip,
      objectId: item.objectId,
      objectType: item.objectType,
    });

    return { ok: true };
  }

  private async findActiveItem(id: number) {
    const item = await this.prisma.recycleBinItem.findFirst({
      where: {
        id,
        status: RecycleStatus.ACTIVE,
      },
    });

    if (!item) {
      throw new NotFoundException('Recycle bin item not found.');
    }

    return item;
  }

  private async restoreTarget(objectType: TargetType, objectId: string) {
    const id = parseObjectId(objectId);

    switch (objectType) {
      case TargetType.NAVIGATION:
        await this.prisma.navigation.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.PAGE:
        await this.prisma.customPage.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.THOUGHT:
        await this.prisma.thought.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.ESSAY:
        await this.prisma.essay.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.PHOTO:
        await this.prisma.photo.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.MESSAGE:
        await this.prisma.message.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.COMMENT:
        await this.prisma.comment.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.MUSIC:
        await this.prisma.music.update({ where: { id }, data: { deletedAt: null } });
        return;
      case TargetType.TAG:
        await this.prisma.tag.update({ where: { id }, data: { isEnabled: true } });
        return;
      case TargetType.ALBUM:
        await this.prisma.album.update({ where: { id }, data: { deletedAt: null, isEnabled: true } });
        return;
      case TargetType.ESSAY_CATEGORY:
        await this.prisma.essayCategory.update({ where: { id }, data: { isEnabled: true } });
        return;
      default:
        throw new BadRequestException(`Restore is not supported for ${objectType}.`);
    }
  }

  private async purgeTarget(objectType: TargetType, objectId: string) {
    const id = parseObjectId(objectId);

    switch (objectType) {
      case TargetType.NAVIGATION:
        await this.prisma.navigation.delete({ where: { id } });
        return;
      case TargetType.PAGE:
        await this.prisma.customPage.delete({ where: { id } });
        return;
      case TargetType.THOUGHT:
        await this.prisma.thought.delete({ where: { id } });
        return;
      case TargetType.ESSAY:
        await this.prisma.essay.delete({ where: { id } });
        return;
      case TargetType.PHOTO:
        await this.prisma.photo.delete({ where: { id } });
        return;
      case TargetType.MESSAGE:
        await this.prisma.message.delete({ where: { id } });
        return;
      case TargetType.COMMENT:
        await this.prisma.comment.delete({ where: { id } });
        return;
      case TargetType.MUSIC:
        await this.prisma.music.delete({ where: { id } });
        return;
      case TargetType.TAG:
        await this.prisma.tag.delete({ where: { id } });
        return;
      case TargetType.ALBUM:
        await this.prisma.album.delete({ where: { id } });
        return;
      case TargetType.ESSAY_CATEGORY:
        await this.prisma.essayCategory.delete({ where: { id } });
        return;
      default:
        throw new BadRequestException(`Permanent delete is not supported for ${objectType}.`);
    }
  }
}

function parseTargetType(value: string | undefined): TargetType | undefined {
  if (!value) {
    return undefined;
  }

  if (!Object.values(TargetType).includes(value as TargetType)) {
    throw new BadRequestException('objectType is invalid.');
  }

  return value as TargetType;
}

function parseObjectId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new BadRequestException('objectId is invalid.');
  }

  return id;
}
