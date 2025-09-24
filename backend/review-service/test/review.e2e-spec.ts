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
import { createTestApp, cleanupTestData, createMockJwtToken } from './test-setup';

describe('Review API (e2e)', () => {
  let app: INestApplication;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let cacheManager: Cache;

  const mockUserId = 'test-user-123';
  const mockGameId = 'test-game-456';
  const mockJwtToken = createMockJwtToken(mockUserId);

  beforeAll(async () => {
    app = await createTestApp({
      imports: [AppModule],
    });

    reviewRepository = app.get<Repository<Review>>(getRepositoryToken(Review));
    gameRatingRepository = app.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    cacheManager = app.get<Cache>(CACHE_MANAGER);
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
    
    // Clear cache
    if ('reset' in cacheManager) {
      await (cacheManager.reset as () => Promise<void>)();
    }
  });

  describe('/api/v1/reviews (POST)', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics and gameplay!',
      rating: 5,
    };

    it('should create a review successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: mockUserId,
        gameId: mockGameId,
        text: validReviewData.text,
        rating: validReviewData.rating,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify review was saved to database
      const savedReview = await reviewRepository.findOne({
        where: { id: response.body.id },
      });
      expect(savedReview).toBeTruthy();
      expect(savedReview?.text).toBe(validReviewData.text);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .send(validReviewData)
        .expect(401);
    });

    it('should validate review text length', async () => {
      // Text too short
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          text: 'Short',
        })
        .expect(400);

      // Text too long
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          text: 'a'.repeat(1001),
        })
        .expect(400);
    });

    it('should validate rating range', async () => {
      // Rating too low
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          rating: 0,
        })
        .expect(400);

      // Rating too high
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          rating: 6,
        })
        .expect(400);
    });

    it('should prevent duplicate reviews for same game', async () => {
      // Create first review
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Try to create duplicate review
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          text: 'Different text but same game',
        })
        .expect(409);
    });

    it('should handle missing required fields', async () => {
      // Missing gameId
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          text: validReviewData.text,
          rating: validReviewData.rating,
        })
        .expect(400);

      // Missing text
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          gameId: validReviewData.gameId,
          rating: validReviewData.rating,
        })
        .expect(400);

      // Missing rating
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          gameId: validReviewData.gameId,
          text: validReviewData.text,
        })
        .expect(400);
    });
  });

  describe('/api/v1/reviews/game/:gameId (GET)', () => {
    beforeEach(async () => {
      // Create test reviews
      const testReviews = [
        {
          userId: 'user-1',
          gameId: mockGameId,
          text: 'Excellent game with amazing graphics!',
          rating: 5,
        },
        {
          userId: 'user-2',
          gameId: mockGameId,
          text: 'Good game but could be better.',
          rating: 4,
        },
        {
          userId: 'user-3',
          gameId: mockGameId,
          text: 'Average game, nothing special.',
          rating: 3,
        },
      ];

      for (const reviewData of testReviews) {
        const review = reviewRepository.create(reviewData);
        await reviewRepository.save(review);
      }
    });

    it('should return paginated reviews for a game', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        reviews: expect.arrayContaining([
          expect.objectContaining({
            gameId: mockGameId,
            text: expect.any(String),
            rating: expect.any(Number),
          }),
        ]),
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      expect(response.body.reviews).toHaveLength(3);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}?page=1&limit=2`)
        .expect(200);

      expect(response.body).toMatchObject({
        reviews: expect.any(Array),
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      expect(response.body.reviews).toHaveLength(2);
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

    it('should validate pagination parameters', async () => {
      // Invalid page number
      await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}?page=0`)
        .expect(400);

      // Invalid limit
      await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}?limit=0`)
        .expect(400);

      // Limit too high
      await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}?limit=101`)
        .expect(400);
    });

    it('should order reviews by creation date (newest first)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/game/${mockGameId}`)
        .expect(200);

      const reviews = response.body.reviews;
      expect(reviews).toHaveLength(3);

      // Check that reviews are ordered by createdAt descending
      for (let i = 0; i < reviews.length - 1; i++) {
        const currentDate = new Date(reviews[i].createdAt);
        const nextDate = new Date(reviews[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });
  });

  describe('/api/v1/reviews/:id (PUT)', () => {
    let testReview: Review;

    beforeEach(async () => {
      // Create a test review
      testReview = reviewRepository.create({
        userId: mockUserId,
        gameId: mockGameId,
        text: 'Original review text',
        rating: 3,
      });
      testReview = await reviewRepository.save(testReview);
    });

    it('should update review successfully', async () => {
      const updateData = {
        text: 'Updated review text with more details',
        rating: 5,
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testReview.id,
        userId: mockUserId,
        gameId: mockGameId,
        text: updateData.text,
        rating: updateData.rating,
        updatedAt: expect.any(String),
      });

      // Verify update in database
      const updatedReview = await reviewRepository.findOne({
        where: { id: testReview.id },
      });
      expect(updatedReview?.text).toBe(updateData.text);
      expect(updatedReview?.rating).toBe(updateData.rating);
    });

    it('should allow partial updates', async () => {
      // Update only text
      const response1 = await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .send({ text: 'Only text updated' })
        .expect(200);

      expect(response1.body.text).toBe('Only text updated');
      expect(response1.body.rating).toBe(3); // Original rating

      // Update only rating
      const response2 = await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .send({ rating: 4 })
        .expect(200);

      expect(response2.body.text).toBe('Only text updated'); // Previous text
      expect(response2.body.rating).toBe(4);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .send({ text: 'Updated text' })
        .expect(401);
    });

    it('should prevent updating other users reviews', async () => {
      const otherUserToken = createMockJwtToken('other-user-456');

      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', otherUserToken)
        .send({ text: 'Trying to update someone elses review' })
        .expect(403);
    });

    it('should return 404 for non-existent review', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/reviews/non-existent-id')
        .set('Authorization', mockJwtToken)
        .send({ text: 'Updated text' })
        .expect(404);
    });

    it('should validate update data', async () => {
      // Invalid text length
      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .send({ text: 'Short' })
        .expect(400);

      // Invalid rating
      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .send({ rating: 6 })
        .expect(400);
    });
  });

  describe('/api/v1/reviews/:id (DELETE)', () => {
    let testReview: Review;

    beforeEach(async () => {
      // Create a test review
      testReview = reviewRepository.create({
        userId: mockUserId,
        gameId: mockGameId,
        text: 'Review to be deleted',
        rating: 4,
      });
      testReview = await reviewRepository.save(testReview);
    });

    it('should delete review successfully', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .expect(204);

      // Verify deletion in database
      const deletedReview = await reviewRepository.findOne({
        where: { id: testReview.id },
      });
      expect(deletedReview).toBeNull();
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReview.id}`)
        .expect(401);
    });

    it('should prevent deleting other users reviews', async () => {
      const otherUserToken = createMockJwtToken('other-user-456');

      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', otherUserToken)
        .expect(403);
    });

    it('should return 404 for non-existent review', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/reviews/non-existent-id')
        .set('Authorization', mockJwtToken)
        .expect(404);
    });

    it('should return 404 when trying to delete already deleted review', async () => {
      // Delete the review first
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .expect(204);

      // Try to delete again
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${testReview.id}`)
        .set('Authorization', mockJwtToken)
        .expect(404);
    });
  });

  describe('/api/v1/reviews/user/:userId (GET)', () => {
    beforeEach(async () => {
      // Create test reviews for different users
      const testReviews = [
        {
          userId: mockUserId,
          gameId: 'game-1',
          text: 'User review 1',
          rating: 5,
        },
        {
          userId: mockUserId,
          gameId: 'game-2',
          text: 'User review 2',
          rating: 4,
        },
        {
          userId: 'other-user',
          gameId: 'game-3',
          text: 'Other user review',
          rating: 3,
        },
      ];

      for (const reviewData of testReviews) {
        const review = reviewRepository.create(reviewData);
        await reviewRepository.save(review);
      }
    });

    it('should return user reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/user/${mockUserId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        reviews: expect.arrayContaining([
          expect.objectContaining({
            userId: mockUserId,
            gameId: expect.any(String),
            text: expect.any(String),
            rating: expect.any(Number),
          }),
        ]),
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      expect(response.body.reviews).toHaveLength(2);
      expect(response.body.reviews.every((review: any) => review.userId === mockUserId)).toBe(true);
    });

    it('should support pagination for user reviews', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/user/${mockUserId}?page=1&limit=1`)
        .expect(200);

      expect(response.body).toMatchObject({
        reviews: expect.any(Array),
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
      });

      expect(response.body.reviews).toHaveLength(1);
    });

    it('should return empty array for user with no reviews', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews/user/user-with-no-reviews')
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

  describe('Rating integration', () => {
    it('should update game rating when review is created', async () => {
      const reviewData = {
        gameId: mockGameId,
        text: 'Great game that deserves a high rating!',
        rating: 5,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(reviewData)
        .expect(201);

      // Check if game rating was created/updated
      const gameRating = await gameRatingRepository.findOne({
        where: { gameId: mockGameId },
      });

      expect(gameRating).toBeTruthy();
      expect(gameRating?.averageRating).toBe(5.0);
      expect(gameRating?.totalReviews).toBe(1);
    });

    it('should recalculate game rating when review is updated', async () => {
      // Create initial review
      const review = reviewRepository.create({
        userId: mockUserId,
        gameId: mockGameId,
        text: 'Initial review',
        rating: 3,
      });
      const savedReview = await reviewRepository.save(review);

      // Create initial game rating
      const gameRating = gameRatingRepository.create({
        gameId: mockGameId,
        averageRating: 3.0,
        totalReviews: 1,
      });
      await gameRatingRepository.save(gameRating);

      // Update review rating
      await request(app.getHttpServer())
        .put(`/api/v1/reviews/${savedReview.id}`)
        .set('Authorization', mockJwtToken)
        .send({ rating: 5 })
        .expect(200);

      // Check if game rating was recalculated
      const updatedGameRating = await gameRatingRepository.findOne({
        where: { gameId: mockGameId },
      });

      expect(updatedGameRating?.averageRating).toBe(5.0);
    });

    it('should recalculate game rating when review is deleted', async () => {
      // Create two reviews
      const review1 = reviewRepository.create({
        userId: mockUserId,
        gameId: mockGameId,
        text: 'First review',
        rating: 5,
      });
      const savedReview1 = await reviewRepository.save(review1);

      const review2 = reviewRepository.create({
        userId: 'other-user',
        gameId: mockGameId,
        text: 'Second review',
        rating: 3,
      });
      await reviewRepository.save(review2);

      // Create game rating for both reviews (average: 4.0)
      const gameRating = gameRatingRepository.create({
        gameId: mockGameId,
        averageRating: 4.0,
        totalReviews: 2,
      });
      await gameRatingRepository.save(gameRating);

      // Delete first review
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${savedReview1.id}`)
        .set('Authorization', mockJwtToken)
        .expect(204);

      // Check if game rating was recalculated (should be 3.0 now)
      const updatedGameRating = await gameRatingRepository.findOne({
        where: { gameId: mockGameId },
      });

      expect(updatedGameRating?.averageRating).toBe(3.0);
      expect(updatedGameRating?.totalReviews).toBe(1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON in request body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle very long game IDs', async () => {
      const longGameId = 'a'.repeat(1000);

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          gameId: longGameId,
          text: 'Review for game with very long ID',
          rating: 4,
        })
        .expect(201);

      expect(response.body.gameId).toBe(longGameId);
    });

    it('should handle special characters in review text', async () => {
      const specialText = 'Review with special chars: áéíóú ñ 中文 🎮 "quotes" & <tags>';

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          gameId: mockGameId,
          text: specialText,
          rating: 4,
        })
        .expect(201);

      expect(response.body.text).toBe(specialText);
    });

    it('should handle concurrent review creation attempts', async () => {
      const reviewData = {
        gameId: mockGameId,
        text: 'Concurrent review attempt',
        rating: 4,
      };

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', mockJwtToken)
          .send(reviewData)
      );

      const results = await Promise.allSettled(promises);

      // Only one should succeed (201), others should fail with conflict (409)
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 201
      );
      const conflicts = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 409
      );

      expect(successful).toHaveLength(1);
      expect(conflicts).toHaveLength(4);
    });
  });
});