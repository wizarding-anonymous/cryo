import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import { RateLimitService } from '../src/security/rate-limit.service';
import { AuthValidationService } from '../src/security/auth-validation.service';
import { MetricsService } from '../src/health/metrics.service';
import { ServiceRegistryService } from '../src/registry/service-registry.service';
import { RedisService } from '../src/redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('API Gateway - Basic Routing Integration (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => false,
        check: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
          windowMs: 60000,
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue({
        validateBearerToken: jest.fn().mockResolvedValue({
          id: 'test-user-1',
          email: 'test@example.com',
          roles: ['user'],
          permissions: ['read:games', 'write:profile'],
        }),
      })
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest
          .fn()
          .mockResolvedValue(
            '# HELP api_gateway_requests_total Total requests\n# TYPE api_gateway_requests_total counter\napi_gateway_requests_total 0',
          ),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
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

  describe('Public Routes - Game Catalog Service', () => {
    it('GET /api/games should proxy to game-catalog-service and return games list', async () => {
      mockedAxios.mockImplementation(async (cfg: any) => {
        if (cfg.method === 'GET' && String(cfg.url).includes('/games')) {
          return {
            status: 200,
            data: {
              items: [
                { id: 1, title: 'Test Game 1', genre: 'Action' },
                { id: 2, title: 'Test Game 2', genre: 'RPG' },
              ],
              total: 2,
              page: 1,
              limit: 10,
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .get('/api/games?limit=10&page=1')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0]).toHaveProperty('id', 1);
      expect(response.body.items[0]).toHaveProperty('title', 'Test Game 1');
      expect(response.body.total).toBe(2);
    });

    it('GET /api/games/:id should proxy to game-catalog-service and return specific game', async () => {
      mockedAxios.mockImplementation(async (cfg: any) => {
        if (cfg.method === 'GET' && String(cfg.url).includes('/games/123')) {
          return {
            status: 200,
            data: {
              id: 123,
              title: 'Specific Game',
              genre: 'Adventure',
              description: 'A great adventure game',
              price: 29.99,
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .get('/api/games/123')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('id', 123);
      expect(response.body).toHaveProperty('title', 'Specific Game');
      expect(response.body).toHaveProperty('price', 29.99);
    });

    it('GET /api/games should handle 404 from upstream service', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Not Found');
        error.response = { status: 404, data: { message: 'Game not found' } };
        throw error;
      });

      await request(app.getHttpServer()).get('/api/games/999').expect(404);
    });
  });

  describe('Service Unavailable Handling', () => {
    it('should return 503 when upstream service is unavailable', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      await request(app.getHttpServer())
        .get('/api/games')
        .expect(503)
        .expect(({ body }: { body: any }) => {
          expect(body).toHaveProperty('error');
          expect(body).toHaveProperty('message');
          expect(body).toHaveProperty('statusCode', 503);
        });
    });

    it('should return 504 when upstream service times out', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('timeout');
        error.code = 'ECONNABORTED';
        throw error;
      });

      await request(app.getHttpServer()).get('/api/games').expect(504);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should handle OPTIONS preflight requests', async () => {
      await request(app.getHttpServer())
        .options('/api/games')
        .expect(200)
        .expect((res: any) => {
          expect(res.headers['access-control-allow-origin']).toBeDefined();
          expect(res.headers['access-control-allow-methods']).toBeDefined();
          expect(res.headers['access-control-allow-headers']).toBeDefined();
        });
    });
  });
});

describe('API Gateway - Authentication & Authorization (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockAuthService: any;

  beforeAll(async () => {
    mockAuthService = {
      validateBearerToken: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => false,
        check: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
          windowMs: 60000,
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue(mockAuthService)
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest.fn().mockResolvedValue(''),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedAxios.mockReset();
    mockAuthService.validateBearerToken.mockReset();
  });

  describe('Protected Routes - User Service', () => {
    it('POST /api/users/profile should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .send({ name: 'Test User' })
        .expect(401)
        .expect(({ body }: { body: any }) => {
          expect(body).toHaveProperty('statusCode', 401);
          expect(body).toHaveProperty('message');
        });
    });

    it('POST /api/users/profile should reject invalid tokens', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test User' })
        .expect(401);

      expect(mockAuthService.validateBearerToken).toHaveBeenCalledWith(
        'invalid-token',
      );
    });

    it('POST /api/users/profile should accept valid tokens and proxy request', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['write:profile'],
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        if (
          cfg.method === 'POST' &&
          String(cfg.url).includes('/users/profile')
        ) {
          expect(cfg.headers['x-user-id']).toBe('user-123');
          expect(cfg.headers['x-user-email']).toBe('test@example.com');
          return {
            status: 200,
            data: {
              id: 'user-123',
              name: 'Updated Name',
              email: 'test@example.com',
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body).toHaveProperty('id', 'user-123');
      expect(response.body).toHaveProperty('name', 'Updated Name');
      expect(mockAuthService.validateBearerToken).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('PUT /api/users/profile should require authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .send({ name: 'Test User' })
        .expect(401);
    });

    it('DELETE /api/users/account should require authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/users/account')
        .expect(401);
    });
  });

  describe('Protected Routes - Payment Service', () => {
    it('POST /api/payments/process should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/process')
        .send({ amount: 100, currency: 'USD' })
        .expect(401);
    });

    it('GET /api/payments/history should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/history')
        .expect(401);
    });

    it('POST /api/payments/process should proxy authenticated requests', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-456',
        email: 'buyer@example.com',
        roles: ['user'],
        permissions: ['make:payments'],
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        if (
          cfg.method === 'POST' &&
          String(cfg.url).includes('/payments/process')
        ) {
          return {
            status: 201,
            data: {
              id: 'payment-789',
              amount: 100,
              currency: 'USD',
              status: 'completed',
              userId: 'user-456',
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .post('/api/payments/process')
        .set('Authorization', 'Bearer valid-payment-token')
        .send({ amount: 100, currency: 'USD', gameId: 'game-123' })
        .expect(201);

      expect(response.body).toHaveProperty('id', 'payment-789');
      expect(response.body).toHaveProperty('status', 'completed');
    });
  });

  describe('Protected Routes - Library Service', () => {
    it('GET /api/library should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/library').expect(401);
    });

    it('POST /api/library/games should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/library/games')
        .send({ gameId: 'game-123' })
        .expect(401);
    });

    it('GET /api/library should return user library when authenticated', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-789',
        email: 'gamer@example.com',
        roles: ['user'],
        permissions: ['read:library'],
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        if (cfg.method === 'GET' && String(cfg.url).includes('/library')) {
          return {
            status: 200,
            data: {
              games: [
                {
                  id: 'game-1',
                  title: 'Owned Game 1',
                  purchaseDate: '2024-01-01',
                },
                {
                  id: 'game-2',
                  title: 'Owned Game 2',
                  purchaseDate: '2024-01-15',
                },
              ],
              total: 2,
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .get('/api/library')
        .set('Authorization', 'Bearer valid-library-token')
        .expect(200);

      expect(response.body.games).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle malformed Authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'InvalidFormat token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should handle missing Bearer prefix', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'just-a-token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should handle empty Authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', '')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should handle expired tokens', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Token expired'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer expired-token')
        .send({ name: 'Test' })
        .expect(401);
    });
  });
});

describe('API Gateway - Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let requestCounter = 0;
  let mockRateLimitService: any;

  beforeAll(async () => {
    mockRateLimitService = {
      isEnabled: () => true,
      check: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue(mockRateLimitService)
      .overrideProvider(AuthValidationService)
      .useValue({
        validateBearerToken: jest.fn().mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
        }),
      })
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest.fn().mockResolvedValue(''),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    requestCounter = 0;
    mockedAxios.mockReset();
    mockRateLimitService.check.mockReset();

    mockedAxios.mockImplementation(async () => ({
      status: 200,
      data: { items: [] },
      headers: { 'content-type': 'application/json' },
    }));
  });

  it('should allow requests within rate limit', async () => {
    mockRateLimitService.check.mockImplementation(() => {
      requestCounter += 1;
      return Promise.resolve({
        allowed: requestCounter <= 5,
        limit: 5,
        remaining: Math.max(0, 5 - requestCounter),
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    // First 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe(String(4 - i));
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    }
  });

  it('should block requests exceeding rate limit with 429 status', async () => {
    mockRateLimitService.check.mockImplementation(() => {
      requestCounter += 1;
      return Promise.resolve({
        allowed: requestCounter <= 3,
        limit: 3,
        remaining: Math.max(0, 3 - requestCounter),
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get('/api/games').expect(200);
    }

    // 4th request should be rate limited
    const response = await request(app.getHttpServer())
      .get('/api/games')
      .expect(429);

    expect(response.body).toHaveProperty('statusCode', 429);
    expect(response.body).toHaveProperty('message');
    expect(response.headers['x-ratelimit-limit']).toBe('3');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should apply rate limiting per IP address', async () => {
    let ip1Counter = 0;
    let ip2Counter = 0;

    mockRateLimitService.check.mockImplementation((ip: string) => {
      if (ip === '127.0.0.1') {
        ip1Counter += 1;
        return Promise.resolve({
          allowed: ip1Counter <= 2,
          limit: 2,
          remaining: Math.max(0, 2 - ip1Counter),
          reset: Date.now() + 60000,
          windowMs: 60000,
        });
      } else {
        ip2Counter += 1;
        return Promise.resolve({
          allowed: ip2Counter <= 2,
          limit: 2,
          remaining: Math.max(0, 2 - ip2Counter),
          reset: Date.now() + 60000,
          windowMs: 60000,
        });
      }
    });

    // Simulate requests from different IPs
    await request(app.getHttpServer())
      .get('/api/games')
      .set('X-Forwarded-For', '192.168.1.1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/games')
      .set('X-Forwarded-For', '192.168.1.2')
      .expect(200);

    // Both IPs should still be allowed
    await request(app.getHttpServer())
      .get('/api/games')
      .set('X-Forwarded-For', '192.168.1.1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/games')
      .set('X-Forwarded-For', '192.168.1.2')
      .expect(200);
  });

  it('should include proper rate limit headers in all responses', async () => {
    mockRateLimitService.check.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 95,
      reset: Date.now() + 60000,
      windowMs: 60000,
    });

    const response = await request(app.getHttpServer())
      .get('/api/games')
      .expect(200);

    expect(response.headers).toHaveProperty('x-ratelimit-limit', '100');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining', '95');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
    expect(parseInt(response.headers['x-ratelimit-reset'])).toBeGreaterThan(
      Date.now() / 1000,
    );
  });

  it('should handle rate limiting for authenticated requests', async () => {
    mockRateLimitService.check.mockImplementation(() => {
      requestCounter += 1;
      return Promise.resolve({
        allowed: requestCounter <= 1,
        limit: 1,
        remaining: Math.max(0, 1 - requestCounter),
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    // First authenticated request should succeed
    await request(app.getHttpServer())
      .post('/api/users/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Test' })
      .expect(200);

    // Second authenticated request should be rate limited
    await request(app.getHttpServer())
      .post('/api/users/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Test' })
      .expect(429);
  });
});

describe('API Gateway - Error Handling (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => false,
        check: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
          windowMs: 60000,
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue({
        validateBearerToken: jest.fn().mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
        }),
      })
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest.fn().mockResolvedValue(''),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
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

  describe('HTTP Error Status Codes', () => {
    it('should return 400 for bad request from upstream service', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Bad Request');
        error.response = {
          status: 400,
          data: {
            message: 'Invalid request parameters',
            code: 'INVALID_PARAMS',
          },
        };
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games?invalid=param')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path', '/api/games');
    });

    it('should return 404 for not found from upstream service', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Not Found');
        error.response = {
          status: 404,
          data: { message: 'Game not found', code: 'GAME_NOT_FOUND' },
        };
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 500 for internal server error from upstream service', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Internal Server Error');
        error.response = {
          status: 500,
          data: { message: 'Database connection failed' },
        };
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(500);

      expect(response.body).toHaveProperty('statusCode', 500);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Network Error Handling', () => {
    it('should return 503 for connection refused errors', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('connect ECONNREFUSED 127.0.0.1:3002');
        error.code = 'ECONNREFUSED';
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(503);

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('error', 'SERVICE_UNAVAILABLE');
      expect(response.body.message).toContain('temporarily unavailable');
    });

    it('should return 504 for timeout errors', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('timeout of 5000ms exceeded');
        error.code = 'ECONNABORTED';
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(504);

      expect(response.body).toHaveProperty('statusCode', 504);
      expect(response.body).toHaveProperty('error', 'GATEWAY_TIMEOUT');
    });

    it('should return 502 for bad gateway errors', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Bad Gateway');
        error.response = { status: 502, data: 'Bad Gateway' };
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(502);

      expect(response.body).toHaveProperty('statusCode', 502);
    });
  });

  describe('Request Validation Errors', () => {
    it('should return 400 for invalid JSON in request body', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle large request bodies gracefully', async () => {
      const largePayload = { data: 'x'.repeat(10000) };

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { received: true },
        headers: { 'content-type': 'application/json' },
      }));

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(largePayload)
        .expect(200);
    });
  });

  describe('Error Response Format', () => {
    it('should return standardized error format', async () => {
      mockedAxios.mockImplementation(async () => {
        const error: any = new Error('Service Error');
        error.response = {
          status: 422,
          data: { message: 'Validation failed' },
        };
        throw error;
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(422);

      expect(response.body).toHaveProperty('statusCode', 422);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('path', '/api/games');
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('should include correlation ID in error responses', async () => {
      mockedAxios.mockImplementation(async () => {
        throw new Error('Service Error');
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(503);

      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.body).toHaveProperty('correlationId');
    });
  });
});

describe('API Gateway - Health Checks & Service Discovery (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockServiceRegistry: any;

  beforeAll(async () => {
    mockServiceRegistry = {
      getServiceConfig: jest.fn(),
      checkServiceHealth: jest.fn(),
      getAllServices: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => false,
        check: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
          windowMs: 60000,
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue({
        validateBearerToken: jest.fn().mockResolvedValue({
          id: 'test-user',
          email: 'test@example.com',
          roles: ['user'],
          permissions: [],
        }),
      })
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest
          .fn()
          .mockResolvedValue(
            '# HELP api_gateway_requests_total Total requests\n# TYPE api_gateway_requests_total counter\napi_gateway_requests_total 42',
          ),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
      .overrideProvider(ServiceRegistryService)
      .useValue(mockServiceRegistry)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedAxios.mockReset();
    mockServiceRegistry.getServiceConfig.mockReset();
    mockServiceRegistry.checkServiceHealth.mockReset();
    mockServiceRegistry.getAllServices.mockReset();
  });

  describe('Health Check Endpoints', () => {
    it('GET /health should return gateway health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.uptime).toBe('number');
    });

    it('GET /health/services should return all services health status', async () => {
      mockServiceRegistry.getAllServices.mockResolvedValue([
        'user-service',
        'game-catalog-service',
        'payment-service',
        'library-service',
      ]);

      mockServiceRegistry.checkServiceHealth.mockImplementation(
        (serviceName: string) => {
          const healthyServices = ['user-service', 'game-catalog-service'];
          return Promise.resolve({
            name: serviceName,
            status: healthyServices.includes(serviceName)
              ? 'healthy'
              : 'unhealthy',
            responseTime: healthyServices.includes(serviceName) ? 45 : null,
            lastCheck: new Date().toISOString(),
            error: healthyServices.includes(serviceName)
              ? null
              : 'Connection timeout',
          });
        },
      );

      const response = await request(app.getHttpServer())
        .get('/health/services')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('services');
      expect(Array.isArray(response.body.services)).toBe(true);
      expect(response.body.services).toHaveLength(4);

      const userService = response.body.services.find(
        (s: any) => s.name === 'user-service',
      );
      expect(userService).toHaveProperty('status', 'healthy');
      expect(userService).toHaveProperty('responseTime', 45);

      const paymentService = response.body.services.find(
        (s: any) => s.name === 'payment-service',
      );
      expect(paymentService).toHaveProperty('status', 'unhealthy');
      expect(paymentService).toHaveProperty('error', 'Connection timeout');
    });

    it('GET /health/services should handle service registry errors', async () => {
      mockServiceRegistry.getAllServices.mockRejectedValue(
        new Error('Registry unavailable'),
      );

      const response = await request(app.getHttpServer())
        .get('/health/services')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Metrics Endpoints', () => {
    it('GET /metrics should return Prometheus metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      expect(response.text).toContain('# HELP api_gateway_requests_total');
      expect(response.text).toContain(
        '# TYPE api_gateway_requests_total counter',
      );
      expect(response.text).toContain('api_gateway_requests_total 42');
    });

    it('GET /metrics should be accessible without authentication', async () => {
      await request(app.getHttpServer()).get('/metrics').expect(200);
    });
  });

  describe('Service Discovery', () => {
    it('should route to healthy services', async () => {
      mockServiceRegistry.getServiceConfig.mockResolvedValue({
        name: 'user-service',
        baseUrl: 'http://localhost:3000',
        timeout: 5000,
        retries: 1,
        healthCheckPath: '/health',
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        if (String(cfg.url).includes('localhost:3000')) {
          return {
            status: 200,
            data: { id: 'user-123', name: 'Test User' },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      const response = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'user-123');
      expect(mockServiceRegistry.getServiceConfig).toHaveBeenCalledWith(
        'user-service',
      );
    });

    it('should handle service discovery failures', async () => {
      mockServiceRegistry.getServiceConfig.mockRejectedValue(
        new Error('Service not found'),
      );

      await request(app.getHttpServer())
        .get('/api/unknown/endpoint')
        .expect(404);
    });

    it('should handle service configuration errors', async () => {
      mockServiceRegistry.getServiceConfig.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(503);
    });
  });

  describe('Circuit Breaker Behavior', () => {
    it('should handle repeated service failures', async () => {
      mockServiceRegistry.getServiceConfig.mockResolvedValue({
        name: 'game-catalog-service',
        baseUrl: 'http://localhost:3002',
        timeout: 1000,
        retries: 2,
        healthCheckPath: '/health',
      });

      // Simulate repeated failures
      mockedAxios.mockImplementation(async () => {
        throw new Error('Service consistently failing');
      });

      // Multiple requests should all fail with 503
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer()).get('/api/games').expect(503);
      }
    });
  });
});

describe('API Gateway - End-to-End User Scenarios (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockAuthService: any;

  beforeAll(async () => {
    mockAuthService = {
      validateBearerToken: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        isEnabled: () => false,
        check: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 100,
          remaining: 99,
          reset: Date.now() + 60000,
          windowMs: 60000,
        }),
      })
      .overrideProvider(AuthValidationService)
      .useValue(mockAuthService)
      .overrideProvider(MetricsService)
      .useValue({
        metrics: jest.fn().mockResolvedValue(''),
        incrementRequestCounter: jest.fn(),
        recordResponseTime: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedAxios.mockReset();
    mockAuthService.validateBearerToken.mockReset();
  });

  describe('Complete User Journey', () => {
    it('should handle complete game purchase flow', async () => {
      // Setup authentication
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-purchase-test',
        email: 'buyer@example.com',
        roles: ['user'],
        permissions: ['read:games', 'make:payments', 'read:library'],
      });

      // Step 1: Browse games (public)
      mockedAxios.mockImplementation(async (cfg: any) => {
        if (
          cfg.method === 'GET' &&
          String(cfg.url).includes('/games') &&
          !cfg.url.includes('user-purchase-test')
        ) {
          return {
            status: 200,
            data: {
              items: [
                {
                  id: 'game-awesome',
                  title: 'Awesome Game',
                  price: 29.99,
                  genre: 'Action',
                },
              ],
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        // Step 2: Process payment (authenticated)
        if (
          cfg.method === 'POST' &&
          String(cfg.url).includes('/payments/process')
        ) {
          return {
            status: 201,
            data: {
              id: 'payment-success',
              gameId: 'game-awesome',
              amount: 29.99,
              status: 'completed',
              userId: 'user-purchase-test',
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        // Step 3: Check library (authenticated)
        if (cfg.method === 'GET' && String(cfg.url).includes('/library')) {
          return {
            status: 200,
            data: {
              games: [
                {
                  id: 'game-awesome',
                  title: 'Awesome Game',
                  purchaseDate: new Date().toISOString(),
                },
              ],
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      // Step 1: Browse games (no auth required)
      const gamesResponse = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(gamesResponse.body.items).toHaveLength(1);
      expect(gamesResponse.body.items[0].title).toBe('Awesome Game');

      // Step 2: Purchase game (auth required)
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/payments/process')
        .set('Authorization', 'Bearer user-token')
        .send({ gameId: 'game-awesome', amount: 29.99, currency: 'USD' })
        .expect(201);

      expect(paymentResponse.body.status).toBe('completed');
      expect(paymentResponse.body.gameId).toBe('game-awesome');

      // Step 3: Check library (auth required)
      const libraryResponse = await request(app.getHttpServer())
        .get('/api/library')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(libraryResponse.body.games).toHaveLength(1);
      expect(libraryResponse.body.games[0].id).toBe('game-awesome');
    });

    it('should handle user profile management flow', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-profile-test',
        email: 'profile@example.com',
        roles: ['user'],
        permissions: ['read:profile', 'write:profile'],
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        if (
          cfg.method === 'GET' &&
          String(cfg.url).includes('/users/profile')
        ) {
          return {
            status: 200,
            data: {
              id: 'user-profile-test',
              email: 'profile@example.com',
              name: 'Original Name',
              avatar: null,
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        if (
          cfg.method === 'PUT' &&
          String(cfg.url).includes('/users/profile')
        ) {
          return {
            status: 200,
            data: {
              id: 'user-profile-test',
              email: 'profile@example.com',
              name: 'Updated Name',
              avatar: 'new-avatar.jpg',
            },
            headers: { 'content-type': 'application/json' },
          };
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      // Get current profile
      const profileResponse = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer profile-token')
        .expect(200);

      expect(profileResponse.body.name).toBe('Original Name');

      // Update profile
      const updateResponse = await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', 'Bearer profile-token')
        .send({ name: 'Updated Name', avatar: 'new-avatar.jpg' })
        .expect(200);

      expect(updateResponse.body.name).toBe('Updated Name');
      expect(updateResponse.body.avatar).toBe('new-avatar.jpg');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle partial service failures gracefully', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'user-resilience-test',
        email: 'resilient@example.com',
        roles: ['user'],
        permissions: ['read:games', 'read:library'],
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        // Game service works
        if (String(cfg.url).includes('game-catalog-service')) {
          return {
            status: 200,
            data: { items: [{ id: 'game-1', title: 'Working Game' }] },
            headers: { 'content-type': 'application/json' },
          };
        }
        // Library service fails
        if (String(cfg.url).includes('library-service')) {
          throw new Error('Library service down');
        }
        throw new Error('Unexpected request: ' + cfg.url);
      });

      // Game service should work
      await request(app.getHttpServer()).get('/api/games').expect(200);

      // Library service should fail gracefully
      await request(app.getHttpServer())
        .get('/api/library')
        .set('Authorization', 'Bearer resilience-token')
        .expect(503);
    });
  });
});
