import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { register } from 'prom-client';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Очищаем регистр метрик перед каждым тестом
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    register.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordRatingCalculation', () => {
    it('should record rating calculation metrics', () => {
      const gameId = 'test-game-1';
      const operationType = 'create';

      service.recordRatingCalculation(gameId, operationType);

      // Проверяем, что метрика была записана
      const metrics = register.getSingleMetric('rating_calculations_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('recordRatingCalculationDuration', () => {
    it('should record calculation duration', () => {
      const gameId = 'test-game-1';
      const duration = 0.5;

      service.recordRatingCalculationDuration(gameId, duration);

      const metrics = register.getSingleMetric('rating_calculation_duration_seconds');
      expect(metrics).toBeDefined();
    });
  });

  describe('recordCacheOperation', () => {
    it('should record cache operations', () => {
      service.recordCacheOperation('get', 'hit');
      service.recordCacheOperation('get', 'miss');
      service.recordCacheOperation('set', 'success');

      const metrics = register.getSingleMetric('rating_cache_operations_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('active calculations tracking', () => {
    it('should track active calculations', async () => {
      service.incrementActiveCalculations();
      service.incrementActiveCalculations();
      service.decrementActiveCalculations();

      const metrics = register.getSingleMetric('active_rating_calculations');
      expect(metrics).toBeDefined();
      
      if (metrics) {
        const metricData = await metrics.get();
        expect(metricData.values[0].value).toBe(1);
      }
    });
  });

  describe('updateCachedRatingsCount', () => {
    it('should update cached ratings count', async () => {
      const count = 42;
      service.updateCachedRatingsCount(count);

      const metrics = register.getSingleMetric('cached_ratings_count');
      expect(metrics).toBeDefined();
      
      if (metrics) {
        const metricData = await metrics.get();
        expect(metricData.values[0].value).toBe(count);
      }
    });
  });

  describe('getMetrics', () => {
    it('should return prometheus metrics string', async () => {
      service.recordRatingCalculation('test-game', 'create');
      service.updateCachedRatingsCount(10);

      const metricsString = await service.getMetrics();
      
      expect(typeof metricsString).toBe('string');
      expect(metricsString).toContain('rating_calculations_total');
      expect(metricsString).toContain('cached_ratings_count');
    });
  });

  describe('getRatingMetricsSummary', () => {
    it('should return metrics summary', async () => {
      service.recordRatingCalculation('test-game-1', 'create');
      service.recordRatingCalculation('test-game-2', 'update');
      service.recordCacheOperation('get', 'hit');
      service.recordCacheOperation('set', 'success');
      service.incrementActiveCalculations();
      service.updateCachedRatingsCount(25);

      const summary = await service.getRatingMetricsSummary();

      expect(summary).toHaveProperty('totalCalculations');
      expect(summary).toHaveProperty('totalCacheOperations');
      expect(summary).toHaveProperty('activeCalculations');
      expect(summary).toHaveProperty('cachedRatingsCount');
      expect(summary).toHaveProperty('averageCalculationTime');

      expect(summary.totalCalculations).toBeGreaterThanOrEqual(0);
      expect(summary.totalCacheOperations).toBeGreaterThanOrEqual(0);
      expect(summary.activeCalculations).toBe(1);
      expect(summary.cachedRatingsCount).toBe(25);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      service.recordRatingCalculation('test-game', 'create');
      service.updateCachedRatingsCount(10);

      let metrics = register.getMetricsAsArray();
      expect(metrics.length).toBeGreaterThan(0);

      service.resetMetrics();

      metrics = register.getMetricsAsArray();
      expect(metrics.length).toBe(0);
    });
  });
});