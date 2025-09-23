import { Test, TestingModule } from '@nestjs/testing';
import { CacheController } from './cache.controller';
import { CacheService } from './cache.service';

describe('CacheController', () => {
  let controller: CacheController;
  let cacheService: CacheService;

  const mockCacheService = {
    getStats: jest.fn(),
    resetStats: jest.fn(),
    getCachePatterns: jest.fn(),
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    controller = module.get<CacheController>(CacheController);
    cacheService = module.get<CacheService>(CacheService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const mockStats = {
        hits: 100,
        misses: 20,
        hitRate: 0.83,
        totalOperations: 120,
      };
      mockCacheService.getStats.mockReturnValue(mockStats);

      const result = controller.getStats();

      expect(result).toEqual(mockStats);
      expect(cacheService.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetStats', () => {
    it('should reset cache statistics', () => {
      controller.resetStats();

      expect(cacheService.resetStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCachePatterns', () => {
    it('should return cache patterns configuration', () => {
      const mockPatterns = {
        library: {
          pattern: 'library_*',
          ttl: 300,
          description: 'User library data',
        },
        search: {
          pattern: 'search_*',
          ttl: 300,
          description: 'Search results',
        },
      };
      mockCacheService.getCachePatterns.mockReturnValue(mockPatterns);

      const result = controller.getCachePatterns();

      expect(result).toEqual(mockPatterns);
      expect(cacheService.getCachePatterns).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return cache health status', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        details: {
          canWrite: true,
          canRead: true,
          stats: { hits: 10, misses: 2, hitRate: 0.83, totalOperations: 12 },
        },
      };
      mockCacheService.healthCheck.mockResolvedValue(mockHealth);

      const result = await controller.healthCheck();

      expect(result).toEqual(mockHealth);
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when cache fails', async () => {
      const mockHealth = {
        status: 'unhealthy' as const,
        details: {
          error: 'Redis connection failed',
          stats: { hits: 0, misses: 0, hitRate: 0, totalOperations: 0 },
        },
      };
      mockCacheService.healthCheck.mockResolvedValue(mockHealth);

      const result = await controller.healthCheck();

      expect(result).toEqual(mockHealth);
      expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
    });
  });
});