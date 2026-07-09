import { Request } from 'express';
import { MaybeAuthenticatedRequest } from './auth.types';

export function isAdminPreviewRequest(request: Request): boolean {
  const value = request.headers['x-admin-preview'];
  const normalized = Array.isArray(value) ? value[0] : value;

  return normalized === '1' || normalized === 'true';
}

export function isAuthenticatedAdminPreview(request: MaybeAuthenticatedRequest): boolean {
  return isAdminPreviewRequest(request) && Boolean(request.admin);
}
