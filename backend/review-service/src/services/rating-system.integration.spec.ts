import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RatingService } from './rating.service';
import { MetricsService } from './metrics.service';
import { BackgroundTasksService } from './background-tasks.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

describe('Rating System Integration', () => {
    let ratingService: RatingService;
    let metricsService: MetricsService;
    let backgroundTasksService: BackgroundTasksService;
    let reviewRepository: jest.Mocked<Repository<Review>>;
    let gameRatingRepository: jest.Mocked<Repository<GameRating>>;
    let cacheManager: jest.Mocked<Cache>;

    beforeEach(async () => {
        const mockReviewRepository = {
            createQueryBuilder: jest.fn(),
        };

        const mockGameRatingRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RatingService,
                MetricsService,
                BackgroundTasksService,
                {
                    provide: getRepositoryToken(Review),
                    useValue: mockReviewRepository,
                },
                {
                    provide: getRepositoryToken(GameRating),
                    useValue: mockGameRatingRepository,
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
            ],
        }).compile();

        ratingService = module.get<RatingService>(RatingService);
        metricsService = module.get<MetricsService>(MetricsService);
        backgroundTasksService = module.get<BackgroundTasksService>(BackgroundTasksService);
        reviewRepository = module.get(getRepositoryToken(Review));
        gameRatingRepository = module.get(getRepositoryToken(GameRating));
        cacheManager = module.get(CACHE_MANAGER);
    });

    it('should integrate rating calculation with metrics tracking', async () => {
        // Setup mock data
        const mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({
                averageRating: '4.5',
                totalReviews: '2',
            }),
        };

        reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
        gameRatingRepository.findOne.mockResolvedValue(null);
        gameRatingRepository.create.mockReturnValue({
            gameId: 'game-123',
            averageRating: 4.5,
            totalReviews: 2,
            updatedAt: new Date(),
        } as GameRating);
        gameRatingRepository.save.mockResolvedValue({
            gameId: 'game-123',
            averageRating: 4.5,
            totalReviews: 2,
            updatedAt: new Date(),
        } as GameRating);
        cacheManager.del.mockResolvedValue(true);

        // Clear metrics before test
        metricsService.clearMetrics();

        // Execute rating update
        const result = await ratingService.updateGameRating('game-123');

        // Verify result
        expect(result.gameId).toBe('game-123');
        expect(result.averageRating).toBe(4.5);
        expect(result.totalReviews).toBe(2);

        // Verify metrics were recorded
        const metrics = metricsService.getMetrics();
        expect(metrics.length).toBeGreaterThan(0);

        // Should have both calculate and update metrics
        const operationTypes = metrics.map(m => m.operationType);
        expect(operationTypes).toContain('calculate');
        expect(operationTypes).toContain('update');

        // Verify metrics summary
        const summary = metricsService.getMetricsSummary();
        expect(summary.totalOperations).toBeGreaterThan(0);
        expect(summary.successRate).toBe(100);
        expect(summary.operationCounts.calculate).toBeGreaterThan(0);
        expect(summary.operationCounts.update).toBeGreaterThan(0);
    });

    it('should integrate caching with metrics tracking', async () => {
        const mockRating = {
            gameId: 'game-456',
            averageRating: 3.8,
            totalReviews: 5,
            updatedAt: new Date(),
        };

        // Clear metrics before test
        metricsService.clearMetrics();

        // Test cache miss
        cacheManager.get.mockResolvedValueOnce(null);
        gameRatingRepository.findOne.mockResolvedValue(mockRating);
        cacheManager.set.mockResolvedValue(undefined);

        const result1 = await ratingService.getGameRating('game-456');
        expect(result1).toEqual(mockRating);

        // Test cache hit
        cacheManager.get.mockResolvedValueOnce(mockRating);

        const result2 = await ratingService.getGameRating('game-456');
        expect(result2).toEqual(mockRating);

        // Verify metrics
        const metrics = metricsService.getMetrics();
        const operationTypes = metrics.map(m => m.operationType);

        expect(operationTypes).toContain('get');
        expect(operationTypes).toContain('cache_miss');
        expect(operationTypes).toContain('cache_hit');

        const summary = metricsService.getMetricsSummary();
        expect(summary.operationCounts.cache_hit).toBe(1);
        expect(summary.operationCounts.cache_miss).toBe(1);
    });

    it('should handle bulk recalculation with metrics', async () => {
        // Setup mock data for bulk recalculation
        const mockGameIds = [
            { gameId: 'game-1' },
            { gameId: 'game-2' },
        ];

        const mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue(mockGameIds),
        };

        reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

        // Mock rating service calls
        jest.spyOn(ratingService, 'updateGameRating')
            .mockResolvedValueOnce({
                gameId: 'game-1',
                averageRating: 4.0,
                totalReviews: 3,
                updatedAt: new Date(),
            } as GameRating)
            .mockResolvedValueOnce({
                gameId: 'game-2',
                averageRating: 3.5,
                totalReviews: 2,
                updatedAt: new Date(),
            } as GameRating);

        // Clear metrics before test
        metricsService.clearMetrics();

        // Execute bulk recalculation
        const result = await backgroundTasksService.recalculateAllGameRatings();

        // Verify result
        expect(result.totalGames).toBe(2);
        expect(result.successfulUpdates).toBe(2);
        expect(result.failedUpdates).toBe(0);

        // Verify metrics were recorded for bulk operation
        const metrics = metricsService.getMetrics();
        const bulkMetrics = metrics.filter(m => m.operationType === 'bulk_recalculate');
        expect(bulkMetrics.length).toBe(2); // One for each game
    });
});