import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from '../services/metrics.service';
import { RatingService } from '../services/rating.service';
import { RatingSchedulerService } from '../services/rating-scheduler.service';

describe('MetricsController', () => {
    let controller: MetricsController;
    let metricsService: MetricsService;
    let ratingService: RatingService;
    let ratingSchedulerService: RatingSchedulerService;

    const mockMetricsService = {
        getMetrics: jest.fn(),
        getRatingMetricsSummary: jest.fn(),
        incrementReviewsCreated: jest.fn(),
        incrementReviewsUpdated: jest.fn(),
        incrementReviewsDeleted: jest.fn(),
        recordRatingCalculation: jest.fn(),
        recordCacheHit: jest.fn(),
        recordCacheMiss: jest.fn(),
        recordExternalServiceCall: jest.fn(),
        recordDatabaseQuery: jest.fn(),
    };

    const mockRatingService = {
        getCacheStatistics: jest.fn(),
        preloadPopularGameRatings: jest.fn(),
        getTopRatedGames: jest.fn(),
        getGameRating: jest.fn(),
    };

    const mockRatingSchedulerService = {
        getSchedulerStatus: jest.fn(),
        recalculateRatingsForGames: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MetricsController],
            providers: [
                {
                    provide: MetricsService,
                    useValue: mockMetricsService,
                },
                {
                    provide: RatingService,
                    useValue: mockRatingService,
                },
                {
                    provide: RatingSchedulerService,
                    useValue: mockRatingSchedulerService,
                },
            ],
        }).compile();

        controller = module.get<MetricsController>(MetricsController);
        metricsService = module.get<MetricsService>(MetricsService);
        ratingService = module.get<RatingService>(RatingService);
        ratingSchedulerService = module.get<RatingSchedulerService>(RatingSchedulerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getMetrics', () => {
        it('should return Prometheus metrics', async () => {
            const mockMetrics = 'review_service_reviews_total 42\nreview_service_ratings_total 24';
            mockMetricsService.getMetrics.mockResolvedValue(mockMetrics);

            const result = await controller.getMetrics();

            expect(result).toBe(mockMetrics);
            expect(mockMetricsService.getMetrics).toHaveBeenCalledTimes(1);
        });

        it('should handle metrics service errors', async () => {
            mockMetricsService.getMetrics.mockRejectedValue(new Error('Metrics error'));

            await expect(controller.getMetrics()).rejects.toThrow('Metrics error');
        });
    });

    describe('getMetricsSummary', () => {
        it('should return metrics summary', async () => {
            const mockRatingMetrics = { totalCalculations: 100, activeCalculations: 5 };
            const mockCacheStats = { cacheHitRate: 0.8, totalOperations: 1000 };
            const mockSchedulerStatus = { isRecalculationRunning: false };

            mockMetricsService.getRatingMetricsSummary.mockResolvedValue(mockRatingMetrics);
            mockRatingService.getCacheStatistics.mockResolvedValue(mockCacheStats);
            mockRatingSchedulerService.getSchedulerStatus.mockReturnValue(mockSchedulerStatus);

            const result = await controller.getMetricsSummary();

            expect(result).toEqual({
                rating: mockRatingMetrics,
                cache: mockCacheStats,
                scheduler: mockSchedulerStatus,
                timestamp: expect.any(String),
            });
        });
    });

    describe('getHealthStatus', () => {
        it('should return healthy status when all components are healthy', async () => {
            const mockRatingMetrics = {
                totalCalculations: 100,
                activeCalculations: 5,
                cachedRatingsCount: 50,
                averageCalculationTime: 0.05,
                totalCacheOperations: 1000
            };
            const mockCacheStats = { cacheHitRate: 0.8, totalOperations: 1000 };
            const mockSchedulerStatus = { isRecalculationRunning: false };

            mockMetricsService.getRatingMetricsSummary.mockResolvedValue(mockRatingMetrics);
            mockRatingService.getCacheStatistics.mockResolvedValue(mockCacheStats);
            mockRatingSchedulerService.getSchedulerStatus.mockReturnValue(mockSchedulerStatus);

            const result = await controller.getHealthStatus();

            expect(result.status).toBe('healthy');
            expect(result.components).toEqual({
                metrics: true,
                cache: true,
                calculations: true,
                scheduler: true,
            });
        });

        it('should return degraded status when some components are unhealthy', async () => {
            const mockRatingMetrics = {
                totalCalculations: 100,
                activeCalculations: 150, // Too many active calculations
                cachedRatingsCount: 50,
                averageCalculationTime: 0.05,
                totalCacheOperations: 1000
            };
            const mockCacheStats = { cacheHitRate: 0.3 }; // Low cache hit rate
            const mockSchedulerStatus = { isRecalculationRunning: false };

            mockMetricsService.getRatingMetricsSummary.mockResolvedValue(mockRatingMetrics);
            mockRatingService.getCacheStatistics.mockResolvedValue(mockCacheStats);
            mockRatingSchedulerService.getSchedulerStatus.mockReturnValue(mockSchedulerStatus);

            const result = await controller.getHealthStatus();

            expect(result.status).toBe('degraded');
            expect(result.components?.cache).toBe(false);
            expect(result.components?.calculations).toBe(false);
        });

        it('should handle errors and return unhealthy status', async () => {
            mockMetricsService.getRatingMetricsSummary.mockRejectedValue(new Error('Service error'));

            const result = await controller.getHealthStatus();

            expect(result.status).toBe('unhealthy');
            expect(result.error).toBe('Service error');
        });
    });

    describe('triggerRecalculation', () => {
        it('should trigger recalculation for valid game IDs', async () => {
            const gameIds = ['game-1', 'game-2'];
            const mockResult = { success: true, processed: 2 };

            mockRatingSchedulerService.recalculateRatingsForGames.mockResolvedValue(mockResult);

            const result = await controller.triggerRecalculation({ gameIds });

            expect(result.success).toBe(true);
            expect(result.result).toEqual(mockResult);
            expect(mockRatingSchedulerService.recalculateRatingsForGames).toHaveBeenCalledWith(gameIds);
        });

        it('should return error for empty game IDs array', async () => {
            const result = await controller.triggerRecalculation({ gameIds: [] });

            expect(result.error).toBe('gameIds array is required and must not be empty');
        });

        it('should return error for too many game IDs', async () => {
            const gameIds = Array.from({ length: 101 }, (_, i) => `game-${i}`);

            const result = await controller.triggerRecalculation({ gameIds });

            expect(result.error).toBe('Maximum 100 games can be recalculated at once');
        });
    });

    describe('preloadCache', () => {
        it('should preload cache successfully', async () => {
            mockRatingService.preloadPopularGameRatings.mockResolvedValue(undefined);

            const result = await controller.preloadCache();

            expect(result.success).toBe(true);
            expect(result.message).toBe('Popular game ratings preloaded into cache');
        });

        it('should handle preload errors', async () => {
            mockRatingService.preloadPopularGameRatings.mockRejectedValue(new Error('Preload error'));

            const result = await controller.preloadCache();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Preload error');
        });
    });

    describe('getPerformanceMetrics', () => {
        it('should return performance metrics', async () => {
            const mockSummary = {
                totalCalculations: 1000,
                activeCalculations: 5,
                averageCalculationTime: 0.05,
                totalCacheOperations: 2000,
                cachedRatingsCount: 100,
            };
            const mockCacheStats = { cacheHitRate: 0.8 };

            mockMetricsService.getRatingMetricsSummary.mockResolvedValue(mockSummary);
            mockRatingService.getCacheStatistics.mockResolvedValue(mockCacheStats);

            const result = await controller.getPerformanceMetrics();

            expect(result.performance).toHaveProperty('calculationsPerSecond');
            expect(result.performance).toHaveProperty('averageCalculationTime');
            expect(result.performance).toHaveProperty('cacheEfficiency');
            expect(result.totals).toHaveProperty('totalCalculations', 1000);
            expect(result.recommendations).toBeInstanceOf(Array);
        });

        it('should handle performance metrics errors', async () => {
            mockMetricsService.getRatingMetricsSummary.mockRejectedValue(new Error('Performance error'));

            const result = await controller.getPerformanceMetrics();

            expect(result.error).toBe('Performance error');
        });
    });
});