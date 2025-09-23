import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import { RateLimitService } from '../src/security/rate-limit.service';
import { AuthValidationService } from '../src/security/auth-validation.service';
import { MetricsService } from '../src/health/metrics.service';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('API Gateway Integration (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({ isEnabled: () => false })
      .overrideProvider(AuthValidationService)
      .useValue({ validateBearerToken: jest.fn().mockResolvedValue({ id: 'u1', email: 'e', roles: [], permissions: [] }) })
      .overrideProvider(MetricsService)
      .useValue({ metrics: jest.fn().mockResolvedValue('') })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedAxios.mockReset();
  });

  it('GET /api/games should proxy to game-catalog-service and return list', async () => {
    mockedAxios.mockImplementation(async (cfg: any) => {
      if (cfg.method === 'GET' && String(cfg.url).includes('/games')) {
        return { status: 200, data: { items: [{ id: 1 }] }, headers: { 'content-type': 'application/json' } };
      }
      throw new Error('unexpected request: ' + cfg.url);
    });

    await request(app.getHttpServer())
      .get('/api/games?limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(({ body }) => {
        expect(body.items).toBeDefined();
      });
  });

  it('handles service unavailable from upstream', async () => {
    mockedAxios.mockImplementation(async () => {
      throw {};
    });
    await request(app.getHttpServer()).get('/api/games').expect(503);
  });

  it('POST /api/users/profile requires authentication', async () => {
    await request(app.getHttpServer()).post('/api/users/profile').send({ name: 'x' }).expect(401);
  });

  it('POST /api/users/profile proxies authenticated requests', async () => {
    // AuthValidationService already mocked to accept any token
    mockedAxios.mockImplementation(async (cfg: any) => {
      // Proxy forward call
      if (cfg.method === 'POST' && String(cfg.url).includes('/users/profile')) {
        return { status: 200, data: { ok: true }, headers: {} };
      }
      // Ignore other calls (we mocked AuthValidationService, so no axios.get should be invoked)
      return { status: 200, data: {}, headers: {} };
    });

    await request(app.getHttpServer())
      .post('/api/users/profile')
      .set('Authorization', 'Bearer token')
      .send({ name: 'New Name' })
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ ok: true }));
  });
});

describe('API Gateway Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let counter = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => true,
        check: jest.fn().mockImplementation(() => {
          counter += 1;
          const allowed = counter <= 3;
          return Promise.resolve({
            allowed,
            limit: 3,
            remaining: Math.max(0, 3 - counter),
            reset: Date.now() + 1000,
            windowMs: 1000,
          });
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue({ validateBearerToken: jest.fn().mockResolvedValue({ id: 'u1', email: 'e', roles: [], permissions: [] }) })
      .overrideProvider(MetricsService)
      .useValue({ metrics: jest.fn().mockResolvedValue('') })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    counter = 0;
    mockedAxios.mockReset();
    mockedAxios.mockImplementation(async (cfg: any) => ({ status: 200, data: { ok: true }, headers: {} }));
  });

  it('enforces limits per IP and returns 429 with rate limit headers', async () => {
    const agent = request(app.getHttpServer());
    await agent.get('/api/games').expect(200);
    await agent.get('/api/games').expect(200);
    await agent.get('/api/games').expect(200);
    await agent.get('/api/games')
      .expect(429)
      .expect((res) => {
        expect(res.headers['x-ratelimit-limit']).toBeDefined();
        expect(res.headers['x-ratelimit-remaining']).toBeDefined();
        expect(res.headers['x-ratelimit-reset']).toBeDefined();
      });
  });
});
