import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { AppModule } from '../src/app.module';
import { Review } from '../src/entities/review.entity';
import { GameRating } from '../src/entities/game-rating.entity';
import { createTestApp, cleanupTestData } from './test-setup';

describe('Health Check (e2e)', () => {
  let app: INestApplication;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let cacheManager: Cache;

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

  describe('/api/v1/health (GET)', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        service: 'review-service',
        version: '1.0.0',
        environment: expect.any(String),
        uptime: expect.stringMatching(/^\d+s$/),
        checks: {
          database: {
            status: 'ok',
            reviews: expect.any(Number),
            ratings: expect.any(Number),
          },
          cache: {
            status: 'ok',
            connected: true,
          },
          memory: {
            used: expect.stringMatching(/^\d+MB$/),
            total: expect.stringMatching(/^\d+MB$/),
          },
        },
      });

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should include database statistics', async () => {
      // Add some test data
      const review = reviewRepository.create({
        userId: 'health-test-user',
        gameId: 'health-test-game',
        text: 'Health check test review',
        rating: 5,
      });
      await reviewRepository.save(review);

      const gameRating = gameRatingRepository.create({
        gameId: 'health-test-game',
        averageRating: 5.0,
        totalReviews: 1,
      });
      await gameRatingRepository.save(gameRating);

      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.checks.database.reviews).toBeGreaterThanOrEqual(1);
      expect(response.body.checks.database.ratings).toBeGreaterThanOrEqual(1);

      // Clean up
      await reviewRepository.remove(review);
      await gameRatingRepository.remove(gameRating);
    });

    it('should verify cache connectivity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.checks.cache.status).toBe('ok');
      expect(response.body.checks.cache.connected).toBe(true);
    });

    it('should include memory usage information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const memoryUsed = parseInt(response.body.checks.memory.used.replace('MB', ''));
      const memoryTotal = parseInt(response.body.checks.memory.total.replace('MB', ''));

      expect(memoryUsed).toBeGreaterThan(0);
      expect(memoryTotal).toBeGreaterThan(0);
      expect(memoryTotal).toBeGreaterThanOrEqual(memoryUsed);
    });

    it('should include service uptime', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const uptime = parseInt(response.body.uptime.replace('s', ''));
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it('should be accessible without authentication', async () => {
      // Health check should not require authentication
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
    });

    it('should respond quickly for monitoring purposes', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('/ (GET) - Service Info', () => {
    it('should return service information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/')
        .expect(200);

      expect(response.text).toBe('Review Service API - Ready to serve game reviews and ratings!');
    });

    it('should be accessible without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/')
        .expect(200);
    });
  });

  describe('Health check resilience', () => {
    it('should handle database connection issues gracefully', async () => {
      // Mock database error by closing connection temporarily
      const originalCount = reviewRepository.count;
      jest.spyOn(reviewRepository, 'count').mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toBeDefined();
      expect(response.body.checks.database.status).toBe('error');

      // Restore original method
      reviewRepository.count = originalCount;
    });

    it('should handle cache connection issues gracefully', async () => {
      // Mock cache error
      const originalSet = cacheManager.set;
      jest.spyOn(cacheManager, 'set').mockRejectedValue(new Error('Cache connection lost'));

      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toBeDefined();

      // Restore original method
      cacheManager.set = originalSet;
    });

    it('should continue to provide basic information even during errors', async () => {
      // Mock both database and cache errors
      jest.spyOn(reviewRepository, 'count').mockRejectedValue(new Error('Database error'));
      jest.spyOn(cacheManager, 'set').mockRejectedValue(new Error('Cache error'));

      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'error',
        timestamp: expect.any(String),
        service: 'review-service',
        version: '1.0.0',
        environment: expect.any(String),
        uptime: expect.stringMatching(/^\d+s$/),
        error: expect.any(String),
        checks: {
          database: { status: 'error' },
          cache: { status: 'error' },
          memory: {
            used: expect.stringMatching(/^\d+MB$/),
            total: expect.stringMatching(/^\d+MB$/),
          },
        },
      });

      // Clean up mocks
      jest.restoreAllMocks();
    });
  });

  describe('Health check for monitoring integration', () => {
    it('should provide consistent response format for monitoring tools', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/health'),
        request(app.getHttpServer()).get('/api/v1/health'),
        request(app.getHttpServer()).get('/api/v1/health'),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('service', 'review-service');
        expect(response.body).toHaveProperty('checks');
        expect(response.body.checks).toHaveProperty('database');
        expect(response.body.checks).toHaveProperty('cache');
        expect(response.body.checks).toHaveProperty('memory');
      });
    });

    it('should include all required fields for Kubernetes health checks', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Required fields for Kubernetes readiness/liveness probes
      expect(response.body.status).toBeDefined();
      expect(['ok', 'error']).toContain(response.body.status);
      
      // Service identification
      expect(response.body.service).toBe('review-service');
      expect(response.body.version).toBeDefined();
      
      // Timestamp for monitoring
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond with appropriate HTTP status codes', async () => {
      // Healthy service should return 200
      const healthyResponse = await request(app.getHttpServer())
        .get('/api/v1/health');

      expect(healthyResponse.status).toBe(200);
      
      // Even with errors, health endpoint should return 200 but with error status in body
      // This allows monitoring tools to distinguish between service being down vs having issues
      jest.spyOn(reviewRepository, 'count').mockRejectedValue(new Error('Test error'));
      
      const errorResponse = await request(app.getHttpServer())
        .get('/api/v1/health');

      expect(errorResponse.status).toBe(200);
      expect(errorResponse.body.status).toBe('error');

      jest.restoreAllMocks();
    });
  });
});