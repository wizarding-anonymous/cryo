import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';
import { PerformanceMonitorService } from '../src/performance/performance-monitor.service';
import { CacheService } from '../src/cache/cache.service';

describe('Performance E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  // let performanceMonitor: PerformanceMonitorService;
  // let cacheService: CacheService;
  let validToken: string;
  let testUserId: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [TestAppModule],
      })
        .overrideProvider(GameCatalogClient)
        .useValue(mockGameCatalogClient)
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
      // performanceMonitor = app.get(PerformanceMonitorService);
      // cacheService = app.get(CacheService);
      testUserId = randomUUID();

      validToken = jwtService.sign({
        sub: testUserId,
        username: 'testuser',
        roles: ['user'],
      });

      // Setup mock responses
      mockGameCatalogClient.doesGameExist.mockResolvedValue(true);
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

    jest.clearAllMocks();
  });

  describe('Large Library Performance', () => {
    it('should handle library with 1000+ games efficiently', async () => {
      const gameCount = 1000;
      const gameIds: string[] = [];

      // Create mock game data
      const mockGames = Array.from({ length: gameCount }, (_, i) => {
        const gameId = randomUUID();
        gameIds.push(gameId);
        return {
          id: gameId,
          title: `Game ${i + 1}`,
          developer: `Developer ${(i % 10) + 1}`,
          publisher: `Publisher ${(i % 5) + 1}`,
          images: [`game${i + 1}.jpg`],
          tags: [`tag${(i % 20) + 1}`, `category${(i % 8) + 1}`],
          releaseDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
        };
      });

      mockGameCatalogClient.getGamesByIds.mockImplementation(
        (ids: string[]) => {
          return Promise.resolve(
            mockGames.filter((game) => ids.includes(game.id)),
          );
        },
      );

      // Add games to library in batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < gameCount; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);
        const promises = batch.map((gameId, index) =>
          request(app.getHttpServer())
            .post('/api/library/add')
            .send({
              userId: testUserId,
              gameId: gameId,
              orderId: randomUUID(),
              purchaseId: randomUUID(),
              purchasePrice: 10 + (index % 50),
              currency: 'USD',
              purchaseDate: new Date(Date.now() - index * 60000).toISOString(),
            }),
        );

        await Promise.all(promises);
      }

      // Test library retrieval performance
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get('/api/library/my?limit=50')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      console.log(
        `Library retrieval time for ${gameCount} games: ${responseTime}ms`,
      );

      expect(response.body.games).toHaveLength(50);
      expect(response.body.pagination.total).toBe(gameCount);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    }, 60000); // 60 second timeout for this test

    it('should handle pagination efficiently with large datasets', async () => {
      const gameCount = 500;
      const gameIds: string[] = [];

      // Add games to library
      for (let i = 0; i < gameCount; i++) {
        const gameId = randomUUID();
        gameIds.push(gameId);

        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: gameId,
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 20 + (i % 30),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      // Test different page sizes
      const pageSizes = [10, 25, 50, 100];

      for (const pageSize of pageSizes) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/api/library/my?page=1&limit=${pageSize}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Page size ${pageSize}: ${responseTime}ms`);

        expect(response.body.games).toHaveLength(pageSize);
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      }

      // Test deep pagination
      const deepPageStartTime = Date.now();
      const deepPageResponse = await request(app.getHttpServer())
        .get('/api/library/my?page=10&limit=25')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      const deepPageEndTime = Date.now();

      const deepPageResponseTime = deepPageEndTime - deepPageStartTime;
      console.log(`Deep pagination (page 10): ${deepPageResponseTime}ms`);

      expect(deepPageResponse.body.games).toHaveLength(25);
      expect(deepPageResponseTime).toBeLessThan(1500); // Deep pagination might be slightly slower
    }, 30000);
  });

  describe('Search Performance', () => {
    it('should handle search queries efficiently on large datasets', async () => {
      const gameCount = 200;
      const searchTerms = [
        'Action',
        'RPG',
        'Strategy',
        'Adventure',
        'Simulation',
      ];

      // Create games with searchable content
      for (let i = 0; i < gameCount; i++) {
        const gameId = randomUUID();
        const searchTerm = searchTerms[i % searchTerms.length];

        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: gameId,
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 15 + (i % 40),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      // Mock games with searchable content
      mockGameCatalogClient.getGamesByIds.mockImplementation(
        (ids: string[]) => {
          return Promise.resolve(
            ids.map((id, index) => ({
              id,
              title: `${searchTerms[index % searchTerms.length]} Game ${index}`,
              developer: `${searchTerms[index % searchTerms.length]} Studios`,
              publisher: 'Test Publisher',
              images: [`game${index}.jpg`],
              tags: [searchTerms[index % searchTerms.length], 'Gaming'],
              releaseDate: new Date(2020 + (index % 4), 0, 1),
            })),
          );
        },
      );

      // Test search performance for different terms
      for (const searchTerm of searchTerms) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/api/library/my/search?query=${searchTerm}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Search for "${searchTerm}": ${responseTime}ms`);

        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        // Note: Search results may be empty for test data, so we don't check length
      }
    }, 20000);

    it('should handle complex search queries efficiently', async () => {
      const gameCount = 100;

      // Add games
      for (let i = 0; i < gameCount; i++) {
        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 25 + (i % 35),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const complexQueries = [
        'Action Adventure',
        'The Elder Scrolls',
        'Call of Duty: Modern Warfare',
        'Grand Theft Auto V',
        'Counter-Strike: Global Offensive',
      ];

      for (const query of complexQueries) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get(`/api/library/my/search?query=${encodeURIComponent(query)}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Complex search "${query}": ${responseTime}ms`);
        expect(responseTime).toBeLessThan(800);
      }
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent library requests', async () => {
      // Add some games first
      const gameCount = 50;
      for (let i = 0; i < gameCount; i++) {
        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 30 + (i % 20),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .get('/api/library/my')
          .set('Authorization', `Bearer ${validToken}`),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentRequests;

      console.log(
        `${concurrentRequests} concurrent requests: ${totalTime}ms total, ${avgResponseTime}ms average`,
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.games).toHaveLength(gameCount);
      });

      expect(avgResponseTime).toBeLessThan(500); // Average should be under 500ms
    });

    it('should handle concurrent search requests', async () => {
      // Add games
      const gameCount = 30;
      for (let i = 0; i < gameCount; i++) {
        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 20 + (i % 25),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      const searchQueries = ['Game', 'Test', 'Action', 'RPG', 'Strategy'];
      const concurrentSearches = 15;

      const startTime = Date.now();

      const promises = Array.from({ length: concurrentSearches }, (_, i) =>
        request(app.getHttpServer())
          .get(
            `/api/library/my/search?query=${searchQueries[i % searchQueries.length]}`,
          )
          .set('Authorization', `Bearer ${validToken}`),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentSearches;

      console.log(
        `${concurrentSearches} concurrent searches: ${totalTime}ms total, ${avgResponseTime}ms average`,
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      expect(avgResponseTime).toBeLessThan(600);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app.getHttpServer())
          .get('/api/library/my')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(
        `Memory increase after 100 operations: ${memoryIncrease / 1024 / 1024}MB`,
      );

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle rapid successive requests without degradation', async () => {
      const requestCount = 50;
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get('/api/library/my')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(
        `Response times - Avg: ${avgResponseTime}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`,
      );

      // Response times should be consistent
      expect(maxResponseTime - minResponseTime).toBeLessThan(1000); // Variance should be less than 1 second
      expect(avgResponseTime).toBeLessThan(300); // Average should be under 300ms
    });
  });

  describe('Database Query Performance', () => {
    it('should use efficient queries for large result sets', async () => {
      const gameCount = 200;

      // Add games
      for (let i = 0; i < gameCount; i++) {
        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 15 + (i % 30),
            currency: 'USD',
            purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      // Test different sorting options
      const sortOptions = ['purchaseDate', 'title', 'developer'];

      for (const sortBy of sortOptions) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/api/library/my?sortBy=${sortBy}&sortOrder=desc&limit=50`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Sort by ${sortBy}: ${responseTime}ms`);

        expect(response.body.games).toHaveLength(50);
        expect(responseTime).toBeLessThan(800);
      }
    });

    it('should handle complex filtering efficiently', async () => {
      const gameCount = 150;

      // Add games with varied data
      for (let i = 0; i < gameCount; i++) {
        await request(app.getHttpServer())
          .post('/api/library/add')
          .send({
            userId: testUserId,
            gameId: randomUUID(),
            orderId: randomUUID(),
            purchaseId: randomUUID(),
            purchasePrice: 10 + (i % 50),
            currency: i % 3 === 0 ? 'EUR' : 'USD',
            purchaseDate: new Date(Date.now() - i * 3600000).toISOString(), // Different hours
          })
          .expect(201);
      }

      mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

      // Test pagination with different parameters
      const testCases = [
        { page: 1, limit: 20 },
        { page: 3, limit: 25 },
        { page: 5, limit: 15 },
        { page: 8, limit: 10 },
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/api/library/my?page=${testCase.page}&limit=${testCase.limit}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(
          `Page ${testCase.page}, Limit ${testCase.limit}: ${responseTime}ms`,
        );

        expect(response.body.games).toHaveLength(testCase.limit);
        expect(responseTime).toBeLessThan(600);
      }
    });
  });
});
