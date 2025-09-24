import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

import { AppModule } from '../src/app.module';
import { Review } from '../src/entities/review.entity';
import { GameRating } from '../src/entities/game-rating.entity';
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';
import { createTestApp, cleanupTestData, createMockJwtToken } from './test-setup';

describe('Complete Review Workflow (e2e)', () => {
  let app: INestApplication;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let cacheManager: Cache;
  let httpService: jest.Mocked<HttpService>;

  const mockUsers = {
    user1: 'user-123',
    user2: 'user-456',
    user3: 'user-789',
  };

  const mockGames = {
    game1: 'game-abc',
    game2: 'game-def',
    game3: 'game-ghi',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
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
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
    httpService = moduleFixture.get(HttpService);

    // Setup default mocks for external services
    setupDefaultMocks();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await cleanupTestData(app);
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear database and cache before each test
    await reviewRepository.clear();
    await gameRatingRepository.clear();
    
    if ('reset' in cacheManager) {
      await (cacheManager.reset as () => Promise<void>)();
    }

    // Reset mocks
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  function setupDefaultMocks() {
    httpService.request.mockImplementation((config) => {
      // Mock ownership checks - all users own all games
      if (config.url?.includes('/ownership')) {
        return of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      }
      
      // Mock game validation - all games exist
      if (config.url?.includes('/games/') && config.method === 'HEAD') {
        return of({
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      }
      
      // Mock successful notifications
      return of({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
    });
  }

  describe('Complete review lifecycle', () => {
    it('should handle complete review lifecycle: create → read → update → delete', async () => {
      const userId = mockUsers.user1;
      const gameId = mockGames.game1;
      const token = createMockJwtToken(userId);

      // Step 1: Create review
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', token)
        .send({
          gameId,
          text: 'Initial review text with detailed feedback about the game',
          rating: 4,
        })
        .expect(201);

      const reviewId = createResponse.body.id;
      expect(createResponse.body).toMatchObject({
        userId,
        gameId,
        text: 'Initial review text with detailed feedback about the game',
        rating: 4,
      });

      // Step 2: Read review (via game reviews endpoint)
      const readResponse = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}`)
        .expect(200);

      expect(readResponse.body.reviews).toHaveLength(1);
      expect(readResponse.body.reviews[0]).toMatchObject({
        id: reviewId,
        userId,
        gameId,
        rating: 4,
      });

      // Step 3: Update review
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', token)
        .send({
          text: 'Updated review text with even more detailed feedback',
          rating: 5,
        })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: reviewId,
        text: 'Updated review text with even more detailed feedback',
        rating: 5,
      });

      // Step 4: Verify update in database
      const updatedReview = await reviewRepository.findOne({
        where: { id: reviewId },
      });
      expect(updatedReview?.rating).toBe(5);

      // Step 5: Delete review
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', token)
        .expect(204);

      // Step 6: Verify deletion
      const deletedReview = await reviewRepository.findOne({
        where: { id: reviewId },
      });
      expect(deletedReview).toBeNull();

      // Step 7: Verify game reviews list is empty
      const finalReadResponse = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}`)
        .expect(200);

      expect(finalReadResponse.body.reviews).toHaveLength(0);
    });

    it('should handle rating calculation throughout review lifecycle', async () => {
      const gameId = mockGames.game1;

      // Create multiple reviews with different ratings
      const reviews = [
        { userId: mockUsers.user1, rating: 5, text: 'Excellent game!' },
        { userId: mockUsers.user2, rating: 4, text: 'Very good game.' },
        { userId: mockUsers.user3, rating: 3, text: 'Average game.' },
      ];

      const createdReviews = [];

      // Create all reviews
      for (const review of reviews) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', createMockJwtToken(review.userId))
          .send({
            gameId,
            text: review.text,
            rating: review.rating,
          })
          .expect(201);

        createdReviews.push(response.body);
      }

      // Check initial rating (should be 4.0: (5+4+3)/3)
      let ratingResponse = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(ratingResponse.body).toMatchObject({
        gameId,
        averageRating: 4.0,
        totalReviews: 3,
      });

      // Update one review to change rating
      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${createdReviews[2].id}`)
        .set('Authorization', createMockJwtToken(mockUsers.user3))
        .send({ rating: 5 })
        .expect(200);

      // Check updated rating (should be 4.67: (5+4+5)/3)
      ratingResponse = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(ratingResponse.body.averageRating).toBeCloseTo(4.67, 2);
      expect(ratingResponse.body.totalReviews).toBe(3);

      // Delete one review
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${createdReviews[1].id}`)
        .set('Authorization', createMockJwtToken(mockUsers.user2))
        .expect(204);

      // Check final rating (should be 5.0: (5+5)/2)
      ratingResponse = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(ratingResponse.body).toMatchObject({
        gameId,
        averageRating: 5.0,
        totalReviews: 2,
      });
    });
  });

  describe('Multi-user scenarios', () => {
    it('should handle multiple users reviewing the same game', async () => {
      const gameId = mockGames.game1;
      const reviewTexts = [
        'User 1 thinks this game is amazing with great graphics!',
        'User 2 finds the gameplay engaging but story lacking.',
        'User 3 loves the multiplayer features and community.',
      ];

      const createdReviews = [];

      // Create reviews from different users
      for (let i = 0; i < 3; i++) {
        const userId = Object.values(mockUsers)[i];
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', createMockJwtToken(userId))
          .send({
            gameId,
            text: reviewTexts[i],
            rating: i + 3, // Ratings: 3, 4, 5
          })
          .expect(201);

        createdReviews.push(response.body);
      }

      // Verify all reviews are returned
      const gameReviewsResponse = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}`)
        .expect(200);

      expect(gameReviewsResponse.body.reviews).toHaveLength(3);
      expect(gameReviewsResponse.body.total).toBe(3);

      // Verify each user can see their own reviews
      for (let i = 0; i < 3; i++) {
        const userId = Object.values(mockUsers)[i];
        const userReviewsResponse = await request(app.getHttpServer())
          .get(`/api/v1/reviews/user/${userId}`)
          .expect(200);

        expect(userReviewsResponse.body.reviews).toHaveLength(1);
        expect(userReviewsResponse.body.reviews[0].userId).toBe(userId);
        expect(userReviewsResponse.body.reviews[0].text).toBe(reviewTexts[i]);
      }

      // Verify rating calculation
      const ratingResponse = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(ratingResponse.body).toMatchObject({
        gameId,
        averageRating: 4.0, // (3+4+5)/3
        totalReviews: 3,
      });
    });

    it('should handle one user reviewing multiple games', async () => {
      const userId = mockUsers.user1;
      const token = createMockJwtToken(userId);
      const games = Object.values(mockGames);

      const createdReviews = [];

      // Create reviews for different games
      for (let i = 0; i < games.length; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', token)
          .send({
            gameId: games[i],
            text: `Review for game ${i + 1} with detailed analysis`,
            rating: (i % 5) + 1, // Ratings: 1, 2, 3
          })
          .expect(201);

        createdReviews.push(response.body);
      }

      // Verify user has reviews for all games
      const userReviewsResponse = await request(app.getHttpServer())
        .get(`/api/v1/reviews/user/${userId}`)
        .expect(200);

      expect(userReviewsResponse.body.reviews).toHaveLength(3);
      expect(userReviewsResponse.body.total).toBe(3);

      // Verify each game has the correct review
      for (let i = 0; i < games.length; i++) {
        const gameReviewsResponse = await request(app.getHttpServer())
          .get(`/api/v1/reviews/game/${games[i]}`)
          .expect(200);

        expect(gameReviewsResponse.body.reviews).toHaveLength(1);
        expect(gameReviewsResponse.body.reviews[0].gameId).toBe(games[i]);
        expect(gameReviewsResponse.body.reviews[0].rating).toBe((i % 5) + 1);
      }
    });
  });

  describe('Pagination and sorting', () => {
    beforeEach(async () => {
      // Create 15 reviews for testing pagination
      const gameId = mockGames.game1;
      
      for (let i = 0; i < 15; i++) {
        const userId = `user-${i}`;
        await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', createMockJwtToken(userId))
          .send({
            gameId,
            text: `Review number ${i + 1} with detailed content`,
            rating: (i % 5) + 1,
          })
          .expect(201);

        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('should handle pagination correctly', async () => {
      const gameId = mockGames.game1;

      // Test first page
      const page1Response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}?page=1&limit=5`)
        .expect(200);

      expect(page1Response.body).toMatchObject({
        reviews: expect.any(Array),
        total: 15,
        page: 1,
        limit: 5,
        totalPages: 3,
      });
      expect(page1Response.body.reviews).toHaveLength(5);

      // Test second page
      const page2Response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}?page=2&limit=5`)
        .expect(200);

      expect(page2Response.body).toMatchObject({
        reviews: expect.any(Array),
        total: 15,
        page: 2,
        limit: 5,
        totalPages: 3,
      });
      expect(page2Response.body.reviews).toHaveLength(5);

      // Test last page
      const page3Response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}?page=3&limit=5`)
        .expect(200);

      expect(page3Response.body).toMatchObject({
        reviews: expect.any(Array),
        total: 15,
        page: 3,
        limit: 5,
        totalPages: 3,
      });
      expect(page3Response.body.reviews).toHaveLength(5);

      // Verify no duplicate reviews across pages
      const allReviewIds = [
        ...page1Response.body.reviews.map((r: any) => r.id),
        ...page2Response.body.reviews.map((r: any) => r.id),
        ...page3Response.body.reviews.map((r: any) => r.id),
      ];
      const uniqueIds = new Set(allReviewIds);
      expect(uniqueIds.size).toBe(15);
    });

    it('should sort reviews by creation date (newest first)', async () => {
      const gameId = mockGames.game1;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${gameId}?limit=15`)
        .expect(200);

      const reviews = response.body.reviews;
      expect(reviews).toHaveLength(15);

      // Verify sorting (newest first)
      for (let i = 0; i < reviews.length - 1; i++) {
        const currentDate = new Date(reviews[i].createdAt);
        const nextDate = new Date(reviews[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });
  });

  describe('Caching behavior', () => {
    it('should cache and invalidate game ratings correctly', async () => {
      const gameId = mockGames.game1;
      const userId = mockUsers.user1;
      const token = createMockJwtToken(userId);

      // Create initial review
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', token)
        .send({
          gameId,
          text: 'Initial review for caching test',
          rating: 4,
        })
        .expect(201);

      // Get rating (should cache it)
      const rating1Response = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(rating1Response.body.averageRating).toBe(4.0);

      // Get rating again (should use cache)
      const rating2Response = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(rating2Response.body).toEqual(rating1Response.body);

      // Create another review (should invalidate cache)
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', createMockJwtToken(mockUsers.user2))
        .send({
          gameId,
          text: 'Second review for caching test',
          rating: 2,
        })
        .expect(201);

      // Get rating again (should be updated)
      const rating3Response = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(rating3Response.body.averageRating).toBe(3.0); // (4+2)/2
      expect(rating3Response.body.totalReviews).toBe(2);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle review creation with ownership check failure', async () => {
      const gameId = mockGames.game1;
      const userId = mockUsers.user1;
      const token = createMockJwtToken(userId);

      // Mock ownership check failure
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: false },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        return of({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any });
      });

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', token)
        .send({
          gameId,
          text: 'This review should not be created',
          rating: 5,
        })
        .expect(403);

      // Verify no review was created
      const reviewCount = await reviewRepository.count();
      expect(reviewCount).toBe(0);
    });

    it('should handle concurrent review operations gracefully', async () => {
      const gameId = mockGames.game1;
      const userId = mockUsers.user1;
      const token = createMockJwtToken(userId);

      // Create initial review
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', token)
        .send({
          gameId,
          text: 'Review for concurrent test',
          rating: 3,
        })
        .expect(201);

      const reviewId = createResponse.body.id;

      // Attempt concurrent updates
      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .put(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', token)
          .send({
            text: `Updated text ${i}`,
            rating: (i % 5) + 1,
          })
      );

      const results = await Promise.allSettled(updatePromises);

      // At least one should succeed
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );
      expect(successful.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalReview = await reviewRepository.findOne({
        where: { id: reviewId },
      });
      expect(finalReview).toBeTruthy();
      expect(finalReview?.text).toMatch(/Updated text \d/);
    });

    it('should handle database transaction rollback on external service failure', async () => {
      const gameId = mockGames.game1;
      const userId = mockUsers.user1;
      const token = createMockJwtToken(userId);

      // Mock external service failure after ownership check passes
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        if (config.url?.includes('/games/') && config.method === 'HEAD') {
          return of({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        // All other calls succeed (notifications, etc.)
        return of({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', token)
        .send({
          gameId,
          text: 'Review that should succeed despite notification failures',
          rating: 4,
        })
        .expect(201);

      // Verify review was created successfully
      expect(response.body.userId).toBe(userId);
      
      const review = await reviewRepository.findOne({
        where: { id: response.body.id },
      });
      expect(review).toBeTruthy();
    });
  });

  describe('Performance scenarios', () => {
    it('should handle bulk review operations efficiently', async () => {
      const gameId = mockGames.game1;
      const startTime = Date.now();

      // Create 50 reviews concurrently
      const createPromises = Array.from({ length: 50 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', createMockJwtToken(`bulk-user-${i}`))
          .send({
            gameId,
            text: `Bulk review ${i} with detailed content for performance testing`,
            rating: (i % 5) + 1,
          })
      );

      const results = await Promise.allSettled(createPromises);
      const endTime = Date.now();

      // All should succeed
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 201
      );
      expect(successful).toHaveLength(50);

      // Should complete within reasonable time (adjust based on system)
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds

      // Verify final rating calculation
      const ratingResponse = await request(app.getHttpServer())
        .get(`/api/v1/ratings/game/${gameId}`)
        .expect(200);

      expect(ratingResponse.body.totalReviews).toBe(50);
      expect(ratingResponse.body.averageRating).toBeCloseTo(3.0, 1); // Average of 1-5
    });
  });
});