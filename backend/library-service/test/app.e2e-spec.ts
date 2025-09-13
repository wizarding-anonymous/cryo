import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { JwtService } from '@nestjs/jwt';

describe('Library Service (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;

  const mockGameCatalogClient = {
    getGamesByIds: jest.fn(),
    doesGameExist: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(GameCatalogClient)
    .useValue(mockGameCatalogClient)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    jwtService = app.get(JwtService);
    validToken = jwtService.sign({ sub: 'user-id-123', username: 'testuser', roles: ['user'] });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGameCatalogClient.getGamesByIds.mockClear();
  });

  describe('LibraryController', () => {
    it('GET /api/library/my - should fail without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/library/my')
        .expect(401);
    });

    it('GET /api/library/my - should return user library', () => {
        // We don't need to mock the repository because for e2e, we want to hit the real DB.
        // But we do need to mock the HTTP client.
        mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

        return request(app.getHttpServer())
            .get('/api/library/my')
            .set('Authorization', `Bearer ${validToken}`)
            .expect(200);
    });

    it('GET /api/library/my/search - should return search results', () => {
        mockGameCatalogClient.getGamesByIds.mockResolvedValue([]);

        return request(app.getHttpServer())
            .get('/api/library/my/search?query=test')
            .set('Authorization', `Bearer ${validToken}`)
            .expect(200);
    });
  });

  describe('HistoryController', () => {
    it('GET /api/library/history - should fail without auth token', () => {
        return request(app.getHttpServer())
          .get('/api/library/history')
          .expect(401);
    });

    it('GET /api/library/history - should return user history', () => {
        return request(app.getHttpServer())
            .get('/api/library/history')
            .set('Authorization', `Bearer ${validToken}`)
            .expect(200);
    });
  });

  describe('Health Endpoints', () => {
    it('/api/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toEqual('ok');
        });
    });
  });
});
