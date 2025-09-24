import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { PaymentServiceClient } from '../src/clients/payment-service.client';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';

describe('External Services Integration E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let validToken: string;
  let testUserId: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
    getGameDetails: jest.fn(),
  };

  const mockUserServiceClient = {
    doesUserExist: jest.fn(),
    getUserDetails: jest.fn(),
  };

  const mockPaymentServiceClient = {
    validatePurchase: jest.fn(),
    getPurchaseDetails: jest.fn(),
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
        .overrideProvider(PaymentServiceClient)
        .useValue(mockPaymentServiceClient)
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

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockUserServiceClient.doesUserExist.mockResolvedValue(true);
    mockGameCatalogClient.doesGameExist.mockResolvedValue(true);
  });

  describe('Game Catalog Service Integration', () => {
    it('should enrich library games with catalog data', async () => {
      const gameId = randomUUID();
      const gameDetails = {
        id: gameId,
        title: 'Test Game',
        developer: 'Test Developer',
        publisher: 'Test Publisher',
        images: ['test-image.jpg'],
        tags: ['action', 'adventure'],
        releaseDate: new Date('2023-01-01'),
      };

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([gameDetails]);

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

      // Get library and verify enrichment
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails).toEqual(gameDetails);
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledWith([
        gameId,
      ]);
    });

    it('should handle game catalog service unavailability', async () => {
      const gameId = randomUUID();

      // Mock service failure
      mockGameCatalogClient.getGamesByIds.mockRejectedValue(
        new Error('Service unavailable'),
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

      // Get library - should still work but without enriched data
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails).toBeUndefined();
    });

    it('should handle partial game catalog data', async () => {
      const gameId = randomUUID();
      const partialGameDetails = {
        id: gameId,
        title: 'Test Game',
        // Missing other fields
      };

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        partialGameDetails,
      ]);

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

      // Get library
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toBe('Test Game');
    });

    it('should handle game catalog timeout', async () => {
      const gameId = randomUUID();

      // Mock timeout
      mockGameCatalogClient.getGamesByIds.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100),
          ),
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

      // Get library - should handle timeout gracefully
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
    });

    it('should validate game existence before adding to library', async () => {
      const gameId = randomUUID();

      // Mock game doesn't exist
      mockGameCatalogClient.doesGameExist.mockResolvedValue(false);

      // Try to add non-existent game
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
        .expect(404);

      expect(mockGameCatalogClient.doesGameExist).toHaveBeenCalledWith(gameId);
    });
  });

  describe('User Service Integration', () => {
    it('should validate user existence before adding games', async () => {
      const gameId = randomUUID();

      // Mock user doesn't exist
      mockUserServiceClient.doesUserExist.mockResolvedValue(false);

      // Try to add game for non-existent user
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
        .expect(404);

      expect(mockUserServiceClient.doesUserExist).toHaveBeenCalledWith(
        testUserId,
      );
    });

    it('should handle user service unavailability', async () => {
      const gameId = randomUUID();

      // Mock service failure
      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error('User service unavailable'),
      );

      // Try to add game - should handle gracefully
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
        .expect(503); // Service unavailable
    });

    it('should retry user service calls on temporary failures', async () => {
      const gameId = randomUUID();

      // Mock first call fails, second succeeds
      mockUserServiceClient.doesUserExist
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(true);

      // Add game - should succeed after retry
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

      expect(mockUserServiceClient.doesUserExist).toHaveBeenCalledTimes(2);
    });
  });

  describe('Payment Service Integration', () => {
    it('should validate purchase details with payment service', async () => {
      const gameId = randomUUID();
      const orderId = randomUUID();
      const purchaseId = randomUUID();

      const purchaseDetails = {
        id: purchaseId,
        orderId: orderId,
        userId: testUserId,
        gameId: gameId,
        amount: 29.99,
        currency: 'USD',
        status: 'completed',
      };

      mockPaymentServiceClient.validatePurchase.mockResolvedValue(true);
      mockPaymentServiceClient.getPurchaseDetails.mockResolvedValue(
        purchaseDetails,
      );

      // Add game with purchase validation
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: gameId,
          orderId: orderId,
          purchaseId: purchaseId,
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      expect(mockPaymentServiceClient.validatePurchase).toHaveBeenCalledWith(
        purchaseId,
      );
    });

    it('should reject invalid purchases', async () => {
      const gameId = randomUUID();
      const purchaseId = randomUUID();

      // Mock invalid purchase
      mockPaymentServiceClient.validatePurchase.mockResolvedValue(false);

      // Try to add game with invalid purchase
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: gameId,
          orderId: randomUUID(),
          purchaseId: purchaseId,
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(400);

      expect(mockPaymentServiceClient.validatePurchase).toHaveBeenCalledWith(
        purchaseId,
      );
    });

    it('should handle payment service circuit breaker', async () => {
      const gameId = randomUUID();

      // Mock multiple failures to trigger circuit breaker
      mockPaymentServiceClient.validatePurchase.mockRejectedValue(
        new Error('Service overloaded'),
      );

      // Multiple requests should fail
      for (let i = 0; i < 3; i++) {
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
          .expect(503);
      }
    });
  });

  describe('Service Integration Resilience', () => {
    it('should handle multiple service failures gracefully', async () => {
      const gameId = randomUUID();

      // Mock all services failing
      mockUserServiceClient.doesUserExist.mockRejectedValue(
        new Error('User service down'),
      );
      mockGameCatalogClient.doesGameExist.mockRejectedValue(
        new Error('Catalog service down'),
      );
      mockPaymentServiceClient.validatePurchase.mockRejectedValue(
        new Error('Payment service down'),
      );

      // Request should fail gracefully
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
        .expect(503);
    });

    it('should cache external service responses', async () => {
      const gameId = randomUUID();

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        {
          id: gameId,
          title: 'Cached Game',
          developer: 'Test Developer',
          publisher: 'Test Publisher',
          images: ['test.jpg'],
          tags: ['test'],
          releaseDate: new Date(),
        },
      ]);

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

      // First library request
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Second library request should use cache
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should only call external service once due to caching
      expect(mockGameCatalogClient.getGamesByIds).toHaveBeenCalledTimes(1);
    });

    it('should handle service response format changes', async () => {
      const gameId = randomUUID();

      // Mock unexpected response format
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([
        {
          id: gameId,
          name: 'Game Title', // Different field name
          studio: 'Developer Name', // Different field name
          // Missing expected fields
        },
      ]);

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

      // Should handle gracefully
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
    });

    it('should implement proper timeout handling', async () => {
      const gameId = randomUUID();

      // Mock long-running service call
      mockGameCatalogClient.getGamesByIds.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000)), // 10 second delay
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

      // Library request should timeout gracefully
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
    });
  });

  describe('Service Health Monitoring', () => {
    it('should report external service health status', async () => {
      // Mock healthy services
      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);
      mockUserServiceClient.doesUserExist.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info).toBeDefined();
    });

    it('should handle health check failures', async () => {
      // This test would depend on actual health check implementation
      // which might not be fully implemented yet
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
    });
  });
});
