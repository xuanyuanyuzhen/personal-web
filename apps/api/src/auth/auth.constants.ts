export const AUTH_COOKIE_NAME = 'yuer_admin_token';

export const AUTH_EXPIRES_IN_SECONDS = {
  default: 24 * 60 * 60,
  rememberMe: 7 * 24 * 60 * 60,
} as const;
