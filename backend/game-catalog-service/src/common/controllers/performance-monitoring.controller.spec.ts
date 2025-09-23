import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitoringController } from './performance-monitoring.controller';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

describe('PerformanceMonitoringController', () => {
  let controller: PerformanceMonitoringController;
  let performanceMonitoringService: PerformanceMonitoringService;

  const mockPerformanceStats = {
    totalRequests: 100,
    averageResponseTime: 150,
    slowRequests: 5,
    errorRate: 2.5,
    cacheHitRate: 75.0,
    topSlowEndpoints: [
      { endpoint: 'GET /games/search', avgResponseTime: 300, count: 10 },
      { endpoint: 'GET /games', avgResponseTime: 200, count: 50 },
    ],
  };

  const mockCacheStats = {
    totalOperations: 200,
    hitRate: 75.0,
    averageResponseTime: 5,
    operationBreakdown: {
      get: 150,
      set: 40,
      del: 10,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceMonitoringController],
      providers: [
        {
          provide: PerformanceMonitoringService,
          useValue: {
            getPerformanceStats: jest
              .fn()
              .mockReturnValue(mockPerformanceStats),
            getCacheStats: jest.fn().mockReturnValue(mockCacheStats),
            clearMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PerformanceMonitoringController>(
      PerformanceMonitoringController,
    );
    performanceMonitoringService = module.get<PerformanceMonitoringService>(
      PerformanceMonitoringService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics with default time period', async () => {
      const result = await controller.getPerformanceStats();

      expect(
        performanceMonitoringService.getPerformanceStats,
      ).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockPerformanceStats);
    });

    it('should return performance statistics with custom time period', async () => {
      const result = await controller.getPerformanceStats(10);

      expect(
        performanceMonitoringService.getPerformanceStats,
      ).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockPerformanceStats);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics with default time period', async () => {
      const result = await controller.getCacheStats();

      expect(performanceMonitoringService.getCacheStats).toHaveBeenCalledWith(
        5,
      );
      expect(result).toEqual(mockCacheStats);
    });

    it('should return cache statistics with custom time period', async () => {
      const result = await controller.getCacheStats(15);

      expect(performanceMonitoringService.getCacheStats).toHaveBeenCalledWith(
        15,
      );
      expect(result).toEqual(mockCacheStats);
    });
  });

  describe('clearMetrics', () => {
    it('should clear metrics successfully', async () => {
      const result = await controller.clearMetrics();

      expect(performanceMonitoringService.clearMetrics).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Performance metrics cleared successfully',
      });
    });

    it('should handle errors when clearing metrics', async () => {
      jest
        .spyOn(performanceMonitoringService, 'clearMetrics')
        .mockImplementation(() => {
          throw new Error('Clear failed');
        });

      const result = await controller.clearMetrics();

      expect(result).toEqual({
        success: false,
        message: 'Failed to clear metrics: Clear failed',
      });
    });
  });
});
