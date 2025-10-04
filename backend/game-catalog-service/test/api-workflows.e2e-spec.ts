import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateGameDto } from '../src/dto/create-game.dto';
import { UpdateGameDto } from '../src/dto/update-game.dto';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { setupTestDatabase, cleanupTestDatabase } from './setup-e2e';

describe('API Workflows (e2e)', () => {
  let app: INestApplication;
  let testGameIds: string[] = [];

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror the main.ts setup for realistic testing
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
    
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    // Clean up created games
    for (const gameId of testGameIds) {
      await request(app.getHttpServer())
        .delete(`/api/games/${gameId}`)
        .expect((res) => {
          // Accept both 204 (success) and 404 (already deleted)
          expect([204, 404]).toContain(res.status);
        });
    }

    await app.close();
    await cleanupTestDatabase();
  });

  describe('Complete Game Lifecycle Workflow', () => {
    let gameId: string;

    it('should complete full CRUD workflow for a game', async () => {
      // 1. Create a new game
      const createGameDto: CreateGameDto = {
        title: 'Workflow Test Game',
        description: 'A comprehensive test game for workflow testing',
        shortDescription: 'Workflow test game',
        price: 49.99,
        currency: 'RUB',
        genre: 'Adventure',
        developer: 'Workflow Studios',
        publisher: 'Workflow Publishers',
        releaseDate: '2024-03-01',
        images: ['workflow1.jpg', 'workflow2.jpg'],
        systemRequirements: {
          minimum: 'Minimum requirements for workflow test',
          recommended: 'Recommended requirements for workflow test',
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/games')
        .send(createGameDto)
        .expect(201);

      expect(createResponse.body.id).toBeDefined();
      expect(createResponse.body.title).toBe(createGameDto.title);
      expect(createResponse.body.price).toBe(createGameDto.price);
      gameId = createResponse.body.id;
      testGameIds.push(gameId);

      // 2. Read the created game
      const readResponse = await request(app.getHttpServer())
        .get(`/api/games/${gameId}`)
        .expect(200);

      expect(readResponse.body.id).toBe(gameId);
      expect(readResponse.body.title).toBe(createGameDto.title);
      expect(readResponse.body.systemRequirements).toEqual(
        createGameDto.systemRequirements,
      );

      // 3. Update the game
      const updateGameDto: UpdateGameDto = {
        title: 'Updated Workflow Test Game',
        price: 39.99,
        description: 'Updated description for workflow test',
      };

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/games/${gameId}`)
        .send(updateGameDto)
        .expect(200);

      expect(updateResponse.body.title).toBe(updateGameDto.title);
      expect(updateResponse.body.price).toBe(updateGameDto.price);
      expect(updateResponse.body.description).toBe(updateGameDto.description);

      // 4. Verify the update
      const verifyResponse = await request(app.getHttpServer())
        .get(`/api/games/${gameId}`)
        .expect(200);

      expect(verifyResponse.body.title).toBe(updateGameDto.title);
      expect(verifyResponse.body.price).toBe(updateGameDto.price);

      // 5. Delete the game
      await request(app.getHttpServer())
        .delete(`/api/games/${gameId}`)
        .expect(204);

      // 6. Verify deletion
      await request(app.getHttpServer())
        .get(`/api/games/${gameId}`)
        .expect(404);

      // Remove from cleanup list since it's already deleted
      testGameIds = testGameIds.filter((id) => id !== gameId);
    });
  });

  describe('Game Catalog Browsing Workflow', () => {
    const catalogGameIds: string[] = [];

    beforeAll(async () => {
      // Create a catalog of test games
      const catalogGames: CreateGameDto[] = [
        {
          title: 'Action Hero',
          price: 59.99,
          genre: 'Action',
          developer: 'Action Studios',
          publisher: 'Action Publishers',
          description: 'An exciting action game',
        },
        {
          title: 'RPG Adventure',
          price: 49.99,
          genre: 'RPG',
          developer: 'RPG Studios',
          publisher: 'RPG Publishers',
          description: 'An immersive RPG experience',
        },
        {
          title: 'Strategy Master',
          price: 39.99,
          genre: 'Strategy',
          developer: 'Strategy Studios',
          publisher: 'Strategy Publishers',
          description: 'A complex strategy game',
        },
        {
          title: 'Puzzle Solver',
          price: 19.99,
          genre: 'Puzzle',
          developer: 'Puzzle Studios',
          publisher: 'Puzzle Publishers',
          description: 'A challenging puzzle game',
        },
        {
          title: 'Racing Champion',
          price: 29.99,
          genre: 'Racing',
          developer: 'Racing Studios',
          publisher: 'Racing Publishers',
          description: 'A fast-paced racing game',
        },
      ];

      for (const gameDto of catalogGames) {
        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(gameDto)
          .expect(201);
        catalogGameIds.push(response.body.id);
        testGameIds.push(response.body.id);
      }
    });

    it('should browse games with pagination', async () => {
      // Get first page
      const page1Response = await request(app.getHttpServer())
        .get('/api/games')
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(page1Response.body.games).toBeDefined();
      expect(page1Response.body.games.length).toBeLessThanOrEqual(3);
      expect(page1Response.body.page).toBe(1);
      expect(page1Response.body.limit).toBe(3);
      expect(page1Response.body.total).toBeGreaterThan(0);

      // Get second page if available
      if (page1Response.body.hasNext) {
        const page2Response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 2, limit: 3 })
          .expect(200);

        expect(page2Response.body.games).toBeDefined();
        expect(page2Response.body.page).toBe(2);

        // Verify no duplicate games between pages
        const page1Ids = page1Response.body.games.map((game: any) => game.id);
        const page2Ids = page2Response.body.games.map((game: any) => game.id);
        const intersection = page1Ids.filter((id: string) =>
          page2Ids.includes(id),
        );
        expect(intersection).toHaveLength(0);
      }
    });

    it('should get detailed game information', async () => {
      const gameId = catalogGameIds[0];

      const response = await request(app.getHttpServer())
        .get(`/api/games/${gameId}`)
        .expect(200);

      expect(response.body.id).toBe(gameId);
      expect(response.body.title).toBeDefined();
      expect(response.body.price).toBeDefined();
      expect(response.body.genre).toBeDefined();
      expect(response.body.developer).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should get purchase information for games', async () => {
      const gameId = catalogGameIds[0];

      const response = await request(app.getHttpServer())
        .get(`/api/games/${gameId}/purchase-info`)
        .expect(200);

      expect(response.body.id).toBe(gameId);
      expect(response.body.title).toBeDefined();
      expect(response.body.price).toBeDefined();
      expect(response.body.currency).toBeDefined();
      expect(response.body.available).toBeDefined();
      expect(typeof response.body.available).toBe('boolean');
    });
  });

  describe('Game Search and Discovery Workflow', () => {
    const searchGameIds: string[] = [];

    beforeAll(async () => {
      // Create games with specific search terms
      const searchGames: CreateGameDto[] = [
        {
          title: 'Cyberpunk Future',
          description: 'A futuristic cyberpunk adventure in a dystopian world',
          price: 59.99,
          genre: 'RPG',
          developer: 'Future Games',
          publisher: 'Future Publishers',
        },
        {
          title: 'Medieval Quest',
          description: 'An epic medieval fantasy adventure',
          price: 49.99,
          genre: 'RPG',
          developer: 'Medieval Studios',
          publisher: 'Medieval Publishers',
        },
        {
          title: 'Space Explorer',
          description: 'Explore the vast reaches of space',
          price: 39.99,
          genre: 'Simulation',
          developer: 'Space Games Inc',
          publisher: 'Space Publishers',
        },
        {
          title: 'Future Racing',
          description: 'High-speed racing in the future',
          price: 29.99,
          genre: 'Racing',
          developer: 'Future Games',
          publisher: 'Future Publishers',
        },
      ];

      for (const gameDto of searchGames) {
        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(gameDto)
          .expect(201);
        searchGameIds.push(response.body.id);
        testGameIds.push(response.body.id);
      }
    });

    it('should search games by title', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'Cyberpunk', searchType: 'title' })
        .expect(200);

      expect(response.body.games).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.games.length).toBeGreaterThan(0);

      const foundGame = response.body.games.find((game: any) =>
        game.title.includes('Cyberpunk'),
      );
      expect(foundGame).toBeDefined();
    });

    it('should search games by description', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'adventure', searchType: 'description' })
        .expect(200);

      expect(response.body.games).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);

      const hasAdventureInDescription = response.body.games.some(
        (game: any) =>
          game.description &&
          game.description.toLowerCase().includes('adventure'),
      );
      expect(hasAdventureInDescription).toBe(true);
    });

    it('should search across all fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'Future', searchType: 'all' })
        .expect(200);

      expect(response.body.games).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);

      // Should find games with "Future" in title, description, or developer
      const hasFutureInAnyField = response.body.games.some(
        (game: any) =>
          game.title.includes('Future') ||
          (game.description && game.description.includes('future')) ||
          game.developer.includes('Future'),
      );
      expect(hasFutureInAnyField).toBe(true);
    });

    it('should filter games by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ minPrice: 30, maxPrice: 50 })
        .expect(200);

      expect(response.body.games).toBeDefined();

      response.body.games.forEach((game: any) => {
        expect(game.price).toBeGreaterThanOrEqual(30);
        expect(game.price).toBeLessThanOrEqual(50);
      });
    });

    it('should combine search query with price filter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({
          q: 'RPG',
          searchType: 'all',
          minPrice: 40,
          maxPrice: 60,
        })
        .expect(200);

      expect(response.body.games).toBeDefined();

      response.body.games.forEach((game: any) => {
        expect(game.price).toBeGreaterThanOrEqual(40);
        expect(game.price).toBeLessThanOrEqual(60);

        const hasRPG =
          game.title.includes('RPG') ||
          (game.description && game.description.includes('RPG')) ||
          game.genre.includes('RPG') ||
          game.developer.includes('RPG');
        expect(hasRPG).toBe(true);
      });
    });

    it('should paginate search results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.games).toBeDefined();
      expect(response.body.games.length).toBeLessThanOrEqual(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Edge Cases Workflow', () => {
    it('should handle invalid game ID gracefully', async () => {
      const invalidId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/games/${invalidId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    it('should handle malformed game ID', async () => {
      const malformedId = 'not-a-valid-uuid';

      await request(app.getHttpServer())
        .get(`/api/games/${malformedId}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should validate game creation data', async () => {
      const invalidGameData = {
        title: '', // Empty title
        price: -10, // Negative price
        developer: '', // Empty developer
        genre: '', // Empty genre
      };

      await request(app.getHttpServer())
        .post('/api/games')
        .send(invalidGameData)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should handle invalid pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/games')
        .query({ page: 0, limit: 101 })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should handle invalid search parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/games/search')
        .query({
          searchType: 'invalid',
          minPrice: -100,
          maxPrice: -50,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should handle empty search results gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'NonExistentGameTitle12345' })
        .expect(200);

      expect(response.body.games).toBeDefined();
      expect(response.body.games).toHaveLength(0);
      expect(response.body.total).toBe(0);
      expect(response.body.page).toBe(1);
    });

    it('should handle concurrent requests properly', async () => {
      // Create a game for concurrent testing
      const gameData: CreateGameDto = {
        title: 'Concurrent Test Game',
        price: 25.99,
        developer: 'Concurrent Studio',
        publisher: 'Concurrent Publishers',
        genre: 'Test',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/games')
        .send(gameData)
        .expect(201);

      const gameId = createResponse.body.id;
      testGameIds.push(gameId);

      // Make multiple concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).get(`/api/games/${gameId}`).expect(200),
      );

      const responses = await Promise.all(concurrentRequests);

      // All responses should be identical
      responses.forEach((response) => {
        expect(response.body.id).toBe(gameId);
        expect(response.body.title).toBe(gameData.title);
      });
    });
  });

  describe('API Response Format Consistency', () => {
    let formatTestGameId: string;

    beforeAll(async () => {
      const gameData: CreateGameDto = {
        title: 'Format Test Game',
        description: 'Testing response format consistency',
        price: 35.99,
        developer: 'Format Studios',
        publisher: 'Format Publishers',
        genre: 'Test',
      };

      const response = await request(app.getHttpServer())
        .post('/api/games')
        .send(gameData)
        .expect(201);

      formatTestGameId = response.body.id;
      testGameIds.push(formatTestGameId);
    });

    it('should return consistent response format for single game', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/games/${formatTestGameId}`)
        .expect(200);

      // Verify required fields are present
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('genre');
      expect(response.body).toHaveProperty('developer');
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Verify data types
      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.title).toBe('string');
      expect(typeof response.body.price).toBe('number');
      expect(typeof response.body.available).toBe('boolean');
    });

    it('should return consistent response format for game list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .query({ page: 1, limit: 5 })
        .expect(200);

      // Verify list response structure
      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasNext');

      expect(Array.isArray(response.body.games)).toBe(true);
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.page).toBe('number');
      expect(typeof response.body.limit).toBe('number');
      expect(typeof response.body.hasNext).toBe('boolean');

      // Verify each game in the list has consistent format
      response.body.games.forEach((game: any) => {
        expect(game).toHaveProperty('id');
        expect(game).toHaveProperty('title');
        expect(game).toHaveProperty('price');
        expect(typeof game.id).toBe('string');
        expect(typeof game.title).toBe('string');
        expect(typeof game.price).toBe('number');
      });
    });

    it('should return consistent error response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/invalid-id')
        .expect(400);

      // Verify error response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });
  });
});
