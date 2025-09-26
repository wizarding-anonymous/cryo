import type { ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from './cache.interceptor';
import { of } from 'rxjs';

describe('CacheInterceptor', () => {
  const make = (method = 'GET', url = '/api/games?x=1') => {
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
      getHeaders: () => resHeaders,
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
    const req = { method, originalUrl: url, headers: {} } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;
    return { ctx, req, res };
  };

  it('returns cached payload when present', (done) => {
    const client = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: { ok: true },
        }),
      ),
    } as any;
    const interceptor = new CacheInterceptor(
      { get: () => true } as any,
      { getClient: () => client } as any,
    );
    const { ctx, res } = make();
    interceptor
      .intercept(ctx, { handle: () => of('not-used') } as any)
      .subscribe({
        complete: () => {
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.send).toHaveBeenCalled();
          done();
        },
      });
  });

  it('skips non-GET methods', (done) => {
    const client = { get: jest.fn() } as any;
    const interceptor = new CacheInterceptor(
      { get: () => true } as any,
      { getClient: () => client } as any,
    );
    const { ctx } = make('POST');
    let called = false;
    interceptor
      .intercept(ctx, { handle: () => of('ok') } as any)
      .subscribe(() => {
        called = true;
      });
    setTimeout(() => {
      expect(called).toBe(true);
      done();
    }, 0);
  });
});
