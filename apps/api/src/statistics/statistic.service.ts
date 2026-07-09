import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordVisitDto } from './statistic.dto';

type TrendPoint = {
  count: number;
  date: string;
};

type VisitDateGroup = {
  _count: {
    _all: number;
  };
  visitDate: Date;
};

const PUBLIC_VISIT_TYPES: Record<string, TargetType> = {
  essay: TargetType.ESSAY,
  message: TargetType.MESSAGE,
  page: TargetType.PAGE,
  photo: TargetType.PHOTO,
  site: TargetType.SITE,
  thought: TargetType.THOUGHT,
};

@Injectable()
export class StatisticService {
  constructor(private readonly prisma: PrismaService) {}

  async recordVisit(
    dto: RecordVisitDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    const path = normalizePath(dto.path);
    const pageType = resolvePageType(dto.pageType, path);

    await this.prisma.visitLog.create({
      data: {
        browser: parseBrowser(userAgent),
        device: parseDevice(userAgent),
        ipHash: ip ? hashIp(ip) : null,
        ipMasked: maskIp(ip),
        pageId: normalizePageId(dto.pageId),
        pageType,
        path,
        visitDate: startOfLocalDay(new Date()),
      },
    });

    return { ok: true };
  }

  async getDashboardStatistics(): Promise<{
    likes: {
      byType: Array<{ count: number; targetType: TargetType }>;
      last7Days: TrendPoint[];
      total: number;
    };
    visits: {
      last7Days: TrendPoint[];
      last30Days: TrendPoint[];
      today: number;
      topPages: Array<{
        count: number;
        pageId: string | null;
        pageType: TargetType;
        path: string;
      }>;
      total: number;
    };
  }> {
    const today = startOfLocalDay(new Date());
    const last7Start = addDays(today, -6);
    const last30Start = addDays(today, -29);

    const [totalVisits, todayVisits, visitGroups30, pageGroups, totalLikes, likeGroups, recentLikes] =
      await Promise.all([
        this.prisma.visitLog.count(),
        this.prisma.visitLog.count({
          where: {
            visitDate: today,
          },
        }),
        this.prisma.visitLog.groupBy({
          by: ['visitDate'],
          where: {
            visitDate: {
              gte: last30Start,
            },
          },
          _count: {
            _all: true,
          },
        }),
        this.prisma.visitLog.groupBy({
          by: ['pageType', 'pageId', 'path'],
          _count: {
            _all: true,
          },
        }),
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
              gte: last7Start,
            },
          },
          select: {
            createdAt: true,
          },
        }),
      ]);

    const topPages = pageGroups
      .map((item) => ({
        count: item._count._all,
        pageId: item.pageId,
        pageType: item.pageType,
        path: item.path,
      }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 8);

    return {
      likes: {
        byType: likeGroups.map((item) => ({
          count: item._count._all,
          targetType: item.targetType,
        })),
        last7Days: buildLikeTrend(recentLikes, today),
        total: totalLikes,
      },
      visits: {
        last7Days: buildVisitTrend(visitGroups30, today, 7),
        last30Days: buildVisitTrend(visitGroups30, today, 30),
        today: todayVisits,
        topPages,
        total: totalVisits,
      },
    };
  }
}

export function hashIp(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function maskIp(value: string | undefined): string | null {
  const ip = value?.trim();
  if (!ip) {
    return null;
  }

  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0`;
  }

  const ipv4Mapped = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4Mapped) {
    return `ipv6-mapped:${maskIp(ipv4Mapped[1])}`;
  }

  if (ip.includes(':')) {
    const segments = ip.split(':').filter(Boolean);
    const prefix = segments.slice(0, 3).join(':');

    return prefix ? `${prefix}::` : '::';
  }

  return 'masked';
}

function normalizePath(value: string | undefined): string {
  const rawPath = value?.trim();
  if (!rawPath) {
    throw new BadRequestException('path is required.');
  }

  const pathWithoutOrigin = stripOrigin(rawPath);
  const pathWithoutHash = pathWithoutOrigin.split('#')[0] ?? '/';
  const path = pathWithoutHash.split('?')[0] ?? '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return normalized.slice(0, 500);
}

function stripOrigin(value: string): string {
  try {
    const url = new URL(value);

    return url.pathname;
  } catch {
    return value;
  }
}

function normalizePageId(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized.slice(0, 64) : null;
}

function resolvePageType(value: string | undefined, path: string): TargetType {
  const normalized = value?.trim().toLowerCase();
  if (normalized) {
    const pageType = PUBLIC_VISIT_TYPES[normalized];
    if (!pageType) {
      throw new BadRequestException('pageType is invalid.');
    }

    return pageType;
  }

  if (path.startsWith('/thoughts')) {
    return TargetType.THOUGHT;
  }

  if (path.startsWith('/essays')) {
    return TargetType.ESSAY;
  }

  if (path.startsWith('/photos')) {
    return TargetType.PHOTO;
  }

  if (path.startsWith('/messages')) {
    return TargetType.MESSAGE;
  }

  if (path.startsWith('/pages') || path === '/about') {
    return TargetType.PAGE;
  }

  return TargetType.SITE;
}

function parseBrowser(userAgent: string | undefined): string | null {
  const normalized = userAgent?.toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized.includes('edg/')) {
    return 'Edge';
  }
  if (normalized.includes('chrome/')) {
    return 'Chrome';
  }
  if (normalized.includes('firefox/')) {
    return 'Firefox';
  }
  if (normalized.includes('safari/')) {
    return 'Safari';
  }

  return 'Other';
}

function parseDevice(userAgent: string | undefined): string | null {
  const normalized = userAgent?.toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized.includes('tablet') || normalized.includes('ipad')) {
    return 'Tablet';
  }
  if (normalized.includes('mobile') || normalized.includes('iphone') || normalized.includes('android')) {
    return 'Mobile';
  }

  return 'Desktop';
}

function buildVisitTrend(groups: VisitDateGroup[], today: Date, days: number): TrendPoint[] {
  const counts = new Map(groups.map((item) => [formatDate(item.visitDate), item._count._all]));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, -(days - 1 - index));
    const key = formatDate(date);

    return {
      count: counts.get(key) ?? 0,
      date: key,
    };
  });
}

function buildLikeTrend(items: Array<{ createdAt: Date }>, today: Date): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = formatDate(item.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, -(6 - index));
    const key = formatDate(date);

    return {
      count: counts.get(key) ?? 0,
      date: key,
    };
  });
}

function startOfLocalDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
