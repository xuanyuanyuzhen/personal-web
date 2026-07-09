import { BadRequestException } from '@nestjs/common';
import { OperationType, TargetType } from '@prisma/client';
import { MusicService } from '../src/music/music.service';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  music: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  recycleBinItem: {
    create: jest.Mock;
  };
};

describe('MusicService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: MusicService;

  beforeEach(() => {
    prisma = {
      music: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      recycleBinItem: {
        create: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new MusicService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists enabled public music and strips deletedAt', async () => {
    prisma.music.findMany.mockResolvedValue([musicRecord({ id: 1, title: '春日散步' })]);

    const result = await service.listPublic();

    expect(prisma.music.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      where: {
        deletedAt: null,
        isEnabled: true,
      },
    });
    expect(result[0]).toMatchObject({ id: 1, title: '春日散步' });
    expect(result[0]).not.toHaveProperty('deletedAt');
  });

  it('lists admin music with pagination and search', async () => {
    prisma.music.findMany.mockResolvedValue([musicRecord({ id: 2, title: '夏日回声' })]);
    prisma.music.count.mockResolvedValue(1);

    const result = await service.listAdmin({ page: '2', pageSize: '20', search: '夏日' });

    expect(prisma.music.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: expect.objectContaining({
          deletedAt: null,
          OR: [{ title: { contains: '夏日' } }, { artist: { contains: '夏日' } }],
        }),
      }),
    );
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 1 });
  });

  it('rejects saving music without a local or external source', async () => {
    await expect(
      service.createAdmin(
        {
          artist: '语尔',
          title: '无声片段',
        },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.music.create).not.toHaveBeenCalled();

    prisma.music.findFirst.mockResolvedValue(musicRecord({ externalUrl: null, localUrl: '/uploads/music/old.mp3' }));
    await expect(service.updateAdmin(1, { externalUrl: '', localUrl: '' }, 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.music.update).not.toHaveBeenCalled();
  });

  it('creates and updates music with operation logs', async () => {
    prisma.music.create.mockResolvedValue(musicRecord({ id: 10, localUrl: '/uploads/music/spring.mp3' }));

    await expect(
      service.createAdmin(
        {
          artist: ' 语尔 ',
          localUrl: ' /uploads/music/spring.mp3 ',
          sortOrder: 5,
          title: ' 春日散步 ',
        },
        1,
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 10 });
    expect(prisma.music.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artist: '语尔',
        externalUrl: null,
        localUrl: '/uploads/music/spring.mp3',
        sortOrder: 5,
        title: '春日散步',
      }),
    });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.CREATE,
        adminId: 1,
        objectId: '10',
        objectType: TargetType.MUSIC,
      }),
    );

    prisma.music.findFirst.mockResolvedValue(musicRecord({ id: 10, localUrl: '/uploads/music/spring.mp3' }));
    prisma.music.update.mockResolvedValue(
      musicRecord({
        externalUrl: 'https://cdn.example.com/night.mp3',
        id: 10,
        isEnabled: false,
        localUrl: null,
        title: '夜晚散步',
      }),
    );

    await expect(
      service.updateAdmin(
        10,
        {
          externalUrl: ' https://cdn.example.com/night.mp3 ',
          isEnabled: false,
          localUrl: '',
          title: '夜晚散步',
        },
        2,
      ),
    ).resolves.toMatchObject({ externalUrl: 'https://cdn.example.com/night.mp3', isEnabled: false });
    expect(prisma.music.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalUrl: 'https://cdn.example.com/night.mp3',
        isEnabled: false,
        localUrl: null,
        title: '夜晚散步',
      }),
      where: { id: 10 },
    });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.UPDATE,
        adminId: 2,
        objectId: '10',
        objectType: TargetType.MUSIC,
      }),
    );
  });

  it('soft deletes music into recycle bin and writes a delete log', async () => {
    const music = musicRecord({ id: 15, title: '旧唱片' });
    prisma.music.findFirst.mockResolvedValue(music);
    prisma.music.update.mockResolvedValue({ ...music, deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(service.deleteAdmin(15, 3, '127.0.0.1')).resolves.toEqual({ ok: true });

    expect(prisma.music.update).toHaveBeenCalledWith({
      data: { deletedAt: expect.any(Date) },
      where: { id: 15 },
    });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedById: 3,
          objectId: '15',
          objectType: TargetType.MUSIC,
          title: '旧唱片',
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: OperationType.DELETE,
        adminId: 3,
        objectId: '15',
        objectType: TargetType.MUSIC,
      }),
    );
  });
});

function musicRecord(overrides: Record<string, unknown> = {}) {
  return {
    artist: '语尔',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
    externalUrl: null,
    id: 1,
    isEnabled: true,
    localUrl: '/uploads/music/song.mp3',
    lyricFileUrl: null,
    lyricText: '[00:00.00]春日散步',
    sortOrder: 0,
    title: '春日散步',
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}
