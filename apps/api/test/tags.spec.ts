import { BadRequestException } from '@nestjs/common';
import { TargetType } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TagService } from '../src/tags/tag.service';

type PrismaMock = {
  tag: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  recycleBinItem: {
    create: jest.Mock;
  };
};

describe('TagService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: TagService;

  beforeEach(() => {
    prisma = {
      recycleBinItem: {
        create: jest.fn(),
      },
      tag: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new TagService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists admin tags with scope and status filters', async () => {
    prisma.tag.findMany.mockResolvedValue([tagRecord({ id: 1 })]);
    prisma.tag.count.mockResolvedValue(1);

    const result = await service.listAdmin({
      isEnabled: 'true',
      page: 1,
      pageSize: 10,
      scope: TargetType.THOUGHT,
      search: 'daily',
    });

    expect(prisma.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          scopes: { some: { targetType: TargetType.THOUGHT } },
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 1,
      scopes: [TargetType.THOUGHT],
    });
  });

  it('lists only enabled public tags for a scope', async () => {
    prisma.tag.findMany.mockResolvedValue([tagRecord({ id: 2, scopes: [TargetType.ESSAY] })]);

    await expect(service.listPublic(TargetType.ESSAY)).resolves.toMatchObject([
      { id: 2, scopes: [TargetType.ESSAY] },
    ]);
    expect(prisma.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          scopes: { some: { targetType: TargetType.ESSAY } },
        },
      }),
    );
  });

  it('creates and updates tags with scopes and operation logs', async () => {
    prisma.tag.create.mockResolvedValue(tagRecord({ id: 3, scopes: [TargetType.THOUGHT, TargetType.ESSAY] }));
    prisma.tag.findUnique.mockResolvedValue(tagRecord({ id: 3 }));
    prisma.tag.update.mockResolvedValue(tagRecord({ id: 3, scopes: [TargetType.ESSAY] }));
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      service.createAdmin(
        {
          color: '#c45b80',
          name: '日常',
          scopes: [TargetType.THOUGHT, TargetType.ESSAY],
          slug: 'daily',
        },
        1,
      ),
    ).resolves.toMatchObject({ id: 3, scopes: [TargetType.THOUGHT, TargetType.ESSAY] });
    expect(prisma.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopes: {
            create: [{ targetType: TargetType.THOUGHT }, { targetType: TargetType.ESSAY }],
          },
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', objectType: 'TAG', objectId: '3' }),
    );

    await expect(
      service.updateAdmin(
        3,
        {
          isEnabled: true,
          name: '日常更新',
          scopes: [TargetType.ESSAY],
          slug: 'daily-updated',
        },
        1,
      ),
    ).resolves.toMatchObject({ id: 3, scopes: [TargetType.ESSAY] });
    expect(prisma.tag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopes: {
            create: [{ targetType: TargetType.ESSAY }],
            deleteMany: {},
          },
        }),
      }),
    );
  });

  it('disables deleted tags and writes a recycle-bin record', async () => {
    prisma.tag.findUnique.mockResolvedValue(tagRecord({ id: 4 }));
    prisma.tag.update.mockResolvedValue(tagRecord({ id: 4 }));
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(service.deleteAdmin(4, 1)).resolves.toEqual({ ok: true });
    expect(prisma.tag.update).toHaveBeenCalledWith({
      data: { isEnabled: false },
      where: { id: 4 },
    });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectId: '4',
          objectType: 'TAG',
          title: '日常',
        }),
      }),
    );
  });

  it('rejects unsupported scopes', async () => {
    await expect(
      service.createAdmin(
        {
          name: '音乐',
          scopes: [TargetType.MUSIC],
          slug: 'music',
        },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function tagRecord(overrides: Partial<{ id: number; scopes: TargetType[] }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    color: '#c45b80',
    createdAt: now,
    id: overrides.id ?? 1,
    isEnabled: true,
    name: '日常',
    scopes: (overrides.scopes ?? [TargetType.THOUGHT]).map((targetType) => ({ targetType })),
    slug: 'daily',
    updatedAt: now,
  };
}
