import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { setupTestDatabase, cleanupTestDatabase } from './setup-e2e';

describe('Application Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
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
    await app.close();
    await cleanupTestDatabase();
  });

  describe('Game CRUD Operations', () => {
    describe('POST /api/games', () => {
      it('should create a new game', async () => {
        const createGameDto = {
          title: 'Test Game',
          description: 'A test game',
          price: 29.99,
          developer: 'Test Studio',
          publisher: 'Test Publisher',
          genre: 'Action',
        };

        const response = await request(app.getHttpServer())
          .post('/api/games')
          .send(createGameDto)
          .expect(201);

        expect(response.body.id).toBeDefined();
        expect(response.body.title).toBe(createGameDto.title);
        expect(response.body.price).toBe(createGameDto.price);

        // Cleanup
        await request(app.getHttpServer())
          .delete(`/api/games/${response.body.id}`)
          .expect(204);
      });
    });

    describe('GET /api/games', () => {
      it('should return paginated games', async () => {
        // Create test games in database
        const testGames = [];
        for (let i = 0; i < 3; i++) {
          const gameData = {
            title: `Test Game ${i + 1}`,
            price: 29.99 + i,
            developer: `Developer ${i + 1}`,
            publisher: `Publisher ${i + 1}`,
            genre: 'Test',
          };

          const createResponse = await request(app.getHttpServer())
            .post('/api/games')
            .send(gameData)
            .expect(201);

          testGames.push(createResponse.body);
        }

        const response = await request(app.getHttpServer())
          .get('/api/games')
          .query({ page: 1, limit: 10 })
          .expect(200);

        expect(response.body.games).toBeDefined();
        expect(response.body.total).toBeGreaterThanOrEqual(3);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(10);
        expect(Array.isArray(response.body.games)).toBe(true);

        // Cleanup
        for (const game of testGames) {
          await request(app.getHttpServer())
            .delete(`/api/games/${game.id}`)
            .expect(204);
        }
      });
    });

    describe('GET /api/games/:id', () => {
      it('should return game by id', async () => {
        // Create a test game
        const gameData = {
          title: 'Test Game for ID',
          price: 39.99,
          developer: 'Test Developer',
          publisher: 'Test Publisher',
          genre: 'Test',
        };

        const createResponse = await request(app.getHttpServer())
          .post('/api/games')
          .send(gameData)
          .expect(201);

        const gameId = createResponse.body.id;

        const response = await request(app.getHttpServer())
          .get(`/api/games/${gameId}`)
          .expect(200);

        expect(response.body.id).toBe(gameId);
        expect(response.body.title).toBe(gameData.title);
        expect(response.body.price).toBe(gameData.price);

        // Cleanup
        await request(app.getHttpServer())
          .delete(`/api/games/${gameId}`)
          .expect(204);
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
