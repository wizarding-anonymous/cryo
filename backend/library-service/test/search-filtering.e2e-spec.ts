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

describe('Search and Filtering E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let validToken: string;
  let testUserId: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
  };

  const testGames = [
    {
      id: randomUUID(),
      title: 'The Witcher 3: Wild Hunt',
      developer: 'CD Projekt RED',
      publisher: 'CD Projekt',
      images: ['witcher3.jpg'],
      tags: ['RPG', 'Open World', 'Fantasy'],
      releaseDate: new Date('2015-05-19'),
    },
    {
      id: randomUUID(),
      title: 'Cyberpunk 2077',
      developer: 'CD Projekt RED',
      publisher: 'CD Projekt',
      images: ['cyberpunk.jpg'],
      tags: ['RPG', 'Sci-Fi', 'Action'],
      releaseDate: new Date('2020-12-10'),
    },
    {
      id: randomUUID(),
      title: 'Counter-Strike 2',
      developer: 'Valve Corporation',
      publisher: 'Valve Corporation',
      images: ['cs2.jpg'],
      tags: ['FPS', 'Competitive', 'Multiplayer'],
      releaseDate: new Date('2023-09-27'),
    },
    {
      id: randomUUID(),
      title: 'Dota 2',
      developer: 'Valve Corporation',
      publisher: 'Valve Corporation',
      images: ['dota2.jpg'],
      tags: ['MOBA', 'Strategy', 'Multiplayer'],
      releaseDate: new Date('2013-07-09'),
    },
    {
      id: randomUUID(),
      title: 'Red Dead Redemption 2',
      developer: 'Rockstar Games',
      publisher: 'Rockstar Games',
      images: ['rdr2.jpg'],
      tags: ['Action', 'Adventure', 'Open World'],
      releaseDate: new Date('2018-10-26'),
    },
  ];

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
      testUserId = randomUUID();

      validToken = jwtService.sign({
        sub: testUserId,
        username: 'testuser',
        roles: ['user'],
      });

      // Setup mock responses
      mockGameCatalogClient.doesGameExist.mockResolvedValue(true);
      mockGameCatalogClient.getGamesByIds.mockImplementation((gameIds: string[]) => {
        return Promise.resolve(
          testGames.filter((game) => gameIds.includes(game.id)),
        );
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
    mockGameCatalogClient.getGamesByIds.mockClear();
    mockGameCatalogClient.doesGameExist.mockClear();

    // Add all test games to user's library
    for (let i = 0; i < testGames.length; i++) {
      const game = testGames[i];
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: testUserId,
          gameId: game.id,
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99 + i * 10,
          currency: 'USD',
          purchaseDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(), // Different dates
        })
        .expect(201);
    }
  });

  describe('Library Search Functionality', () => {
    it('should search games by exact title match', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Cyberpunk 2077')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toBe('Cyberpunk 2077');
    });

    it('should search games by partial title match', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Witcher')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toContain('Witcher');
    });

    it('should search games by developer name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=CD Projekt RED')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      const developers = response.body.games.map((game: any) => game.gameDetails.developer);
      expect(developers).toEqual(['CD Projekt RED', 'CD Projekt RED']);
    });

    it('should search games by publisher name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Valve Corporation')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      const publishers = response.body.games.map((game: any) => game.gameDetails.publisher);
      expect(publishers).toEqual(['Valve Corporation', 'Valve Corporation']);
    });

    it('should search games by tags', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=RPG')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      response.body.games.forEach((game: any) => {
        expect(game.gameDetails.tags).toContain('RPG');
      });
    });

    it('should handle case-insensitive search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=cyberpunk')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toBe('Cyberpunk 2077');
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=NonExistentGame')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should handle special characters in search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Counter-Strike')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toBe('Counter-Strike 2');
    });

    it('should handle numeric search queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=2077')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(1);
      expect(response.body.games[0].gameDetails.title).toBe('Cyberpunk 2077');
    });

    it('should validate minimum search query length', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my/search?query=a')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });

    it('should validate maximum search query length', async () => {
      const longQuery = 'a'.repeat(101); // Assuming max length is 100
      await request(app.getHttpServer())
        .get('/api/library/my/search?query=' + longQuery)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });
  });

  describe('Library Filtering and Sorting', () => {
    it('should sort games by purchase date (newest first)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=purchaseDate&sortOrder=desc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(5);
      
      // Verify sorting order (newest first)
      const purchaseDates = response.body.games.map((game: any) => new Date(game.purchaseDate));
      for (let i = 1; i < purchaseDates.length; i++) {
        expect(purchaseDates[i-1].getTime()).toBeGreaterThanOrEqual(purchaseDates[i].getTime());
      }
    });

    it('should sort games by purchase date (oldest first)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=purchaseDate&sortOrder=asc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(5);
      
      // Verify sorting order (oldest first)
      const purchaseDates = response.body.games.map((game: any) => new Date(game.purchaseDate));
      for (let i = 1; i < purchaseDates.length; i++) {
        expect(purchaseDates[i-1].getTime()).toBeLessThanOrEqual(purchaseDates[i].getTime());
      }
    });

    it('should sort games by title alphabetically', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=title&sortOrder=asc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(5);
      
      // Verify alphabetical sorting
      const titles = response.body.games.map((game: any) => game.gameDetails.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });

    it('should sort games by developer name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=developer&sortOrder=asc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(5);
      
      // Verify developer sorting
      const developers = response.body.games.map((game: any) => game.gameDetails.developer);
      const sortedDevelopers = [...developers].sort();
      expect(developers).toEqual(sortedDevelopers);
    });

    it('should handle invalid sort parameters gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=invalidField&sortOrder=desc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('sortBy');
    });

    it('should handle invalid sort order gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my?sortBy=title&sortOrder=invalid')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.message).toContain('sortOrder');
    });
  });

  describe('Pagination with Search and Filtering', () => {
    it('should paginate search results correctly', async () => {
      // Search for games by a common tag that should return multiple results
      const page1Response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Open World&page=1&limit=1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(page1Response.body.games).toHaveLength(1);
      expect(page1Response.body.pagination.page).toBe(1);
      expect(page1Response.body.pagination.limit).toBe(1);

      if (page1Response.body.pagination.totalPages > 1) {
        const page2Response = await request(app.getHttpServer())
          .get('/api/library/my/search?query=Open World&page=2&limit=1')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(page2Response.body.games).toHaveLength(1);
        expect(page2Response.body.pagination.page).toBe(2);
        
        // Ensure different games on different pages
        expect(page1Response.body.games[0].gameId).not.toBe(page2Response.body.games[0].gameId);
      }
    });

    it('should handle pagination beyond available results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=Cyberpunk&page=10&limit=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.games).toHaveLength(0);
      expect(response.body.pagination.page).toBe(10);
    });

    it('should validate pagination parameters', async () => {
      // Invalid page number
      await request(app.getHttpServer())
        .get('/api/library/my?page=0')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      // Invalid limit
      await request(app.getHttpServer())
        .get('/api/library/my?limit=0')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      // Limit too high
      await request(app.getHttpServer())
        .get('/api/library/my?limit=1000')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });
  });

  describe('Purchase History Search', () => {
    it('should search purchase history by game title', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/history/search?query=Witcher')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(1);
      expect(response.body.history[0].gameId).toBe(testGames[0].id);
    });

    it('should search purchase history by developer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/history/search?query=Valve')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(2);
    });

    it('should handle empty search results in history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/history/search?query=NonExistentGame')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(0);
    });

    it('should paginate history search results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/history/search?query=CD Projekt&page=1&limit=1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(1);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent search requests', async () => {
      const searchPromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .get(`/api/library/my/search?query=game${i % 3}`)
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(searchPromises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle search with URL-encoded special characters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/library/my/search?query=' + encodeURIComponent('Counter-Strike: 2'))
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should handle the encoded query gracefully
      expect(response.status).toBe(200);
    });

    it('should handle empty search query parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my/search?query=')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });

    it('should handle missing search query parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my/search')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });
  });
});