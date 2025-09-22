import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { LibraryGame } from '../src/library/entities/library-game.entity';
import { PurchaseHistory } from '../src/history/entities/purchase-history.entity';

describe('Library Service E2E with Database', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let validToken: string;
  let testUserId: string;
  let testGameId: string;
  let testOrderId: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
  };

  const mockUserClient = {
    doesUserExist: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(GameCatalogClient)
      .useValue(mockGameCatalogClient)
      .overrideProvider(UserServiceClient)
      .useValue(mockUserClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    }));
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    // Generate test data
    testUserId = randomUUID();
    testGameId = randomUUID();
    testOrderId = randomUUID();

    validToken = jwtService.sign({
      sub: testUserId,
      username: 'testuser',
      roles: ['user']
    });

    // Setup mock responses
    mockUserClient.doesUserExist.mockResolvedValue(true);
    mockGameCatalogClient.doesGameExist.mockResolvedValue(true);
    mockGameCatalogClient.getGamesByIds.mockResolvedValue([
      {
        id: testGameId,
        title: 'Test Game',
        developer: 'Test Developer',
        publisher: 'Test Publisher',
        images: ['test-image.jpg'],
        tags: ['action', 'adventure'],
        releaseDate: new Date('2023-01-01'),
      }
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await dataSource.getRepository(LibraryGame).delete({ userId: testUserId });
    await dataSource.getRepository(PurchaseHistory).delete({ userId: testUserId });

    // Reset mocks
    mockGameCatalogClient.getGamesByIds.mockClear();
    mockGameCatalogClient.doesGameExist.mockClear();
    mockUserClient.doesUserExist.mockClear();
  });

  describe('Library Management Flow', () => {
    it('should complete full library management flow', async () => {
      // 1. Initially empty library
      const emptyLibraryResponse = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(emptyLibraryResponse.body.games).toHaveLength(0);
      expect(emptyLibraryResponse.body.pagination.total).toBe(0);

      // 2. Add game to library (simulating purchase)
      const addGameResponse = await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: testOrderId,
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      expect(addGameResponse.body.gameId).toBe(testGameId);
      expect(addGameResponse.body.userId).toBe(testUserId);

      // 3. Verify game appears in library
      const libraryWithGameResponse = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(libraryWithGameResponse.body.games).toHaveLength(1);
      expect(libraryWithGameResponse.body.games[0].gameId).toBe(testGameId);
      expect(libraryWithGameResponse.body.games[0].gameDetails.title).toBe('Test Game');

      // 4. Check ownership
      const ownershipResponse = await request(app.getHttpServer())
        .get(`/api/library/ownership/${testGameId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(ownershipResponse.body.owns).toBe(true);
      expect(ownershipResponse.body.purchasePrice).toBe(29.99);

      // 5. Search in library
      const searchResponse = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(searchResponse.body.games).toHaveLength(1);
      expect(searchResponse.body.games[0].gameId).toBe(testGameId);
    });

    it('should return empty results for a search with no matches', async () => {
      // Add a game first
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: testOrderId,
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Search for something that doesn't exist
      const searchResponse = await request(app.getHttpServer())
        .get('/api/library/my/search?query=NonExistentGame')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(searchResponse.body.games).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      // Add multiple games
      const gameIds = [];
      for (let i = 0; i < 5; i++) {
        const gameId = randomUUID();
        gameIds.push(gameId);

        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: gameId,
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 19.99 + i,
            currency: 'USD',
            purchaseDate: new Date().toISOString(),
          })
          .expect(201);
      }

      // Mock multiple games response
      mockGameCatalogClient.getGamesByIds.mockResolvedValue(
        gameIds.map((id, index) => ({
          id,
          title: `Test Game ${index + 1}`,
          developer: 'Test Developer',
          publisher: 'Test Publisher',
          images: [`test-image-${index + 1}.jpg`],
          tags: ['action'],
          releaseDate: new Date('2023-01-01'),
        }))
      );

      // Test pagination
      const page1Response = await request(app.getHttpServer())
        .get('/api/library/my?page=1&limit=3')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(page1Response.body.games).toHaveLength(3);
      expect(page1Response.body.pagination.total).toBe(5);
      expect(page1Response.body.pagination.totalPages).toBe(2);

      const page2Response = await request(app.getHttpServer())
        .get('/api/library/my?page=2&limit=3')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(page2Response.body.games).toHaveLength(2);
    });

    it('should prevent duplicate game additions', async () => {
      // Add game first time
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: testOrderId,
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
          gameId: testGameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(409); // Conflict
    });
  });

  describe('Purchase History Flow', () => {
    it('should track purchase history correctly', async () => {
      // Add game to library (creates purchase history)
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: testOrderId,
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Check purchase history
      const historyResponse = await request(app.getHttpServer())
        .get('/api/library/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(historyResponse.body.history).toHaveLength(1);
      expect(historyResponse.body.history[0].gameId).toBe(testGameId);
      expect(historyResponse.body.history[0].amount).toBe(29.99);
      expect(historyResponse.body.history[0].status).toBe('completed');

      // Search in history
      const searchHistoryResponse = await request(app.getHttpServer())
        .get('/api/library/history/search?query=Test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(searchHistoryResponse.body.history).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JWT tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle missing authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my')
        .expect(401);
    });

    it('should validate request data', async () => {
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: 'invalid-uuid',
          gameId: testGameId,
          // Missing required fields
        })
        .expect(400);
    });

    it('should handle non-existent game ownership check', async () => {
      const nonExistentGameId = randomUUID();

      const ownershipResponse = await request(app.getHttpServer())
        .get(`/api/library/ownership/${nonExistentGameId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(ownershipResponse.body.owns).toBe(false);
    });

    it('should return an error when adding a game for a non-existent user', async () => {
      mockUserClient.doesUserExist.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: testOrderId,
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(404); // Not Found

      // Reset mock for other tests
      mockUserClient.doesUserExist.mockResolvedValue(true);
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent a user from accessing another user\'s library', async () => {
      const otherUserId = randomUUID();
      const otherUserGameId = randomUUID();

      // Add a game for the main test user
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: testGameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 10.00,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Add a game for another user
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: otherUserId,
          gameId: otherUserGameId,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 20.00,
          currency: 'EUR',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Fetch the library for the main test user
      const response = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`) // Token belongs to testUserId
        .expect(200);

      // Assert that the main user sees only their own game
      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameId).toBe(testGameId);
      expect(response.body.games[0].userId).toBe(testUserId);
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('ok');
      expect(healthResponse.body.info).toBeDefined();
    });

    it('should return detailed health status', async () => {
      const detailedHealthResponse = await request(app.getHttpServer())
        .get('/api/health/detailed')
        .expect(200);

      expect(detailedHealthResponse.body.status).toBe('ok');
      expect(detailedHealthResponse.body.info.database).toBeDefined();
      expect(detailedHealthResponse.body.info.redis).toBeDefined();
    });
  });
});
