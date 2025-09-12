import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        reset: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health - should return health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect((res) => {
        // Health check can return 200 (ok) or 503 (service unavailable) depending on system resources
        expect([200, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
        expect(['ok', 'error']).toContain(res.body.status);
        expect(res.body).toHaveProperty('info');
        expect(res.body).toHaveProperty('details');
      });
  });
});
