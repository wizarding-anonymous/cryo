import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RatingService } from './rating.service';
import { MetricsService } from './metrics.service';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

describe('RatingService', () => {
    let service: RatingService;
    let reviewRepository: jest.Mocked<Repository<Review>>;
    let gameRatingRepository: jest.Mocked<Repository<GameRating>>;
    let cacheManager: jest.Mocked<Cache>;
    let metricsService: jest.Mocked<MetricsService>;

    const mockGameRating: GameRating = {
        gameId: 'game1',
        averageRating: 4.5,
        totalReviews: 2,
        updatedAt: new Date(),
    };

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

        const mockMetricsService = {
            measureOperation: jest.fn(),
            recordMetric: jest.fn(),
        };

        const mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn(),
        } as any;

        mockReviewRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RatingService,
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
                {
                    provide: MetricsService,
                    useValue: mockMetricsService,
                },
            ],
        }).compile();

        service = module.get<RatingService>(RatingService);
        reviewRepository = module.get(getRepositoryToken(Review));
        gameRatingRepository = module.get(getRepositoryToken(GameRating));
        cacheManager = module.get(CACHE_MANAGER);
        metricsService = module.get(MetricsService);

        // Setup default behavior for measureOperation to just execute the operation
        metricsService.measureOperation.mockImplementation(async (type, operation) => {
            return await operation();
        });
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('calculateGameRating', () => {
        it('should calculate average rating and total reviews', async () => {
            const mockQueryBuilder = reviewRepository.createQueryBuilder() as any;
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.5',
                totalReviews: '2',
            });

            const result = await service.calculateGameRating('game1');

            expect(result).toEqual({
                averageRating: 4.5,
                totalReviews: 2,
            });
            expect(metricsService.measureOperation).toHaveBeenCalledWith(
                'calculate',
                expect.any(Function),
                'game1'
            );
        });

        it('should return zero values when no reviews exist', async () => {
            const mockQueryBuilder = reviewRepository.createQueryBuilder() as any;
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: null,
                totalReviews: '0',
            });

            const result = await service.calculateGameRating('game1');

            expect(result).toEqual({
                averageRating: 0,
                totalReviews: 0,
            });
        });
    });

    describe('updateGameRating', () => {
        it('should create new game rating if none exists', async () => {
            const mockQueryBuilder = reviewRepository.createQueryBuilder() as any;
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.5',
                totalReviews: '2',
            });

            gameRatingRepository.findOne.mockResolvedValue(null);
            gameRatingRepository.create.mockReturnValue(mockGameRating);
            gameRatingRepository.save.mockResolvedValue(mockGameRating);
            cacheManager.del.mockResolvedValue(true);

            const result = await service.updateGameRating('game1');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.create).toHaveBeenCalledWith({
                gameId: 'game1',
                averageRating: 4.5,
                totalReviews: 2,
            });
            expect(cacheManager.del).toHaveBeenCalledWith('game_rating_game1');
            expect(metricsService.measureOperation).toHaveBeenCalledWith(
                'update',
                expect.any(Function),
                'game1'
            );
        });

        it('should update existing game rating', async () => {
            const mockQueryBuilder = reviewRepository.createQueryBuilder() as any;
            mockQueryBuilder.getRawOne.mockResolvedValue({
                averageRating: '4.0',
                totalReviews: '3',
            });

            const existingRating = { ...mockGameRating };
            gameRatingRepository.findOne.mockResolvedValue(existingRating);
            gameRatingRepository.save.mockResolvedValue({
                ...existingRating,
                averageRating: 4.0,
                totalReviews: 3,
            });
            cacheManager.del.mockResolvedValue(true);

            const result = await service.updateGameRating('game1');

            expect(result.averageRating).toBe(4.0);
            expect(result.totalReviews).toBe(3);
            expect(cacheManager.del).toHaveBeenCalledWith('game_rating_game1');
        });
    });

    describe('getGameRating', () => {
        it('should return cached rating if available', async () => {
            cacheManager.get.mockResolvedValue(mockGameRating);

            const result = await service.getGameRating('game1');

            expect(result).toEqual(mockGameRating);
            expect(cacheManager.get).toHaveBeenCalledWith('game_rating_game1');
            expect(gameRatingRepository.findOne).not.toHaveBeenCalled();
        });

        it('should fetch from database and cache if not in cache', async () => {
            cacheManager.get.mockResolvedValue(null);
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);
            cacheManager.set.mockResolvedValue(undefined);

            const result = await service.getGameRating('game1');

            expect(result).toEqual(mockGameRating);
            expect(gameRatingRepository.findOne).toHaveBeenCalledWith({
                where: { gameId: 'game1' },
            });
            expect(cacheManager.set).toHaveBeenCalledWith('game_rating_game1', mockGameRating, 300);
        });

        it('should return null if rating not found', async () => {
            cacheManager.get.mockResolvedValue(null);
            gameRatingRepository.findOne.mockResolvedValue(null);

            const result = await service.getGameRating('game1');

            expect(result).toBeNull();
            expect(cacheManager.set).not.toHaveBeenCalled();
        });

        it('should record cache hit metric when rating is cached', async () => {
            cacheManager.get.mockResolvedValue(mockGameRating);

            await service.getGameRating('game1');

            expect(metricsService.recordMetric).toHaveBeenCalledWith({
                operationType: 'cache_hit',
                gameId: 'game1',
                duration: 0,
                timestamp: expect.any(Date),
                success: true,
            });
        });

        it('should record cache miss metric when rating is not cached', async () => {
            cacheManager.get.mockResolvedValue(null);
            gameRatingRepository.findOne.mockResolvedValue(mockGameRating);

            await service.getGameRating('game1');

            expect(metricsService.recordMetric).toHaveBeenCalledWith({
                operationType: 'cache_miss',
                gameId: 'game1',
                duration: 0,
                timestamp: expect.any(Date),
                success: true,
            });
        });
    });
});