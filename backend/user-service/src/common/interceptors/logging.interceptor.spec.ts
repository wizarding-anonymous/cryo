import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log incoming request and successful response', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    const mockResponse = {
      statusCode: 200,
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

    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toBe('test response');
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Incoming Request: GET /test'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Outgoing Response: GET /test - Status: 200'),
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
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    const mockResponse = {
      statusCode: 500,
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

    const logSpy = jest.spyOn(interceptor['logger'], 'log');
    const errorSpy = jest.spyOn(interceptor['logger'], 'error');

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (error) => {
        expect(error).toBe(testError);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Incoming Request: POST /test'),
        );
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error Response: POST /test - Status: 400'),
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
      get: jest.fn().mockReturnValue(undefined),
    };

    const mockResponse = {
      statusCode: 200,
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

    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('User-Agent: '),
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
    };

    const mockResponse = {
      statusCode: 200,
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
  });
});
