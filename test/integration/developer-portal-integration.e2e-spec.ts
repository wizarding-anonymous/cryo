import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Developer Portal Service Integration (e2e)', () => {
  let app: INestApplication;
  const validApiKey = 'test-developer-portal-api-key';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/developers/:userId/basic-profile', () => {
    it('should return 401 without API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/developers/123e4567-e89b-12d3-a456-426614174000/basic-profile')
        .expect(401);
    });

    it('should return 403 with invalid API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/developers/123e4567-e89b-12d3-a456-426614174000/basic-profile')
        .set('X-API-Key', 'invalid-key')
        .expect(403);
    });

    it('should return 404 for non-existent developer', () => {
      return request(app.getHttpServer())
        .get('/api/v1/developers/123e4567-e89b-12d3-a456-426614174000/basic-profile')
        .set('X-API-Key', validApiKey)
        .expect(404);
    });
  });

  describe('GET /api/v1/publishers/:userId/basic-profile', () => {
    it('should return 401 without API key', () => {
      return request(app.getHttpServer())
        .get('/api/v1/publishers/123e4567-e89b-12d3-a456-426614174000/basic-profile')
        .expect(401);
    });
  });
});