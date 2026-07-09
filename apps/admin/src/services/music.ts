import { apiRequest } from './request';
import type { ListQuery, ListResult } from './content';

export interface MusicItem {
  id: number;
  title: string;
  artist: string;
  localUrl: string | null;
  externalUrl: string | null;
  lyricText: string | null;
  lyricFileUrl: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MusicPayload {
  title: string;
  artist: string;
  localUrl: string | null;
  externalUrl: string | null;
  lyricText: string | null;
  lyricFileUrl: string | null;
  sortOrder: number;
  isEnabled: boolean;
}

export interface UploadedMusicFile {
  kind: 'music' | 'lyric';
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  relativePath: string;
  storagePath: string;
  url: string;
}

export function listMusic(query: ListQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  return apiRequest<ListResult<MusicItem>>(`/admin/music?${params.toString()}`);
}

export function createMusic(payload: MusicPayload) {
  return apiRequest<MusicItem>('/admin/music', {
    body: payload,
    method: 'POST',
  });
}

export function updateMusic(id: number, payload: MusicPayload) {
  return apiRequest<MusicItem>(`/admin/music/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteMusic(id: number) {
  return apiRequest<{ ok: true }>(`/admin/music/${id}`, {
    method: 'DELETE',
  });
}

export function uploadMusicFile(file: File) {
  return uploadFile('music', file);
}

export function uploadLyricFile(file: File) {
  return uploadFile('lyric', file);
}

function uploadFile(kind: 'lyric' | 'music', file: File) {
  const body = new FormData();
  body.append('file', file);

  return apiRequest<UploadedMusicFile>(`/admin/uploads/${kind}`, {
    body,
    method: 'POST',
  });
}
