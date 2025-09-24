import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { RatingService } from './rating.service';
import { RatingSchedulerService } from './rating-scheduler.service';
import { MetricsService } from './metrics.service';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';
import { ExternalIntegrationService } from './external-integration.service';

describe('Rating System Integration', () => {
    let ratingService: RatingService;
    let ratingScheduler: RatingSchedulerService;
    let metricsService: MetricsService;
    let gameRatingRepository: jest.Mocked<Repository<GameRating>>;
    let reviewRepository: jest.Mocked<Repository<Review>>;
    let cacheManager: jest.Mocked<Cache>;
    let mockQueryBuilder: any;

    const mockReviews: Review[] = [
        {
            id: '1',
            userId: 'user1',
            gameId: 'game1',
            text: 'Great game!',
            rating: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: '2',
            userId: 'user2',
            gameId: 'game1',
            text: 'Good game',
            rating: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: '3',
            userId: 'user3',
            gameId: 'game1',
            text: 'Average game',
            rating: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

    beforeEach(async () => {
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            having: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getRawMany: jest.fn(),
            getRawOne: jest.fn(),
            getMany: jest.fn(),
        };

        const mockGameRatingRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
        };

        const mockReviewRepository = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
        };

        const mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };

        const mockExternalIntegrationService = {
            updateGameCatalogRating: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RatingService,
                RatingSchedulerService,
                MetricsService,
                {
                    provide: getRepositoryToken(GameRating),
                    useValue: mockGameRatingRepository,
                },
                {
                    provide: getRepositoryToken(Review),
                    useValue: mockReviewRepository,
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
                {
                    provide: ExternalIntegrationService,
                    useValue: mockExternalIntegrationService,
                },
            ],
        }).compile();

        ratingService = module.get<RatingService>(RatingService);
        ratingScheduler = module.get<RatingSchedulerService>(RatingSchedulerService);
        metricsService = module.get<MetricsService>(MetricsService);
        gameRatingRepository = module.get(getRepositoryToken(GameRating));
        reviewRepository = module.get(getRepositoryToken(Review));
        cacheManager = module.get(CACHE_MANAGER);
    });

    describe('Automatic Rating Recalculation', () => {
        it('should automatically recalculate rating when reviews change', async () => {
            // Arrange
            const gameId = 'game1';
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '3',
            });

            gameRatingRepository.findOne.mockResolvedValue(null);
            gameRatingRepository.create.mockReturnValue({
                gameId,
                averageRating: 4.0,
                totalReviews: 3,
            } as GameRating);
            gameRatingRepository.save.mockResolvedValue({
                gameId,
                averageRating: 4.0,
                totalReviews: 3,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            const result = await ratingService.updateGameRating(gameId);

            // Assert
            expect(result.averageRating).toBe(4.0);
            expect(result.totalReviews).toBe(3);
            expect(gameRatingRepository.save).toHaveBeenCalled();
        });

        it('should handle rating calculation for games with no reviews', async () => {
            // Arrange
            const gameId = 'game-no-reviews';
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: null,
                totalReviews: '0',
            });

            // Act
            const result = await ratingService.calculateGameRating(gameId);

            // Assert
            expect(result.averageRating).toBe(0);
            expect(result.totalReviews).toBe(0);
        });
    });

    describe('Redis Caching with 5-minute TTL', () => {
        it('should cache rating with 5-minute TTL', async () => {
            // Arrange
            const gameId = 'game1';
            const gameRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating;

            cacheManager.get.mockResolvedValue(null);
            gameRatingRepository.findOne.mockResolvedValue(gameRating);

            // Act
            await ratingService.getGameRating(gameId);

            // Assert
            expect(cacheManager.set).toHaveBeenCalledWith(
                `game_rating_${gameId}`,
                gameRating,
                300 // 5 minutes TTL
            );
        });

        it('should return cached rating when available', async () => {
            // Arrange
            const gameId = 'game1';
            const cachedRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating;

            cacheManager.get.mockResolvedValue(cachedRating);

            // Act
            const result = await ratingService.getGameRating(gameId);

            // Assert
            expect(result).toEqual(cachedRating);
            expect(gameRatingRepository.findOne).not.toHaveBeenCalled();
        });

        it('should handle cache errors gracefully', async () => {
            // Arrange
            const gameId = 'game1';
            const gameRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating;

            cacheManager.get.mockRejectedValue(new Error('Cache connection failed'));
            gameRatingRepository.findOne.mockResolvedValue(gameRating);

            // Act
            const result = await ratingService.getGameRating(gameId);

            // Assert
            expect(result).toEqual(gameRating);
            expect(gameRatingRepository.findOne).toHaveBeenCalled();
        });
    });

    describe('Cache Invalidation', () => {
        it('should invalidate cache when rating is updated', async () => {
            // Arrange
            const gameId = 'game1';
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.5',
                totalReviews: '10',
            });

            gameRatingRepository.findOne.mockResolvedValue({
                gameId,
                averageRating: 4.0,
                totalReviews: 9,
            } as GameRating);

            gameRatingRepository.save.mockResolvedValue({
                gameId,
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            await ratingService.updateGameRating(gameId);

            // Assert
            expect(cacheManager.del).toHaveBeenCalledWith(`game_rating_${gameId}`);
        });

        it('should invalidate related caches', async () => {
            // Arrange
            const gameId = 'game1';

            // Act
            await ratingService.invalidateRelatedCaches(gameId);

            // Assert
            expect(cacheManager.del).toHaveBeenCalledWith(`game_rating_${gameId}`);
            expect(cacheManager.del).toHaveBeenCalledWith('top_rated_games');
            expect(cacheManager.del).toHaveBeenCalledWith('rating_stats');
        });
    });

    describe('Background Rating Recalculation', () => {
        it('should recalculate all game ratings in background', async () => {
            // Arrange
            const gameIds = [
                { gameId: 'game1' },
                { gameId: 'game2' },
                { gameId: 'game3' },
            ];

            mockQueryBuilder.getRawMany.mockResolvedValue(gameIds);
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '5',
            });

            gameRatingRepository.findOne.mockResolvedValue(null);
            gameRatingRepository.save.mockResolvedValue({
                gameId: 'game1',
                averageRating: 4.0,
                totalReviews: 5,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            await ratingScheduler.recalculateAllGameRatings();

            // Assert
            expect(reviewRepository.createQueryBuilder().getRawMany).toHaveBeenCalled();
            expect(gameRatingRepository.save).toHaveBeenCalledTimes(gameIds.length);
        });

        it('should handle errors during bulk recalculation', async () => {
            // Arrange
            const gameIds = [{ gameId: 'game1' }];
            mockQueryBuilder.getRawMany.mockResolvedValue(gameIds);
            mockQueryBuilder.getRawOne.mockRejectedValue(
                new Error('Database error')
            );

            // Act & Assert
            await expect(ratingScheduler.recalculateAllGameRatings()).resolves.not.toThrow();
        });
    });

    describe('Performance Metrics', () => {
        it('should record rating calculation metrics', async () => {
            // Arrange
            const gameId = 'game1';
            const spy = jest.spyOn(metricsService, 'recordRatingCalculation');

            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '3',
            });

            gameRatingRepository.findOne.mockResolvedValue(null);
            gameRatingRepository.save.mockResolvedValue({
                gameId,
                averageRating: 4.0,
                totalReviews: 3,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            await ratingService.updateGameRating(gameId);

            // Assert
            expect(spy).toHaveBeenCalledWith(gameId, 'update');
        });

        it('should record cache operation metrics', async () => {
            // Arrange
            const gameId = 'game1';
            const cachedRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating;

            cacheManager.get.mockResolvedValue(cachedRating);
            const spy = jest.spyOn(metricsService, 'recordCacheOperation');

            // Act
            await ratingService.getGameRating(gameId);

            // Assert
            expect(spy).toHaveBeenCalledWith('get', 'hit');
        });

        it('should track active calculations', async () => {
            // Arrange
            const gameId = 'game1';
            const incrementSpy = jest.spyOn(metricsService, 'incrementActiveCalculations');
            const decrementSpy = jest.spyOn(metricsService, 'decrementActiveCalculations');

            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '3',
            });

            // Act
            await ratingService.calculateGameRating(gameId);

            // Assert
            expect(incrementSpy).toHaveBeenCalled();
            expect(decrementSpy).toHaveBeenCalled();
        });
    });

    describe('Bulk Operations', () => {
        it('should handle bulk rating retrieval efficiently', async () => {
            // Arrange
            const gameIds = ['game1', 'game2', 'game3'];
            const cachedRating = {
                gameId: 'game1',
                averageRating: 4.5,
                totalReviews: 10,
                updatedAt: new Date(),
            } as GameRating;

            cacheManager.get
                .mockResolvedValueOnce(cachedRating) // game1 cached
                .mockResolvedValueOnce(null) // game2 not cached
                .mockResolvedValueOnce(null); // game3 not cached

            gameRatingRepository.find.mockResolvedValue([
                {
                    gameId: 'game2',
                    averageRating: 3.5,
                    totalReviews: 5,
                    updatedAt: new Date(),
                } as GameRating,
            ]);

            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '2',
            });

            gameRatingRepository.save.mockResolvedValue({
                gameId: 'game3',
                averageRating: 4.0,
                totalReviews: 2,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            const results = await ratingService.getBulkGameRatings(gameIds);

            // Assert
            expect(results.size).toBe(3);
            expect(results.has('game1')).toBe(true);
            expect(results.has('game2')).toBe(true);
            expect(results.has('game3')).toBe(true);
        });

        it('should preload ratings by priority', async () => {
            // Arrange
            const highPriorityGames = ['game1', 'game2'];
            const popularGames = [
                { gameId: 'game3', averageRating: 4.8, totalReviews: 100, updatedAt: new Date() },
                { gameId: 'game4', averageRating: 4.7, totalReviews: 95, updatedAt: new Date() },
            ];

            gameRatingRepository.find.mockResolvedValue(popularGames);
            gameRatingRepository.count.mockResolvedValue(50);
            cacheManager.get.mockResolvedValue(null);
            gameRatingRepository.findOne.mockResolvedValue({
                gameId: 'game1',
                averageRating: 4.5,
                totalReviews: 50,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            const result = await ratingService.preloadRatingsByPriority({
                highPriorityGames,
                includePopular: true,
                maxGames: 10,
            });

            // Assert
            expect(result.preloaded).toBeGreaterThanOrEqual(0);
            expect(result.errors).toBeGreaterThanOrEqual(0);
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('System Load and Performance', () => {
        it('should update system load metrics during bulk operations', async () => {
            // Arrange
            const spy = jest.spyOn(metricsService, 'updateRatingSystemLoad');
            mockQueryBuilder.getRawMany.mockResolvedValue([
                { gameId: 'game1' },
            ]);

            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '3',
            });

            gameRatingRepository.save.mockResolvedValue({
                gameId: 'game1',
                averageRating: 4.0,
                totalReviews: 3,
                updatedAt: new Date(),
            } as GameRating);

            // Act
            await ratingScheduler.recalculateAllGameRatings();

            // Assert
            expect(spy).toHaveBeenCalled();
        });

        it('should provide performance analytics', async () => {
            // Arrange
            const mockSummary = {
                totalCalculations: 100,
                totalCacheOperations: 500,
                activeCalculations: 2,
                cachedRatingsCount: 50,
                averageCalculationTime: 0.05,
            };

            jest.spyOn(metricsService, 'getRatingMetricsSummary').mockResolvedValue(mockSummary);

            // Act
            const analytics = await ratingService.getPerformanceAnalytics();

            // Assert
            expect(analytics.cacheEfficiency.hitRate).toBeGreaterThanOrEqual(0);
            expect(analytics.cacheEfficiency.hitRate).toBeLessThanOrEqual(1);
            expect(analytics.ratingCalculations.totalCalculations).toBe(100);
            expect(analytics.systemLoad.activeCalculations).toBe(2);
        });
    });
});