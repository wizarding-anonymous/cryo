import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import {
  ResponseTransformationInterceptor,
  TransformResponse,
  ExcludeTransform,
  TRANSFORM_RESPONSE_METADATA,
  EXCLUDE_TRANSFORM_METADATA,
} from './response-transformation.interceptor';

describe('ResponseTransformationInterceptor', () => {
  let interceptor: ResponseTransformationInterceptor;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseTransformationInterceptor,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<ResponseTransformationInterceptor>(
      ResponseTransformationInterceptor,
    );
    reflector = module.get<Reflector>(Reflector);

    mockRequest = {
      method: 'GET',
      url: '/games',
      requestId: 'test-request-id',
      cacheHit: false,
    };

    mockResponse = {
      getHeader: jest.fn().mockReturnValue('application/json'),
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
    it('should transform response with default metadata', (done) => {
      const responseData = { id: '1', title: 'Test Game' };

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toMatchObject({
            data: responseData,
            meta: {
              timestamp: expect.any(String),
              requestId: 'test-request-id',
              responseTime: expect.any(Number),
              version: 'v1',
            },
          });
          expect(value.meta.cached).toBeUndefined(); // cacheHit is false
          done();
        },
        error: done,
      });
    });

    it('should include cached flag when request is from cache', (done) => {
      const responseData = { id: '1', title: 'Test Game' };
      mockRequest.cacheHit = true;

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value.meta.cached).toBe(true);
          done();
        },
        error: done,
      });
    });

    it('should exclude transformation when ExcludeTransform decorator is used', (done) => {
      const responseData = { id: '1', title: 'Test Game' };

      jest.spyOn(reflector, 'get').mockReturnValueOnce(true); // EXCLUDE_TRANSFORM_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toBe(responseData); // No transformation
          done();
        },
        error: done,
      });
    });

    it('should exclude specified fields from response', (done) => {
      const responseData = {
        id: '1',
        title: 'Test Game',
        internalId: 'secret',
        user: { id: '1', password: 'secret', name: 'John' },
      };

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({
          excludeFields: ['internalId', 'user.password'],
        }); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value.data).toEqual({
            id: '1',
            title: 'Test Game',
            user: { id: '1', name: 'John' },
          });
          expect(value.data.internalId).toBeUndefined();
          expect(value.data.user.password).toBeUndefined();
          done();
        },
        error: done,
      });
    });

    it('should skip metadata when includeMetadata is false', (done) => {
      const responseData = { id: '1', title: 'Test Game' };

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({ includeMetadata: false }); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toEqual({
            data: responseData,
          });
          expect(value.meta).toBeUndefined();
          done();
        },
        error: done,
      });
    });

    it('should add timestamp when addTimestamp is true and includeMetadata is false', (done) => {
      const responseData = { id: '1', title: 'Test Game' };

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({ includeMetadata: false, addTimestamp: true }); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toMatchObject({
            data: responseData,
            meta: {
              timestamp: expect.any(String),
            },
          });
          expect(value.meta.requestId).toBeUndefined();
          done();
        },
        error: done,
      });
    });

    it('should skip transformation for health check endpoints', (done) => {
      const responseData = { status: 'ok' };
      mockRequest.url = '/health';

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toBe(responseData); // No transformation
          done();
        },
        error: done,
      });
    });

    it('should skip transformation for non-JSON responses', (done) => {
      const responseData = 'plain text response';
      mockResponse.getHeader.mockReturnValue('text/plain');

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toBe(responseData); // No transformation
          done();
        },
        error: done,
      });
    });

    it('should skip transformation for null/undefined data', (done) => {
      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(null));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toBeNull(); // No transformation
          done();
        },
        error: done,
      });
    });

    it('should skip transformation for already transformed data', (done) => {
      const alreadyTransformed = {
        data: { id: '1', title: 'Test Game' },
        meta: { timestamp: '2023-01-01T00:00:00.000Z' },
      };

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({}); // TRANSFORM_RESPONSE_METADATA

      jest
        .spyOn(mockCallHandler, 'handle')
        .mockReturnValue(of(alreadyTransformed));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value).toBe(alreadyTransformed); // No transformation
          done();
        },
        error: done,
      });
    });

    it('should handle array responses correctly', (done) => {
      const responseData = [
        { id: '1', title: 'Game 1', secret: 'hidden' },
        { id: '2', title: 'Game 2', secret: 'hidden' },
      ];

      jest
        .spyOn(reflector, 'get')
        .mockReturnValueOnce(false) // EXCLUDE_TRANSFORM_METADATA
        .mockReturnValueOnce({ excludeFields: ['secret'] }); // TRANSFORM_RESPONSE_METADATA

      jest.spyOn(mockCallHandler, 'handle').mockReturnValue(of(responseData));

      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      result$.subscribe({
        next: (value) => {
          expect(value.data).toEqual([
            { id: '1', title: 'Game 1' },
            { id: '2', title: 'Game 2' },
          ]);
          expect(value.data[0].secret).toBeUndefined();
          expect(value.data[1].secret).toBeUndefined();
          done();
        },
        error: done,
      });
    });
  });

  describe('decorators', () => {
    it('should set transform response metadata on method', () => {
      const options = { includeMetadata: true, excludeFields: ['password'] };

      class TestController {
        @TransformResponse(options)
        testMethod() {
          return 'test';
        }
      }

      const controller = new TestController();
      const metadata = Reflect.getMetadata(
        TRANSFORM_RESPONSE_METADATA,
        controller.testMethod,
      );

      expect(metadata).toEqual(options);
    });

    it('should set exclude transform metadata on method', () => {
      class TestController {
        @ExcludeTransform()
        testMethod() {
          return 'test';
        }
      }

      const controller = new TestController();
      const metadata = Reflect.getMetadata(
        EXCLUDE_TRANSFORM_METADATA,
        controller.testMethod,
      );

      expect(metadata).toBe(true);
    });

    it('should set default options when TransformResponse is called without parameters', () => {
      class TestController {
        @TransformResponse()
        testMethod() {
          return 'test';
        }
      }

      const controller = new TestController();
      const metadata = Reflect.getMetadata(
        TRANSFORM_RESPONSE_METADATA,
        controller.testMethod,
      );

      expect(metadata).toEqual({});
    });
  });
});
