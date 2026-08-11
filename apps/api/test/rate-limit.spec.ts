import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitGuard, RateLimitOptions } from '../src/common/rate-limit.guard';

type ContextInput = {
  ip?: string;
  handlerName?: string;
  className?: string;
};

function createContext({
  ip = '203.0.113.1',
  handlerName = 'submit',
  className = 'TestController',
}: ContextInput = {}) {
  const setHeader = jest.fn();

  const context = {
    getHandler: () => ({ name: handlerName }),
    getClass: () => ({ name: className }),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        ip,
        socket: { remoteAddress: ip },
      }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;

  return { context, setHeader };
}

function createGuard(options: RateLimitOptions | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === RATE_LIMIT_KEY ? options : undefined)),
  } as unknown as Reflector;

  return new RateLimitGuard(reflector);
}

describe('RateLimitGuard', () => {
  it('allows routes without a rate limit configured', () => {
    const guard = createGuard(undefined);
    const { context } = createContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows requests up to the limit and rejects the next one', () => {
    const guard = createGuard({ limit: 3, windowMs: 60_000 });
    const { context } = createContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );
  });

  it('sets Retry-After when rejecting', () => {
    const guard = createGuard({ limit: 1, windowMs: 60_000 });
    const { context, setHeader } = createContext();

    guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow();

    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('counts each client address separately', () => {
    const guard = createGuard({ limit: 1, windowMs: 60_000 });
    const first = createContext({ ip: '203.0.113.1' });
    const second = createContext({ ip: '198.51.100.7' });

    expect(guard.canActivate(first.context)).toBe(true);
    expect(guard.canActivate(second.context)).toBe(true);
  });

  it('counts each route separately', () => {
    const guard = createGuard({ limit: 1, windowMs: 60_000 });
    const login = createContext({ handlerName: 'login' });
    const submit = createContext({ handlerName: 'submit' });

    expect(guard.canActivate(login.context)).toBe(true);
    expect(guard.canActivate(submit.context)).toBe(true);
  });

  it('lets the window expire so blocked clients recover', () => {
    jest.useFakeTimers();
    try {
      const guard = createGuard({ limit: 1, windowMs: 1_000 });
      const { context } = createContext();

      expect(guard.canActivate(context)).toBe(true);
      expect(() => guard.canActivate(context)).toThrow();

      jest.advanceTimersByTime(1_500);

      expect(guard.canActivate(context)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
