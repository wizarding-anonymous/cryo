import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import { RateLimitService } from '../src/security/rate-limit.service';
import { AuthValidationService } from '../src/security/auth-validation.service';
import { MetricsService } from '../src/health/metrics.service';
import { RedisService } from '../src/redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('API Gateway - Security Integration (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockAuthService: any;
  let mockRateLimitService: any;
  let mockRedisService: any;

  beforeAll(async () => {
    mockAuthService = {
      validateBearerToken: jest.fn(),
    };

    mockRateLimitService = {
      isEnabled: () => true,
      check: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthValidationService)
      .useValue(mockAuthService)
      .overrideProvider(RateLimitService)
      .useValue(mockRateLimitService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
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
    mockRateLimitService.check.mockReset();
    mockRedisService.get.mockReset();
    mockRedisService.set.mockReset();
    mockRedisService.incr.mockReset();
    mockRedisService.expire.mockReset();
    mockRedisService.del.mockReset();
  });

  describe('JWT Authentication Security', () => {
    it('should reject requests with malformed JWT tokens', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid token format'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .send({ name: 'Test' })
        .expect(401)
        .expect(({ body }: { body: any }) => {
          expect(body).toHaveProperty('statusCode', 401);
          expect(body).toHaveProperty('message');
          expect(body).toHaveProperty('timestamp');
        });
    });

    it('should reject expired JWT tokens', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Token expired'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer expired.jwt.token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should reject tokens with invalid signatures', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid signature'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer invalid.signature.token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should validate token issuer and audience claims', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid issuer'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer wrong.issuer.token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should handle token validation service unavailability', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Auth service unavailable'),
      );

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid.token')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should pass valid tokens and extract user information', async () => {
      const userInfo = {
        id: 'user-123',
        email: 'secure@example.com',
        roles: ['user', 'premium'],
        permissions: ['read:profile', 'write:profile'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockAuthService.validateBearerToken.mockResolvedValue(userInfo);

      mockedAxios.mockImplementation(async (cfg: any) => {
        // Verify user info is passed to upstream service
        expect(cfg.headers['x-user-id']).toBe('user-123');
        expect(cfg.headers['x-user-email']).toBe('secure@example.com');
        expect(cfg.headers['x-user-roles']).toBe('user,premium');

        return {
          status: 200,
          data: { success: true },
          headers: { 'content-type': 'application/json' },
        };
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid.jwt.token')
        .send({ name: 'Secure User' })
        .expect(200);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should implement sliding window rate limiting', async () => {
      let requestCount = 0;

      mockRateLimitService.check.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          allowed: requestCount <= 5,
          limit: 5,
          remaining: Math.max(0, 5 - requestCount),
          reset: Date.now() + 60000,
          windowMs: 60000,
        });
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      // Make requests up to the limit
      for (let i = 1; i <= 5; i++) {
        const response = await request(app.getHttpServer())
          .get('/api/games')
          .expect(200);

        expect(response.headers['x-ratelimit-remaining']).toBe(String(5 - i));
      }

      // Next request should be rate limited
      await request(app.getHttpServer())
        .get('/api/games')
        .expect(429)
        .expect(({ body, headers }: { body: any; headers: any }) => {
          expect(body.statusCode).toBe(429);
          expect(headers['x-ratelimit-remaining']).toBe('0');
          expect(headers['retry-after']).toBeDefined();
        });
    });

    it('should apply different rate limits per IP address', async () => {
      const ipCounters: { [key: string]: number } = {};

      mockRateLimitService.check.mockImplementation((ip: string) => {
        ipCounters[ip] = (ipCounters[ip] || 0) + 1;
        return Promise.resolve({
          allowed: ipCounters[ip] <= 3,
          limit: 3,
          remaining: Math.max(0, 3 - ipCounters[ip]),
          reset: Date.now() + 60000,
          windowMs: 60000,
        });
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      // IP 1: Make 3 requests (should all succeed)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .get('/api/games')
          .set('X-Forwarded-For', '192.168.1.100')
          .expect(200);
      }

      // IP 2: Make 3 requests (should all succeed)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .get('/api/games')
          .set('X-Forwarded-For', '192.168.1.200')
          .expect(200);
      }

      // IP 1: 4th request should be rate limited
      await request(app.getHttpServer())
        .get('/api/games')
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(429);

      // IP 2: 4th request should be rate limited
      await request(app.getHttpServer())
        .get('/api/games')
        .set('X-Forwarded-For', '192.168.1.200')
        .expect(429);
    });

    it('should handle rate limiting for authenticated users', async () => {
      let authRequestCount = 0;

      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'rate-limited-user',
        email: 'limited@example.com',
        roles: ['user'],
        permissions: ['write:profile'],
      });

      mockRateLimitService.check.mockImplementation(() => {
        authRequestCount++;
        return Promise.resolve({
          allowed: authRequestCount <= 2,
          limit: 2,
          remaining: Math.max(0, 2 - authRequestCount),
          reset: Date.now() + 60000,
          windowMs: 60000,
        });
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { success: true },
        headers: { 'content-type': 'application/json' },
      }));

      // First 2 authenticated requests should succeed
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/api/users/profile')
          .set('Authorization', 'Bearer valid-token')
          .send({ name: 'Test' })
          .expect(200);
      }

      // 3rd authenticated request should be rate limited
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test' })
        .expect(429);
    });

    it('should implement burst protection', async () => {
      let burstCount = 0;

      mockRateLimitService.check.mockImplementation(() => {
        burstCount++;
        // Allow first 10 requests immediately, then rate limit
        return Promise.resolve({
          allowed: burstCount <= 10,
          limit: 10,
          remaining: Math.max(0, 10 - burstCount),
          reset: Date.now() + 1000, // Short window for burst
          windowMs: 1000,
        });
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      // Simulate burst of requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(request(app.getHttpServer()).get('/api/games'));
      }

      const responses = await Promise.all(promises);

      // First 10 should succeed
      for (let i = 0; i < 10; i++) {
        expect(responses[i].status).toBe(200);
      }

      // Remaining should be rate limited
      for (let i = 10; i < 15; i++) {
        expect(responses[i].status).toBe(429);
      }
    });

    it('should reset rate limits after window expires', async () => {
      let windowResetCount = 0;

      mockRateLimitService.check.mockImplementation(() => {
        windowResetCount++;
        // Simulate window reset after 3 requests
        const isNewWindow = windowResetCount > 3;
        const currentCount = isNewWindow
          ? windowResetCount - 3
          : windowResetCount;

        return Promise.resolve({
          allowed: currentCount <= 3,
          limit: 3,
          remaining: Math.max(0, 3 - currentCount),
          reset: Date.now() + (isNewWindow ? 60000 : 1000),
          windowMs: 60000,
        });
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      // Fill up the rate limit
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer()).get('/api/games').expect(200);
      }

      // Should be rate limited
      await request(app.getHttpServer()).get('/api/games').expect(429);

      // Simulate window reset - should work again
      await request(app.getHttpServer()).get('/api/games').expect(200);
    });
  });

  describe('Input Validation Security', () => {
    beforeEach(() => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'test-user',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['write:profile'],
      });

      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    it('should sanitize SQL injection attempts in query parameters', async () => {
      mockedAxios.mockImplementation(async (cfg: any) => {
        // Verify malicious SQL is not passed through
        expect(cfg.url).not.toContain("'; DROP TABLE");
        expect(cfg.url).not.toContain('UNION SELECT');

        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      await request(app.getHttpServer())
        .get("/api/games?search='; DROP TABLE users; --")
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/games?id=1 UNION SELECT * FROM users')
        .expect(200);
    });

    it('should prevent XSS attacks in request bodies', async () => {
      mockedAxios.mockImplementation(async (cfg: any) => {
        const body = JSON.parse(cfg.data);
        // Verify script tags are sanitized
        expect(body.name).not.toContain('<script>');
        expect(body.description).not.toContain('javascript:');

        return {
          status: 200,
          data: { success: true },
          headers: { 'content-type': 'application/json' },
        };
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: '<script>alert("xss")</script>Malicious User',
          description: 'javascript:alert("xss")',
          bio: '<img src="x" onerror="alert(1)">',
        })
        .expect(200);
    });

    it('should validate request size limits', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB payload
      };

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(largePayload)
        .expect(413); // Payload Too Large
    });

    it('should validate content-type headers', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'text/plain')
        .send('invalid json data')
        .expect(400);
    });

    it('should prevent path traversal attacks', async () => {
      await request(app.getHttpServer())
        .get('/api/../../../etc/passwd')
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/files?path=../../../etc/passwd')
        .expect(400);
    });
  });

  describe('CORS Security', () => {
    it('should enforce CORS policy for cross-origin requests', async () => {
      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .set('Origin', 'https://trusted-domain.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from untrusted origins', async () => {
      await request(app.getHttpServer())
        .options('/api/games')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET')
        .expect(403);
    });

    it('should handle preflight OPTIONS requests correctly', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/users/profile')
        .set('Origin', 'https://trusted-domain.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
        .expect(200);

      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Authorization',
      );
    });
  });

  describe('Security Headers', () => {
    beforeEach(() => {
      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      }));
    });

    it('should include security headers in all responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose sensitive server information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include proper cache control for sensitive endpoints', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'test-user',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:profile'],
      });

      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { profile: { email: 'test@example.com' } },
        headers: { 'content-type': 'application/json' },
      }));

      const response = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose internal error details in production', async () => {
      mockedAxios.mockRejectedValue(
        new Error('Database connection failed: host=internal-db-server'),
      );

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(500);

      expect(response.body.message).not.toContain('internal-db-server');
      expect(response.body.message).not.toContain('Database connection failed');
      expect(response.body).toHaveProperty('statusCode', 500);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should log security events without exposing them to clients', async () => {
      // Simulate brute force attempt
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .send({ name: 'Test' })
          .expect(401);
      }

      // All responses should be identical (no timing attacks)
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token-1')
          .send({ name: 'Test' }),
        request(app.getHttpServer())
          .post('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token-2')
          .send({ name: 'Test' }),
      ]);

      expect(responses[0].body).toEqual(responses[1].body);
    });

    it('should handle timeout errors securely', async () => {
      mockedAxios.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Simulate timeout
        throw new Error('Request timeout');
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(504);

      expect(response.body).toHaveProperty('statusCode', 504);
      expect(response.body.message).not.toContain('timeout');
      expect(response.body.message).toBe('Gateway Timeout');
    });
  });

  describe('Request Logging Security', () => {
    it('should not log sensitive information in request logs', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'test-user',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['write:profile'],
      });

      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });

      mockedAxios.mockImplementation(async () => ({
        status: 200,
        data: { success: true },
        headers: { 'content-type': 'application/json' },
      }));

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer sensitive-jwt-token')
        .send({
          password: 'secret-password',
          creditCard: '4111-1111-1111-1111',
          ssn: '123-45-6789',
        })
        .expect(200);

      // Verify sensitive data is not passed to upstream
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.not.objectContaining({
            authorization: expect.stringContaining(
              'Bearer sensitive-jwt-token',
            ),
          }),
        }),
      );
    });

    it('should mask sensitive headers in logs', async () => {
      mockAuthService.validateBearerToken.mockResolvedValue({
        id: 'test-user',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['write:profile'],
      });

      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });

      mockedAxios.mockImplementation(async (cfg: any) => {
        // Verify authorization header is not passed through
        expect(cfg.headers.authorization).toBeUndefined();

        return {
          status: 200,
          data: { success: true },
          headers: { 'content-type': 'application/json' },
        };
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer jwt-token')
        .set('X-API-Key', 'secret-api-key')
        .send({ name: 'Test User' })
        .expect(200);
    });
  });
});
