import { NotFoundException } from '@nestjs/common';
import { PublishStatus, Visibility } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PhotoService } from '../src/photos/photo.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  $transaction: jest.Mock;
  album: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  photo: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  like: {
    count: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    groupBy: jest.Mock;
  };
  recycleBinItem: {
    create: jest.Mock;
  };
};

describe('PhotoService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: PhotoService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
      album: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      like: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        groupBy: jest.fn(),
      },
      photo: {
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
    service = new PhotoService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists public photos with visibility and album filtering', async () => {
    prisma.photo.findMany.mockResolvedValue([photoRecord({ id: 1 })]);
    prisma.photo.count.mockResolvedValue(1);
    prisma.like.groupBy.mockResolvedValue([{ _count: { _all: 2 }, targetId: '1' }]);
    prisma.like.findMany.mockResolvedValue([{ targetId: '1' }]);

    const result = await service.listPublicPhotos({ albumId: '3', page: 1, pageSize: 10 }, 'visitor-1');

    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          albumId: 3,
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({ id: 1, likeCount: 2, liked: true });
  });

  it('lists admin albums with pagination', async () => {
    prisma.album.findMany.mockResolvedValue([albumRecord({ id: 1 }), albumRecord({ id: 2 })]);
    prisma.album.count.mockResolvedValue(2);

    const result = await service.listAdminAlbums({ page: 1, pageSize: 10 });

    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 10, total: 2 });
    expect(result.items).toHaveLength(2);
  });

  it('does not like missing or private photos', async () => {
    prisma.photo.findFirst.mockResolvedValue(null);

    await expect(service.togglePublicLike(1, 'visitor-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates albums, creates photos, deletes photos to recycle bin, and toggles likes', async () => {
    prisma.album.create.mockResolvedValue(albumRecord({ id: 3 }));
    operationLogService.write.mockResolvedValue(undefined);

    await expect(service.createAlbumAdmin({ name: 'Spring', slug: 'spring' }, 1)).resolves.toMatchObject({
      id: 3,
      name: 'Spring',
    });

    prisma.album.findFirst.mockResolvedValue(albumRecord({ id: 3 }));
    prisma.photo.create.mockResolvedValue(photoRecord({ id: 20 }));
    prisma.like.groupBy.mockResolvedValue([]);

    await expect(
      service.createPhotoAdmin(
        {
          albumId: 3,
          originalUrl: '/uploads/photos/original/2026/06/photo.jpg',
          title: 'Photo',
        },
        1,
      ),
    ).resolves.toMatchObject({ id: 20, title: 'Photo' });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', objectType: 'PHOTO', objectId: '20' }),
    );

    prisma.photo.findFirst.mockResolvedValue(photoRecord({ id: 20 }));
    prisma.photo.update.mockResolvedValue({ ...photoRecord({ id: 20 }), deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(service.deletePhotoAdmin(20, 1)).resolves.toEqual({ ok: true });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ objectId: '20', objectType: 'PHOTO' }) }),
    );

    prisma.photo.findFirst.mockResolvedValue(photoRecord({ id: 20 }));
    prisma.like.findUnique.mockResolvedValue(null);
    prisma.like.create.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(1);

    await expect(service.togglePublicLike(20, 'visitor-1')).resolves.toEqual({ likeCount: 1, liked: true });
  });

  it('sorts admin photos and writes an operation log', async () => {
    prisma.photo.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.photo.update.mockResolvedValue({ id: 2 });

    await expect(
      service.sortPhotosAdmin(
        {
          items: [
            { id: 2, sortOrder: 0 },
            { id: 1, sortOrder: 1 },
          ],
        },
        1,
      ),
    ).resolves.toEqual({ ok: true });

    expect(prisma.photo.update).toHaveBeenNthCalledWith(1, {
      data: { sortOrder: 0 },
      select: { id: true },
      where: { id: 2 },
    });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        detail: expect.objectContaining({ action: 'reorder' }),
        objectId: 'sort',
        objectType: 'PHOTO',
      }),
    );
  });
});

function albumRecord(overrides: Partial<{ id: number; name: string }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    coverUrl: null,
    createdAt: now,
    deletedAt: null,
    description: null,
    id: overrides.id ?? 1,
    isEnabled: true,
    name: overrides.name ?? 'Spring',
    slug: 'spring',
    sortOrder: 0,
    status: PublishStatus.PUBLISHED,
    updatedAt: now,
    visibility: Visibility.PUBLIC,
  };
}

function photoRecord(overrides: Partial<{ id: number; title: string }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    album: { id: 3, name: 'Spring', slug: 'spring' },
    albumId: 3,
    createdAt: now,
    deletedAt: null,
    description: null,
    id: overrides.id ?? 1,
    largeUrl: '/uploads/photos/large/2026/06/photo.jpg',
    originalUrl: '/uploads/photos/original/2026/06/photo.jpg',
    sortOrder: 0,
    status: PublishStatus.PUBLISHED,
    thumbUrl: '/uploads/photos/thumb/2026/06/photo.jpg',
    title: overrides.title ?? 'Photo',
    updatedAt: now,
    visibility: Visibility.PUBLIC,
  };
}
