import { Test, TestingModule } from '@nestjs/testing';
import { CacheHealthIndicator } from './cache.health';
import { CacheService } from '../cache/cache.service';

describe('CacheHealthIndicator', () => {
  let indicator: CacheHealthIndicator;
  let cacheService: CacheService;

  const mockCacheService = {
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheHealthIndicator,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    indicator = module.get<CacheHealthIndicator>(CacheHealthIndicator);
    cacheService = module.get<CacheService>(CacheService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return healthy status when cache is working', async () => {
      const mockHealthCheck = {
        status: 'healthy' as const,
        details: {
          canRead: true,
          canWrite: true,
          stats: { hits: 10, misses: 2, hitRate: 0.83, totalOperations: 12 },
        },
      };
      mockCacheService.healthCheck.mockResolvedValue(mockHealthCheck);

      const result = await indicator.isHealthy('cache');

      expect(result).toEqual({
        cache: {
          status: 'up',
          healthStatus: mockHealthCheck.status,
          stats: mockHealthCheck.details.stats,
          canRead: true,
          canWrite: true,
        },
      });
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
    });

    it('should throw error when cache is unhealthy', async () => {
      const mockHealthCheck = {
        status: 'unhealthy' as const,
        details: {
          error: 'Redis connection failed',
          stats: { hits: 0, misses: 0, hitRate: 0, totalOperations: 0 },
        },
      };
      mockCacheService.healthCheck.mockResolvedValue(mockHealthCheck);

      await expect(indicator.isHealthy('cache')).rejects.toThrow(
        'Cache health check failed',
      );
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
    });

    it('should handle cache service errors', async () => {
      const error = new Error('Cache service unavailable');
      mockCacheService.healthCheck.mockRejectedValue(error);

      await expect(indicator.isHealthy('cache')).rejects.toThrow(
        'Cache health check failed: Cache service unavailable',
      );
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
    });
  });
});
