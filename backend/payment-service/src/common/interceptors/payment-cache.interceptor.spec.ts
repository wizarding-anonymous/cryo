import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { PaymentCacheInterceptor } from './payment-cache.interceptor';

describe('PaymentCacheInterceptor', () => {
  let interceptor: PaymentCacheInterceptor;
  let cacheManager: any;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCacheInterceptor,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    interceptor = module.get<PaymentCacheInterceptor>(PaymentCacheInterceptor);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should cache GET requests', async () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/payments/test-id',
          user: { userId: 'test-user' },
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ id: 'test-payment', status: 'completed' }),
    } as CallHandler;

    mockCacheManager.get.mockResolvedValue(null);

    const result$ = await interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe((data) => {
      expect(data).toEqual({ id: 'test-payment', status: 'completed' });
    });

    expect(mockCacheManager.get).toHaveBeenCalledWith(
      'payment:/payments/test-id:test-user',
    );
  });

  it('should return cached data if available', async () => {
    const cachedData = { id: 'cached-payment', status: 'completed' };

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/payments/test-id',
          user: { userId: 'test-user' },
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: jest.fn(),
    } as CallHandler;

    mockCacheManager.get.mockResolvedValue(cachedData);

    const result$ = await interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    result$.subscribe((data) => {
      expect(data).toEqual(cachedData);
    });

    expect(mockCallHandler.handle).not.toHaveBeenCalled();
  });

  it('should not cache non-GET requests', async () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/payments',
          user: { userId: 'test-user' },
        }),
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ id: 'new-payment' }),
    } as CallHandler;

    const result$ = await interceptor.intercept(
      mockExecutionContext,
      mockCallHandler,
    );

    expect(result$).toBeDefined();
    expect(mockCacheManager.get).not.toHaveBeenCalled();
  });
});
