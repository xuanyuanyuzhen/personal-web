import { BadRequestException } from '@nestjs/common';
import { AuditStatus, PublishStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchService } from '../src/search/search.service';

type PrismaMock = {
  customPage: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  essay: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  message: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  photo: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  thought: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('SearchService', () => {
  let prisma: PrismaMock;
  let service: SearchService;

  beforeEach(() => {
    prisma = {
      customPage: { count: jest.fn(), findMany: jest.fn() },
      essay: { count: jest.fn(), findMany: jest.fn() },
      message: { count: jest.fn(), findMany: jest.fn() },
      photo: { count: jest.fn(), findMany: jest.fn() },
      thought: { count: jest.fn(), findMany: jest.fn() },
    };
    service = new SearchService(prisma as unknown as PrismaService);
  });

  it('searches public content by section with visibility filters', async () => {
    const now = new Date('2026-06-03T00:00:00.000Z');
    prisma.thought.findMany.mockResolvedValue([{ content: '<p>春日碎碎念</p>', createdAt: now, id: 1, summary: null }]);
    prisma.customPage.findMany.mockResolvedValue([{ content: '<p>春日页面</p>', createdAt: now, id: 2, slug: 'spring', summary: null, title: '春日页面' }]);
    prisma.essay.findMany.mockResolvedValue([{ content: '<p>春日随笔</p>', createdAt: now, id: 3, slug: 'spring-note', summary: '春日摘要', title: '春日随笔' }]);
    prisma.photo.findMany.mockResolvedValue([{ createdAt: now, description: '春日照片', id: 4, thumbUrl: '/thumb.jpg', title: '照片' }]);
    prisma.message.findMany.mockResolvedValue([{ content: '春日留言', createdAt: now, id: 5, nickname: '访客' }]);
    prisma.thought.count.mockResolvedValue(1);
    prisma.customPage.count.mockResolvedValue(1);
    prisma.essay.count.mockResolvedValue(1);
    prisma.photo.count.mockResolvedValue(1);
    prisma.message.count.mockResolvedValue(1);

    const result = await service.searchPublic({ page: 1, pageSize: 3, q: '春日' });

    expect(prisma.thought.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: expect.objectContaining({
          deletedAt: null,
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auditStatus: AuditStatus.APPROVED,
          content: { contains: '春日' },
          deletedAt: null,
        }),
      }),
    );
    expect(result.sections.essays.items[0]).toMatchObject({
      excerpt: '春日摘要',
      title: '春日随笔',
      type: 'essays',
      url: '/essays/spring-note',
    });
    expect(result.sections.messages.items[0]).not.toHaveProperty('email');
  });

  it('includes admin-visible content only in authenticated preview mode', async () => {
    mockEmptyResults(prisma);

    await service.searchPublic({ q: '草稿' }, true);

    expect(prisma.essay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        }),
      }),
    );
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          auditStatus: AuditStatus.APPROVED,
        }),
      }),
    );
  });

  it('rejects empty or too-large search parameters', async () => {
    await expect(service.searchPublic({ q: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPublic({ pageSize: 99, q: '春日' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function mockEmptyResults(prisma: PrismaMock) {
  for (const model of [prisma.thought, prisma.customPage, prisma.essay, prisma.photo, prisma.message]) {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
  }
}
