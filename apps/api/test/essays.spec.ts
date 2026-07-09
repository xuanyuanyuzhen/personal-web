import { NotFoundException } from '@nestjs/common';
import { PublishStatus, Visibility } from '@prisma/client';
import { EssayService } from '../src/essays/essay.service';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  essay: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  essayCategory: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  tag: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  tagScope: {
    upsert: jest.Mock;
  };
  tagRelation: {
    create: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
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

describe('EssayService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: EssayService;

  beforeEach(() => {
    prisma = {
      essay: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      essayCategory: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
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
      recycleBinItem: {
        create: jest.fn(),
      },
      tag: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      tagRelation: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      tagScope: {
        upsert: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new EssayService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists only published public essays and attaches category, tags, and like state', async () => {
    prisma.essay.findMany.mockResolvedValue([essayRecord({ id: 1 })]);
    prisma.essay.count.mockResolvedValue(1);
    prisma.tagRelation.findMany.mockResolvedValue([
      {
        tag: { color: null, id: 2, name: '日常', slug: 'daily' },
        targetId: '1',
      },
    ]);
    prisma.like.groupBy.mockResolvedValue([{ _count: { _all: 4 }, targetId: '1' }]);
    prisma.like.findMany.mockResolvedValue([{ targetId: '1' }]);

    const result = await service.listPublic({ page: 1, pageSize: 10 }, 'visitor-1');

    expect(prisma.essay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      category: { name: '札记' },
      id: 1,
      likeCount: 4,
      liked: true,
      tags: [{ name: '日常' }],
    });
  });

  it('applies public category filtering', async () => {
    prisma.essayCategory.findFirst.mockResolvedValue({ id: 3 });
    prisma.essay.findMany.mockResolvedValue([]);
    prisma.essay.count.mockResolvedValue(0);
    prisma.like.groupBy.mockResolvedValue([]);

    await service.listPublic({ category: 'notes', page: 1, pageSize: 10 });

    expect(prisma.essayCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          slug: 'notes',
        }),
      }),
    );
    expect(prisma.essay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 3 }),
      }),
    );
  });

  it('does not return draft or private essay detail', async () => {
    prisma.essay.findFirst.mockResolvedValue(null);

    await expect(service.getPublicDetail('draft-note')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.essay.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
  });

  it('toggles public essay likes', async () => {
    prisma.essay.findFirst.mockResolvedValue(essayRecord({ id: 1 }));
    prisma.like.findUnique.mockResolvedValue(null);
    prisma.like.create.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(1);

    await expect(service.togglePublicLike(1, 'visitor-1')).resolves.toEqual({
      likeCount: 1,
      liked: true,
    });
    expect(prisma.like.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetId: '1',
          targetType: 'ESSAY',
          visitorId: 'visitor-1',
        }),
      }),
    );

    prisma.like.findUnique.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(0);
    await expect(service.togglePublicLike(1, 'visitor-1')).resolves.toEqual({
      likeCount: 0,
      liked: false,
    });
    expect(prisma.like.delete).toHaveBeenCalled();
  });

  it('creates categories, creates essays with tags, and deletes essays to recycle bin', async () => {
    prisma.essayCategory.create.mockResolvedValue(categoryRecord({ id: 3 }));
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      service.createCategoryAdmin({ name: '札记', slug: 'notes', sortOrder: 1 }, 1),
    ).resolves.toMatchObject({ id: 3 });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', objectType: 'ESSAY_CATEGORY', objectId: '3' }),
    );

    prisma.essayCategory.findUnique.mockResolvedValue(categoryRecord({ id: 3 }));
    prisma.essay.create.mockResolvedValue(essayRecord({ id: 20, title: 'Created' }));
    prisma.tag.findMany.mockResolvedValue([{ id: 4, name: '日常' }]);
    prisma.tagRelation.create.mockResolvedValue({});
    prisma.tagRelation.findMany.mockResolvedValue([]);
    prisma.like.groupBy.mockResolvedValue([]);

    await expect(
      service.createAdmin(
        {
          categoryId: 3,
          content: '<p>Created</p>',
          slug: 'created-note',
          status: PublishStatus.PUBLISHED,
          tagNames: ['日常'],
          title: 'Created',
        },
        1,
      ),
    ).resolves.toMatchObject({ id: 20, title: 'Created' });
    expect(prisma.tagRelation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetId: '20',
          targetType: 'ESSAY',
        }),
      }),
    );

    prisma.essay.findFirst.mockResolvedValue(essayRecord({ id: 20, title: 'Created' }));
    prisma.essay.update.mockResolvedValue({ ...essayRecord({ id: 20 }), deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(service.deleteAdmin(20, 1)).resolves.toEqual({ ok: true });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectId: '20',
          objectType: 'ESSAY',
          title: 'Created',
        }),
      }),
    );
  });
});

function categoryRecord(overrides: Partial<{ id: number }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    createdAt: now,
    description: null,
    id: overrides.id ?? 1,
    isEnabled: true,
    name: '札记',
    slug: 'notes',
    sortOrder: 0,
    updatedAt: now,
  };
}

function essayRecord(overrides: Partial<{ id: number; title: string }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    category: { id: 3, name: '札记', slug: 'notes' },
    categoryId: 3,
    content: '<p>Content</p>',
    coverUrl: null,
    createdAt: now,
    deletedAt: null,
    id: overrides.id ?? 1,
    isPinned: false,
    publishedAt: now,
    scheduledAt: null,
    slug: 'public-note',
    sortOrder: 0,
    status: PublishStatus.PUBLISHED,
    summary: 'Summary',
    title: overrides.title ?? 'Public Note',
    updatedAt: now,
    visibility: Visibility.PUBLIC,
  };
}
