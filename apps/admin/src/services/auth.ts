import { reactive } from 'vue';
import { apiRequest } from './request';

export interface AdminUser {
  displayName?: string;
  id?: number | string;
  nickname?: string;
  username: string;
}

export interface LoginPayload {
  password: string;
  rememberMe: boolean;
  username: string;
}

interface AuthState {
  checking: boolean;
  initialized: boolean;
  user: AdminUser | null;
}

export const authState = reactive<AuthState>({
  checking: false,
  initialized: false,
  user: null,
});

function normalizeUser(payload: unknown): AdminUser {
  const maybeWrapped = payload as { admin?: unknown; user?: unknown };
  const user = (maybeWrapped.user ?? maybeWrapped.admin ?? payload) as Partial<AdminUser>;

  return {
    ...user,
    username: user.username ?? 'admin',
  };
}

export function clearCurrentUser() {
  authState.user = null;
  authState.initialized = true;
}

export async function login(payload: LoginPayload) {
  const response = await apiRequest<unknown>('/auth/login', {
    body: payload,
    method: 'POST',
  });
  const user = normalizeUser(response);
  authState.user = user;
  authState.initialized = true;
  return user;
}

export async function logout() {
  try {
    await apiRequest<null>('/auth/logout', { method: 'POST' });
  } finally {
    clearCurrentUser();
  }
}

export async function fetchCurrentUser(force = false) {
  if (!force && authState.user) {
    return authState.user;
  }

  authState.checking = true;

  try {
    const response = await apiRequest<unknown>('/auth/me');
    const user = normalizeUser(response);
    authState.user = user;
    authState.initialized = true;
    return user;
  } catch (error) {
    clearCurrentUser();
    throw error;
  } finally {
    authState.checking = false;
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest<unknown>('/auth/change-password', {
    body: {
      currentPassword,
      newPassword,
    },
    method: 'POST',
  });
}
