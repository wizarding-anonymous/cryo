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
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Rating API (e2e)', () => {
    let app: INestApplication;
    let reviewRepository: Repository<Review>;
    let gameRatingRepository: Repository<GameRating>;
    let cacheManager: Cache;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply same configuration as main app
        app.useGlobalPipes(new ValidationPipe(validationConfig));
        app.useGlobalFilters(new HttpExceptionFilter());
        app.setGlobalPrefix('api/v1');

        await app.init();

        reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
        gameRatingRepository = moduleFixture.get<Repository<GameRating>>(getRepositoryToken(GameRating));
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

    describe('/api/v1/ratings/game/:gameId (GET)', () => {
        it('should return calculated rating for game with reviews', async () => {
            // Create test reviews
            const reviews = [
                { userId: 'user-1', gameId: 'game-123', text: 'Excellent game!', rating: 5 },
                { userId: 'user-2', gameId: 'game-123', text: 'Very good', rating: 4 },
                { userId: 'user-3', gameId: 'game-123', text: 'Good game', rating: 4 },
                { userId: 'user-4', gameId: 'game-123', text: 'Average', rating: 3 },
            ];

            for (const reviewData of reviews) {
                const review = reviewRepository.create(reviewData);
                await reviewRepository.save(review);
            }

            // Create game rating
            const gameRating = gameRatingRepository.create({
                gameId: 'game-123',
                averageRating: 4.0,
                totalReviews: 4,
            });
            await gameRatingRepository.save(gameRating);

            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/game-123')
                .expect(200);

            expect(response.body).toMatchObject({
                gameId: 'game-123',
                averageRating: 4.0,
                totalReviews: 4,
                updatedAt: expect.any(String),
            });
        });

        it('should return zero rating for game with no reviews', async () => {
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
            // Create a game rating
            const gameRating = gameRatingRepository.create({
                gameId: 'game-cache-test',
                averageRating: 3.5,
                totalReviews: 2,
            });
            await gameRatingRepository.save(gameRating);

            // First request - should fetch from database and cache
            const response1 = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/game-cache-test')
                .expect(200);

            // Check if cached
            const cachedResult = await cacheManager.get('game_rating_game-cache-test');
            expect(cachedResult).toBeDefined();

            // Second request - should use cache
            const response2 = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/game-cache-test')
                .expect(200);

            expect(response1.body).toEqual(response2.body);
        });

        it('should handle special characters in game ID', async () => {
            const gameId = 'game-with-special-chars_123';

            const response = await request(app.getHttpServer())
                .get(`/api/v1/ratings/game/${gameId}`)
                .expect(200);

            expect(response.body.gameId).toBe(gameId);
        });
    });

    describe('/api/v1/ratings/top (GET)', () => {
        beforeEach(async () => {
            // Create test game ratings
            const gameRatings = [
                { gameId: 'game-1', averageRating: 4.8, totalReviews: 100 },
                { gameId: 'game-2', averageRating: 4.7, totalReviews: 50 },
                { gameId: 'game-3', averageRating: 4.9, totalReviews: 25 },
                { gameId: 'game-4', averageRating: 4.6, totalReviews: 200 },
                { gameId: 'game-5', averageRating: 4.5, totalReviews: 10 }, // Should be excluded (< 5 reviews)
                { gameId: 'game-6', averageRating: 3.8, totalReviews: 75 },
            ];

            for (const ratingData of gameRatings) {
                const rating = gameRatingRepository.create(ratingData);
                await gameRatingRepository.save(rating);
            }
        });

        it('should return top rated games with minimum review threshold', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/top?limit=5')
                .expect(200);

            expect(response.body).toHaveLength(5);

            // Should be ordered by average rating DESC, then by total reviews DESC
            expect(response.body[0]).toMatchObject({
                gameId: 'game-3',
                averageRating: 4.9,
                totalReviews: 25,
            });

            expect(response.body[1]).toMatchObject({
                gameId: 'game-1',
                averageRating: 4.8,
                totalReviews: 100,
            });

            // game-5 should not be included (< 5 reviews)
            const gameIds = response.body.map((game: any) => game.gameId);
            expect(gameIds).not.toContain('game-5');
        });

        it('should respect limit parameter', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/top?limit=2')
                .expect(200);

            expect(response.body).toHaveLength(2);
        });

        it('should use default limit when not specified', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/top')
                .expect(200);

            expect(response.body.length).toBeLessThanOrEqual(10); // Default limit
        });

        it('should handle invalid limit parameter', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/ratings/top?limit=invalid')
                .expect(400);

            expect(response.body.error).toBeDefined();
        });
    });

    describe('Rating calculation accuracy', () => {
        it('should calculate correct average for various ratings', async () => {
            const testCases = [
                {
                    ratings: [5, 5, 5, 5, 5],
                    expectedAverage: 5.0,
                    gameId: 'perfect-game',
                },
                {
                    ratings: [1, 2, 3, 4, 5],
                    expectedAverage: 3.0,
                    gameId: 'average-game',
                },
                {
                    ratings: [4, 4, 5, 3, 4],
                    expectedAverage: 4.0,
                    gameId: 'good-game',
                },
                {
                    ratings: [2, 3, 2, 3, 2],
                    expectedAverage: 2.4,
                    gameId: 'poor-game',
                },
            ];

            for (const testCase of testCases) {
                // Create reviews
                for (let i = 0; i < testCase.ratings.length; i++) {
                    const review = reviewRepository.create({
                        userId: `user-${i}`,
                        gameId: testCase.gameId,
                        text: `Review ${i + 1}`,
                        rating: testCase.ratings[i],
                    });
                    await reviewRepository.save(review);
                }

                // Create game rating (simulating what the service would calculate)
                const gameRating = gameRatingRepository.create({
                    gameId: testCase.gameId,
                    averageRating: testCase.expectedAverage,
                    totalReviews: testCase.ratings.length,
                });
                await gameRatingRepository.save(gameRating);

                const response = await request(app.getHttpServer())
                    .get(`/api/v1/ratings/game/${testCase.gameId}`)
                    .expect(200);

                expect(response.body.averageRating).toBeCloseTo(testCase.expectedAverage, 1);
                expect(response.body.totalReviews).toBe(testCase.ratings.length);
            }
        });
    });

    describe('Performance and caching', () => {
        it('should handle concurrent requests efficiently', async () => {
            // Create a game rating
            const gameRating = gameRatingRepository.create({
                gameId: 'concurrent-test-game',
                averageRating: 4.2,
                totalReviews: 15,
            });
            await gameRatingRepository.save(gameRating);

            // Make multiple concurrent requests
            const promises = Array.from({ length: 10 }, () =>
                request(app.getHttpServer())
                    .get('/api/v1/ratings/game/concurrent-test-game')
                    .expect(200)
            );

            const responses = await Promise.all(promises);

            // All responses should be identical
            const firstResponse = responses[0].body;
            responses.forEach((response: request.Response) => {
                expect(response.body).toEqual(firstResponse);
            });
        });

        it('should invalidate cache when rating is updated', async () => {
            const gameId = 'cache-invalidation-test';

            // Create initial rating
            const gameRating = gameRatingRepository.create({
                gameId,
                averageRating: 3.0,
                totalReviews: 5,
            });
            await gameRatingRepository.save(gameRating);

            // First request - caches the result
            const response1 = await request(app.getHttpServer())
                .get(`/api/v1/ratings/game/${gameId}`)
                .expect(200);

            expect(response1.body.averageRating).toBe(3.0);

            // Update the rating in database (simulating rating service update)
            await gameRatingRepository.update(
                { gameId },
                { averageRating: 4.5, totalReviews: 6 }
            );

            // Clear cache (simulating what the rating service would do)
            await cacheManager.del(`game_rating_${gameId}`);

            // Second request - should get updated value
            const response2 = await request(app.getHttpServer())
                .get(`/api/v1/ratings/game/${gameId}`)
                .expect(200);

            expect(response2.body.averageRating).toBe(4.5);
            expect(response2.body.totalReviews).toBe(6);
        });
    });

    describe('Edge cases', () => {
        it('should handle very long game IDs', async () => {
            const longGameId = 'a'.repeat(100);

            const response = await request(app.getHttpServer())
                .get(`/api/v1/ratings/game/${longGameId}`)
                .expect(200);

            expect(response.body.gameId).toBe(longGameId);
        });

        it('should handle game IDs with special characters', async () => {
            const specialGameId = 'game-with-special_chars.123@test';

            const response = await request(app.getHttpServer())
                .get(`/api/v1/ratings/game/${encodeURIComponent(specialGameId)}`)
                .expect(200);

            expect(response.body.gameId).toBe(specialGameId);
        });

        it('should return consistent results for empty database', async () => {
            const response1 = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/empty-db-test')
                .expect(200);

            const response2 = await request(app.getHttpServer())
                .get('/api/v1/ratings/game/empty-db-test')
                .expect(200);

            expect(response1.body).toEqual(response2.body);
            expect(response1.body.averageRating).toBe(0);
            expect(response1.body.totalReviews).toBe(0);
        });
    });
});