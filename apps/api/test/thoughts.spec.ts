import { NotFoundException } from '@nestjs/common';
import { PublishStatus, Visibility } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ThoughtService } from '../src/thoughts/thought.service';

type PrismaMock = {
  thought: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
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

describe('ThoughtService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: ThoughtService;

  beforeEach(() => {
    prisma = {
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
      thought: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new ThoughtService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('lists only published public thoughts and attaches tags and like state', async () => {
    prisma.thought.findMany.mockResolvedValue([thoughtRecord({ id: 1 })]);
    prisma.thought.count.mockResolvedValue(1);
    prisma.tagRelation.findMany.mockResolvedValue([
      {
        tag: { color: null, id: 2, name: '日常', slug: 'daily' },
        targetId: '1',
      },
    ]);
    prisma.like.groupBy.mockResolvedValue([{ _count: { _all: 3 }, targetId: '1' }]);
    prisma.like.findMany.mockResolvedValue([{ targetId: '1' }]);

    const result = await service.listPublic({ page: 1, pageSize: 10 }, 'visitor-1');

    expect(prisma.thought.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 1,
      likeCount: 3,
      liked: true,
      tags: [{ name: '日常' }],
    });
  });

  it('applies tag filtering by tag name or slug', async () => {
    prisma.tag.findFirst.mockResolvedValue({ id: 8 });
    prisma.tagRelation.findMany
      .mockResolvedValueOnce([{ targetId: '12' }])
      .mockResolvedValueOnce([]);
    prisma.thought.findMany.mockResolvedValue([]);
    prisma.thought.count.mockResolvedValue(0);
    prisma.like.groupBy.mockResolvedValue([]);

    await service.listPublic({ page: 1, pageSize: 10, tag: 'daily' });

    expect(prisma.thought.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [12] },
        }),
      }),
    );
  });

  it('toggles public thought likes', async () => {
    prisma.thought.findFirst.mockResolvedValue(thoughtRecord({ id: 1 }));
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

  it('does not like missing or private thoughts', async () => {
    prisma.thought.findFirst.mockResolvedValue(null);

    await expect(service.togglePublicLike(1, 'visitor-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates, updates, and deletes thoughts with tags and logs', async () => {
    const created = thoughtRecord({ id: 20, summary: 'Created' });
    prisma.thought.create.mockResolvedValue(created);
    prisma.tag.findMany.mockResolvedValue([{ id: 4, name: '日常' }]);
    prisma.tagRelation.create.mockResolvedValue({});
    prisma.tagRelation.findMany.mockResolvedValue([]);
    prisma.like.groupBy.mockResolvedValue([]);
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      service.createAdmin(
        {
          content: '<p>Created</p>',
          status: PublishStatus.PUBLISHED,
          tagNames: ['日常'],
        },
        1,
      ),
    ).resolves.toMatchObject({ id: 20 });
    expect(prisma.tagRelation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tagId: 4,
          targetType: 'THOUGHT',
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', objectType: 'THOUGHT', objectId: '20' }),
    );

    prisma.thought.findFirst.mockResolvedValue(created);
    prisma.thought.update.mockResolvedValue(thoughtRecord({ id: 20, summary: 'Updated' }));

    await expect(service.updateAdmin(20, { summary: 'Updated', tagNames: [] }, 1)).resolves.toMatchObject({
      summary: 'Updated',
    });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', objectType: 'THOUGHT', objectId: '20' }),
    );

    prisma.thought.findFirst.mockResolvedValue(thoughtRecord({ id: 20, summary: 'Updated' }));
    prisma.thought.update.mockResolvedValue({ ...created, deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(service.deleteAdmin(20, 1)).resolves.toEqual({ ok: true });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectId: '20',
          objectType: 'THOUGHT',
        }),
      }),
    );
  });
});

function thoughtRecord(overrides: Partial<{ id: number; summary: string | null }> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    content: '<p>Content</p>',
    createdAt: now,
    deletedAt: null,
    id: overrides.id ?? 1,
    imageUrl: null,
    isPinned: false,
    mood: null,
    publishedAt: now,
    scheduledAt: null,
    sortOrder: 0,
    status: PublishStatus.PUBLISHED,
    summary: overrides.summary ?? 'Summary',
    updatedAt: now,
    visibility: Visibility.PUBLIC,
  };
}
