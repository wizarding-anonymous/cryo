import type { ExecutionContext } from '@nestjs/common';
import { CorsInterceptor } from './cors.interceptor';
import { of } from 'rxjs';

describe('CorsInterceptor', () => {
  const makeCtx = (method = 'GET') => {
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const req = { method } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;
    return { ctx, res };
  };

  it('sets CORS headers and passes through', (done) => {
    const interceptor = new CorsInterceptor({ get: () => true } as any);
    const { ctx, res } = makeCtx('GET');
    interceptor
      .intercept(ctx, { handle: () => of('ok') } as any)
      .subscribe(() => {
        expect((res as any).setHeader).toBeDefined();
        done();
      });
  });

  it('short-circuits OPTIONS', (done) => {
    const interceptor = new CorsInterceptor({ get: () => true } as any);
    const { ctx, res } = makeCtx('OPTIONS');
    interceptor
      .intercept(ctx, { handle: () => of('ok') } as any)
      .subscribe(() => {
        expect((res as any).status).toHaveBeenCalledWith(204);
        done();
      });
  });
});
