import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { AppModule } from '../src/app.module';
import { Review } from '../src/entities/review.entity';
import { GameRating } from '../src/entities/game-rating.entity';
import { OwnershipService } from '../src/services/ownership.service';
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Review API (e2e)', () => {
    let app: INestApplication;
    let reviewRepository: Repository<Review>;
    let gameRatingRepository: Repository<GameRating>;
    let ownershipService: OwnershipService;
    let cacheManager: Cache;

    const mockUser = {
        id: 'user-123',
        username: 'testuser',
    };

    const mockReview = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        gameId: 'game-456',
        text: 'Great game! Really enjoyed playing it.',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(OwnershipService)
            .useValue({
                checkGameOwnership: jest.fn().mockResolvedValue(true),
                getUserOwnedGames: jest.fn().mockResolvedValue(['game-456', 'game-789']),
                invalidateOwnershipCache: jest.fn().mockResolvedValue(undefined),
            })
            .compile();

        app = moduleFixture.createNestApplication();

        // Apply same configuration as main app
        app.useGlobalPipes(new ValidationPipe(validationConfig));
        app.useGlobalFilters(new HttpExceptionFilter());
        app.setGlobalPrefix('api/v1');

        await app.init();

        reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
        gameRatingRepository = moduleFixture.get<Repository<GameRating>>(getRepositoryToken(GameRating));
        ownershipService = moduleFixture.get<OwnershipService>(OwnershipService);
        cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
    }, 30000);

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    beforeEach(async () => {
        // Clear database and cache before each test
        await reviewRepository.clear();
        await gameRatingRepository.clear();

        // Clear cache - use type assertion for test environment
        if ('reset' in cacheManager) {
            await (cacheManager.reset as () => Promise<void>)();
        }
    });

    describe('/api/v1/reviews (POST)', () => {
        it('should create a new review', async () => {
            const createReviewDto = {
                gameId: 'game-456',
                text: 'Amazing game with great graphics!',
                rating: 5,
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(createReviewDto)
                .expect(201);

            expect(response.body).toMatchObject({
                gameId: createReviewDto.gameId,
                text: createReviewDto.text,
                rating: createReviewDto.rating,
                userId: expect.any(String),
            });
            expect(response.body.id).toBeDefined();
            expect(response.body.createdAt).toBeDefined();
        });

        it('should return 400 for invalid rating', async () => {
            const createReviewDto = {
                gameId: 'game-456',
                text: 'Test review',
                rating: 6, // Invalid rating (should be 1-5)
            };

            await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(createReviewDto)
                .expect(400);
        });

        it('should return 400 for text too short', async () => {
            const createReviewDto = {
                gameId: 'game-456',
                text: 'Short', // Too short (minimum 10 characters)
                rating: 5,
            };

            await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(createReviewDto)
                .expect(400);
        });

        it('should return 403 when user does not own the game', async () => {
            jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(false);

            const createReviewDto = {
                gameId: 'game-456',
                text: 'Great game!',
                rating: 5,
            };

            await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(createReviewDto)
                .expect(403);
        });

        it('should return 409 when review already exists', async () => {
            // Create initial review
            const review = reviewRepository.create({
                ...mockReview,
                userId: 'user-123',
                gameId: 'game-456',
            });
            await reviewRepository.save(review);

            const createReviewDto = {
                gameId: 'game-456',
                text: 'Another review for the same game',
                rating: 4,
            };

            await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(createReviewDto)
                .expect(409);
        });
    });

    describe('/api/v1/reviews/game/:gameId (GET)', () => {
        beforeEach(async () => {
            // Create test reviews
            const reviews = [
                reviewRepository.create({
                    userId: 'user-1',
                    gameId: 'game-456',
                    text: 'First review',
                    rating: 5,
                }),
                reviewRepository.create({
                    userId: 'user-2',
                    gameId: 'game-456',
                    text: 'Second review',
                    rating: 4,
                }),
                reviewRepository.create({
                    userId: 'user-3',
                    gameId: 'game-789',
                    text: 'Different game review',
                    rating: 3,
                }),
            ];
            await reviewRepository.save(reviews);
        });

        it('should return paginated reviews for a game', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/reviews/game/game-456')
                .expect(200);

            expect(response.body).toMatchObject({
                reviews: expect.arrayContaining([
                    expect.objectContaining({
                        gameId: 'game-456',
                        text: expect.any(String),
                        rating: expect.any(Number),
                    }),
                ]),
                total: 2,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
        });

        it('should support pagination parameters', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/reviews/game/game-456?page=1&limit=1')
                .expect(200);

            expect(response.body.reviews).toHaveLength(1);
            expect(response.body.limit).toBe(1);
            expect(response.body.totalPages).toBe(2);
        });

        it('should return empty array for game with no reviews', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/reviews/game/nonexistent-game')
                .expect(200);

            expect(response.body).toMatchObject({
                reviews: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
            });
        });
    });

    describe('/api/v1/reviews/:id (PUT)', () => {
        let savedReview: Review;

        beforeEach(async () => {
            savedReview = await reviewRepository.save(
                reviewRepository.create({
                    userId: 'user-123',
                    gameId: 'game-456',
                    text: 'Original review text',
                    rating: 3,
                })
            );
        });

        it('should update a review', async () => {
            const updateReviewDto = {
                text: 'Updated review text with more details',
                rating: 5,
            };

            const response = await request(app.getHttpServer())
                .put(`/api/v1/reviews/${savedReview.id}`)
                .set('Authorization', 'Bearer valid-token')
                .send(updateReviewDto)
                .expect(200);

            expect(response.body).toMatchObject({
                id: savedReview.id,
                text: updateReviewDto.text,
                rating: updateReviewDto.rating,
            });
        });

        it('should return 404 for non-existent review', async () => {
            const updateReviewDto = {
                text: 'Updated text',
                rating: 4,
            };

            await request(app.getHttpServer())
                .put('/api/v1/reviews/non-existent-id')
                .set('Authorization', 'Bearer valid-token')
                .send(updateReviewDto)
                .expect(404);
        });

        it('should return 403 when user tries to update another user\'s review', async () => {
            const otherUserReview = await reviewRepository.save(
                reviewRepository.create({
                    userId: 'other-user',
                    gameId: 'game-456',
                    text: 'Other user review',
                    rating: 4,
                })
            );

            const updateReviewDto = {
                text: 'Trying to update other user review',
                rating: 1,
            };

            await request(app.getHttpServer())
                .put(`/api/v1/reviews/${otherUserReview.id}`)
                .set('Authorization', 'Bearer valid-token')
                .send(updateReviewDto)
                .expect(403);
        });
    });

    describe('/api/v1/reviews/:id (DELETE)', () => {
        let savedReview: Review;

        beforeEach(async () => {
            savedReview = await reviewRepository.save(
                reviewRepository.create({
                    userId: 'user-123',
                    gameId: 'game-456',
                    text: 'Review to be deleted',
                    rating: 3,
                })
            );
        });

        it('should delete a review', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/reviews/${savedReview.id}`)
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            const deletedReview = await reviewRepository.findOne({
                where: { id: savedReview.id },
            });
            expect(deletedReview).toBeNull();
        });

        it('should return 404 for non-existent review', async () => {
            await request(app.getHttpServer())
                .delete('/api/v1/reviews/non-existent-id')
                .set('Authorization', 'Bearer valid-token')
                .expect(404);
        });

        it('should return 403 when user tries to delete another user\'s review', async () => {
            const otherUserReview = await reviewRepository.save(
                reviewRepository.create({
                    userId: 'other-user',
                    gameId: 'game-456',
                    text: 'Other user review',
                    rating: 4,
                })
            );

            await request(app.getHttpServer())
                .delete(`/api/v1/reviews/${otherUserReview.id}`)
                .set('Authorization', 'Bearer valid-token')
                .expect(403);
        });
    });

    describe('/api/v1/ratings/game/:gameId (GET)', () => {
        beforeEach(async () => {
            // Create test reviews for rating calculation
            const reviews = [
                reviewRepository.create({
                    userId: 'user-1',
                    gameId: 'game-456',
                    text: 'Great game',
                    rating: 5,
                }),
                reviewRepository.create({
                    userId: 'user-2',
                    gameId: 'game-456',
                    text: 'Good game',
                    rating: 4,
                }),
                reviewRepository.create({
                    userId: 'user-3',
                    gameId: 'game-456',
                    text: 'Average game',
                    rating: 3,
                }),
            ];
            await reviewRepository.save(reviews);

            // Create corresponding game rating
            const gameRating = gameRatingRepository.create({
                gameId: 'game-456',
                averageRating: 4.0,
                totalReviews: 3,
            });
            await gameRatingRepository.save(gameRating);
        });

        it('should return game rating', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/game-456')
                .expect(200);

            expect(response.body).toMatchObject({
                gameId: 'game-456',
                averageRating: 4.0,
                totalReviews: 3,
            });
        });

        it('should return default rating for game with no reviews', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/nonexistent-game')
                .expect(200);

            expect(response.body).toMatchObject({
                gameId: 'nonexistent-game',
                averageRating: 0,
                totalReviews: 0,
            });
        });

        it('should cache rating results', async () => {
            // First request
            await request(app.getHttpServer())
                .get('/api/v1/ratings/game/game-456')
                .expect(200);

            // Check if result is cached
            const cachedResult = await cacheManager.get('game_rating_game-456');
            expect(cachedResult).toBeDefined();
        });
    });

    describe('Error handling', () => {
        it('should handle validation errors properly', async () => {
            const invalidReviewDto = {
                gameId: '', // Empty gameId
                text: '', // Empty text
                rating: 'invalid', // Invalid rating type
            };

            const response = await request(app.getHttpServer())
                .post('/api/v1/reviews')
                .set('Authorization', 'Bearer valid-token')
                .send(invalidReviewDto)
                .expect(400);

            expect(response.body).toMatchObject({
                error: expect.objectContaining({
                    code: expect.any(String),
                    message: expect.any(String),
                }),
            });
        });

        it('should handle unauthorized requests', async () => {
            const createReviewDto = {
                gameId: 'game-456',
                text: 'Great game!',
                rating: 5,
            };

            await request(app.getHttpServer())
                .post('/api/v1/reviews')
                // No Authorization header
                .send(createReviewDto)
                .expect(401);
        });
    });
});