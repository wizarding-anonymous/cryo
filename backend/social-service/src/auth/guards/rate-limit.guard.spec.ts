import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitGuard } from './rate-limit.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext } from '@nestjs/common';
import { RateLimitExceededException } from '../../common/exceptions/rate-limit-exceeded.exception';
import { Cache } from 'cache-manager';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  store: {
    ttl: jest.fn(),
  },
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (request: any) => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow first request and set cache', async () => {
    const request = { user: { userId: 'user1' } };
    const mockContext = createMockExecutionContext(request);
    mockCacheManager.get.mockResolvedValue(null);

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(mockCacheManager.set).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.any(Object),
    );
  });

  it('should allow subsequent requests under the limit', async () => {
    const request = { user: { userId: 'user1' } };
    const mockContext = createMockExecutionContext(request);
    mockCacheManager.get.mockResolvedValue(5); // Current count is 5
    mockCacheManager.store.ttl.mockResolvedValue(30); // 30 seconds left

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(mockCacheManager.set).toHaveBeenCalledWith(expect.any(String), 6, {
      ttl: 30,
    });
  });

  it('should throw RateLimitExceededException when limit is reached', async () => {
    const request = { user: { userId: 'user1' } };
    const mockContext = createMockExecutionContext(request);
    mockCacheManager.get.mockResolvedValue(20); // Limit is 20

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should allow request if no user is present', async () => {
    const request = {};
    const mockContext = createMockExecutionContext(request);

    const canActivate = await guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
    expect(mockCacheManager.get).not.toHaveBeenCalled();
  });
});
