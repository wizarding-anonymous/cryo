import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggingService } from '../logging/logging.service';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let loggingService: LoggingService;

  beforeEach(async () => {
    const mockLoggingService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logSecurityEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log incoming request and successful response', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {
        'x-correlation-id': 'test-correlation-id',
        'user-agent': 'test-user-agent',
      },
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    const mockResponse = {
      statusCode: 200,
      get: jest.fn().mockReturnValue('application/json'),
      setHeader: jest.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of('test response'),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toBe('test response');
        expect(loggingService.info).toHaveBeenCalledTimes(2);
        expect(loggingService.info).toHaveBeenCalledWith(
          'Incoming HTTP request',
          expect.objectContaining({
            operation: 'GET /test',
            metadata: expect.objectContaining({
              method: 'GET',
              url: '/test',
            }),
          }),
        );
        expect(loggingService.info).toHaveBeenCalledWith(
          'HTTP request completed successfully',
          expect.objectContaining({
            operation: 'GET /test',
            metadata: expect.objectContaining({
              statusCode: 200,
            }),
          }),
        );
        done();
      },
    });
  });

  it('should log incoming request and error response', (done) => {
    const mockRequest = {
      method: 'POST',
      url: '/test',
      ip: '127.0.0.1',
      headers: {
        'x-correlation-id': 'test-correlation-id',
        'user-agent': 'test-user-agent',
      },
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    const mockResponse = {
      statusCode: 500,
      get: jest.fn().mockReturnValue('application/json'),
      setHeader: jest.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const testError = new Error('Test error');
    (testError as any).status = 400;

    const mockCallHandler = {
      handle: () => throwError(() => testError),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (error) => {
        expect(error).toBe(testError);
        expect(loggingService.info).toHaveBeenCalledWith(
          'Incoming HTTP request',
          expect.objectContaining({
            operation: 'POST /test',
          }),
        );
        expect(loggingService.error).toHaveBeenCalledWith(
          'HTTP request failed',
          expect.objectContaining({
            operation: 'POST /test',
            metadata: expect.objectContaining({
              statusCode: 400,
            }),
          }),
          testError,
        );
        done();
      },
    });
  });

  it('should handle missing user agent', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {
        'x-correlation-id': 'test-correlation-id',
      },
      get: jest.fn().mockReturnValue(undefined),
    };

    const mockResponse = {
      statusCode: 200,
      get: jest.fn().mockReturnValue('application/json'),
      setHeader: jest.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of('test response'),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect(loggingService.info).toHaveBeenCalledWith(
          'Incoming HTTP request',
          expect.objectContaining({
            userAgent: '',
          }),
        );
        done();
      },
    });
  });

  it('should add correlation ID to request', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      headers: {},
    };

    const mockResponse = {
      statusCode: 200,
      get: jest.fn().mockReturnValue('application/json'),
      setHeader: jest.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of('test response'),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect((mockRequest as any).correlationId).toBeDefined();
        expect(typeof (mockRequest as any).correlationId).toBe('string');
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-Correlation-ID',
          (mockRequest as any).correlationId,
        );
        done();
      },
    });
  });

  it('should generate unique correlation IDs', () => {
    const id1 = interceptor['generateCorrelationId']();
    const id2 = interceptor['generateCorrelationId']();

    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
    expect(id2.length).toBeGreaterThan(0);
  });
});
