import type { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation();
    errorSpy = jest
      .spyOn((interceptor as any).logger, 'error')
      .mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs successful requests with timing', (done) => {
    const req = {
      method: 'GET',
      originalUrl: '/api/games',
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const res = { statusCode: 200 } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    interceptor
      .intercept(ctx, { handle: () => of('ok') } as any)
      .subscribe(() => {
        expect(logSpy).toHaveBeenCalledTimes(2); // Request and response logs
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/games - 127.0.0.1 - test-agent'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/games - 200 -'),
        );
        done();
      });
  });

  it('logs errors with timing and stack trace', (done) => {
    const error = new Error('Test error');
    (error as any).status = 500;

    const req = {
      method: 'POST',
      originalUrl: '/api/users',
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const res = { statusCode: 500 } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any as ExecutionContext;

    interceptor
      .intercept(ctx, { handle: () => throwError(() => error) } as any)
      .subscribe({
        error: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('POST /api/users - 127.0.0.1 - test-agent'),
          );
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('POST /api/users - 500 -'),
            expect.any(String),
          );
          done();
        },
      });
  });
});
