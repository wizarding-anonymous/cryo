import type { ExecutionContext } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  it('sets X-Request-Id header', (done) => {
    const interceptor = new ResponseInterceptor();
    const headers: Record<string, any> = {};
    const req = { headers } as any;
    const resHeaders: Record<string, any> = {};
    const res = { setHeader: (k: string, v: string) => (resHeaders[k] = v) } as any;
    const ctx = ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any) as ExecutionContext;
    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe(() => {
      expect(resHeaders['X-Request-Id']).toBeDefined();
      done();
    });
  });
});

