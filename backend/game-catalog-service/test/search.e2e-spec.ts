import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateGameDto } from '../src/dto/create-game.dto';

describe('SearchController (e2e)', () => {
  let app: INestApplication;
  let testGameIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Create test games for search functionality
    const testGames: CreateGameDto[] = [
      {
        title: 'Cyberpunk 2077',
        description: 'Futuristic RPG game set in Night City',
        price: 2999.99,
        developer: 'CD Projekt RED',
        genre: 'RPG',
      },
      {
        title: 'The Witcher 3',
        description: 'Fantasy RPG adventure',
        price: 1499.99,
        developer: 'CD Projekt RED',
        genre: 'RPG',
      },
      {
        title: 'Counter-Strike 2',
        description: 'Competitive first-person shooter',
        price: 0,
        developer: 'Valve',
        genre: 'FPS',
      },
      {
        title: 'Dota 2',
        description: 'Multiplayer online battle arena',
        price: 0,
        developer: 'Valve',
        genre: 'MOBA',
      },
    ];

    for (const gameDto of testGames) {
      const response = await request(app.getHttpServer())
        .post('/api/games')
        .send(gameDto)
        .expect(201);
      testGameIds.push(response.body.id);
    }
  });

  afterAll(async () => {
    // Clean up test games
    for (const gameId of testGameIds) {
      await request(app.getHttpServer())
        .delete(`/api/games/${gameId}`)
        .expect(204);
    }
    await app.close();
  });

  describe('GET /api/games/search', () => {
    it('should search games by title', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'Cyberpunk', searchType: 'title' })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.total).toBeGreaterThan(0);
          expect(res.body.games.length).toBeGreaterThan(0);
          expect(res.body.games[0].title).toContain('Cyberpunk');
        });
    });

    it('should search games by description', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'RPG', searchType: 'description' })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.total).toBeGreaterThan(0);
        });
    });

    it('should search games across all fields', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'Valve', searchType: 'all' })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.total).toBeGreaterThan(0);
        });
    });

    it('should return paginated results', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ page: 1, limit: 2 })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(2);
          expect(res.body.games.length).toBeLessThanOrEqual(2);
        });
    });

    it('should filter by price range', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ minPrice: 1000, maxPrice: 2000 })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          res.body.games.forEach((game: any) => {
            expect(game.price).toBeGreaterThanOrEqual(1000);
            expect(game.price).toBeLessThanOrEqual(2000);
          });
        });
    });

    it('should return empty results for non-existent search', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'NonExistentGameTitle12345' })
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.games).toHaveLength(0);
          expect(res.body.total).toBe(0);
        });
    });

    it('should return 400 for invalid price range', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ minPrice: 2000, maxPrice: 1000 })
        .expect(400)
        .then((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should return 400 for negative prices', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ minPrice: -100 })
        .expect(400)
        .then((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should return 400 for empty search query', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: '   ' })
        .expect(400)
        .then((res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('should handle search without query parameter', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .expect(200)
        .then((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.games).toBeDefined();
          expect(res.body.total).toBeGreaterThanOrEqual(0);
        });
    });

    it('should validate pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ page: 0, limit: 101 })
        .expect(400);
    });

    it('should validate search type parameter', () => {
      return request(app.getHttpServer())
        .get('/api/games/search')
        .query({ q: 'test', searchType: 'invalid' })
        .expect(400);
    });
  });
});