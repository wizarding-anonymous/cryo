import { LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingMiddleware } from './logging.middleware';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logger: jest.Mocked<LoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

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
      originalUrl: '/api/test',
      url: '/api/test',
      ip: '192.168.1.1',
      headers: {},
    };

    const eventListeners: { [key: string]: Function } = {};
    mockResponse = {
      statusCode: 200,
      on: jest.fn((event: string, callback: Function) => {
        eventListeners[event] = callback;
        return mockResponse as Response;
      }),
    };

    // Helper to trigger response events
    (mockResponse as any).triggerEvent = (event: string) => {
      if (eventListeners[event]) {
        eventListeners[event]();
      }
    };

    nextFunction = jest.fn();

    middleware = new LoggingMiddleware(logger);
  });

  describe('use', () => {
    it('should log HTTP request when response finishes', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();

      // Simulate response finishing
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 200,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: null,
        correlationId: undefined,
      });
    });

    it('should use x-forwarded-for header when available', () => {
      mockRequest.headers!['x-forwarded-for'] = '203.0.113.1, 192.168.1.1';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 200,
        durationMs: expect.any(Number),
        ip: '203.0.113.1',
        userId: null,
        correlationId: undefined,
      });
    });

    it('should log correlation ID when provided', () => {
      mockRequest.headers!['x-correlation-id'] = 'corr-123-456';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 200,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: null,
        correlationId: 'corr-123-456',
      });
    });

    it('should log user ID when user is authenticated', () => {
      (mockRequest as any).user = { id: 'user123' };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 200,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: 'user123',
        correlationId: undefined,
      });
    });

    it('should use url when originalUrl is not available', () => {
      delete mockRequest.originalUrl;

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 200,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: null,
        correlationId: undefined,
      });
    });

    it('should measure request duration', () => {
      const startTime = Date.now();

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      // Simulate some processing time
      setTimeout(() => {
        (mockResponse as any).triggerEvent('finish');

        const logCall = logger.log.mock.calls[0];
        const loggedDuration = logCall[1].durationMs;
        expect(loggedDuration).toBeGreaterThanOrEqual(0);
        expect(loggedDuration).toBeLessThan(1000); // Should be reasonable for this test
      }, 10);
    });

    it('should handle POST requests with different status codes', () => {
      mockRequest.method = 'POST';
      mockResponse.statusCode = 201;

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'POST',
        url: '/api/test',
        status: 201,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: null,
        correlationId: undefined,
      });
    });

    it('should handle error status codes', () => {
      mockResponse.statusCode = 500;

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
      (mockResponse as any).triggerEvent('finish');

      expect(logger.log).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/test',
        status: 500,
        durationMs: expect.any(Number),
        ip: '192.168.1.1',
        userId: null,
        correlationId: undefined,
      });
    });

    it('should call next function immediately', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });
  });
});