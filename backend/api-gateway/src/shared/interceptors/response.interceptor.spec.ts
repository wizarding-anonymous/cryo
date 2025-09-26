import type { ExecutionContext } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('sets standard response headers', (done) => {
    const headers: Record<string, any> = {};
    const req = { headers } as any;
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
    } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    interceptor
      .intercept(ctx, { handle: () => of('ok') } as any)
      .subscribe(() => {
        expect(resHeaders['X-Request-Id']).toBeDefined();
        expect(resHeaders['X-Timestamp']).toBeDefined();
        expect(resHeaders['X-Gateway-Version']).toBe('1.0.0');
        expect(resHeaders['X-Content-Type-Options']).toBe('nosniff');
        expect(resHeaders['X-Frame-Options']).toBe('DENY');
        expect(resHeaders['X-XSS-Protection']).toBe('1; mode=block');
        done();
      });
  });

  it('adds metadata to object responses', (done) => {
    const headers: Record<string, any> = {};
    const req = { headers } as any;
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
    } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    const responseData = { message: 'success', data: [] };

    interceptor
      .intercept(ctx, { handle: () => of(responseData) } as any)
      .subscribe((result) => {
        expect(result._metadata).toBeDefined();
        expect(result._metadata.requestId).toBeDefined();
        expect(result._metadata.timestamp).toBeDefined();
        expect(result._metadata.gateway).toBe('cryo-api-gateway');
        expect(result.message).toBe('success');
        expect(result.data).toEqual([]);
        done();
      });
  });

  it('does not modify non-object responses', (done) => {
    const headers: Record<string, any> = {};
    const req = { headers } as any;
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
    } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    interceptor
      .intercept(ctx, { handle: () => of('plain string') } as any)
      .subscribe((result) => {
        expect(result).toBe('plain string');
        done();
      });
  });

  it('uses existing request ID from headers', (done) => {
    const existingRequestId = 'existing-123';
    const headers: Record<string, any> = { 'x-request-id': existingRequestId };
    const req = { headers } as any;
    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: (k: string, v: string) => (resHeaders[k] = v),
    } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    interceptor
      .intercept(ctx, { handle: () => of({ test: true }) } as any)
      .subscribe((result) => {
        expect(resHeaders['X-Request-Id']).toBe(existingRequestId);
        expect(result._metadata.requestId).toBe(existingRequestId);
        done();
      });
  });
});
