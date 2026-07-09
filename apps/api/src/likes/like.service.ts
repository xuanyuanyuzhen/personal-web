import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PublishStatus, TargetType, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_LIKE_TYPES = new Set(['site', 'thought', 'essay', 'photo']);
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

type PublicLikeTarget = {
  targetId: string;
  targetType: TargetType;
};

@Injectable()
export class LikeService {
  constructor(private readonly prisma: PrismaService) {}

  async togglePublicLike(
    targetType: string | undefined,
    targetId: string | undefined,
    visitorId: string | undefined,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    if (!normalizedVisitorId) {
      throw new BadRequestException('X-Visitor-Id header is required.');
    }

    const target = await this.resolvePublicTarget(targetType, targetId);
    const where = {
      visitorId_targetType_targetId: {
        targetId: target.targetId,
        targetType: target.targetType,
        visitorId: normalizedVisitorId,
      },
    };
    const existing = await this.prisma.like.findUnique({ where });

    if (existing) {
      await this.prisma.like.delete({ where });
    } else {
      await this.prisma.like.create({
        data: {
          targetId: target.targetId,
          targetType: target.targetType,
          visitorId: normalizedVisitorId,
        },
      });
    }

    return {
      likeCount: await this.countTargetLikes(target),
      liked: !existing,
    };
  }

  async getPublicStatus(
    targetType: string | undefined,
    targetId: string | undefined,
    visitorId: string | undefined,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const target = await this.resolvePublicTarget(targetType, targetId);
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    const liked = normalizedVisitorId
      ? Boolean(
          await this.prisma.like.findUnique({
            where: {
              visitorId_targetType_targetId: {
                targetId: target.targetId,
                targetType: target.targetType,
                visitorId: normalizedVisitorId,
              },
            },
          }),
        )
      : false;

    return {
      likeCount: await this.countTargetLikes(target),
      liked,
    };
  }

  async getAdminSummary(): Promise<{
    byType: Array<{ count: number; targetType: TargetType }>;
    last7Days: Array<{ count: number; date: string }>;
    total: number;
  }> {
    const [total, byType, recentLikes] = await Promise.all([
      this.prisma.like.count(),
      this.prisma.like.groupBy({
        by: ['targetType'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.like.findMany({
        where: {
          createdAt: {
            gte: startOfLocalDay(new Date(Date.now() - (SEVEN_DAY_MS - 24 * 60 * 60 * 1000))),
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const trendMap = new Map<string, number>();
    for (const item of recentLikes) {
      const key = formatDate(item.createdAt);
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }

    return {
      byType: byType.map((item) => ({
        count: item._count._all,
        targetType: item.targetType,
      })),
      last7Days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = formatDate(date);

        return {
          count: trendMap.get(key) ?? 0,
          date: key,
        };
      }),
      total,
    };
  }

  private countTargetLikes(target: PublicLikeTarget): Promise<number> {
    return this.prisma.like.count({
      where: {
        targetId: target.targetId,
        targetType: target.targetType,
      },
    });
  }

  private async resolvePublicTarget(
    targetType: string | undefined,
    targetId: string | undefined,
  ): Promise<PublicLikeTarget> {
    const normalizedType = targetType?.trim().toLowerCase();
    if (!normalizedType || !PUBLIC_LIKE_TYPES.has(normalizedType)) {
      throw new BadRequestException('targetType is invalid.');
    }

    if (normalizedType === 'site') {
      return {
        targetId: 'site',
        targetType: TargetType.SITE,
      };
    }

    const id = parseTargetId(targetId);

    if (normalizedType === 'thought') {
      await this.assertPublicThought(id);
      return { targetId: String(id), targetType: TargetType.THOUGHT };
    }

    if (normalizedType === 'essay') {
      await this.assertPublicEssay(id);
      return { targetId: String(id), targetType: TargetType.ESSAY };
    }

    await this.assertPublicPhoto(id);
    return { targetId: String(id), targetType: TargetType.PHOTO };
  }

  private async assertPublicThought(id: number): Promise<void> {
    const thought = await this.prisma.thought.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
      },
      select: {
        id: true,
      },
    });

    if (!thought) {
      throw new NotFoundException('Like target not found.');
    }
  }

  private async assertPublicEssay(id: number): Promise<void> {
    const essay = await this.prisma.essay.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
      },
      select: {
        id: true,
      },
    });

    if (!essay) {
      throw new NotFoundException('Like target not found.');
    }
  }

  private async assertPublicPhoto(id: number): Promise<void> {
    const photo = await this.prisma.photo.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
        OR: [
          {
            albumId: null,
          },
          {
            album: {
              deletedAt: null,
              isEnabled: true,
              status: PublishStatus.PUBLISHED,
              visibility: Visibility.PUBLIC,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!photo) {
      throw new NotFoundException('Like target not found.');
    }
  }
}

function normalizeVisitorId(visitorId: string | undefined): string | undefined {
  const normalized = visitorId?.trim();

  return normalized || undefined;
}

function parseTargetId(value: string | undefined): number {
  const parsed = Number(value?.trim());

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('targetId must be a positive integer.');
  }

  return parsed;
}

function startOfLocalDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
