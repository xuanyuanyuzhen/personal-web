import { NotFoundException } from '@nestjs/common';
import { NavigationType, PublishStatus, Visibility } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { NavigationService } from '../src/navigations/navigation.service';
import { PageService } from '../src/pages/page.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  navigation: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  customPage: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
  };
  recycleBinItem: {
    create: jest.Mock;
  };
};

describe('NavigationService and PageService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let navigationService: NavigationService;
  let pageService: PageService;

  beforeEach(() => {
    prisma = {
      navigation: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      customPage: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      recycleBinItem: {
        create: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    navigationService = new NavigationService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
    pageService = new PageService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('filters disabled, deleted, draft, and private entries from public navigation', async () => {
    const now = new Date('2026-06-03T00:00:00.000Z');
    prisma.navigation.findMany.mockResolvedValue([
      navigationRecord({ id: 1, key: 'home', title: 'Home', path: '/' }),
      navigationRecord({
        id: 2,
        key: 'page-public',
        title: 'Public Page',
        type: NavigationType.PAGE,
        parentId: 1,
        pageId: 10,
        page: publicPageRecord({ id: 10, title: 'Public', slug: 'public' }),
      }),
      navigationRecord({ id: 3, key: 'disabled', title: 'Disabled', isEnabled: false }),
      navigationRecord({ id: 4, key: 'deleted', title: 'Deleted', deletedAt: now }),
      navigationRecord({
        id: 5,
        key: 'draft-page',
        title: 'Draft Page',
        type: NavigationType.PAGE,
        pageId: 11,
        page: publicPageRecord({ id: 11, title: 'Draft', slug: 'draft', status: PublishStatus.DRAFT }),
      }),
      navigationRecord({
        id: 6,
        key: 'private-page',
        title: 'Private Page',
        type: NavigationType.PAGE,
        pageId: 12,
        page: publicPageRecord({
          id: 12,
          title: 'Private',
          slug: 'private',
          visibility: Visibility.PRIVATE,
        }),
      }),
    ]);

    const tree = await navigationService.listPublic();

    expect(prisma.navigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, isEnabled: true },
      }),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ key: 'home' });
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0]).toMatchObject({
      key: 'page-public',
      page: { id: 10, title: 'Public', slug: 'public' },
    });
    expect(JSON.stringify(tree)).not.toContain('draft-page');
    expect(JSON.stringify(tree)).not.toContain('private-page');
    expect(JSON.stringify(tree)).not.toContain('disabled');
    expect(JSON.stringify(tree)).not.toContain('deleted');
  });

  it('includes draft and private page navigations in authenticated admin preview', async () => {
    prisma.navigation.findMany.mockResolvedValue([
      navigationRecord({ id: 1, key: 'home', title: 'Home', path: '/' }),
      navigationRecord({
        id: 5,
        key: 'draft-page',
        title: 'Draft Page',
        type: NavigationType.PAGE,
        pageId: 11,
        page: publicPageRecord({ id: 11, title: 'Draft', slug: 'draft', status: PublishStatus.DRAFT }),
      }),
      navigationRecord({
        id: 6,
        key: 'private-page',
        title: 'Private Page',
        type: NavigationType.PAGE,
        pageId: 12,
        page: publicPageRecord({
          id: 12,
          title: 'Private',
          slug: 'private',
          visibility: Visibility.PRIVATE,
        }),
      }),
    ]);

    const tree = await navigationService.listPublic(true);

    expect(tree.map((item) => item.key)).toEqual(['home', 'draft-page', 'private-page']);
  });

  it('does not return draft, private, or deleted public page details', async () => {
    prisma.customPage.findFirst.mockResolvedValueOnce(
      adminPageRecord({ id: 1, slug: 'draft', status: PublishStatus.DRAFT }),
    );
    await expect(pageService.getPublicBySlug('draft')).rejects.toBeInstanceOf(NotFoundException);

    prisma.customPage.findFirst.mockResolvedValueOnce(
      adminPageRecord({ id: 2, slug: 'private', visibility: Visibility.PRIVATE }),
    );
    await expect(pageService.getPublicBySlug('private')).rejects.toBeInstanceOf(NotFoundException);

    prisma.customPage.findFirst.mockResolvedValueOnce(
      adminPageRecord({ id: 3, slug: 'deleted', deletedAt: new Date('2026-06-03T00:00:00.000Z') }),
    );
    await expect(pageService.getPublicBySlug('deleted')).rejects.toBeInstanceOf(NotFoundException);

    prisma.customPage.findFirst.mockResolvedValueOnce(adminPageRecord({ id: 4, slug: 'public' }));
    const page = await pageService.getPublicBySlug('public');

    expect(prisma.customPage.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          slug: 'public',
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
          deletedAt: null,
        },
      }),
    );
    expect(page).toMatchObject({ id: 4, slug: 'public' });
    expect(page).not.toHaveProperty('status');
    expect(page).not.toHaveProperty('visibility');
    expect(page).not.toHaveProperty('deletedAt');
  });

  it('returns non-deleted pages in authenticated admin preview', async () => {
    prisma.customPage.findFirst.mockResolvedValueOnce(
      adminPageRecord({ id: 1, slug: 'draft', status: PublishStatus.DRAFT }),
    );
    const draft = await pageService.getPublicBySlug('draft', true);

    expect(prisma.customPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'draft',
          deletedAt: null,
        },
      }),
    );
    expect(draft).toMatchObject({ id: 1, slug: 'draft' });

    prisma.customPage.findFirst.mockResolvedValueOnce(
      adminPageRecord({ id: 2, slug: 'deleted', deletedAt: new Date('2026-06-03T00:00:00.000Z') }),
    );
    await expect(pageService.getPublicBySlug('deleted', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates, updates, and deletes navigation with recycle-bin and operation logs', async () => {
    const created = navigationRecord({ id: 20, key: 'about', title: 'About', path: '/about' });
    prisma.navigation.create.mockResolvedValue(created);
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      navigationService.createAdmin(
        {
          key: 'about',
          title: 'About',
          type: NavigationType.INTERNAL,
          path: '/about',
        },
        1,
        '203.0.113.9',
      ),
    ).resolves.toMatchObject({ id: 20, key: 'about' });
    expect(prisma.navigation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'about',
          title: 'About',
          type: NavigationType.INTERNAL,
          path: '/about',
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 1, action: 'CREATE', objectType: 'NAVIGATION', objectId: '20' }),
    );

    const existing = navigationRecord({ id: 20, key: 'about', title: 'About', path: '/about' });
    const updated = navigationRecord({ id: 20, key: 'about', title: 'About Me', path: '/about-me' });
    prisma.navigation.findFirst.mockResolvedValueOnce(existing);
    prisma.navigation.update.mockResolvedValueOnce(updated);

    await expect(
      navigationService.updateAdmin(20, { title: 'About Me', path: '/about-me' }, 1, '203.0.113.9'),
    ).resolves.toMatchObject({ title: 'About Me' });
    expect(prisma.navigation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20 },
        data: expect.objectContaining({ title: 'About Me', path: '/about-me' }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', objectType: 'NAVIGATION', objectId: '20' }),
    );

    prisma.navigation.findFirst.mockResolvedValueOnce(updated);
    prisma.navigation.update.mockResolvedValueOnce({ ...updated, deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 1 });

    await expect(navigationService.deleteAdmin(20, 1, '203.0.113.9')).resolves.toEqual({ ok: true });
    expect(prisma.navigation.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 20 },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectType: 'NAVIGATION',
          objectId: '20',
          title: 'About Me',
          deletedById: 1,
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', objectType: 'NAVIGATION', objectId: '20' }),
    );
  });

  it('creates, updates, and deletes pages with recycle-bin and operation logs', async () => {
    const created = adminPageRecord({ id: 30, title: 'About', slug: 'about' });
    prisma.customPage.create.mockResolvedValue(created);
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      pageService.createAdmin(
        {
          title: 'About',
          slug: 'about',
          content: '<p>Hello</p>',
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
        },
        1,
        '203.0.113.10',
      ),
    ).resolves.toMatchObject({ id: 30, slug: 'about' });
    expect(prisma.customPage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'About',
          slug: 'about',
          content: '<p>Hello</p>',
          status: PublishStatus.PUBLISHED,
          visibility: Visibility.PUBLIC,
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 1, action: 'CREATE', objectType: 'PAGE', objectId: '30' }),
    );

    const existing = adminPageRecord({ id: 30, title: 'About', slug: 'about' });
    const updated = adminPageRecord({ id: 30, title: 'About Me', slug: 'about-me' });
    prisma.customPage.findFirst.mockResolvedValueOnce(existing);
    prisma.customPage.update.mockResolvedValueOnce(updated);

    await expect(pageService.updateAdmin(30, { title: 'About Me', slug: 'about-me' }, 1)).resolves.toMatchObject({
      title: 'About Me',
    });
    expect(prisma.customPage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 30 },
        data: expect.objectContaining({ title: 'About Me', slug: 'about-me' }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', objectType: 'PAGE', objectId: '30' }),
    );

    prisma.customPage.findFirst.mockResolvedValueOnce(updated);
    prisma.customPage.update.mockResolvedValueOnce({ ...updated, deletedAt: new Date() });
    prisma.recycleBinItem.create.mockResolvedValue({ id: 2 });

    await expect(pageService.deleteAdmin(30, 1, '203.0.113.10')).resolves.toEqual({ ok: true });
    expect(prisma.customPage.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 30 },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectType: 'PAGE',
          objectId: '30',
          title: 'About Me',
          deletedById: 1,
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', objectType: 'PAGE', objectId: '30' }),
    );
  });
});

function navigationRecord(
  overrides: Partial<{
    id: number;
    key: string;
    title: string;
    type: NavigationType;
    path: string | null;
    url: string | null;
    target: string | null;
    icon: string | null;
    parentId: number | null;
    pageId: number | null;
    sortOrder: number;
    isEnabled: boolean;
    deletedAt: Date | null;
    page: ReturnType<typeof publicPageRecord> | null;
  }>,
) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    id: overrides.id ?? 1,
    key: overrides.key ?? 'home',
    title: overrides.title ?? 'Home',
    type: overrides.type ?? NavigationType.INTERNAL,
    path: overrides.path ?? '/',
    url: overrides.url ?? null,
    target: overrides.target ?? null,
    icon: overrides.icon ?? null,
    parentId: overrides.parentId ?? null,
    pageId: overrides.pageId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    isEnabled: overrides.isEnabled ?? true,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: now,
    updatedAt: now,
    parent: null,
    page: overrides.page ?? null,
  };
}

function publicPageRecord(
  overrides: Partial<{
    id: number;
    title: string;
    slug: string;
    status: PublishStatus;
    visibility: Visibility;
    deletedAt: Date | null;
  }>,
) {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Page',
    slug: overrides.slug ?? 'page',
    status: overrides.status ?? PublishStatus.PUBLISHED,
    visibility: overrides.visibility ?? Visibility.PUBLIC,
    deletedAt: overrides.deletedAt ?? null,
  };
}

function adminPageRecord(
  overrides: Partial<{
    id: number;
    title: string;
    slug: string;
    status: PublishStatus;
    visibility: Visibility;
    deletedAt: Date | null;
  }>,
) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Page',
    slug: overrides.slug ?? 'page',
    summary: 'Summary',
    content: '<p>Content</p>',
    status: overrides.status ?? PublishStatus.PUBLISHED,
    visibility: overrides.visibility ?? Visibility.PUBLIC,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    isPinned: false,
    sortOrder: 0,
    publishedAt: now,
    scheduledAt: null,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
