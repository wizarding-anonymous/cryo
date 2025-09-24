import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response data with metadata', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-correlation-id': 'test-correlation-id' },
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ games: ['game1', 'game2'] }),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('meta');
          expect(data.data).toEqual({ games: ['game1', 'game2'] });
          expect(data.meta).toBeDefined();
          expect(data.meta!).toHaveProperty('timestamp');
          expect(data.meta!).toHaveProperty('version', '1.0');
          expect(data.meta!).toHaveProperty(
            'correlationId',
            'test-correlation-id',
          );
          resolve(data);
        },
      });
    });
  });

  it('should handle paginated response', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    const paginatedData = {
      games: ['game1', 'game2'],
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    };

    const mockCallHandler = {
      handle: () => of(paginatedData),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('meta');
          expect(data.meta).toBeDefined();
          expect(data.meta!.pagination).toEqual({
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
          });
          resolve(data);
        },
      });
    });
  });

  it('should handle null response', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(null),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data', null);
          expect(data).toHaveProperty('meta');
          expect(data.meta).toBeDefined();
          expect(data.meta!).toHaveProperty('timestamp');
          expect(data.meta!).toHaveProperty('version', '1.0');
          resolve(data);
        },
      });
    });
  });

  it('should not double-wrap already transformed responses', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    const alreadyTransformed = {
      data: { games: ['game1'] },
      meta: { timestamp: '2023-01-01T00:00:00.000Z', version: '1.0' },
    };

    const mockCallHandler = {
      handle: () => of(alreadyTransformed),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toEqual(alreadyTransformed);
          expect(data.data).toEqual({ games: ['game1'] });
          resolve(data);
        },
      });
    });
  });

  it('should handle response without correlation ID', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ message: 'success' }),
    } as CallHandler;

    const result$ = interceptor.intercept(mockContext, mockCallHandler);

    await new Promise((resolve) => {
      result$.subscribe({
        next: (data) => {
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('meta');
          expect(data.meta).toBeDefined();
          expect(data.meta!).not.toHaveProperty('correlationId');
          expect(data.meta!).toHaveProperty('timestamp');
          expect(data.meta!).toHaveProperty('version', '1.0');
          resolve(data);
        },
      });
    });
  });
});
