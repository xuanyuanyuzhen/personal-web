import { apiRequest } from './request';
import type { ListResult } from './content';

export type TargetType =
  | 'SITE'
  | 'NAVIGATION'
  | 'PAGE'
  | 'THOUGHT'
  | 'ESSAY'
  | 'ESSAY_CATEGORY'
  | 'PHOTO'
  | 'ALBUM'
  | 'MESSAGE'
  | 'COMMENT'
  | 'MUSIC'
  | 'TAG'
  | 'MASCOT'
  | 'ANNOUNCEMENT'
  | 'SETTING';

export type OperationType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'PERMANENT_DELETE'
  | 'AUDIT'
  | 'CHANGE_PASSWORD'
  | 'UPDATE_SETTING';

export interface AdminSummary {
  id: number;
  username: string;
  displayName: string;
}

export interface RecycleBinItem {
  id: number;
  objectType: TargetType;
  objectId: string;
  title: string;
  summary: string | null;
  status: 'ACTIVE' | 'RESTORED' | 'PURGED';
  deletedById: number | null;
  deletedBy: AdminSummary | null;
  deletedAt: string;
  restoredAt: string | null;
  purgedAt: string | null;
}

export interface OperationLogItem {
  id: number;
  adminId: number | null;
  admin: AdminSummary | null;
  action: OperationType;
  objectType: TargetType | null;
  objectId: string | null;
  ip: string | null;
  detail: unknown;
  createdAt: string;
}

export interface RecycleBinQuery {
  page: number;
  pageSize: number;
  objectType?: TargetType | '';
  search?: string;
}

export interface OperationLogQuery {
  page: number;
  pageSize: number;
  action?: OperationType | '';
  objectType?: TargetType | '';
  search?: string;
}

export function listRecycleBin(query: RecycleBinQuery) {
  const params = buildQuery(query);

  return apiRequest<ListResult<RecycleBinItem>>(`/admin/recycle-bin?${params.toString()}`);
}

export function restoreRecycleBinItem(id: number) {
  return apiRequest<{ ok: true }>(`/admin/recycle-bin/${id}/restore`, {
    method: 'POST',
  });
}

export function purgeRecycleBinItem(id: number) {
  return apiRequest<{ ok: true }>(`/admin/recycle-bin/${id}/purge`, {
    method: 'DELETE',
  });
}

export function listOperationLogs(query: OperationLogQuery) {
  const params = buildQuery(query);

  if (query.action) {
    params.set('action', query.action);
  }

  return apiRequest<ListResult<OperationLogItem>>(`/admin/operation-logs?${params.toString()}`);
}

function buildQuery(query: RecycleBinQuery | OperationLogQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.objectType) {
    params.set('objectType', query.objectType);
  }
  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  return params;
}
