import { apiRequest } from './request';

export interface MascotConfig {
  id: number;
  key: string;
  name: string;
  imageUrl: string | null;
  displayScopes: string[];
  live2dConfig: unknown;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MascotConfigPayload {
  name: string;
  imageUrl: string | null;
  displayScopes: string[];
  live2dConfig: Record<string, unknown> | null;
  isEnabled: boolean;
}

export interface MascotLine {
  id: number;
  key: string;
  pageKey: string;
  content: string;
  weight: number;
  isRandom: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MascotLinePayload {
  key?: string;
  pageKey: string;
  content: string;
  weight: number;
  isRandom: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface UploadedMascotFile {
  kind: 'mascot';
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  relativePath: string;
  storagePath: string;
  url: string;
}

export function getMascotConfig() {
  return apiRequest<MascotConfig>('/admin/mascot/config');
}

export function updateMascotConfig(payload: MascotConfigPayload) {
  return apiRequest<MascotConfig>('/admin/mascot/config', {
    body: payload,
    method: 'PUT',
  });
}

export function listMascotLines() {
  return apiRequest<MascotLine[]>('/admin/mascot/lines');
}

export function createMascotLine(payload: MascotLinePayload) {
  return apiRequest<MascotLine>('/admin/mascot/lines', {
    body: payload,
    method: 'POST',
  });
}

export function updateMascotLine(id: number, payload: MascotLinePayload) {
  return apiRequest<MascotLine>(`/admin/mascot/lines/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteMascotLine(id: number) {
  return apiRequest<{ ok: true }>(`/admin/mascot/lines/${id}`, {
    method: 'DELETE',
  });
}

export function uploadMascotFile(file: File) {
  const body = new FormData();
  body.append('file', file);

  return apiRequest<UploadedMascotFile>('/admin/uploads/mascot', {
    body,
    method: 'POST',
  });
}
