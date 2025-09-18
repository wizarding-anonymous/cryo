import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheInterceptor } from './cache.interceptor';
import { of } from 'rxjs';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  let cacheManager: any;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInterceptor,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    interceptor = module.get<CacheInterceptor>(CacheInterceptor);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should return cached response if available', async () => {
    const cachedData = { data: 'cached' };
    cacheManager.get.mockResolvedValue(cachedData);

    const mockRequest = {
      method: 'GET',
      url: '/achievements',
      user: { id: 'user-123' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'fresh' }),
    } as CallHandler;

    const result = await interceptor.intercept(mockContext, mockCallHandler);
    
    result.subscribe((data) => {
      expect(data).toEqual(cachedData);
      expect(cacheManager.get).toHaveBeenCalledWith('GET:/achievements:user-123');
    });
  });

  it('should cache response if not in cache', (done) => {
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);

    const freshData = { data: 'fresh' };
    const mockRequest = {
      method: 'GET',
      url: '/achievements',
      user: { id: 'user-123' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(freshData),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).then((result) => {
      result.subscribe((data) => {
        expect(data).toEqual(freshData);
        expect(cacheManager.get).toHaveBeenCalledWith('GET:/achievements:user-123');
        // Cache should be set with 30 minutes TTL for all achievements
        setTimeout(() => {
          expect(cacheManager.set).toHaveBeenCalledWith(
            'GET:/achievements:user-123',
            freshData,
            1800000, // 30 minutes in milliseconds
          );
          done();
        }, 10);
      });
    });
  });

  it('should not cache non-GET requests', async () => {
    const mockRequest = {
      method: 'POST',
      url: '/achievements/unlock',
      user: { id: 'user-123' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'response' }),
    } as CallHandler;

    const result = await interceptor.intercept(mockContext, mockCallHandler);
    
    // Compare the observable results, not the observables themselves
    result.subscribe((data) => {
      expect(data).toEqual({ data: 'response' });
    });
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('should use different TTL for user-specific endpoints', (done) => {
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);

    const freshData = { data: 'user-specific' };
    const mockRequest = {
      method: 'GET',
      url: '/achievements/user/123',
      user: { id: 'user-123' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(freshData),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).then((result) => {
      result.subscribe((data) => {
        expect(data).toEqual(freshData);
        // Cache should be set with 2 minutes TTL for user-specific data
        setTimeout(() => {
          expect(cacheManager.set).toHaveBeenCalledWith(
            'GET:/achievements/user/123:user-123',
            freshData,
            120000, // 2 minutes in milliseconds
          );
          done();
        }, 10);
      });
    });
  });

  it('should handle anonymous users', (done) => {
    cacheManager.get.mockResolvedValue(null);

    const mockRequest = {
      method: 'GET',
      url: '/achievements',
      // No user property
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler = {
      handle: () => of({ data: 'public' }),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).then((result) => {
      result.subscribe(() => {
        expect(cacheManager.get).toHaveBeenCalledWith('GET:/achievements:anonymous');
        done();
      });
    });
  });
});