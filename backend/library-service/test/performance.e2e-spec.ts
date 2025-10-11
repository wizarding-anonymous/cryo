import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { E2ETestBase } from './e2e-test-base';

describe('Performance E2E - Load and Stress Testing', () => {
  let testBase: E2ETestBase;

  beforeAll(async () => {
    testBase = new (class extends E2ETestBase {})();
    await testBase.setupTestApp();
  }, 120000);

  afterAll(async () => {
    await testBase.teardownTestApp();
  });

  beforeEach(async () => {
    await testBase.cleanupTestData();
  });

  describe('Large Library Performance', () => {
    it('should handle library with 1000+ games efficiently', async () => {
      const gameCount = 1000;
      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();

      // Create large dataset of test games
      const testGames = Array.from({ length: gameCount }, (_, i) => ({
        id: randomUUID(),
        title: `Performance Test Game ${i + 1}`,
        developer: `Developer ${(i % 10) + 1}`,
        publisher: `Publisher ${(i % 5) + 1}`,
        images: [`game${i + 1}.jpg`],
        tags: [`tag${(i % 20) + 1}`, `category${(i % 8) + 1}`],
        releaseDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
      }));

      // Add all test games to mock database
      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Configure mock to handle batch requests efficiently
      mockGameCatalog.getGamesByIds.mockImplementation((ids: string[]) => {
        return Promise.resolve(
          testGames.filter(game => ids.includes(game.id))
        );
      });

      // Add games to library in batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < gameCount; i += batchSize) {
        const batch = testGames.slice(i, i + batchSize);
        const promises = batch.map((game, index) =>
          testBase.addGameToLibrary({
            gameId: game.id,
            purchasePrice: 10 + (index % 50),
            purchaseDate: new Date(Date.now() - index * 60000).toISOString(),
          })
        );

        await Promise.all(promises);
      }

      // Test library retrieval performance
      const startTime = Date.now();
      const response = await request(testBase.app.getHttpServer())
        .get('/api/library/my?limit=50')
        .set(testBase.getAuthHeaders())
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      console.log(
        `Library retrieval time for ${gameCount} games: ${responseTime}ms`,
      );

      expect(response.body.games).toHaveLength(50);
      expect(response.body.pagination.total).toBe(gameCount);
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds for large dataset
    }, 120000); // 2 minute timeout for this test

    it('should handle pagination efficiently with large datasets', async () => {
      const gameCount = 500;
      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();

      // Create test games for pagination testing
      const testGames = Array.from({ length: gameCount }, (_, i) => ({
        id: randomUUID(),
        title: `Pagination Test Game ${i + 1}`,
        developer: `Developer ${(i % 15) + 1}`,
        publisher: `Publisher ${(i % 8) + 1}`,
        images: [`pagination_game${i + 1}.jpg`],
        tags: [`pagination`, `test`, `game${i % 10}`],
        releaseDate: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
      }));

      // Add games to mock database
      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Add games to library efficiently
      const batchSize = 50;
      for (let i = 0; i < gameCount; i += batchSize) {
        const batch = testGames.slice(i, i + batchSize);
        const promises = batch.map((game, index) =>
          testBase.addGameToLibrary({
            gameId: game.id,
            purchasePrice: 20 + (index % 30),
            purchaseDate: new Date(Date.now() - (i + index) * 60000).toISOString(),
          })
        );
        await Promise.all(promises);
      }

      // Configure mock to return empty details for performance testing
      mockGameCatalog.getGamesByIds.mockResolvedValue([]);

      // Test different page sizes
      const pageSizes = [10, 25, 50, 100];

      for (const pageSize of pageSizes) {
        const startTime = Date.now();

        const response = await request(testBase.app.getHttpServer())
          .get(`/api/library/my?page=1&limit=${pageSize}`)
          .set(testBase.getAuthHeaders())
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Page size ${pageSize}: ${responseTime}ms`);

        expect(response.body.games).toHaveLength(pageSize);
        expect(responseTime).toBeLessThan(1500); // Should respond within 1.5 seconds
      }

      // Test deep pagination
      const deepPageStartTime = Date.now();
      const deepPageResponse = await request(testBase.app.getHttpServer())
        .get('/api/library/my?page=10&limit=25')
        .set(testBase.getAuthHeaders())
        .expect(200);
      const deepPageEndTime = Date.now();

      const deepPageResponseTime = deepPageEndTime - deepPageStartTime;
      console.log(`Deep pagination (page 10): ${deepPageResponseTime}ms`);

      expect(deepPageResponse.body.games).toHaveLength(25);
      expect(deepPageResponseTime).toBeLessThan(2000); // Deep pagination might be slightly slower
    }, 60000);
  });

  describe('Search Performance', () => {
    it('should handle search queries efficiently on large datasets', async () => {
      const gameCount = 200;
      const searchTerms = ['Action', 'RPG', 'Strategy', 'Adventure', 'Simulation'];
      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();

      // Create games with searchable content
      const testGames = Array.from({ length: gameCount }, (_, i) => {
        const searchTerm = searchTerms[i % searchTerms.length];
        return {
          id: randomUUID(),
          title: `${searchTerm} Game ${i}`,
          developer: `${searchTerm} Studios`,
          publisher: 'Test Publisher',
          images: [`game${i}.jpg`],
          tags: [searchTerm, 'Gaming'],
          releaseDate: new Date(2020 + (i % 4), 0, 1),
        };
      });

      // Add games to mock database
      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Add games to library
      for (let i = 0; i < gameCount; i++) {
        await testBase.addGameToLibrary({
          gameId: testGames[i].id,
          purchasePrice: 15 + (i % 40),
          purchaseDate: new Date(Date.now() - i * 60000).toISOString(),
        });
      }

      // Configure mock to return searchable games
      mockGameCatalog.getGamesByIds.mockImplementation((ids: string[]) => {
        return Promise.resolve(
          testGames.filter(game => ids.includes(game.id))
        );
      });

      // Test search performance for different terms
      for (const searchTerm of searchTerms) {
        const startTime = Date.now();

        const response = await request(testBase.app.getHttpServer())
          .get(`/api/library/my/search?query=${searchTerm}`)
          .set(testBase.getAuthHeaders())
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Search for "${searchTerm}": ${responseTime}ms`);

        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        expect(response.body.games.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should handle complex search queries efficiently', async () => {
      const gameCount = 100;
      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();

      // Add games with complex titles
      const testGames = Array.from({ length: gameCount }, (_, i) => ({
        id: randomUUID(),
        title: `Complex Game Title ${i}: The Adventure`,
        developer: 'Complex Studios',
        publisher: 'Complex Publisher',
        images: [`complex_game${i}.jpg`],
        tags: ['Complex', 'Adventure', 'Action'],
        releaseDate: new Date(2020 + (i % 4), 0, 1),
      }));

      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Add games to library
      for (const game of testGames) {
        await testBase.addGameToLibrary({
          gameId: game.id,
          purchasePrice: 25 + (Math.random() * 35),
        });
      }

      mockGameCatalog.getGamesByIds.mockImplementation((ids: string[]) => {
        return Promise.resolve(
          testGames.filter(game => ids.includes(game.id))
        );
      });

      const complexQueries = [
        'Action Adventure',
        'The Elder Scrolls',
        'Call of Duty: Modern Warfare',
        'Grand Theft Auto V',
        'Counter-Strike: Global Offensive',
      ];

      for (const query of complexQueries) {
        const startTime = Date.now();

        await request(testBase.app.getHttpServer())
          .get(`/api/library/my/search?query=${encodeURIComponent(query)}`)
          .set(testBase.getAuthHeaders())
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Complex search "${query}": ${responseTime}ms`);
        expect(responseTime).toBeLessThan(800);
      }
    }, 20000);
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent library requests', async () => {
      // Add some games first
      const gameCount = 50;
      const testGames = testBase.mockManager.getAllTestGames().slice(0, gameCount);

      for (const game of testGames) {
        await testBase.addGameToLibrary({
          gameId: game.id,
          purchasePrice: 30 + (Math.random() * 20),
        });
      }

      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();
      mockGameCatalog.getGamesByIds.mockResolvedValue([]);

      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(testBase.app.getHttpServer())
          .get('/api/library/my')
          .set(testBase.getAuthHeaders()),
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
    }, 30000);

    it('should handle concurrent search requests', async () => {
      // Add games
      const gameCount = 30;
      const testGames = testBase.mockManager.getAllTestGames().slice(0, gameCount);

      for (const game of testGames) {
        await testBase.addGameToLibrary({
          gameId: game.id,
          purchasePrice: 20 + (Math.random() * 25),
        });
      }

      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();
      mockGameCatalog.getGamesByIds.mockResolvedValue([]);

      const searchQueries = ['Game', 'Test', 'Action', 'RPG', 'Strategy'];
      const concurrentSearches = 15;

      const startTime = Date.now();

      const promises = Array.from({ length: concurrentSearches }, (_, i) =>
        request(testBase.app.getHttpServer())
          .get(
            `/api/library/my/search?query=${searchQueries[i % searchQueries.length]}`,
          )
          .set(testBase.getAuthHeaders()),
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
    }, 20000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(testBase.app.getHttpServer())
          .get('/api/library/my')
          .set(testBase.getAuthHeaders())
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
    }, 30000);

    it('should handle rapid successive requests without degradation', async () => {
      const requestCount = 50;
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();

        await request(testBase.app.getHttpServer())
          .get('/api/library/my')
          .set(testBase.getAuthHeaders())
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
    }, 20000);
  });

  describe('Database Query Performance', () => {
    it('should use efficient queries for large result sets', async () => {
      const gameCount = 200;
      const testGames = Array.from({ length: gameCount }, (_, i) => ({
        id: randomUUID(),
        title: `DB Performance Game ${i}`,
        developer: `Developer ${i % 10}`,
        publisher: `Publisher ${i % 5}`,
        images: [`db_game${i}.jpg`],
        tags: ['Performance', 'Database'],
        releaseDate: new Date(2020 + (i % 4), 0, 1),
      }));

      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Add games to library
      for (const game of testGames) {
        await testBase.addGameToLibrary({
          gameId: game.id,
          purchasePrice: 15 + (Math.random() * 30),
        });
      }

      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();
      mockGameCatalog.getGamesByIds.mockResolvedValue([]);

      // Test different sorting options
      const sortOptions = ['purchaseDate', 'title', 'developer'];

      for (const sortBy of sortOptions) {
        const startTime = Date.now();

        const response = await request(testBase.app.getHttpServer())
          .get(`/api/library/my?sortBy=${sortBy}&sortOrder=desc&limit=50`)
          .set(testBase.getAuthHeaders())
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Sort by ${sortBy}: ${responseTime}ms`);

        expect(response.body.games).toHaveLength(50);
        expect(responseTime).toBeLessThan(800);
      }
    }, 30000);

    it('should handle complex filtering efficiently', async () => {
      const gameCount = 150;
      const testGames = Array.from({ length: gameCount }, (_, i) => ({
        id: randomUUID(),
        title: `Filter Test Game ${i}`,
        developer: `Developer ${i % 8}`,
        publisher: `Publisher ${i % 4}`,
        images: [`filter_game${i}.jpg`],
        tags: ['Filter', 'Test'],
        releaseDate: new Date(2020 + (i % 4), 0, 1),
      }));

      testGames.forEach(game => testBase.mockManager.addTestGame(game));

      // Add games with varied data
      for (let i = 0; i < gameCount; i++) {
        await testBase.addGameToLibrary({
          gameId: testGames[i].id,
          purchasePrice: 10 + (i % 50),
          currency: i % 3 === 0 ? 'EUR' : 'USD',
          purchaseDate: new Date(Date.now() - i * 3600000).toISOString(), // Different hours
        });
      }

      const mockGameCatalog = testBase.mockManager.getGameCatalogMock();
      mockGameCatalog.getGamesByIds.mockResolvedValue([]);

      // Test pagination with different parameters
      const testCases = [
        { page: 1, limit: 20 },
        { page: 3, limit: 25 },
        { page: 5, limit: 15 },
        { page: 8, limit: 10 },
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();

        const response = await request(testBase.app.getHttpServer())
          .get(`/api/library/my?page=${testCase.page}&limit=${testCase.limit}`)
          .set(testBase.getAuthHeaders())
          .expect(200);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(
          `Page ${testCase.page}, Limit ${testCase.limit}: ${responseTime}ms`,
        );

        expect(response.body.games).toHaveLength(testCase.limit);
        expect(responseTime).toBeLessThan(600);
      }
    }, 30000);
  });

  describe('Stress Testing', () => {
    it('should handle extreme load conditions', async () => {
      // Add a moderate number of games for stress testing
      const gameCount = 100;
      const testGames = testBase.mockManager.getAllTestGames().slice(0, gameCount);

      for (const game of testGames) {
        await testBase.addGameToLibrary({
          gameId: game.id,
          purchasePrice: Math.random() * 100,
        });
      }

      // Simulate extreme concurrent load
      const extremeLoad = 50;
      const promises = [];

      for (let i = 0; i < extremeLoad; i++) {
        promises.push(
          request(testBase.app.getHttpServer())
            .get('/api/library/my?limit=10')
            .set(testBase.getAuthHeaders())
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      console.log(`Extreme load test (${extremeLoad} requests): ${totalTime}ms`);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle extreme load within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
    }, 60000);
  });
});