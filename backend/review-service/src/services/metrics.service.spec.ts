import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { register, Counter, Histogram, Gauge } from 'prom-client';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear all metrics before each test
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

  describe('recordReviewCreated', () => {
    it('should increment review creation counter', () => {
      service.recordReviewCreated('game-123', 5);
      service.recordReviewCreated('game-456', 3);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_reviews_created_total');
      expect(metrics).toContain('game_id="game-123"');
      expect(metrics).toContain('rating="5"');
      expect(metrics).toContain('game_id="game-456"');
      expect(metrics).toContain('rating="3"');
    });

    it('should handle different rating values', () => {
      for (let rating = 1; rating <= 5; rating++) {
        service.recordReviewCreated(`game-${rating}`, rating);
      }

      const metrics = register.metrics();
      for (let rating = 1; rating <= 5; rating++) {
        expect(metrics).toContain(`rating="${rating}"`);
      }
    });
  });

  describe('recordReviewUpdated', () => {
    it('should increment review update counter', () => {
      service.recordReviewUpdated('game-123', 4, 5);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_reviews_updated_total');
      expect(metrics).toContain('game_id="game-123"');
      expect(metrics).toContain('old_rating="4"');
      expect(metrics).toContain('new_rating="5"');
    });
  });

  describe('recordReviewDeleted', () => {
    it('should increment review deletion counter', () => {
      service.recordReviewDeleted('game-123', 3);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_reviews_deleted_total');
      expect(metrics).toContain('game_id="game-123"');
      expect(metrics).toContain('rating="3"');
    });
  });

  describe('recordRatingCalculation', () => {
    it('should increment rating calculation counter', () => {
      service.recordRatingCalculation('game-123', 4.5, 10);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_rating_calculations_total');
      expect(metrics).toContain('game_id="game-123"');
    });

    it('should record rating calculation duration', () => {
      const endTimer = service.recordRatingCalculationDuration('game-123');
      
      // Simulate some processing time
      setTimeout(() => {
        endTimer();
      }, 10);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_rating_calculation_duration_seconds');
    });
  });

  describe('recordCacheOperation', () => {
    it('should record cache hit', () => {
      service.recordCacheOperation('hit', 'rating');

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_cache_operations_total');
      expect(metrics).toContain('operation="hit"');
      expect(metrics).toContain('type="rating"');
    });

    it('should record cache miss', () => {
      service.recordCacheOperation('miss', 'ownership');

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_cache_operations_total');
      expect(metrics).toContain('operation="miss"');
      expect(metrics).toContain('type="ownership"');
    });

    it('should record cache operation duration', () => {
      const endTimer = service.recordCacheOperationDuration('get', 'rating');
      
      setTimeout(() => {
        endTimer();
      }, 5);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_cache_operation_duration_seconds');
    });
  });

  describe('recordExternalServiceCall', () => {
    it('should record successful external service call', () => {
      service.recordExternalServiceCall('library-service', 'success', 150);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_external_service_calls_total');
      expect(metrics).toContain('service="library-service"');
      expect(metrics).toContain('status="success"');
    });

    it('should record failed external service call', () => {
      service.recordExternalServiceCall('achievement-service', 'error', 5000);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_external_service_calls_total');
      expect(metrics).toContain('service="achievement-service"');
      expect(metrics).toContain('status="error"');
    });

    it('should record external service response time', () => {
      service.recordExternalServiceCall('notification-service', 'success', 200);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_external_service_response_time_seconds');
      expect(metrics).toContain('service="notification-service"');
    });
  });

  describe('updateActiveCalculations', () => {
    it('should increment active calculations', () => {
      service.incrementActiveCalculations();

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_active_rating_calculations');
    });

    it('should decrement active calculations', () => {
      service.incrementActiveCalculations();
      service.decrementActiveCalculations();

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_active_rating_calculations');
    });
  });

  describe('updateCachedRatingsCount', () => {
    it('should update cached ratings count', () => {
      service.updateCachedRatingsCount(150);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_cached_ratings_count');
    });
  });

  describe('getRatingMetricsSummary', () => {
    it('should return comprehensive metrics summary', async () => {
      // Generate some test metrics
      service.recordReviewCreated('game-1', 5);
      service.recordReviewCreated('game-2', 4);
      service.recordRatingCalculation('game-1', 4.5, 2);
      service.recordCacheOperation('hit', 'rating');
      service.recordCacheOperation('miss', 'rating');
      service.recordExternalServiceCall('library-service', 'success', 100);

      const summary = await service.getRatingMetricsSummary();

      expect(summary).toHaveProperty('totalReviews');
      expect(summary).toHaveProperty('totalRatingCalculations');
      expect(summary).toHaveProperty('cacheHitRate');
      expect(summary).toHaveProperty('averageCalculationTime');
      expect(summary).toHaveProperty('externalServiceHealth');
      expect(summary).toHaveProperty('activeCalculations');
      expect(summary).toHaveProperty('cachedRatingsCount');

      expect(summary.totalReviews).toBeGreaterThanOrEqual(0);
      expect(summary.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(summary.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it('should handle empty metrics gracefully', async () => {
      const summary = await service.getRatingMetricsSummary();

      expect(summary.totalReviews).toBe(0);
      expect(summary.totalRatingCalculations).toBe(0);
      expect(summary.cacheHitRate).toBe(0);
      expect(summary.averageCalculationTime).toBe(0);
      expect(summary.activeCalculations).toBe(0);
      expect(summary.cachedRatingsCount).toBe(0);
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should return Prometheus formatted metrics', async () => {
      service.recordReviewCreated('game-123', 5);
      service.recordRatingCalculation('game-123', 4.5, 1);

      const metrics = await service.getPrometheusMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
      expect(metrics).toContain('review_service_');
    });

    it('should include all metric types', async () => {
      // Generate metrics of all types
      service.recordReviewCreated('game-1', 5);
      service.recordCacheOperation('hit', 'rating');
      service.recordExternalServiceCall('library-service', 'success', 100);
      service.incrementActiveCalculations();
      service.updateCachedRatingsCount(50);

      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toContain('review_service_reviews_created_total');
      expect(metrics).toContain('review_service_cache_operations_total');
      expect(metrics).toContain('review_service_external_service_calls_total');
      expect(metrics).toContain('review_service_active_rating_calculations');
      expect(metrics).toContain('review_service_cached_ratings_count');
    });
  });

  describe('error handling', () => {
    it('should handle invalid rating values gracefully', () => {
      // Should not throw errors for edge cases
      expect(() => service.recordReviewCreated('game-123', 0)).not.toThrow();
      expect(() => service.recordReviewCreated('game-123', 6)).not.toThrow();
      expect(() => service.recordReviewCreated('game-123', -1)).not.toThrow();
    });

    it('should handle empty or invalid game IDs', () => {
      expect(() => service.recordReviewCreated('', 5)).not.toThrow();
      expect(() => service.recordReviewCreated(null as any, 5)).not.toThrow();
      expect(() => service.recordReviewCreated(undefined as any, 5)).not.toThrow();
    });

    it('should handle negative response times', () => {
      expect(() => service.recordExternalServiceCall('test-service', 'success', -100)).not.toThrow();
    });
  });

  describe('metric labels and values', () => {
    it('should properly escape special characters in labels', () => {
      service.recordReviewCreated('game-with-"quotes"', 5);
      service.recordExternalServiceCall('service-with\\backslash', 'success', 100);

      const metrics = register.metrics();
      expect(metrics).toContain('review_service_reviews_created_total');
      expect(metrics).toContain('review_service_external_service_calls_total');
    });

    it('should handle very long game IDs', () => {
      const longGameId = 'a'.repeat(1000);
      
      expect(() => service.recordReviewCreated(longGameId, 5)).not.toThrow();
      
      const metrics = register.metrics();
      expect(metrics).toContain('review_service_reviews_created_total');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent metric updates', async () => {
      const promises = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            service.recordReviewCreated(`game-${i % 10}`, (i % 5) + 1);
            service.recordCacheOperation(i % 2 === 0 ? 'hit' : 'miss', 'rating');
          })
        );
      }

      await Promise.all(promises);

      const summary = await service.getRatingMetricsSummary();
      expect(summary.totalReviews).toBeGreaterThan(0);
    });
  });
});