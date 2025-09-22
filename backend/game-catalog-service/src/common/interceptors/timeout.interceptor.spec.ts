import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, delay } from 'rxjs';
import { TimeoutInterceptor, Timeout, TIMEOUT_METADATA } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeoutInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<TimeoutInterceptor>(TimeoutInterceptor);
    reflector = module.get<Reflector>(Reflector);

    mockRequest = {
      method: 'GET',
      url: '/games',
      requestId: 'test-request-id',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: jest.fn(),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should use default timeout when no custom timeout is set', (done) => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of('test response'));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toBe('test response');
          expect(reflector.get).toHaveBeenCalledWith(TIMEOUT_METADATA, undefined);
          done();
        },
        error: done,
      });
    });

    it('should use custom timeout when set via decorator', (done) => {
      const customTimeout = 5000;
      jest.spyOn(reflector, 'get').mockReturnValue(customTimeout);
      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of('test response'));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toBe('test response');
          expect(reflector.get).toHaveBeenCalledWith(TIMEOUT_METADATA, undefined);
          done();
        },
        error: done,
      });
    });

    it('should throw RequestTimeoutException when request times out', (done) => {
      const shortTimeout = 100;
      jest.spyOn(reflector, 'get').mockReturnValue(shortTimeout);
      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(
        of('delayed response').pipe(delay(200))
      );

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          done(new Error('Should have thrown timeout exception'));
        },
        error: (error) => {
          expect(error).toBeInstanceOf(RequestTimeoutException);
          expect(error.getResponse()).toMatchObject({
            message: `Request timeout after ${shortTimeout}ms`,
            code: 'REQUEST_TIMEOUT',
            endpoint: '/games',
            method: 'GET',
            timeout: shortTimeout,
          });
          expect(mockRequest.timedOut).toBe(true);
          expect(mockRequest.timeoutDuration).toBe(shortTimeout);
          done();
        },
      });
    });

    it('should pass through non-timeout errors', (done) => {
      const customError = new Error('Custom error');
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(throwError(() => customError));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          done(new Error('Should have thrown custom error'));
        },
        error: (error) => {
          expect(error).toBe(customError);
          expect(mockRequest.timedOut).toBeUndefined();
          done();
        },
      });
    });

    it('should handle request without requestId', (done) => {
      mockRequest.requestId = undefined;
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of('test response'));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: (value) => {
          expect(value).toBe('test response');
          done();
        },
        error: done,
      });
    });
  });

  describe('Timeout decorator', () => {
    it('should set timeout metadata on method', () => {
      const timeoutMs = 5000;
      
      class TestController {
        @Timeout(timeoutMs)
        testMethod() {
          return 'test';
        }
      }

      const controller = new TestController();
      const metadata = Reflect.getMetadata(TIMEOUT_METADATA, controller.testMethod);
      
      expect(metadata).toBe(timeoutMs);
    });

    it('should set timeout metadata on class', () => {
      const timeoutMs = 10000;
      
      @Timeout(timeoutMs)
      class TestController {
        testMethod() {
          return 'test';
        }
      }

      const metadata = Reflect.getMetadata(TIMEOUT_METADATA, TestController);
      
      expect(metadata).toBe(timeoutMs);
    });
  });
});