import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import request from 'supertest';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ReviewController, RatingController } from '../src/controllers';
import { ReviewService, RatingService, OwnershipService, MetricsService } from '../src/services';
import { Review, GameRating } from '../src/entities';
import { HttpExceptionFilter } from '../src/filters';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { OwnershipGuard } from '../src/guards/ownership.guard';

describe('Complete Review System Integration (E2E)', () => {
    let app: INestApplication;
    let reviewRepository: Repository<Review>;
    let gameRatingRepository: Repository<GameRating>;
    let cacheManager: Cache;
    let ownershipService: OwnershipService;
    let metricsService: MetricsService;

    // Test data - removed unused testUsers variable

    const testGames = [
        { id: 'game-1', title: 'Epic Adventure Game' },
        { id: 'game-2', title: 'Strategy Master' },
    ];

    const testReviews = [
        {
            userId: 'user-1',
            gameId: 'game-1',
            text: 'Amazing game with incredible graphics and engaging storyline!',
            rating: 5,
        },
        {
            userId: 'user-2',
            gameId: 'game-1',
            text: 'Good game but could use better controls.',
            rating: 4,
        },
        {
            userId: 'user-3',
            gameId: 'game-1',
            text: 'Decent game, worth playing once.',
            rating: 3,
        },
    ];

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                HttpModule,
            ],
            controllers: [AppController, ReviewController, RatingController],
            providers: [
                AppService,
                ReviewService,
                RatingService,
                OwnershipService,
                MetricsService,
                {
                    provide: getRepositoryToken(Review),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                        findOne: jest.fn(),
                        findAndCount: jest.fn(),
                        remove: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(GameRating),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: {
                        get: jest.fn(),
                        set: jest.fn(),
                        del: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: any) => {
                    const request = context.switchToHttp().getRequest();
                    const authHeader = request.headers.authorization;
                    if (authHeader && authHeader.startsWith('Bearer mock-jwt-token')) {
                        // Extract user ID from token for testing
                        const token = authHeader.replace('Bearer ', '');
                        const userId = token.replace('mock-jwt-token-', '') || 'user-1';
                        request.user = { id: userId, email: `${userId}@example.com` };
                        return true;
                    }
                    return false;
                },
            })
            .overrideGuard(OwnershipGuard)
            .useValue({
                canActivate: () => true, // Allow all requests in tests
            })
            .compile();

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }));

        app.useGlobalFilters(new HttpExceptionFilter());

        await app.init();

        reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
        gameRatingRepository = moduleFixture.get<Repository<GameRating>>(getRepositoryToken(GameRating));
        cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
        ownershipService = moduleFixture.get<OwnershipService>(OwnershipService);
        metricsService = moduleFixture.get<MetricsService>(MetricsService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Review Creation and Rating Calculation Flow', () => {
        it('should handle multiple reviews and calculate accurate ratings', async () => {
            const gameId = testGames[0].id;
            let currentReviewCount = 0;
            let totalRatingSum = 0;
            const createdReviews: any[] = [];

            // Mock ownership service to allow all users to review
            jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(true);

            // Mock metrics service
            jest.spyOn(metricsService, 'measureOperation').mockImplementation(async (_type, operation) => {
                return await operation();
            });
            jest.spyOn(metricsService, 'recordMetric').mockReturnValue(undefined);

            for (const [index, reviewData] of testReviews.entries()) {
                // Mock no existing review for this user
                (reviewRepository.findOne as jest.Mock).mockResolvedValue(null);

                // Create mock review
                const mockReview = {
                    id: `review-${index + 1}`,
                    ...reviewData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                (reviewRepository.create as jest.Mock).mockReturnValue(mockReview);
                (reviewRepository.save as jest.Mock).mockResolvedValue(mockReview);
                createdReviews.push(mockReview);

                // Update counters for rating calculation
                currentReviewCount++;
                totalRatingSum += reviewData.rating;
                const expectedAverage = totalRatingSum / currentReviewCount;

                // Mock rating calculation query
                const mockQueryBuilder = {
                    select: jest.fn().mockReturnThis(),
                    addSelect: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    getRawOne: jest.fn().mockResolvedValue({
                        averageRating: expectedAverage.toString(),
                        totalReviews: currentReviewCount.toString(),
                    }),
                };
                (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

                // Mock game rating update
                const updatedRating = {
                    gameId,
                    averageRating: expectedAverage,
                    totalReviews: currentReviewCount,
                    updatedAt: new Date(),
                };

                if (index === 0) {
                    // First review - no existing rating
                    (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);
                    (gameRatingRepository.create as jest.Mock).mockReturnValue(updatedRating);
                } else {
                    // Subsequent reviews - update existing rating
                    const existingRating = {
                        gameId,
                        averageRating: totalRatingSum / (currentReviewCount - 1),
                        totalReviews: currentReviewCount - 1,
                        updatedAt: new Date(),
                    };
                    (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(existingRating);
                }

                (gameRatingRepository.save as jest.Mock).mockResolvedValue(updatedRating);
                (cacheManager.del as jest.Mock).mockResolvedValue(true);

                // Create the review
                const response = await request(app.getHttpServer())
                    .post('/reviews')
                    .set('Authorization', `Bearer mock-jwt-token-${reviewData.userId}`)
                    .send({
                        gameId: reviewData.gameId,
                        text: reviewData.text,
                        rating: reviewData.rating,
                    })
                    .expect(201);

                expect(response.body).toMatchObject({
                    id: expect.any(String),
                    userId: reviewData.userId,
                    gameId: reviewData.gameId,
                    text: reviewData.text,
                    rating: reviewData.rating,
                });

                // Verify rating calculation was called
                expect(reviewRepository.createQueryBuilder).toHaveBeenCalled();
                expect(gameRatingRepository.save).toHaveBeenCalledWith(
                    expect.objectContaining({
                        gameId,
                        averageRating: expectedAverage,
                        totalReviews: currentReviewCount,
                    })
                );

                // Verify cache invalidation
                expect(cacheManager.del).toHaveBeenCalledWith(`game_rating_${gameId}`);
            }

            // Final verification: average should be (5 + 4 + 3) / 3 = 4.0
            const finalExpectedAverage = 4.0;
            expect(totalRatingSum / currentReviewCount).toBe(finalExpectedAverage);
        });
    });

    describe('Review Retrieval with Pagination', () => {
        it('should retrieve reviews with proper pagination and sorting', async () => {
            const gameId = testGames[0].id;
            const mockReviews = testReviews.map((review, index) => ({
                id: `review-${index + 1}`,
                ...review,
                createdAt: new Date(Date.now() - (index * 1000 * 60 * 60)), // Different timestamps
                updatedAt: new Date(Date.now() - (index * 1000 * 60 * 60)),
            }));

            // Test first page
            (reviewRepository.findAndCount as jest.Mock).mockResolvedValue([
                mockReviews.slice(0, 2), // First 2 reviews
                mockReviews.length,
            ]);

            const firstPageResponse = await request(app.getHttpServer())
                .get(`/reviews/game/${gameId}`)
                .set('Authorization', 'Bearer mock-jwt-token-user-1')
                .query({ page: 1, limit: 2 })
                .expect(200);

            expect(firstPageResponse.body).toEqual({
                reviews: expect.arrayContaining([
                    expect.objectContaining({ id: 'review-1' }),
                    expect.objectContaining({ id: 'review-2' }),
                ]),
                total: 3,
            });

            // Test second page
            (reviewRepository.findAndCount as jest.Mock).mockResolvedValue([
                mockReviews.slice(2, 3), // Last review
                mockReviews.length,
            ]);

            const secondPageResponse = await request(app.getHttpServer())
                .get(`/reviews/game/${gameId}`)
                .set('Authorization', 'Bearer mock-jwt-token-user-1')
                .query({ page: 2, limit: 2 })
                .expect(200);

            expect(secondPageResponse.body).toEqual({
                reviews: expect.arrayContaining([
                    expect.objectContaining({ id: 'review-3' }),
                ]),
                total: 3,
            });

            // Verify repository was called with correct parameters
            expect(reviewRepository.findAndCount).toHaveBeenCalledWith({
                where: { gameId },
                order: { createdAt: 'DESC' },
                skip: 2, // (page - 1) * limit
                take: 2, // limit
            });
        });
    });

    describe('Rating Caching and Performance', () => {
        it('should use cached ratings when available and cache new calculations', async () => {
            const gameId = testGames[0].id;
            const cachedRating = {
                gameId,
                averageRating: 4.2,
                totalReviews: 5,
                updatedAt: new Date(),
            };

            // Test cache hit
            (cacheManager.get as jest.Mock).mockResolvedValue(cachedRating);

            const cachedResponse = await request(app.getHttpServer())
                .get(`/ratings/game/${gameId}`)
                .expect(200);

            expect(cachedResponse.body).toEqual({
                ...cachedRating,
                updatedAt: cachedRating.updatedAt.toISOString(),
            });
            expect(cacheManager.get).toHaveBeenCalledWith(`/ratings/game/${gameId}`);
            expect(gameRatingRepository.findOne).not.toHaveBeenCalled();

            // Test cache miss
            jest.clearAllMocks();
            (cacheManager.get as jest.Mock).mockResolvedValue(null);

            const dbRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 6,
                updatedAt: new Date(),
            };
            (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(dbRating);
            (cacheManager.set as jest.Mock).mockResolvedValue(undefined);

            const dbResponse = await request(app.getHttpServer())
                .get(`/ratings/game/${gameId}`)
                .expect(200);

            expect(dbResponse.body).toEqual({
                ...dbRating,
                updatedAt: dbRating.updatedAt.toISOString(),
            });
            expect(gameRatingRepository.findOne).toHaveBeenCalledWith({
                where: { gameId },
            });
            expect(cacheManager.set).toHaveBeenCalledWith(
                `game_rating_${gameId}`,
                dbRating,
                300 // 5 minutes TTL
            );
        });
    });

    describe('Review Update and Deletion Flow', () => {
        it('should update review and recalculate rating', async () => {
            const reviewId = 'review-1';
            const userId = 'user-1';
            const gameId = 'game-1';

            const existingReview = {
                id: reviewId,
                userId,
                gameId,
                text: 'Original review text',
                rating: 3,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updateData = {
                text: 'Updated review text with more details',
                rating: 5,
            };

            // Mock finding existing review
            (reviewRepository.findOne as jest.Mock).mockResolvedValue(existingReview);

            // Mock saving updated review
            const updatedReview = { ...existingReview, ...updateData, updatedAt: new Date() };
            (reviewRepository.save as jest.Mock).mockResolvedValue(updatedReview);

            // Mock rating recalculation
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.5',
                    totalReviews: '3',
                }),
            };
            (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

            const updatedRating = {
                gameId,
                averageRating: 4.5,
                totalReviews: 3,
                updatedAt: new Date(),
            };
            (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(updatedRating);
            (gameRatingRepository.save as jest.Mock).mockResolvedValue(updatedRating);
            (cacheManager.del as jest.Mock).mockResolvedValue(true);

            const response = await request(app.getHttpServer())
                .put(`/reviews/${reviewId}`)
                .set('Authorization', `Bearer mock-jwt-token-${userId}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toMatchObject({
                id: reviewId,
                userId,
                gameId,
                text: updateData.text,
                rating: updateData.rating,
            });

            // Verify rating was recalculated and cache invalidated
            expect(cacheManager.del).toHaveBeenCalledWith(`game_rating_${gameId}`);
        });

        it('should delete review and recalculate rating', async () => {
            const reviewId = 'review-1';
            const userId = 'user-1';
            const gameId = 'game-1';

            const existingReview = {
                id: reviewId,
                userId,
                gameId,
                text: 'Review to be deleted',
                rating: 4,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Mock finding existing review
            (reviewRepository.findOne as jest.Mock).mockResolvedValue(existingReview);
            (reviewRepository.remove as jest.Mock).mockResolvedValue(existingReview);

            // Mock rating recalculation after deletion
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '4.0',
                    totalReviews: '2',
                }),
            };
            (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

            const updatedRating = {
                gameId,
                averageRating: 4.0,
                totalReviews: 2,
                updatedAt: new Date(),
            };
            (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(updatedRating);
            (gameRatingRepository.save as jest.Mock).mockResolvedValue(updatedRating);
            (cacheManager.del as jest.Mock).mockResolvedValue(true);

            await request(app.getHttpServer())
                .delete(`/reviews/${reviewId}`)
                .set('Authorization', `Bearer mock-jwt-token-${userId}`)
                .expect(204);

            expect(reviewRepository.remove).toHaveBeenCalledWith(existingReview);
            expect(cacheManager.del).toHaveBeenCalledWith(`game_rating_${gameId}`);
        });
    });

    describe('Error Scenarios and Edge Cases', () => {
        it('should handle concurrent review creation attempts', async () => {
            const userId = 'user-1';
            const gameId = 'game-1';
            const reviewData = testReviews[0];

            // Mock ownership verification
            jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(true);

            // First request succeeds
            (reviewRepository.findOne as jest.Mock)
                .mockResolvedValueOnce(null) // No existing review
                .mockResolvedValueOnce({ id: 'existing-review', userId, gameId }); // Review exists on second call

            const mockReview = {
                id: 'review-1',
                ...reviewData,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            (reviewRepository.create as jest.Mock).mockReturnValue(mockReview);
            (reviewRepository.save as jest.Mock).mockResolvedValue(mockReview);

            // Mock rating update
            const mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({
                    averageRating: '5.0',
                    totalReviews: '1',
                }),
            };
            (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

            const updatedRating = {
                gameId,
                averageRating: 5.0,
                totalReviews: 1,
                updatedAt: new Date(),
            };
            (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);
            (gameRatingRepository.create as jest.Mock).mockReturnValue(updatedRating);
            (gameRatingRepository.save as jest.Mock).mockResolvedValue(updatedRating);

            // First request should succeed
            await request(app.getHttpServer())
                .post('/reviews')
                .set('Authorization', `Bearer mock-jwt-token-${userId}`)
                .send({
                    gameId: reviewData.gameId,
                    text: reviewData.text,
                    rating: reviewData.rating,
                })
                .expect(201);

            // Second request should fail with conflict
            await request(app.getHttpServer())
                .post('/reviews')
                .set('Authorization', `Bearer mock-jwt-token-${userId}`)
                .send({
                    gameId: reviewData.gameId,
                    text: 'Another review attempt',
                    rating: 4,
                })
                .expect(409);
        });

        it('should handle game with no reviews', async () => {
            const gameId = 'game-without-reviews';

            (cacheManager.get as jest.Mock).mockResolvedValue(null);
            (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);

            const response = await request(app.getHttpServer())
                .get(`/ratings/game/${gameId}`)
                .expect(200);

            expect(response.body).toEqual({
                gameId,
                averageRating: 0,
                totalReviews: 0,
                message: 'No reviews yet',
            });
        });
    });
});