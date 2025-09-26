import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { ServiceRegistryService } from '../../registry/service-registry.service';
import { RedisService } from '../../redis/redis.service';
import { AuthValidationService } from '../auth-validation.service';

describe('Authentication Guards Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ServiceRegistryService)
      .useValue({
        getAll: () => [],
        getServiceConfig: () => undefined,
      })
      .overrideProvider(RedisService)
      .useValue({
        getClient: () => ({
          ping: () => Promise.resolve('PONG'),
          multi: () => ({
            zremrangebyscore: jest.fn().mockReturnThis(),
            zcard: jest.fn().mockReturnThis(),
            zadd: jest.fn().mockReturnThis(),
            pexpire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 0], [null, 0]]),
          }),
          zrange: jest.fn().mockResolvedValue([]),
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue({
        validateBearerToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 10000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  describe('Health endpoints (no auth required)', () => {
    it('should allow access to health endpoint without authentication', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200);
    });

    it('should allow access to metrics endpoint without authentication', async () => {
      await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);
    });
  });

  describe('Proxy endpoints authentication behavior', () => {
    it('should return 404 for non-existent GET routes (no auth required)', async () => {
      await request(app.getHttpServer())
        .get('/api/nonexistent')
        .expect(404);
    }, 10000);

    it('should return 401 for POST routes without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/nonexistent')
        .send({ test: 'data' })
        .expect(401);
    }, 10000);

    it('should return 401 for PUT routes without authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/nonexistent')
        .send({ test: 'data' })
        .expect(401);
    }, 10000);

    it('should return 401 for DELETE routes without authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/nonexistent')
        .expect(401);
    }, 10000);
  });
});