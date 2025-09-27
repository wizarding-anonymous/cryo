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

describe('API Gateway - Error Handling Integration (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockAuthService: any;
  let mockRateLimitService: any;
  let mockRedisService: any;
  let mockMetricsService: any;

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
      del: jest.fn(),
      ping: jest.fn(),
    };

    mockMetricsService = {
      metrics: jest.fn().mockResolvedValue(''),
      incrementRequestCounter: jest.fn(),
      recordResponseTime: jest.fn(),
      incrementErrorCounter: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthValidationService)
      .useValue(mockAuthService)
      .overrideProvider(RateLimitService)
      .useValue(mockRateLimitService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(MetricsService)
      .useValue(mockMetricsService)
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
    mockRedisService.del.mockReset();
    mockRedisService.ping.mockReset();
    mockMetricsService.incrementErrorCounter.mockReset();
  });

  describe('Upstream Service Errors', () => {
    beforeEach(() => {
      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    it('should handle 404 errors from upstream services', async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Game not found' },
          headers: { 'content-type': 'application/json' },
        },
        isAxiosError: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games/999')
        .expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Not Found',
        timestamp: expect.any(String),
        path: '/api/games/999',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'upstream_error',
        { status: '404', service: 'games' },
      );
    });

    it('should handle 500 errors from upstream services', async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
            stack: 'Error stack trace...',
          },
          headers: { 'content-type': 'application/json' },
        },
        isAxiosError: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        message: 'Bad Gateway',
        timestamp: expect.any(String),
        path: '/api/games',
      });

      // Should not expose internal error details
      expect(response.body.message).not.toContain('stack trace');
      expect(response.body).not.toHaveProperty('stack');
    });

    it('should handle network timeout errors', async () => {
      mockedAxios.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
        isAxiosError: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(504);

      expect(response.body).toEqual({
        statusCode: 504,
        message: 'Gateway Timeout',
        timestamp: expect.any(String),
        path: '/api/games',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'timeout_error',
        { service: 'games' },
      );
    });

    it('should handle connection refused errors', async () => {
      mockedAxios.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:3001',
        isAxiosError: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(503);

      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Service Unavailable',
        timestamp: expect.any(String),
        path: '/api/games',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'connection_error',
        { service: 'games' },
      );
    });

    it('should handle malformed JSON responses from upstream', async () => {
      mockedAxios.mockRejectedValue({
        response: {
          status: 200,
          data: 'invalid json{',
          headers: { 'content-type': 'application/json' },
        },
        isAxiosError: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        message: 'Bad Gateway',
        timestamp: expect.any(String),
        path: '/api/games',
      });
    });

    it('should handle upstream service returning non-JSON content', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: '<html><body>Error page</body></html>',
        headers: { 'content-type': 'text/html' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(502);

      expect(response.body).toEqual({
        statusCode: 502,
        message: 'Bad Gateway',
        timestamp: expect.any(String),
        path: '/api/games',
      });
    });
  });

  describe('Authentication Errors', () => {
    beforeEach(() => {
      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .send({ name: 'Test User' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'auth_error',
        { type: 'missing_token' },
      );
    });

    it('should handle invalid authorization header format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'InvalidFormat token')
        .send({ name: 'Test User' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });
    });

    it('should handle JWT validation service errors', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('JWT validation service unavailable'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test User' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'auth_service_error',
        { service: 'jwt_validation' },
      );
    });

    it('should handle expired JWT tokens', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Token expired'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer expired-token')
        .send({ name: 'Test User' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });
    });

    it('should handle JWT signature validation errors', async () => {
      mockAuthService.validateBearerToken.mockRejectedValue(
        new Error('Invalid signature'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer tampered-token')
        .send({ name: 'Test User' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });
    });
  });

  describe('Rate Limiting Errors', () => {
    it('should handle rate limit exceeded errors', async () => {
      mockRateLimitService.check.mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(429);

      expect(response.body).toEqual({
        statusCode: 429,
        message: 'Too Many Requests',
        timestamp: expect.any(String),
        path: '/api/games',
      });

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
      expect(response.headers['retry-after']).toBeDefined();

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        { limit: '10' },
      );
    });

    it('should handle rate limiting service errors', async () => {
      mockRateLimitService.check.mockRejectedValue(
        new Error('Rate limiting service unavailable'),
      );

      // Should allow request to proceed when rate limiting fails
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'rate_limit_service_error',
        { service: 'rate_limiter' },
      );
    });

    it('should handle Redis connection errors in rate limiting', async () => {
      mockRateLimitService.check.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      // Should log the error but not fail the request
    });
  });

  describe('Cache Service Errors', () => {
    beforeEach(() => {
      mockRateLimitService.check.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
        windowMs: 60000,
      });
    });

    it('should handle Redis cache read errors gracefully', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis read failed'));
      mockRedisService.set.mockResolvedValue('OK');

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(response.headers['x-cache']).toBe('ERROR');

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'cache_error',
        { operation: 'read', service: 'redis' },
      );
    });

    it('should handle Redis cache write errors gracefully', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockRejectedValue(new Error('Redis write failed'));

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(response.headers['x-cache']).toBe('MISS');

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'cache_error',
        { operation: 'write', service: 'redis' },
      );
    });

    it('should handle corrupted cache data', async () => {
      mockRedisService.get.mockResolvedValue('invalid-json{');
      mockRedisService.set.mockResolvedValue('OK');

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(response.headers['x-cache']).toBe('ERROR');

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'cache_error',
        { operation: 'deserialize', service: 'redis' },
      );
    });

    it('should handle cache service complete unavailability', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis unavailable'));
      mockRedisService.set.mockRejectedValue(new Error('Redis unavailable'));
      mockRedisService.ping.mockRejectedValue(new Error('Redis unavailable'));

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(response.headers['x-cache']).toBe('ERROR');
    });
  });

  describe('Request Validation Errors', () => {
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

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'validation_error',
        { type: 'malformed_json' },
      );
    });

    it('should handle oversized request payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB
      };

      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(largePayload)
        .expect(413);

      expect(response.body).toEqual({
        statusCode: 413,
        message: 'Payload Too Large',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'validation_error',
        { type: 'payload_too_large' },
      );
    });

    it('should handle unsupported content types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'text/plain')
        .send('plain text data')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/users/profile',
      });
    });

    it('should handle missing required query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games/search') // Assuming this requires a 'q' parameter
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/games/search',
      });
    });

    it('should handle invalid query parameter values', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/games?page=invalid&limit=abc')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/games',
      });
    });
  });

  describe('Circuit Breaker Errors', () => {
    it('should handle circuit breaker open state', async () => {
      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        mockedAxios.mockRejectedValue(new Error('Service unavailable'));

        await request(app.getHttpServer()).get('/api/games').expect(502);
      }

      // Circuit breaker should now be open
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(503);

      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Service Unavailable',
        timestamp: expect.any(String),
        path: '/api/games',
      });

      expect(response.headers['x-circuit-breaker']).toBe('OPEN');

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'circuit_breaker_open',
        { service: 'games' },
      );
    });

    it('should handle circuit breaker half-open state', async () => {
      // Simulate circuit breaker in half-open state
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body).toEqual({ items: [] });
      expect(response.headers['x-circuit-breaker']).toBe('HALF_OPEN');
    });
  });

  describe('Health Check Errors', () => {
    it('should handle health check failures gracefully', async () => {
      mockRedisService.ping.mockRejectedValue(
        new Error('Redis health check failed'),
      );

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      expect(response.body).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        checks: {
          redis: {
            status: 'down',
            message: expect.any(String),
          },
        },
      });
    });

    it('should handle partial service degradation', async () => {
      mockRedisService.ping.mockResolvedValue('PONG');

      // Mock upstream service health check failure
      mockedAxios.mockRejectedValue(new Error('Games service unavailable'));

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'degraded',
        timestamp: expect.any(String),
        checks: {
          redis: {
            status: 'up',
          },
          upstream_services: {
            status: 'degraded',
            services: {
              games: 'down',
              users: 'unknown',
            },
          },
        },
      });
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error format for all error types', async () => {
      const errorScenarios = [
        {
          setup: () => {
            mockedAxios.mockRejectedValue({
              response: { status: 404 },
              isAxiosError: true,
            });
          },
          request: () => request(app.getHttpServer()).get('/api/games/999'),
          expectedStatus: 404,
        },
        {
          setup: () => {
            mockAuthService.validateBearerToken.mockRejectedValue(
              new Error('Invalid token'),
            );
          },
          request: () =>
            request(app.getHttpServer())
              .post('/api/users/profile')
              .set('Authorization', 'Bearer invalid')
              .send({}),
          expectedStatus: 401,
        },
        {
          setup: () => {
            mockRateLimitService.check.mockResolvedValue({
              allowed: false,
              limit: 10,
              remaining: 0,
              reset: Date.now() + 60000,
              windowMs: 60000,
            });
          },
          request: () => request(app.getHttpServer()).get('/api/games'),
          expectedStatus: 429,
        },
      ];

      for (const scenario of errorScenarios) {
        scenario.setup();

        const response = await scenario
          .request()
          .expect(scenario.expectedStatus);

        // All error responses should have consistent structure
        expect(response.body).toHaveProperty(
          'statusCode',
          scenario.expectedStatus,
        );
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('path');

        // Should not expose internal details
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('details');
      }
    });

    it('should include correlation IDs in error responses', async () => {
      mockedAxios.mockRejectedValue(new Error('Service error'));

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .set('X-Correlation-ID', 'test-correlation-123')
        .expect(502);

      expect(response.body).toHaveProperty(
        'correlationId',
        'test-correlation-123',
      );
      expect(response.headers['x-correlation-id']).toBe('test-correlation-123');
    });

    it('should generate correlation IDs when not provided', async () => {
      mockedAxios.mockRejectedValue(new Error('Service error'));

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(502);

      expect(response.body).toHaveProperty('correlationId');
      expect(response.body.correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
      expect(response.headers['x-correlation-id']).toBe(
        response.body.correlationId,
      );
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary upstream failures', async () => {
      let requestCount = 0;

      mockedAxios.mockImplementation(async () => {
        requestCount++;

        if (requestCount <= 2) {
          throw new Error('Temporary failure');
        }

        return {
          status: 200,
          data: { items: [], recovered: true },
          headers: { 'content-type': 'application/json' },
        };
      });

      // First two requests should fail
      await request(app.getHttpServer()).get('/api/games').expect(502);
      await request(app.getHttpServer()).get('/api/games').expect(502);

      // Third request should succeed
      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body.recovered).toBe(true);
    });

    it('should handle graceful degradation when cache is unavailable', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Cache unavailable'));
      mockRedisService.set.mockRejectedValue(new Error('Cache unavailable'));

      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [], fromUpstream: true },
        headers: { 'content-type': 'application/json' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.body.fromUpstream).toBe(true);
      expect(response.headers['x-cache']).toBe('ERROR');

      // Service should continue to work without cache
    });
  });
});
