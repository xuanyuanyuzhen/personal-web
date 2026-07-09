import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublishStatus, TargetType, Visibility } from '@prisma/client';
import { LikeService } from '../src/likes/like.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  essay: {
    findFirst: jest.Mock;
  };
  like: {
    count: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    groupBy: jest.Mock;
  };
  photo: {
    findFirst: jest.Mock;
  };
  thought: {
    findFirst: jest.Mock;
  };
};

describe('LikeService', () => {
  let prisma: PrismaMock;
  let service: LikeService;

  beforeEach(() => {
    prisma = {
      essay: {
        findFirst: jest.fn(),
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
        findFirst: jest.fn(),
      },
      thought: {
        findFirst: jest.fn(),
      },
    };
    service = new LikeService(prisma as unknown as PrismaService);
  });

  it('toggles a site like with a stable site target', async () => {
    prisma.like.findUnique.mockResolvedValue(null);
    prisma.like.create.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(1);

    await expect(service.togglePublicLike('site', undefined, 'visitor-1')).resolves.toEqual({
      likeCount: 1,
      liked: true,
    });
    expect(prisma.like.create).toHaveBeenCalledWith({
      data: {
        targetId: 'site',
        targetType: TargetType.SITE,
        visitorId: 'visitor-1',
      },
    });

    prisma.like.findUnique.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(0);

    await expect(service.togglePublicLike('site', undefined, 'visitor-1')).resolves.toEqual({
      likeCount: 0,
      liked: false,
    });
    expect(prisma.like.delete).toHaveBeenCalledWith({
      where: {
        visitorId_targetType_targetId: {
          targetId: 'site',
          targetType: TargetType.SITE,
          visitorId: 'visitor-1',
        },
      },
    });
  });

  it('requires visitor id when toggling likes', async () => {
    await expect(service.togglePublicLike('site', undefined, ' ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows likes only for public thoughts', async () => {
    prisma.thought.findFirst.mockResolvedValue({ id: 10 });
    prisma.like.findUnique.mockResolvedValue(null);
    prisma.like.create.mockResolvedValue({ id: 1 });
    prisma.like.count.mockResolvedValue(1);

    await expect(service.togglePublicLike('thought', '10', 'visitor-1')).resolves.toEqual({
      likeCount: 1,
      liked: true,
    });
    expect(prisma.thought.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          id: 10,
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
  });

  it('rejects missing or private targets', async () => {
    prisma.essay.findFirst.mockResolvedValue(null);

    await expect(service.togglePublicLike('essay', '2', 'visitor-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports status without requiring a visitor id', async () => {
    prisma.like.count.mockResolvedValue(4);

    await expect(service.getPublicStatus('site', undefined, undefined)).resolves.toEqual({
      likeCount: 4,
      liked: false,
    });
    expect(prisma.like.findUnique).not.toHaveBeenCalled();
  });

  it('aggregates total likes by type and by recent day', async () => {
    const today = new Date();
    prisma.like.count.mockResolvedValue(3);
    prisma.like.groupBy.mockResolvedValue([
      { _count: { _all: 2 }, targetType: TargetType.SITE },
      { _count: { _all: 1 }, targetType: TargetType.PHOTO },
    ]);
    prisma.like.findMany.mockResolvedValue([{ createdAt: today }, { createdAt: today }]);

    const result = await service.getAdminSummary();

    expect(result.total).toBe(3);
    expect(result.byType).toEqual([
      { count: 2, targetType: TargetType.SITE },
      { count: 1, targetType: TargetType.PHOTO },
    ]);
    expect(result.last7Days).toHaveLength(7);
    expect(result.last7Days.at(-1)).toEqual({
      count: 2,
      date: formatLocalDate(today),
    });
  });
});

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
