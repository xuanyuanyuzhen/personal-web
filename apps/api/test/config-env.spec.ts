import { corsAllowedOrigins, useSecureCookie, validateEnvironment } from '../src/config/env';

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

function silentLogger() {
  return { warn: jest.fn() };
}

describe('validateEnvironment', () => {
  afterEach(resetEnv);

  it('rejects production startup when JWT_SECRET is the example placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'replace-with-a-long-random-secret';
    process.env.DATABASE_URL = 'mysql://user:realpassword@127.0.0.1:3306/yuer';

    expect(() => validateEnvironment(silentLogger())).toThrow(/JWT_SECRET/);
  });

  it('rejects production startup when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'mysql://user:realpassword@127.0.0.1:3306/yuer';

    expect(() => validateEnvironment(silentLogger())).toThrow(/JWT_SECRET is required/);
  });

  it('rejects production startup when JWT_SECRET is too short', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short-secret';
    process.env.DATABASE_URL = 'mysql://user:realpassword@127.0.0.1:3306/yuer';

    expect(() => validateEnvironment(silentLogger())).toThrow(/at least 32 characters/);
  });

  it('rejects production startup when DATABASE_URL keeps the placeholder password', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(48);
    process.env.DATABASE_URL = 'mysql://yuer:change-me@127.0.0.1:3306/yuer';

    expect(() => validateEnvironment(silentLogger())).toThrow(/DATABASE_URL/);
  });

  it('accepts a fully configured production environment', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(48);
    process.env.DATABASE_URL = 'mysql://user:realpassword@127.0.0.1:3306/yuer';
    process.env.CORS_ALLOWED_ORIGINS = 'https://example.com';

    expect(() => validateEnvironment(silentLogger())).not.toThrow();
  });

  it('only warns in development so local setup stays frictionless', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    const logger = silentLogger();

    expect(() => validateEnvironment(logger)).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('useSecureCookie', () => {
  afterEach(resetEnv);

  it('is enabled by explicit COOKIE_SECURE even when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    process.env.COOKIE_SECURE = 'true';

    expect(useSecureCookie()).toBe(true);
  });

  it('can be explicitly disabled for plain-HTTP deployments', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';

    expect(useSecureCookie()).toBe(false);
  });

  it('falls back to the environment when unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SECURE;

    expect(useSecureCookie()).toBe(true);
  });
});

describe('corsAllowedOrigins', () => {
  afterEach(resetEnv);

  it('returns an empty list when unset so cross-origin stays disabled', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;

    expect(corsAllowedOrigins()).toEqual([]);
  });

  it('splits, trims and strips trailing slashes', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://a.com/, https://b.com , ';

    expect(corsAllowedOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });
});
