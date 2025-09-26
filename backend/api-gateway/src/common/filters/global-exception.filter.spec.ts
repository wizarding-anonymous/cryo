import { HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ServiceException } from '../exceptions/service.exception';
import { ServiceUnavailableException } from '../exceptions/service-unavailable.exception';
import { RateLimitExceededException } from '../exceptions/rate-limit-exceeded.exception';
import { ProxyTimeoutException } from '../exceptions/proxy-timeout.exception';

const makeHost = (url = '/api/x', headers: Record<string, any> = {}) => {
  const req = { headers, originalUrl: url } as any;
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(s: number) {
      this.statusCode = s;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any as ArgumentsHost;
  return { host, res, req };
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('HttpException handling', () => {
    it('should format HttpException correctly', () => {
      const { host, res } = makeHost();
      filter.catch(new HttpException({ error: 'TEST_ERROR', message: 'Test message' }, 400), host);
      
      expect(res.statusCode).toBe(400);
      expect(res.headers['X-Request-Id']).toBeDefined();
      expect(res.body.error).toBe('TEST_ERROR');
      expect(res.body.message).toBe('Test message');
      expect(res.body.statusCode).toBe(400);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toBe('/api/x');
      expect(res.body.service).toBe('api-gateway');
      expect(res.body.requestId).toBeDefined();
    });

    it('should handle HttpException with 4xx status (warning log)', () => {
      const { host, res } = makeHost();
      filter.catch(new HttpException('Client error', 404), host);
      
      expect(res.statusCode).toBe(404);
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should handle HttpException with 5xx status (error log)', () => {
      const { host, res } = makeHost();
      filter.catch(new HttpException('Server error', 500), host);
      
      expect(res.statusCode).toBe(500);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('ServiceException handling', () => {
    it('should handle ServiceException correctly', () => {
      const { host, res } = makeHost();
      const serviceException = new ServiceException('Service error', 503, 'user-service');
      filter.catch(serviceException, host);
      
      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('SERVICE_ERROR');
      expect(res.body.message).toBe('Service error');
      expect(res.body.service).toBe('user-service');
    });
  });

  describe('Custom exception handling', () => {
    it('should handle ServiceUnavailableException', () => {
      const { host, res } = makeHost();
      filter.catch(new ServiceUnavailableException('user-service'), host);
      
      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
      expect(res.body.message).toBe('user-service is temporarily unavailable');
    });

    it('should handle RateLimitExceededException', () => {
      const { host, res } = makeHost();
      filter.catch(new RateLimitExceededException(100, 60000), host);
      
      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.message).toBe('Rate limit exceeded: 100 requests per 60000ms');
    });

    it('should handle ProxyTimeoutException', () => {
      const { host, res } = makeHost();
      filter.catch(new ProxyTimeoutException('game-service', 5000), host);
      
      expect(res.statusCode).toBe(504);
      expect(res.body.error).toBe('PROXY_TIMEOUT');
      expect(res.body.message).toBe('Request to game-service timed out after 5000ms');
    });
  });

  describe('Unknown error handling', () => {
    it('should handle generic Error', () => {
      const { host, res } = makeHost();
      filter.catch(new Error('Something went wrong'), host);
      
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Error');
      expect(res.body.message).toBe('Something went wrong');
      expect(res.body.service).toBe('api-gateway');
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle unknown exception type', () => {
      const { host, res } = makeHost();
      filter.catch('unknown error', host);
      
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Error');
      expect(res.body.message).toBe('An unknown error occurred');
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('Request ID handling', () => {
    it('should use existing request ID from header', () => {
      const { host, res } = makeHost('/api/test', { 'x-request-id': 'existing-id' });
      filter.catch(new Error('test'), host);
      
      expect(res.headers['X-Request-Id']).toBe('existing-id');
      expect(res.body.requestId).toBe('existing-id');
    });

    it('should generate new request ID if none exists', () => {
      const { host, res } = makeHost();
      filter.catch(new Error('test'), host);
      
      expect(res.headers['X-Request-Id']).toBeDefined();
      expect(res.body.requestId).toBeDefined();
      expect(res.headers['X-Request-Id']).toBe(res.body.requestId);
    });

    it('should handle array of request IDs in header', () => {
      const { host, res } = makeHost('/api/test', { 'x-request-id': ['first-id', 'second-id'] });
      filter.catch(new Error('test'), host);
      
      expect(res.headers['X-Request-Id']).toBe('first-id');
      expect(res.body.requestId).toBe('first-id');
    });
  });

  describe('Logging functionality', () => {
    it('should log errors with correlation ID and context', () => {
      const { host } = makeHost('/api/test');
      const error = new Error('Test error');
      filter.catch(error, host);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'Unhandled Exception: Test error',
        error.stack,
        expect.objectContaining({
          requestId: expect.any(String),
          path: '/api/test',
          statusCode: 500,
          timestamp: expect.any(String),
        })
      );
    });

    it('should log HTTP 5xx errors', () => {
      const { host } = makeHost();
      filter.catch(new HttpException('Server error', 500), host);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        'HTTP Exception: Server error',
        expect.any(String),
        expect.objectContaining({
          requestId: expect.any(String),
          statusCode: 500,
        })
      );
    });
  });
});
