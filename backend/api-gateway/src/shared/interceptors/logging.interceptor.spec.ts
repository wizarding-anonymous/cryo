import type { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  it('logs method and url', (done) => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined as any);
    const interceptor = new LoggingInterceptor();
    const req = { method: 'GET', originalUrl: '/api/x' } as any;
    const res = {} as any;
    const ctx = ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any) as ExecutionContext;
    interceptor.intercept(ctx, { handle: () => of('ok') } as any).subscribe(() => {
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      done();
    });
  });
});

