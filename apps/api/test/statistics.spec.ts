import { TargetType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashIp, maskIp, StatisticService } from '../src/statistics/statistic.service';

type PrismaMock = {
  like: {
    count: jest.Mock;
    findMany: jest.Mock;
    groupBy: jest.Mock;
  };
  visitLog: {
    count: jest.Mock;
    create: jest.Mock;
    groupBy: jest.Mock;
  };
};

describe('StatisticService', () => {
  let prisma: PrismaMock;
  let service: StatisticService;

  beforeEach(() => {
    prisma = {
      like: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      visitLog: {
        count: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    service = new StatisticService(prisma as unknown as PrismaService);
  });

  it('records visits with masked IP, hashed IP, and coarse user agent fields', async () => {
    prisma.visitLog.create.mockResolvedValue({ id: 1 });

    await service.recordVisit(
      {
        pageType: 'thought',
        path: '/thoughts?tag=daily',
      },
      '203.0.113.42',
      'Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
    );

    expect(prisma.visitLog.create).toHaveBeenCalledTimes(1);
    const data = prisma.visitLog.create.mock.calls[0][0].data;

    expect(data.path).toBe('/thoughts');
    expect(data.pageType).toBe(TargetType.THOUGHT);
    expect(data.ipMasked).toBe('203.0.113.0');
    expect(data.ipMasked).not.toBe('203.0.113.42');
    expect(data.ipHash).toBe(hashIp('203.0.113.42'));
    expect(data.browser).toBe('Chrome');
    expect(data.device).toBe('Mobile');
    expect(data).not.toHaveProperty('referrer');
  });

  it('masks IPv6 and non-standard IP values without storing the original value', () => {
    expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3::');
    expect(maskIp('unknown-client')).toBe('masked');
  });

  it('aggregates dashboard visit and like statistics', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    prisma.visitLog.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    prisma.visitLog.groupBy
      .mockResolvedValueOnce([
        { _count: { _all: 1 }, visitDate: yesterday },
        { _count: { _all: 2 }, visitDate: today },
      ])
      .mockResolvedValueOnce([
        { _count: { _all: 3 }, pageId: 'thoughts', pageType: TargetType.THOUGHT, path: '/thoughts' },
        { _count: { _all: 7 }, pageId: 'home', pageType: TargetType.SITE, path: '/' },
      ]);
    prisma.like.count.mockResolvedValue(5);
    prisma.like.groupBy.mockResolvedValue([{ _count: { _all: 5 }, targetType: TargetType.SITE }]);
    prisma.like.findMany.mockResolvedValue([{ createdAt: today }, { createdAt: today }]);

    const result = await service.getDashboardStatistics();

    expect(result.visits.total).toBe(10);
    expect(result.visits.today).toBe(2);
    expect(result.visits.last7Days).toHaveLength(7);
    expect(result.visits.last30Days).toHaveLength(30);
    expect(result.visits.last7Days.at(-1)).toEqual({
      count: 2,
      date: formatLocalDate(today),
    });
    expect(result.visits.topPages[0]).toEqual({
      count: 7,
      pageId: 'home',
      pageType: TargetType.SITE,
      path: '/',
    });
    expect(result.likes.total).toBe(5);
    expect(result.likes.last7Days.at(-1)).toEqual({
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
