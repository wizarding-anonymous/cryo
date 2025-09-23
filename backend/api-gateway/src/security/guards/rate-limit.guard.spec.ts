import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitExceededException } from '../../common/exceptions/rate-limit-exceeded.exception';

describe('RateLimitGuard', () => {
  const makeCtx = (method = 'GET', url = '/api/test'): ExecutionContext => {
    const headers: Record<string, any> = {};
    const req = {
      method,
      originalUrl: url,
      headers,
      ip: '1.2.3.4',
      socket: { remoteAddress: '1.2.3.4' },
    } as any;
    const resHeaders: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        resHeaders[k] = v;
      },
      getHeaders: () => resHeaders,
    } as any;
    return ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any) as ExecutionContext;
  };

  it('bypasses when disabled', async () => {
    const svc = { isEnabled: () => false } as any;
    const guard = new RateLimitGuard(svc);
    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);
  });

  it('allows when within limit and sets headers', async () => {
    const svc = {
      isEnabled: () => true,
      check: jest.fn().mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: Date.now() + 1000, windowMs: 1000 }),
    } as any;
    const guard = new RateLimitGuard(svc);
    await expect(guard.canActivate(makeCtx())).resolves.toBe(true);
    expect(svc.check).toHaveBeenCalled();
  });

  it('throws when limit exceeded', async () => {
    const svc = {
      isEnabled: () => true,
      check: jest.fn().mockResolvedValue({ allowed: false, limit: 1, remaining: 0, reset: Date.now() + 1000, windowMs: 1000 }),
    } as any;
    const guard = new RateLimitGuard(svc);
    await expect(guard.canActivate(makeCtx())).rejects.toBeInstanceOf(RateLimitExceededException);
  });
});

