import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { RatingService } from './rating.service';
import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';
import { ExternalIntegrationService } from './external-integration.service';
import { MetricsService } from './metrics.service';

describe('RatingService', () => {
    let service: RatingService;
    let gameRatingRepository: jest.Mocked<Repository<GameRating>>;
    let reviewRepository: jest.Mocked<Repository<Review>>;
    let cacheManager: jest.Mocked<Cache>;

    const mockGameRating: GameRating = {
        gameId: 'game-456',
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockGameRatingRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        const mockReviewRepository = {
            createQueryBuilder: jest.fn(),
        };

        const mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        };



        const mockExternalIntegrationService = {
            updateGameCatalogRating: jest.fn(),
        };

        const mockMetricsService = {
            recordRatingCalculation: jest.fn(),
            recordRatingCalculationDuration: jest.fn(),
            recordCacheOperation: jest.fn(),
            recordCacheOperationDuration: jest.fn(),
            incrementActiveCalculations: jest.fn(),
            decrementActiveCalculations: jest.fn(),
            updateCachedRatingsCount: jest.fn(),
            getRatingMetricsSummary: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RatingService,
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
                {
                    provide: MetricsService,
                    useValue: mockMetricsService,
                },
            ],
        }).compile();

        service = module.get<RatingService>(RatingService);
        gameRatingRepository = module.get(getRepositoryToken(GameRating));
        reviewRepository = module.get(getRepositoryToken(Review));
        cacheManager = module.get(CACHE_MANAGER);
    });

    describe('calculateGameRating', () => {
        it('should calculate average rating and total reviews', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.5',
                    totalReviews: '10',
                }),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.calculateGameRating('game-456');

            expect(result).toEqual({
                averageRating: 4.5,
                totalReviews: 10,
            });
        });

        it('should return zero values when no reviews exist', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: null,
                    totalReviews: '0',
                }),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.calculateGameRating('game-456');

            expect(result).toEqual({
                averageRating: 0,
                totalReviews: 0,
            });
        });
    });

    describe('updateGameRating', () => {
        it('should update existing game rating', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.5',
                    totalReviews: '10',
                }),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);
            gameRatingRepository.save.mockResolvedValue(mockGameRating);
            cacheManager.del.mockResolvedValue(true);

            const result = await service.updateGameRating('game-456');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.save).toHaveBeenCalled();
            expect(cacheManager.del).toHaveBeenCalledWith('game_rating_game-456');
        });

        it('should create new game rating if none exists', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.5',
                    totalReviews: '10',
                }),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
            gameRatingRepository.findOne.mockResolvedValue(null);
            gameRatingRepository.create.mockReturnValue(mockGameRating);
            gameRatingRepository.save.mockResolvedValue(mockGameRating);
            cacheManager.del.mockResolvedValue(true);

            const result = await service.updateGameRating('game-456');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.create).toHaveBeenCalledWith({
                gameId: 'game-456',
                averageRating: 4.5,
                totalReviews: 10,
            });
        });
    });

    describe('getGameRating', () => {
        it('should return cached rating if available', async () => {
            cacheManager.get.mockResolvedValue(mockGameRating);

            const result = await service.getGameRating('game-456');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.findOne).not.toHaveBeenCalled();
        });

        it('should fetch from database and cache if not in cache', async () => {
            cacheManager.get.mockResolvedValue(undefined);
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);
            cacheManager.set.mockResolvedValue(undefined);

            const result = await service.getGameRating('game-456');

            expect(result).toEqual(mockGameRating);
            expect(cacheManager.set).toHaveBeenCalledWith('game_rating_game-456', mockGameRating, 300);
        });

        it('should create empty rating for games without reviews', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: null,
                    totalReviews: '0',
                }),
            };

            cacheManager.get.mockResolvedValue(undefined);
            gameRatingRepository.findOne.mockResolvedValue(null);
            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
            cacheManager.set.mockResolvedValue(undefined);

            const result = await service.getGameRating('game-456');

            expect(result?.gameId).toBe('game-456');
            expect(result?.averageRating).toBe(0);
            expect(result?.totalReviews).toBe(0);
        });
    });

    describe('getTopRatedGames', () => {
        it('should return top rated games', async () => {
            const topGames = [mockGameRating];
            gameRatingRepository.find.mockResolvedValue(topGames);

            const result = await service.getTopRatedGames(10);

            expect(result).toEqual(topGames);
            expect(gameRatingRepository.find).toHaveBeenCalledWith({
                where: { totalReviews: 5 },
                order: { averageRating: 'DESC', totalReviews: 'DESC' },
                take: 10,
            });
        });

        it('should use default limit when not provided', async () => {
            const topGames = [mockGameRating];
            gameRatingRepository.find.mockResolvedValue(topGames);

            const result = await service.getTopRatedGames();

            expect(result).toEqual(topGames);
            expect(gameRatingRepository.find).toHaveBeenCalledWith({
                where: { totalReviews: 5 },
                order: { averageRating: 'DESC', totalReviews: 'DESC' },
                take: 10,
            });
        });

        it('should handle empty results', async () => {
            gameRatingRepository.find.mockResolvedValue([]);

            const result = await service.getTopRatedGames(10);

            expect(result).toEqual([]);
        });
    });



    describe('invalidateGameRatingCache', () => {
        it('should invalidate cache for specific game', async () => {
            cacheManager.del.mockResolvedValue(true);

            await service.invalidateGameRatingCache('game-456');

            expect(cacheManager.del).toHaveBeenCalledWith('game_rating_game-456');
        });

        it('should handle cache deletion errors gracefully', async () => {
            cacheManager.del.mockRejectedValue(new Error('Cache error'));

            // Should not throw error - the service should handle cache errors gracefully
            await service.invalidateGameRatingCache('game-456');
            
            expect(cacheManager.del).toHaveBeenCalledWith('game_rating_game-456');
        });
    });

    describe('error handling', () => {
        it('should handle database errors in calculateGameRating', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockRejectedValue(new Error('Database error')),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            await expect(service.calculateGameRating('game-456')).rejects.toThrow('Database error');
        });

        it('should handle cache errors gracefully in getGameRating', async () => {
            // Mock cache to throw error, but service should continue with database
            cacheManager.get.mockImplementation(() => {
                throw new Error('Cache error');
            });
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);

            const result = await service.getGameRating('game-456');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.findOne).toHaveBeenCalled();
        });

        it('should handle save errors in updateGameRating', async () => {
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.5',
                    totalReviews: '10',
                }),
            };

            reviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);
            gameRatingRepository.save.mockRejectedValue(new Error('Save error'));

            await expect(service.updateGameRating('game-456')).rejects.toThrow('Save error');
        });
    });
});