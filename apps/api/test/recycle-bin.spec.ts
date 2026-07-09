import { OperationType, RecycleStatus, TargetType } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RecycleBinService } from '../src/recycle-bin/recycle-bin.service';

type PrismaMock = {
  album: { delete: jest.Mock; update: jest.Mock };
  comment: { delete: jest.Mock; update: jest.Mock };
  customPage: { delete: jest.Mock; update: jest.Mock };
  essay: { delete: jest.Mock; update: jest.Mock };
  essayCategory: { delete: jest.Mock; update: jest.Mock };
  message: { delete: jest.Mock; update: jest.Mock };
  music: { delete: jest.Mock; update: jest.Mock };
  navigation: { delete: jest.Mock; update: jest.Mock };
  operationLog: {
    count: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
  };
  photo: { delete: jest.Mock; update: jest.Mock };
  recycleBinItem: {
    count: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  tag: { delete: jest.Mock; update: jest.Mock };
  thought: { delete: jest.Mock; update: jest.Mock };
};

describe('RecycleBinService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: RecycleBinService;

  beforeEach(() => {
    prisma = createPrismaMock();
    operationLogService = { write: jest.fn() };
    service = new RecycleBinService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists active recycle-bin items with type filtering and pagination', async () => {
    prisma.recycleBinItem.findMany.mockResolvedValue([recycleItem({ objectType: TargetType.THOUGHT })]);
    prisma.recycleBinItem.count.mockResolvedValue(1);

    const result = await service.list({ objectType: 'THOUGHT', page: '1', pageSize: '10', search: '春日' });

    expect(prisma.recycleBinItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          deletedBy: expect.any(Object),
        }),
        where: expect.objectContaining({
          objectType: TargetType.THOUGHT,
          status: RecycleStatus.ACTIVE,
        }),
      }),
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 10, total: 1 });
  });

  it('restores soft-deleted content and writes a restore log', async () => {
    prisma.recycleBinItem.findFirst.mockResolvedValue(recycleItem({ objectId: '12', objectType: TargetType.THOUGHT }));
    prisma.recycleBinItem.update.mockResolvedValue(recycleItem({ status: RecycleStatus.RESTORED }));
    prisma.thought.update.mockResolvedValue({ id: 12 });

    await expect(service.restore(1, 2, '127.0.0.1')).resolves.toEqual({ ok: true });

    expect(prisma.thought.update).toHaveBeenCalledWith({
      data: { deletedAt: null },
      where: { id: 12 },
    });
    expect(prisma.recycleBinItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RecycleStatus.RESTORED }),
        where: { id: 1 },
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.RESTORE,
        adminId: 2,
        objectId: '12',
        objectType: TargetType.THOUGHT,
      }),
    );
  });

  it('permanently deletes targets and writes a permanent delete log', async () => {
    prisma.recycleBinItem.findFirst.mockResolvedValue(recycleItem({ objectId: '8', objectType: TargetType.TAG }));
    prisma.recycleBinItem.update.mockResolvedValue(recycleItem({ status: RecycleStatus.PURGED }));
    prisma.tag.delete.mockResolvedValue({ id: 8 });

    await expect(service.purge(1, 3, '127.0.0.1')).resolves.toEqual({ ok: true });

    expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 8 } });
    expect(prisma.recycleBinItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RecycleStatus.PURGED }),
        where: { id: 1 },
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.PERMANENT_DELETE,
        adminId: 3,
        objectId: '8',
        objectType: TargetType.TAG,
      }),
    );
  });
});

describe('OperationLogService', () => {
  it('cleans expired logs before listing operation logs', async () => {
    const prisma = createPrismaMock();
    prisma.operationLog.deleteMany.mockResolvedValue({ count: 2 });
    prisma.operationLog.findMany.mockResolvedValue([operationLog()]);
    prisma.operationLog.count.mockResolvedValue(1);
    const service = new OperationLogService(prisma as unknown as PrismaService);

    const result = await service.list({ action: 'DELETE', objectType: 'THOUGHT', page: '1', pageSize: '20' });

    expect(prisma.operationLog.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.operationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ admin: expect.any(Object) }),
        where: expect.objectContaining({
          action: OperationType.DELETE,
          objectType: TargetType.THOUGHT,
        }),
      }),
    );
    expect(result.pagination.total).toBe(1);
  });
});

function createPrismaMock(): PrismaMock {
  return {
    album: { delete: jest.fn(), update: jest.fn() },
    comment: { delete: jest.fn(), update: jest.fn() },
    customPage: { delete: jest.fn(), update: jest.fn() },
    essay: { delete: jest.fn(), update: jest.fn() },
    essayCategory: { delete: jest.fn(), update: jest.fn() },
    message: { delete: jest.fn(), update: jest.fn() },
    music: { delete: jest.fn(), update: jest.fn() },
    navigation: { delete: jest.fn(), update: jest.fn() },
    operationLog: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    photo: { delete: jest.fn(), update: jest.fn() },
    recycleBinItem: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tag: { delete: jest.fn(), update: jest.fn() },
    thought: { delete: jest.fn(), update: jest.fn() },
  };
}

function recycleItem(overrides: Record<string, unknown> = {}) {
  return {
    deletedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedById: 1,
    id: 1,
    objectId: '1',
    objectType: TargetType.THOUGHT,
    purgedAt: null,
    restoredAt: null,
    snapshot: null,
    status: RecycleStatus.ACTIVE,
    summary: '摘要',
    title: '春日记录',
    ...overrides,
  };
}

function operationLog(overrides: Record<string, unknown> = {}) {
  return {
    action: OperationType.DELETE,
    admin: { displayName: '管理员', id: 1, username: 'admin' },
    adminId: 1,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    detail: { title: '春日记录' },
    id: 1,
    ip: '127.0.0.1',
    objectId: '1',
    objectType: TargetType.THOUGHT,
    ...overrides,
  };
}
