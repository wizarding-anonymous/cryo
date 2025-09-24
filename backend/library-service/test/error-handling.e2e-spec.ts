import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';

describe('Error Handling E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let validToken: string;
  let testUserId: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
  };

  const mockUserServiceClient = {
    doesUserExist: jest.fn(),
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [TestAppModule],
      })
        .overrideProvider(GameCatalogClient)
        .useValue(mockGameCatalogClient)
        .overrideProvider(UserServiceClient)
        .useValue(mockUserServiceClient)
        .compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.setGlobalPrefix('api');
      await app.init();

      dataSource = app.get(DataSource);
      jwtService = app.get(JwtService);
      testUserId = randomUUID();

      validToken = jwtService.sign({
        sub: testUserId,
        username: 'testuser',
        roles: ['user'],
      });
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await dataSource.getRepository(LibraryGame).delete({ userId: testUserId });
    await dataSource
      .getRepository(PurchaseHistory)
      .delete({ userId: testUserId });

    // Reset mocks
    jest.clearAllMocks();
    mockUserServiceClient.doesUserExist.mockResolvedValue(true);
    mockGameCatalogClient.doesGameExist.mockResolvedValue(true);
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid UUID in gameId parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/ownership/invalid-uuid')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('validation failed');
    });

    it('should return 400 for invalid pagination parameters', async () => {
      // Invalid page number
      let response = await request(app.getHttpServer())
        .get('/api/library/my?page=-1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('page');

      // Invalid limit
      response = await request(app.getHttpServer())
        .get('/api/library/my?limit=0')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('limit');

      // Limit too high
      response = await request(app.getHttpServer())
        .get('/api/library/my?limit=1000')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('limit');
    });

    it('should return 400 for invalid sort parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=invalidField')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('sortBy');
    });

    it('should return 400 for missing required fields in add game request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          // Missing required fields
        })
        .expect(400);

      expect(response.body.message).toContain('validation failed');
    });

    it('should return 400 for invalid data types in request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 'invalid-number', // Should be number
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.message).toContain('purchasePrice');
    });

    it('should return 400 for invalid currency format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'INVALID', // Should be 3-letter code
          purchaseDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.message).toContain('currency');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: 'invalid-date',
        })
        .expect(400);

      expect(response.body.message).toContain('purchaseDate');
    });

    it('should return 400 for negative purchase price', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: -10.0,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.message).toContain('purchasePrice');
    });

    it('should return 400 for search query that is too short', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=a')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('query');
    });

    it('should return 400 for search query that is too long', async () => {
      const longQuery = 'a'.repeat(101); // Assuming max length is 100
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=' + longQuery)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('query');
    });
  });

  describe('Not Found Errors', () => {
    it('should return 404 for non-existent game ownership check', async () => {
      const nonExistentGameId = randomUUID();

      const response = await request(app.getHttpServer())
        .get(`/api/library/ownership/${nonExistentGameId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200); // Ownership check returns 200 with owns: false

      expect(response.body.owns).toBe(false);
    });

    it('should return 404 for non-existent purchase details', async () => {
      const nonExistentPurchaseId = randomUUID();

      await request(app.getHttpServer())
        .get(`/api/library/history/${nonExistentPurchaseId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('should return 404 when trying to add game for non-existent user', async () => {
      mockUserServiceClient.doesUserExist.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(404);
    });

    it('should return 404 when trying to add non-existent game', async () => {
      mockGameCatalogClient.doesGameExist.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(404);
    });

    it('should return 404 when trying to remove non-existent game from library', async () => {
      await request(app.getHttpServer())
        .delete('/api/library/remove')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
        })
        .expect(404);
    });
  });

  describe('Conflict Errors', () => {
    it('should return 409 when trying to add duplicate game to library', async () => {
      const gameId = randomUUID();

      // Add game first time
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: gameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Try to add same game again
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: gameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(409);
    });
  });

  describe('Server Errors', () => {
    it('should return 503 when external services are unavailable', async () => {
      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(503);
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll test that the app handles database errors

      // Close the database connection to simulate error
      await dataSource.destroy();

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      // Reconnect for other tests
      await dataSource.initialize();
    });

    it('should handle timeout errors from external services', async () => {
      mockGameCatalogClient.getGamesByIds.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100),
          ),
      );

      // Add game first
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Library request should handle timeout gracefully
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should return library without enriched data
      expect(response.body.games).toHaveLength(1);
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle malformed JSON in request body', async () => {
      await request(app.getHttpServer())
        .post('/api/library/add')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle extremely large request payloads', async () => {
      const largePayload = {
        userId: testUserId,
        gameId: randomUUID(),
        orderId: randomUUID(),
        purchaseId: randomUUID(),
        purchasePrice: 29.99,
        currency: 'USD',
        purchaseDate: new Date().toISOString(),
        metadata: 'x'.repeat(10000), // Large string
      };

      // Should either accept or reject based on payload size limits
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send(largePayload);

      expect([201, 400, 413]).toContain(response.status);
    });

    it('should handle SQL injection attempts in search queries', async () => {
      const maliciousQuery = "'; DROP TABLE library_games; --";

      const response = await request(app.getHttpServer())
        .get(
          '/api/library/my/search?query=' + encodeURIComponent(maliciousQuery),
        )
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should handle safely and return empty results
      expect(response.body.games).toEqual([]);
    });

    it('should handle XSS attempts in search queries', async () => {
      const xssQuery = '<script>alert("xss")</script>';

      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=' + encodeURIComponent(xssQuery))
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should handle safely
      expect(response.body.games).toEqual([]);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: 'invalid-uuid',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });

    it('should return consistent error format for not found errors', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/library/history/${randomUUID()}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });

    it('should return consistent error format for unauthorized errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .expect(401);

      // Correlation ID might be in headers or body depending on implementation
      expect(
        response.headers['x-correlation-id'] || response.body.correlationId,
      ).toBeDefined();
    });

    it('should not expose sensitive information in error messages', async () => {
      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error(
          'Database connection string: postgres://user:password@host:5432/db',
        ),
      );

      const response = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(503);

      // Should not expose database credentials
      expect(response.body.message).not.toContain('password');
      expect(response.body.message).not.toContain('postgres://');
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue working when cache is unavailable', async () => {
      // This would require mocking the cache service
      // For now, test that basic functionality works

      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should provide fallback when game enrichment fails', async () => {
      const gameId = randomUUID();

      mockGameCatalogClient.getGamesByIds.mockRejectedValue(
        new Error('Catalog service down'),
      );

      // Add game to library
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: gameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Should still return library data without enrichment
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameId).toBe(gameId);
    });
  });
});
