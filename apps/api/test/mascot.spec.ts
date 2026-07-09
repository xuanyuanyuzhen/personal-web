import { OperationType, TargetType } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MascotService } from '../src/mascot/mascot.service';

type PrismaMock = {
  mascot: {
    findFirst: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
  };
  mascotLine: {
    create: jest.Mock;
    delete: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('MascotService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: MascotService;

  beforeEach(() => {
    prisma = {
      mascot: {
        findFirst: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      mascotLine: {
        create: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new MascotService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('returns null when the mascot is disabled for the current page scope', async () => {
    prisma.mascot.findFirst.mockResolvedValue({
      displayScopes: ['home'],
      id: 1,
      imageUrl: '/mascot.png',
      isEnabled: true,
      name: '默认看板娘',
    });

    await expect(service.getPublicConfig('photos')).resolves.toBeNull();
    expect(prisma.mascotLine.findFirst).not.toHaveBeenCalled();
  });

  it('returns the matching page line and enabled random pool for public config', async () => {
    prisma.mascot.findFirst.mockResolvedValue({
      displayScopes: ['*'],
      id: 1,
      imageUrl: '/mascot.png',
      isEnabled: true,
      name: '默认看板娘',
    });
    prisma.mascotLine.findFirst.mockResolvedValue(makeLine({ content: '首页台词', id: 1, isRandom: false }));
    prisma.mascotLine.findMany.mockResolvedValue([makeLine({ content: '随机台词', id: 2, isRandom: true })]);

    const result = await service.getPublicConfig('home');

    expect(result?.pageKey).toBe('home');
    expect(result?.pageLine?.content).toBe('首页台词');
    expect(result?.randomLines).toHaveLength(1);
    expect(prisma.mascotLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          isRandom: true,
          pageKey: { in: ['home', '*'] },
        }),
      }),
    );
  });

  it('updates config and writes an operation log', async () => {
    prisma.mascot.upsert.mockResolvedValue(makeMascot());
    prisma.mascot.update.mockResolvedValue(
      makeMascot({
        displayScopes: ['home', 'thoughts'],
        isEnabled: false,
        name: '新看板娘',
      }),
    );

    const result = await service.updateAdminConfig(
      {
        displayScopes: ['home', 'thoughts'],
        isEnabled: false,
        name: '新看板娘',
      },
      1,
      '127.0.0.1',
    );

    expect(result.name).toBe('新看板娘');
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.UPDATE_SETTING,
        adminId: 1,
        objectId: 'default',
        objectType: TargetType.MASCOT,
      }),
    );
  });

  it('creates page and random lines with operation logs', async () => {
    prisma.mascot.upsert.mockResolvedValue(makeMascot());
    prisma.mascotLine.create.mockResolvedValue(makeLine({ content: '新台词', id: 3, isRandom: true }));

    const result = await service.createAdminLine(
      {
        content: '新台词',
        isRandom: true,
        pageKey: '*',
        weight: 3,
      },
      1,
    );

    expect(result.isRandom).toBe(true);
    expect(prisma.mascotLine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRandom: true,
          pageKey: '*',
          weight: 3,
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.CREATE,
        objectType: TargetType.MASCOT,
      }),
    );
  });
});

function makeMascot(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date(),
    displayScopes: ['*'],
    id: 1,
    imageUrl: '/uploads/site/mascot/placeholder.png',
    isEnabled: true,
    key: 'default',
    live2dConfig: { reserved: true },
    name: '默认看板娘',
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    content: '台词',
    createdAt: new Date(),
    id: 1,
    isEnabled: true,
    isRandom: false,
    key: 'line-1',
    mascotId: 1,
    pageKey: 'home',
    sortOrder: 0,
    updatedAt: new Date(),
    weight: 1,
    ...overrides,
  };
}
