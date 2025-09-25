import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService, RatingMetrics } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    service.clearMetrics();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordMetric', () => {
    it('should record a metric', () => {
      const metric: RatingMetrics = {
        operationType: 'calculate',
        gameId: 'game-123',
        duration: 100,
        timestamp: new Date(),
        success: true,
      };

      service.recordMetric(metric);
      const metrics = service.getMetrics();

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    it('should limit metrics to maxMetrics entries', () => {
      // Add more than 1000 metrics
      for (let i = 0; i < 1100; i++) {
        service.recordMetric({
          operationType: 'calculate',
          gameId: `game-${i}`,
          duration: 100,
          timestamp: new Date(),
          success: true,
        });
      }

      const metrics = service.getMetrics();
      expect(metrics).toHaveLength(1000);
      // Should keep the last 1000 metrics
      expect(metrics[0].gameId).toBe('game-100');
      expect(metrics[999].gameId).toBe('game-1099');
    });
  });

  describe('measureOperation', () => {
    it('should measure successful operation', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await service.measureOperation('calculate', mockOperation, 'game-123');
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
      
      const metrics = service.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operationType).toBe('calculate');
      expect(metrics[0].gameId).toBe('game-123');
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should measure failed operation', async () => {
      const error = new Error('Test error');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(service.measureOperation('calculate', mockOperation, 'game-123')).rejects.toThrow('Test error');
      
      const metrics = service.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operationType).toBe('calculate');
      expect(metrics[0].gameId).toBe('game-123');
      expect(metrics[0].success).toBe(false);
      expect(metrics[0].error).toBe('Test error');
      expect(metrics[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle operation without gameId', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await service.measureOperation('bulk_recalculate', mockOperation);
      
      const metrics = service.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operationType).toBe('bulk_recalculate');
      expect(metrics[0].gameId).toBeUndefined();
    });
  });

  describe('getMetricsSummary', () => {
    it('should return empty summary when no metrics', () => {
      const summary = service.getMetricsSummary();
      
      expect(summary).toEqual({
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        operationCounts: {},
        recentErrors: [],
      });
    });

    it('should calculate correct summary with metrics', () => {
      // Add successful metrics
      service.recordMetric({
        operationType: 'calculate',
        duration: 100,
        timestamp: new Date(),
        success: true,
      });
      service.recordMetric({
        operationType: 'update',
        duration: 200,
        timestamp: new Date(),
        success: true,
      });
      
      // Add failed metric
      service.recordMetric({
        operationType: 'calculate',
        duration: 50,
        timestamp: new Date(),
        success: false,
        error: 'Test error',
      });

      const summary = service.getMetricsSummary();
      
      expect(summary.totalOperations).toBe(3);
      expect(summary.averageDuration).toBe(116.67); // (100 + 200 + 50) / 3
      expect(summary.successRate).toBe(66.67); // 2/3 * 100
      expect(summary.operationCounts).toEqual({
        calculate: 2,
        update: 1,
      });
      expect(summary.recentErrors).toHaveLength(1);
      expect(summary.recentErrors[0].error).toBe('Test error');
    });

    it('should limit recent errors to 10', () => {
      // Add 15 failed metrics
      for (let i = 0; i < 15; i++) {
        service.recordMetric({
          operationType: 'calculate',
          duration: 100,
          timestamp: new Date(),
          success: false,
          error: `Error ${i}`,
        });
      }

      const summary = service.getMetricsSummary();
      expect(summary.recentErrors).toHaveLength(10);
      // Should keep the last 10 errors
      expect(summary.recentErrors[0].error).toBe('Error 5');
      expect(summary.recentErrors[9].error).toBe('Error 14');
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      service.recordMetric({
        operationType: 'calculate',
        duration: 100,
        timestamp: new Date(),
        success: true,
      });

      expect(service.getMetrics()).toHaveLength(1);
      
      service.clearMetrics();
      
      expect(service.getMetrics()).toHaveLength(0);
    });
  });
});