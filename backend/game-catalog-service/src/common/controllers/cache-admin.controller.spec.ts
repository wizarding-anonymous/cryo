import { Test, TestingModule } from '@nestjs/testing';
import { CacheAdminController } from './cache-admin.controller';
import { CacheService } from '../services/cache.service';
import { CacheWarmingService } from '../services/cache-warming.service';
import { PerformanceInterceptor } from '../interceptors/performance.interceptor';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

const mockCacheService = {
  getCacheStats: jest.fn(),
  invalidateGameCache: jest.fn(),
};

const mockCacheWarmingService = {
  triggerWarmup: jest.fn(),
};

const mockPerformanceMonitoringService = {
  recordEndpointMetrics: jest.fn(),
};

describe('CacheAdminController', () => {
  let controller: CacheAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheAdminController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: CacheWarmingService,
          useValue: mockCacheWarmingService,
        },
        {
          provide: PerformanceInterceptor,
          useValue: {},
        },
        {
          provide: PerformanceMonitoringService,
          useValue: mockPerformanceMonitoringService,
        },
      ],
    }).compile();

    controller = module.get<CacheAdminController>(CacheAdminController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        status: 'available',
        timestamp: new Date().toISOString(),
      };
      mockCacheService.getCacheStats.mockResolvedValue(mockStats);

      const result = (await controller.getCacheStats()) as typeof mockStats;

      expect(mockCacheService.getCacheStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('triggerCacheWarmup', () => {
    it('should trigger cache warmup and return result', async () => {
      const mockResult = {
        success: true,
        duration: 1000,
        message: 'Warmup completed',
      };
      mockCacheWarmingService.triggerWarmup.mockResolvedValue(mockResult);

      const result = await controller.triggerCacheWarmup();

      expect(mockCacheWarmingService.triggerWarmup).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('invalidateGameCaches', () => {
    it('should invalidate all game caches successfully', async () => {
      mockCacheService.invalidateGameCache.mockResolvedValue(undefined);

      const result = await controller.invalidateGameCaches();

      expect(mockCacheService.invalidateGameCache).toHaveBeenCalledWith();
      expect(result.success).toBe(true);
    });

    it('should handle cache invalidation errors', async () => {
      mockCacheService.invalidateGameCache.mockRejectedValue(
        new Error('Cache error'),
      );

      const result = await controller.invalidateGameCaches();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to invalidate');
    });
  });

  describe('invalidateGameCache', () => {
    it('should invalidate cache for specific game', async () => {
      const gameId = 'test-game-id';
      mockCacheService.invalidateGameCache.mockResolvedValue(undefined);

      const result = await controller.invalidateGameCache(gameId);

      expect(mockCacheService.invalidateGameCache).toHaveBeenCalledWith(gameId);
      expect(result.success).toBe(true);
    });

    it('should handle specific game cache invalidation errors', async () => {
      const gameId = 'test-game-id';
      mockCacheService.invalidateGameCache.mockRejectedValue(
        new Error('Cache error'),
      );

      const result = await controller.invalidateGameCache(gameId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to invalidate');
    });
  });
});
