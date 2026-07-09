import { BadRequestException, Injectable } from '@nestjs/common';
import { OperationType, Prisma, TargetType } from '@prisma/client';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../uploads/upload.service';
import { UploadedFile } from '../uploads/upload.types';
import { UpdateAnnouncementDto, UpdateSiteSettingsDto } from './settings.dto';

const SETTING_KEYS = {
  aboutContent: 'about.content',
  avatarUrl: 'site.avatarUrl',
  faviconUrl: 'site.faviconUrl',
  githubUrl: 'site.githubUrl',
  homeIntroduction: 'site.introduction',
  publicName: 'site.publicName',
  siteName: 'site.name',
  theme: 'site.theme',
} as const;

const DEFAULT_THEME = {
  faviconReserved: true,
  primary: 'pink',
};

type SiteSettings = {
  siteName: string;
  publicName: string;
  homeIntroduction: string;
  githubUrl: string;
  avatarUrl: string;
  faviconUrl: string;
  aboutContent: string;
  theme: Prisma.JsonValue;
};

type AnnouncementView = {
  title: string;
  content: string;
  isEnabled: boolean;
  publishedAt: Date | null;
};

export type UploadedAvatarFile = UploadedFile;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
    private readonly uploadService: UploadService,
  ) {}

  async getSiteSettings(): Promise<SiteSettings> {
    const rows = await this.prisma.setting.findMany({
      where: {
        key: { in: Object.values(SETTING_KEYS) },
      },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));

    return {
      aboutContent: stringSetting(settings, SETTING_KEYS.aboutContent, '<p>这里会慢慢补上关于我的介绍。</p>'),
      avatarUrl: stringSetting(settings, SETTING_KEYS.avatarUrl, ''),
      faviconUrl: stringSetting(settings, SETTING_KEYS.faviconUrl, ''),
      githubUrl: stringSetting(settings, SETTING_KEYS.githubUrl, ''),
      homeIntroduction: stringSetting(settings, SETTING_KEYS.homeIntroduction, '安静记录碎片、随笔、照片和一点点日常灵感。'),
      publicName: stringSetting(settings, SETTING_KEYS.publicName, '轩辕宇振'),
      siteName: stringSetting(settings, SETTING_KEYS.siteName, '语尔'),
      theme: settings.get(SETTING_KEYS.theme) ?? DEFAULT_THEME,
    };
  }

  async updateSiteSettings(
    dto: UpdateSiteSettingsDto,
    adminId: number,
    ip?: string,
  ): Promise<SiteSettings> {
    const entries = siteSettingEntries(dto);
    if (entries.length === 0) {
      return this.getSiteSettings();
    }

    for (const entry of entries) {
      await this.upsertSetting(entry.key, entry.group, entry.value, entry.description);
    }

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE_SETTING,
      objectType: TargetType.SETTING,
      objectId: 'site',
      ip,
      detail: {
        changedKeys: entries.map((entry) => entry.key),
      },
    });

    return this.getSiteSettings();
  }

  async uploadAvatar(file: UploadedAvatarFile | undefined, adminId: number, ip?: string): Promise<SiteSettings> {
    if (!file) {
      throw new BadRequestException('avatar file is required.');
    }

    const result = await this.uploadService.saveFile('avatar', file);
    if (result.kind === 'photo') {
      throw new BadRequestException('avatar upload failed.');
    }

    await this.upsertSetting(SETTING_KEYS.avatarUrl, 'site', result.url, 'Avatar URL');
    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE_SETTING,
      objectType: TargetType.SETTING,
      objectId: SETTING_KEYS.avatarUrl,
      ip,
      detail: {
        filename: result.filename,
        size: result.size,
      },
    });

    return this.getSiteSettings();
  }

  async getPublicAnnouncement(): Promise<AnnouncementView | null> {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        key: 'home',
        isEnabled: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return announcement ? toAnnouncementView(announcement) : null;
  }

  async getAdminAnnouncement(): Promise<AnnouncementView> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { key: 'home' },
    });

    return announcement
      ? toAnnouncementView(announcement)
      : {
          content: '',
          isEnabled: false,
          publishedAt: null,
          title: '',
        };
  }

  async updateAnnouncement(
    dto: UpdateAnnouncementDto,
    adminId: number,
    ip?: string,
  ): Promise<AnnouncementView> {
    const current = await this.getAdminAnnouncement();
    const title = normalizeString(dto.title ?? current.title, 'title');
    const content = normalizeString(dto.content ?? current.content, 'content');
    const isEnabled = dto.isEnabled ?? current.isEnabled;

    const announcement = await this.prisma.announcement.upsert({
      where: { key: 'home' },
      update: {
        content,
        isEnabled,
        publishedAt: isEnabled ? new Date() : null,
        title,
      },
      create: {
        content,
        isEnabled,
        key: 'home',
        publishedAt: isEnabled ? new Date() : null,
        title,
      },
    });

    await this.operationLogService.write({
      adminId,
      action: OperationType.UPDATE_SETTING,
      objectType: TargetType.ANNOUNCEMENT,
      objectId: 'home',
      ip,
      detail: {
        isEnabled: announcement.isEnabled,
        title: announcement.title,
      },
    });

    return toAnnouncementView(announcement);
  }

  private async upsertSetting(
    key: string,
    group: string,
    value: Prisma.InputJsonValue,
    description: string,
  ): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: {
        description,
        group,
        value,
      },
      create: {
        description,
        group,
        key,
        value,
      },
    });
  }
}

function siteSettingEntries(dto: UpdateSiteSettingsDto): Array<{
  key: string;
  group: string;
  value: Prisma.InputJsonValue;
  description: string;
}> {
  const entries: Array<{ key: string; group: string; value: Prisma.InputJsonValue; description: string }> = [];
  addStringEntry(entries, dto.siteName, SETTING_KEYS.siteName, 'site', 'Website name');
  addStringEntry(entries, dto.publicName, SETTING_KEYS.publicName, 'site', 'Public display name');
  addStringEntry(entries, dto.homeIntroduction, SETTING_KEYS.homeIntroduction, 'site', 'Home page introduction');
  addStringEntry(entries, dto.githubUrl, SETTING_KEYS.githubUrl, 'site', 'GitHub profile URL', true);
  addStringEntry(entries, dto.avatarUrl, SETTING_KEYS.avatarUrl, 'site', 'Avatar URL', true);
  addStringEntry(entries, dto.faviconUrl, SETTING_KEYS.faviconUrl, 'theme', 'Reserved favicon URL', true);
  addStringEntry(entries, dto.aboutContent, SETTING_KEYS.aboutContent, 'about', 'About page content');

  return entries;
}

function addStringEntry(
  entries: Array<{ key: string; group: string; value: Prisma.InputJsonValue; description: string }>,
  value: string | undefined,
  key: string,
  group: string,
  description: string,
  allowEmpty = false,
) {
  if (value === undefined) {
    return;
  }

  entries.push({
    description,
    group,
    key,
    value: allowEmpty ? value.trim() : normalizeString(value, key),
  });
}

function stringSetting(settings: Map<string, Prisma.JsonValue>, key: string, fallback: string): string {
  const value = settings.get(key);

  return typeof value === 'string' ? value : fallback;
}

function normalizeString(value: string, field: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException(`${field} is required.`);
  }

  return trimmed;
}

function toAnnouncementView(announcement: {
  title: string;
  content: string;
  isEnabled: boolean;
  publishedAt: Date | null;
}): AnnouncementView {
  return {
    content: announcement.content,
    isEnabled: announcement.isEnabled,
    publishedAt: announcement.publishedAt,
    title: announcement.title,
  };
}
