import { OperationLogService } from '../src/operation-log/operation-log.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { UploadService } from '../src/uploads/upload.service';

type PrismaMock = {
  setting: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  announcement: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
};

describe('SettingsService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let uploadService: { saveFile: jest.Mock };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      announcement: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      setting: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    uploadService = { saveFile: jest.fn() };
    service = new SettingsService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
      uploadService as unknown as UploadService,
    );
  });

  it('reads site settings with defaults for missing keys', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: 'site.name', value: '语尔' },
      { key: 'site.publicName', value: '轩辕宇振' },
      { key: 'site.introduction', value: '首页介绍' },
      { key: 'site.githubUrl', value: 'https://github.com/example' },
    ]);

    await expect(service.getSiteSettings()).resolves.toMatchObject({
      aboutContent: '<p>这里会慢慢补上关于我的介绍。</p>',
      githubUrl: 'https://github.com/example',
      homeIntroduction: '首页介绍',
      publicName: '轩辕宇振',
      siteName: '语尔',
    });
  });

  it('updates site settings and writes operation log', async () => {
    prisma.setting.upsert.mockResolvedValue({});
    prisma.setting.findMany.mockResolvedValue([
      { key: 'site.name', value: '新站名' },
      { key: 'site.publicName', value: '新昵称' },
    ]);
    operationLogService.write.mockResolvedValue(undefined);

    const result = await service.updateSiteSettings(
      {
        publicName: '新昵称',
        siteName: '新站名',
      },
      1,
      '203.0.113.20',
    );

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SETTING',
        adminId: 1,
        objectId: 'site',
        objectType: 'SETTING',
      }),
    );
    expect(result).toMatchObject({ publicName: '新昵称', siteName: '新站名' });
  });

  it('returns only enabled public announcement', async () => {
    const announcement = announcementRecord({ content: '<p>公告</p>', title: '首页公告' });
    prisma.announcement.findFirst.mockResolvedValue(announcement);

    await expect(service.getPublicAnnouncement()).resolves.toMatchObject({
      content: '<p>公告</p>',
      isEnabled: true,
      title: '首页公告',
    });
    expect(prisma.announcement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isEnabled: true, key: 'home' },
      }),
    );
  });

  it('updates announcement and writes operation log', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);
    prisma.announcement.upsert.mockResolvedValue(
      announcementRecord({ content: '<p>新公告</p>', title: '新公告' }),
    );
    operationLogService.write.mockResolvedValue(undefined);

    await expect(
      service.updateAnnouncement({ content: '<p>新公告</p>', isEnabled: true, title: '新公告' }, 1),
    ).resolves.toMatchObject({
      content: '<p>新公告</p>',
      isEnabled: true,
      title: '新公告',
    });
    expect(prisma.announcement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ key: 'home', title: '新公告' }),
        update: expect.objectContaining({ title: '新公告' }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SETTING',
        objectId: 'home',
        objectType: 'ANNOUNCEMENT',
      }),
    );
  });

  it('uploads avatar through the unified upload service', async () => {
    uploadService.saveFile.mockResolvedValue({
      filename: 'avatar.png',
      kind: 'avatar',
      mimeType: 'image/png',
      originalName: 'avatar.png',
      relativePath: 'site/avatar/avatar.png',
      size: 4,
      storagePath: 'site/avatar/avatar.png',
      url: '/uploads/site/avatar/avatar.png',
    });
    prisma.setting.upsert.mockResolvedValue({});
    prisma.setting.findMany.mockResolvedValue([{ key: 'site.avatarUrl', value: '/uploads/site/avatar/avatar.png' }]);

    await expect(
      service.uploadAvatar(
        {
          buffer: Buffer.from('file'),
          mimetype: 'image/png',
          originalname: 'avatar.png',
          size: 4,
        },
        1,
      ),
    ).resolves.toMatchObject({ avatarUrl: '/uploads/site/avatar/avatar.png' });
    expect(uploadService.saveFile).toHaveBeenCalledWith(
      'avatar',
      expect.objectContaining({ originalname: 'avatar.png' }),
    );
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ value: '/uploads/site/avatar/avatar.png' }),
      }),
    );
  });
});

function announcementRecord(overrides: Partial<{ title: string; content: string; isEnabled: boolean }>) {
  const now = new Date('2026-06-03T00:00:00.000Z');

  return {
    content: overrides.content ?? '<p>公告</p>',
    createdAt: now,
    id: 1,
    isEnabled: overrides.isEnabled ?? true,
    key: 'home',
    publishedAt: now,
    title: overrides.title ?? '公告',
    updatedAt: now,
  };
}
