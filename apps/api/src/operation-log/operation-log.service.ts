import { Injectable } from '@nestjs/common';
import { OperationType, Prisma, TargetType } from '@prisma/client';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_RETENTION_DAYS = 90;

type WriteLogInput = {
  adminId?: number;
  action: OperationType;
  objectType?: TargetType;
  objectId?: string;
  ip?: string;
  detail?: Prisma.InputJsonObject;
};

type OperationLogQuery = PaginationQuery & {
  action?: string;
  objectType?: string;
};

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: WriteLogInput): Promise<void> {
    await this.prisma.operationLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        ip: input.ip,
        detail: input.detail,
      },
    });
  }

  async list(query: OperationLogQuery) {
    await this.cleanupExpired();
    const pagination = parsePagination(query);
    const where: Prisma.OperationLogWhereInput = {};
    const action = parseOperationType(query.action);
    const objectType = parseTargetType(query.objectType);

    if (action) {
      where.action = action;
    }
    if (objectType) {
      where.objectType = objectType;
    }
    if (pagination.search) {
      where.OR = [
        { objectId: { contains: pagination.search } },
        { ip: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        include: {
          admin: {
            select: {
              displayName: true,
              id: true,
              username: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.operationLog.count({ where }),
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

  async cleanupExpired(retentionDays = readRetentionDays()): Promise<{ count: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    return this.prisma.operationLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });
  }
}

function parseOperationType(value: string | undefined): OperationType | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(OperationType).includes(value as OperationType) ? (value as OperationType) : undefined;
}

function parseTargetType(value: string | undefined): TargetType | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(TargetType).includes(value as TargetType) ? (value as TargetType) : undefined;
}

function readRetentionDays(): number {
  const configured = Number(process.env.OPERATION_LOG_RETENTION_DAYS);

  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS;
}
