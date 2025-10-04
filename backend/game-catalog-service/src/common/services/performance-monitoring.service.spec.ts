import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  PerformanceMonitoringService,
  PerformanceMetrics,
  CacheMetrics,
} from './performance-monitoring.service';

describe('PerformanceMonitoringService', () => {
  let service: PerformanceMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitoringService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              switch (key) {
                case 'PERFORMANCE_MONITORING_ENABLED':
                  return true;
                case 'SLOW_QUERY_THRESHOLD_MS':
                  return 500;
                default:
                  return defaultValue as unknown;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PerformanceMonitoringService>(
      PerformanceMonitoringService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEndpointMetrics', () => {
    it('should record performance metrics', () => {
      const metrics: PerformanceMetrics = {
        endpoint: '/games',
        method: 'GET',
        responseTime: 150,
        cacheHit: true,
        responseSize: 1024,
        timestamp: new Date(),
        status: 'success',
      };

      const logSpy = jest.spyOn(service['logger'], 'debug');
      service.recordEndpointMetrics(metrics);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log slow requests', () => {
      const metrics: PerformanceMetrics = {
        endpoint: '/games',
        method: 'GET',
        responseTime: 600, // Above threshold
        cacheHit: false,
        responseSize: 1024,
        timestamp: new Date(),
        status: 'success',
      };

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      service.recordEndpointMetrics(metrics);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow request detected'),
      );
    });

    it('should log error requests', () => {
      const metrics: PerformanceMetrics = {
        endpoint: '/games',
        method: 'GET',
        responseTime: 150,
        cacheHit: false,
        responseSize: 0,
        timestamp: new Date(),
        status: 'error',
        error: 'Database connection failed',
      };

      const errorSpy = jest.spyOn(service['logger'], 'error');
      service.recordEndpointMetrics(metrics);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
      );
    });
  });

  describe('recordCacheMetrics', () => {
    it('should record cache metrics', () => {
      const metrics: CacheMetrics = {
        key: 'game-catalog:games_list_page1',
        operation: 'get',
        hit: true,
        responseTime: 5,
        timestamp: new Date(),
      };

      const debugSpy = jest.spyOn(service['logger'], 'debug');
      service.recordCacheMetrics(metrics);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache HIT'),
      );
    });

    it('should record cache miss', () => {
      const metrics: CacheMetrics = {
        key: 'game-catalog:games_list_page1',
        operation: 'get',
        hit: false,
        responseTime: 5,
        timestamp: new Date(),
      };

      const debugSpy = jest.spyOn(service['logger'], 'debug');
      service.recordCacheMetrics(metrics);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache MISS'),
      );
    });
  });

  describe('getPerformanceStats', () => {
    it('should return empty stats when no metrics', () => {
      const stats = service.getPerformanceStats(5);

      expect(stats).toEqual({
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        errorRate: 0,
        cacheHitRate: 0,
        topSlowEndpoints: [],
      });
    });

    it('should calculate performance statistics correctly', () => {
      // Add some test metrics
      const now = new Date();
      const metrics: PerformanceMetrics[] = [
        {
          endpoint: '/games',
          method: 'GET',
          responseTime: 100,
          cacheHit: true,
          responseSize: 1024,
          timestamp: now,
          status: 'success',
        },
        {
          endpoint: '/games',
          method: 'GET',
          responseTime: 600, // Slow request
          cacheHit: false,
          responseSize: 2048,
          timestamp: now,
          status: 'success',
        },
        {
          endpoint: '/games/search',
          method: 'GET',
          responseTime: 200,
          cacheHit: false,
          responseSize: 512,
          timestamp: now,
          status: 'error',
          error: 'Database error',
        },
      ];

      metrics.forEach((m) => service.recordEndpointMetrics(m));

      // Add cache metrics
      const cacheMetrics: CacheMetrics[] = [
        {
          key: 'test1',
          operation: 'get',
          hit: true,
          responseTime: 5,
          timestamp: now,
        },
        {
          key: 'test2',
          operation: 'get',
          hit: false,
          responseTime: 5,
          timestamp: now,
        },
      ];

      cacheMetrics.forEach((m) => service.recordCacheMetrics(m));

      const stats = service.getPerformanceStats(5);

      expect(stats.totalRequests).toBe(3);
      expect(stats.averageResponseTime).toBe(300); // (100 + 600 + 200) / 3
      expect(stats.slowRequests).toBe(1); // Only the 600ms request
      expect(stats.errorRate).toBe(33.33); // 1 error out of 3 requests
      expect(stats.cacheHitRate).toBe(50); // 1 hit out of 2 cache operations
      expect(stats.topSlowEndpoints).toHaveLength(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return empty cache stats when no metrics', () => {
      const stats = service.getCacheStats(5);

      expect(stats).toEqual({
        totalOperations: 0,
        hitRate: 0,
        averageResponseTime: 0,
        operationBreakdown: {},
      });
    });

    it('should calculate cache statistics correctly', () => {
      const now = new Date();
      const cacheMetrics: CacheMetrics[] = [
        {
          key: 'test1',
          operation: 'get',
          hit: true,
          responseTime: 5,
          timestamp: now,
        },
        {
          key: 'test2',
          operation: 'get',
          hit: false,
          responseTime: 10,
          timestamp: now,
        },
        {
          key: 'test3',
          operation: 'set',
          hit: false,
          responseTime: 15,
          timestamp: now,
        },
      ];

      cacheMetrics.forEach((m) => service.recordCacheMetrics(m));

      const stats = service.getCacheStats(5);

      expect(stats.totalOperations).toBe(3);
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 get operations
      expect(stats.averageResponseTime).toBe(10); // (5 + 10 + 15) / 3
      expect(stats.operationBreakdown).toEqual({
        get: 2,
        set: 1,
      });
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics buffers', () => {
      // Add some metrics first
      const metrics: PerformanceMetrics = {
        endpoint: '/games',
        method: 'GET',
        responseTime: 150,
        cacheHit: true,
        responseSize: 1024,
        timestamp: new Date(),
        status: 'success',
      };

      service.recordEndpointMetrics(metrics);

      const cacheMetrics: CacheMetrics = {
        key: 'test',
        operation: 'get',
        hit: true,
        responseTime: 5,
        timestamp: new Date(),
      };

      service.recordCacheMetrics(cacheMetrics);

      // Verify metrics exist
      let stats = service.getPerformanceStats(5);
      expect(stats.totalRequests).toBe(1);

      // Clear metrics
      const logSpy = jest.spyOn(service['logger'], 'log');
      service.clearMetrics();

      // Verify metrics are cleared
      stats = service.getPerformanceStats(5);
      expect(stats.totalRequests).toBe(0);
      expect(logSpy).toHaveBeenCalledWith('Performance metrics cleared');
    });
  });

  describe('configuration', () => {
    it('should respect disabled monitoring', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PerformanceMonitoringService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PERFORMANCE_MONITORING_ENABLED') return false;
                return defaultValue as unknown;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<PerformanceMonitoringService>(
        PerformanceMonitoringService,
      );

      const metrics: PerformanceMetrics = {
        endpoint: '/games',
        method: 'GET',
        responseTime: 150,
        cacheHit: true,
        responseSize: 1024,
        timestamp: new Date(),
        status: 'success',
      };

      disabledService.recordEndpointMetrics(metrics);

      const stats = disabledService.getPerformanceStats(5);
      expect(stats.totalRequests).toBe(0); // Should not record when disabled
    });
  });
});
