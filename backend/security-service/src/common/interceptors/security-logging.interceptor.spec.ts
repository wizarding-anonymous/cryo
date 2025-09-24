import { ExecutionContext, CallHandler, LoggerService } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { SecurityLoggingInterceptor } from './security-logging.interceptor';

describe('SecurityLoggingInterceptor', () => {
  let interceptor: SecurityLoggingInterceptor;
  let logger: jest.Mocked<LoggerService>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    mockRequest = {
      method: 'GET',
      originalUrl: '/api/security/test',
      url: '/api/security/test',
      ip: '192.168.1.1',
      headers: {},
    };

    mockResponse = {
      statusCode: 200,
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    interceptor = new SecurityLoggingInterceptor(logger);
  });

  describe('intercept', () => {
    it('should log successful request with basic information', (done) => {
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toBe('success');
        },
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'GET',
            url: '/api/security/test',
            status: 200,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: null,
            correlationId: undefined,
          });
          done();
        },
      });
    });

    it('should log request with user information when authenticated', (done) => {
      mockRequest.user = { id: 'user123' };
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'GET',
            url: '/api/security/test',
            status: 200,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: 'user123',
            correlationId: undefined,
          });
          done();
        },
      });
    });

    it('should use x-forwarded-for header when available', (done) => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.1, 192.168.1.1';
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'GET',
            url: '/api/security/test',
            status: 200,
            durationMs: expect.any(Number),
            ip: '203.0.113.1',
            userId: null,
            correlationId: undefined,
          });
          done();
        },
      });
    });

    it('should log correlation ID when provided', (done) => {
      mockRequest.headers['x-correlation-id'] = 'corr-123-456';
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'GET',
            url: '/api/security/test',
            status: 200,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: null,
            correlationId: 'corr-123-456',
          });
          done();
        },
      });
    });

    it('should use url when originalUrl is not available', (done) => {
      delete mockRequest.originalUrl;
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'GET',
            url: '/api/security/test',
            status: 200,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: null,
            correlationId: undefined,
          });
          done();
        },
      });
    });

    it('should log error when request fails', (done) => {
      const error = new Error('Test error');
      mockResponse.statusCode = 500;
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(logger.warn).toHaveBeenCalledWith('Security API error', {
            method: 'GET',
            url: '/api/security/test',
            status: 500,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: null,
            error: 'Test error',
            correlationId: undefined,
          });
          done();
        },
      });
    });

    it('should measure request duration accurately', (done) => {
      const startTime = Date.now();
      mockCallHandler.handle.mockReturnValue(of('success'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      // Add a small delay to test duration measurement
      setTimeout(() => {
        result$.subscribe({
          complete: () => {
            const logCall = logger.log.mock.calls[0];
            const loggedDuration = logCall[1].durationMs;
            expect(loggedDuration).toBeGreaterThanOrEqual(0);
            expect(loggedDuration).toBeLessThan(1000); // Should be less than 1 second for this test
            done();
          },
        });
      }, 10);
    });

    it('should handle POST requests correctly', (done) => {
      mockRequest.method = 'POST';
      mockResponse.statusCode = 201;
      mockCallHandler.handle.mockReturnValue(of({ id: 'created' }));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(logger.log).toHaveBeenCalledWith('Security API access', {
            method: 'POST',
            url: '/api/security/test',
            status: 201,
            durationMs: expect.any(Number),
            ip: '192.168.1.1',
            userId: null,
            correlationId: undefined,
          });
          done();
        },
      });
    });
  });
});