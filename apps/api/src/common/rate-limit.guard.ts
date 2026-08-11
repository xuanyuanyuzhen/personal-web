import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { getRequestIp } from '../auth/request-ip';

export type RateLimitOptions = {
  /** 时间窗内允许的最大请求数。 */
  limit: number;
  /** 时间窗长度（毫秒）。 */
  windowMs: number;
};

export const RATE_LIMIT_KEY = 'rate-limit-options';

/** 给单个路由或整个控制器设置限流阈值。 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

type Counter = {
  count: number;
  expiresAt: number;
};

/**
 * 基于内存的固定窗口限流。
 *
 * 单实例部署足够；如果将来横向扩容到多实例，需要换成 Redis 之类的共享存储，
 * 因为每个进程各自计数会让实际阈值变成 N 倍。
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    this.sweep(now);

    const key = `${context.getClass().name}.${context.getHandler().name}:${getRequestIp(request) ?? 'unknown'}`;
    const counter = this.counters.get(key);

    if (!counter || counter.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + options.windowMs });
      return true;
    }

    counter.count += 1;

    if (counter.count > options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((counter.expiresAt - now) / 1000));
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', String(retryAfterSeconds));

      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /** 惰性清理过期计数，避免 Map 随访客 IP 无上限增长。 */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) {
      return;
    }

    this.lastSweep = now;

    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
