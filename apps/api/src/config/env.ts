/**
 * 启动期环境变量校验。
 *
 * 生产环境下缺失或仍是占位值的关键配置必须让进程直接退出，
 * 而不是静默回退到 `.env.example` 里的示例值。
 */

/** `.env.example` 中的占位值，出现在生产环境即视为未配置。 */
const placeholderValues = new Set([
  'change-me',
  'replace-with-a-long-random-secret',
  'local-development-jwt-secret',
  'admin123',
]);

const MIN_SECRET_LENGTH = 32;

export type AppEnvironment = 'development' | 'production' | 'test';

export function resolveEnvironment(): AppEnvironment {
  const raw = process.env.NODE_ENV?.trim().toLowerCase();

  if (raw === 'production' || raw === 'test') {
    return raw;
  }

  return 'development';
}

export function isProduction(): boolean {
  return resolveEnvironment() === 'production';
}

function isPlaceholder(value: string): boolean {
  return placeholderValues.has(value.trim().toLowerCase());
}

/**
 * 校验生产环境必需的配置。开发环境只提示，不阻塞启动。
 *
 * @throws 生产环境下配置缺失或为占位值时抛出，阻止进程带着不安全的默认值上线。
 */
export function validateEnvironment(logger: Pick<Console, 'warn'> = console): void {
  const problems: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    problems.push('JWT_SECRET is required.');
  } else if (isPlaceholder(jwtSecret)) {
    problems.push('JWT_SECRET is still the example placeholder value.');
  } else if (jwtSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    problems.push('DATABASE_URL is required.');
  } else if (databaseUrl.split(/[:@]/).some(isPlaceholder)) {
    problems.push('DATABASE_URL still contains the example placeholder password.');
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (initialPassword && isPlaceholder(initialPassword)) {
    warnings.push(
      'ADMIN_INITIAL_PASSWORD is still the default seed password. Change the admin password after first login.',
    );
  }

  if (!process.env.CORS_ALLOWED_ORIGINS?.trim()) {
    warnings.push(
      'CORS_ALLOWED_ORIGINS is not set. Browser cross-origin credentialed requests will be rejected.',
    );
  }

  if (!isProduction()) {
    for (const problem of [...problems, ...warnings]) {
      logger.warn(`[config] ${problem}`);
    }

    return;
  }

  for (const warning of warnings) {
    logger.warn(`[config] ${warning}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with invalid configuration:\n${problems
        .map((problem) => `  - ${problem}`)
        .join('\n')}`,
    );
  }
}

/**
 * 登录 cookie 是否加 `Secure`。
 *
 * 单独用 `COOKIE_SECURE` 控制，而不是只看 `NODE_ENV`：生产启动脚本未必设置
 * `NODE_ENV`，一旦漏设就会把登录 cookie 降级成明文传输。显式配置优先，
 * 没配时才回退到环境判断。
 */
export function useSecureCookie(): boolean {
  const configured = process.env.COOKIE_SECURE?.trim().toLowerCase();

  if (configured === 'true' || configured === '1') {
    return true;
  }

  if (configured === 'false' || configured === '0') {
    return false;
  }

  return isProduction();
}

/**
 * 允许携带凭证的跨域来源白名单。
 *
 * 未配置时返回空数组，此时不启用跨域 —— 同源部署（反向代理到同一域名）不需要它。
 */
export function corsAllowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
