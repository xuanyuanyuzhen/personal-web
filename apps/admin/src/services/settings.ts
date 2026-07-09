import { apiRequest } from './request';

export interface SiteSettings {
  siteName: string;
  publicName: string;
  homeIntroduction: string;
  githubUrl: string;
  avatarUrl: string;
  faviconUrl: string;
  aboutContent: string;
  theme: unknown;
}

export interface SiteSettingsPayload {
  siteName: string;
  publicName: string;
  homeIntroduction: string;
  githubUrl: string;
  avatarUrl: string;
  faviconUrl: string;
  aboutContent: string;
}

export interface Announcement {
  title: string;
  content: string;
  isEnabled: boolean;
  publishedAt: string | null;
}

export interface AnnouncementPayload {
  title: string;
  content: string;
  isEnabled: boolean;
}

export function getSiteSettings() {
  return apiRequest<SiteSettings>('/site/settings');
}

export function updateSiteSettings(payload: SiteSettingsPayload) {
  return apiRequest<SiteSettings>('/admin/settings', {
    body: payload,
    method: 'PUT',
  });
}

export function uploadAvatar(file: File) {
  const body = new FormData();
  body.append('file', file);

  return apiRequest<SiteSettings>('/admin/settings/avatar', {
    body,
    method: 'POST',
  });
}

export function getAdminAnnouncement() {
  return apiRequest<Announcement>('/admin/announcement');
}

export function updateAnnouncement(payload: AnnouncementPayload) {
  return apiRequest<Announcement>('/admin/announcement', {
    body: payload,
    method: 'PUT',
  });
}
