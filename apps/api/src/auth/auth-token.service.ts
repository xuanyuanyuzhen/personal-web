import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { isProduction } from '../config/env';

export type AuthTokenPayload = {
  sub: number;
  adminId: number;
  username: string;
  passwordVersion: number;
  exp: number;
};

@Injectable()
export class AuthTokenService {
  sign(input: Omit<AuthTokenPayload, 'exp'>, expiresInSeconds: number): string {
    const header = this.encodeJson({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encodeJson({
      ...input,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
    const signature = this.signPart(`${header}.${payload}`);

    return `${header}.${payload}.${signature}`;
  }

  verify(token: string): AuthTokenPayload {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const expected = this.signPart(`${header}.${payload}`);
    if (!this.safeEquals(signature, expected)) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const decoded = this.decodePayload(payload);
    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Authentication token expired.');
    }

    return decoded;
  }

  private encodeJson(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decodePayload(payload: string): AuthTokenPayload {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<AuthTokenPayload>;

    if (
      typeof parsed.sub !== 'number' ||
      typeof parsed.adminId !== 'number' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.passwordVersion !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return parsed as AuthTokenPayload;
  }

  private signPart(value: string): string {
    return createHmac('sha256', this.secret()).update(value).digest('base64url');
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private secret(): string {
    const configured = process.env.JWT_SECRET?.trim();
    if (configured) {
      return configured;
    }

    // 生产环境不允许兜底：`validateEnvironment()` 已在启动期拦下这种情况，
    // 这里再挡一次，避免将来有人绕过启动校验直接用到这个 service。
    if (isProduction()) {
      throw new Error('JWT_SECRET is not configured.');
    }

    return 'local-development-jwt-secret';
  }
}
