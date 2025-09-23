import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheInterceptor } from './cache.interceptor';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;
  const mockCache: any = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInterceptor,
        Reflector,
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    interceptor = module.get<CacheInterceptor>(CacheInterceptor);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should bypass non-GET requests', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST' }),
      }),
    } as unknown as ExecutionContext;

    const handler = { handle: () => of({ ok: true }) } as CallHandler;

    const res$ = await interceptor.intercept(context, handler);
    await new Promise((resolve) => res$.subscribe(() => resolve(null)));
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('should return cached value when present', async () => {
    mockCache.get.mockResolvedValueOnce({ cached: true });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/library/my',
          user: { id: 'u1' },
        }),
      }),
    } as unknown as ExecutionContext;
    const handler = { handle: () => of({ fresh: true }) } as CallHandler;

    const res$ = await interceptor.intercept(context, handler);
    await new Promise((resolve) =>
      res$.subscribe((data) => {
        expect(data).toEqual({ cached: true });
        resolve(null);
      }),
    );
  });

  it('should cache response and record user key on miss', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockCache.get.mockResolvedValueOnce([]); // user keys fetch
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/library/my?page=1',
          user: { id: 'u1' },
        }),
      }),
    } as unknown as ExecutionContext;
    const handler = { handle: () => of({ fresh: true }) } as CallHandler;

    const res$ = await interceptor.intercept(context, handler);
    await new Promise((resolve) => res$.subscribe((data) => resolve(data)));

    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('cache:u1:/api/library/my'),
      { fresh: true },
      300,
    );
  });
});
