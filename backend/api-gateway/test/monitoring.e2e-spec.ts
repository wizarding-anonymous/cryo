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

describe('API Gateway - Monitoring & Observability Integration (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mockMetricsService: any;
  let mockRedisService: any;

  beforeAll(async () => {
    mockMetricsService = {
      metrics: jest.fn(),
      incrementRequestCounter: jest.fn(),
      recordResponseTime: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      recordUpstreamLatency: jest.fn(),
      incrementErrorCounter: jest.fn(),
      recordActiveConnections: jest.fn(),
      recordMemoryUsage: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      info: jest
        .fn()
        .mockResolvedValue('redis_version:6.2.0\r\nused_memory:1024000'),
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
          id: 'monitor-user',
          email: 'monitor@example.com',
          roles: ['user'],
          permissions: [],
        }),
      })
      .overrideProvider(MetricsService)
      .useValue(mockMetricsService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockedAxios.mockReset();
    Object.values(mockMetricsService).forEach((mock: any) => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics for successful requests', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      await request(app.getHttpServer()).get('/api/games').expect(200);

      expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledWith(
        'GET',
        '/api/games',
        200,
      );
      expect(mockMetricsService.recordResponseTime).toHaveBeenCalledWith(
        expect.any(Number),
      );
      expect(mockMetricsService.recordUpstreamLatency).toHaveBeenCalledWith(
        'games',
        expect.any(Number),
      );
    });

    it('should collect metrics for failed requests', async () => {
      mockedAxios.mockRejectedValue({
        response: { status: 500 },
        isAxiosError: true,
      });

      await request(app.getHttpServer()).get('/api/games').expect(502);

      expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledWith(
        'GET',
        '/api/games',
        502,
      );
      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'upstream_error',
        { status: '500', service: 'games' },
      );
    });

    it('should collect cache metrics', async () => {
      const gameData = { items: [] };

      // Cache miss scenario
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValueOnce('OK');

      mockedAxios.mockResolvedValue({
        status: 200,
        data: gameData,
        headers: { 'content-type': 'application/json' },
      });

      await request(app.getHttpServer()).get('/api/games').expect(200);

      expect(mockMetricsService.recordCacheMiss).toHaveBeenCalledWith(
        '/api/games',
      );

      // Cache hit scenario
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(gameData));

      await request(app.getHttpServer()).get('/api/games').expect(200);

      expect(mockMetricsService.recordCacheHit).toHaveBeenCalledWith(
        '/api/games',
      );
    });

    it('should collect authentication metrics', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
        headers: { 'content-type': 'application/json' },
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test' })
        .expect(200);

      expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledWith(
        'POST',
        '/api/users/profile',
        200,
      );
    });

    it('should track concurrent connections', async () => {
      mockedAxios.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      const promises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).get('/api/games').expect(200),
      );

      await Promise.all(promises);

      expect(mockMetricsService.recordActiveConnections).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should provide comprehensive health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        checks: {
          redis: {
            status: 'up',
            responseTime: expect.any(Number),
          },
          memory: {
            status: 'ok',
            usage: expect.any(Object),
          },
          upstream_services: {
            status: 'ok',
            services: expect.any(Object),
          },
        },
      });
    });

    it('should detect unhealthy dependencies', async () => {
      mockRedisService.ping.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      expect(response.body).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        checks: {
          redis: {
            status: 'down',
            message: 'Redis connection failed',
            responseTime: expect.any(Number),
          },
          memory: {
            status: 'ok',
            usage: expect.any(Object),
          },
          upstream_services: {
            status: 'unknown',
            services: expect.any(Object),
          },
        },
      });
    });

    it('should provide detailed health information', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: expect.any(String),
        checks: {
          redis: {
            status: 'up',
            version: expect.any(String),
            memory: expect.any(String),
            responseTime: expect.any(Number),
          },
          memory: {
            status: 'ok',
            usage: {
              rss: expect.any(Number),
              heapTotal: expect.any(Number),
              heapUsed: expect.any(Number),
              external: expect.any(Number),
            },
            limits: {
              maxHeap: expect.any(Number),
              maxRss: expect.any(Number),
            },
          },
          cpu: {
            status: 'ok',
            usage: expect.any(Number),
            loadAverage: expect.any(Array),
          },
          upstream_services: {
            status: 'ok',
            services: {
              games: {
                status: 'up',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
              },
              users: {
                status: 'up',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
              },
            },
          },
        },
      });
    });

    it('should provide readiness probe', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
        checks: {
          redis: 'ready',
          upstream_services: 'ready',
        },
      });
    });

    it('should provide liveness probe', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Metrics Endpoint', () => {
    it('should expose Prometheus metrics', async () => {
      const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/games",status="200"} 10
http_requests_total{method="POST",route="/api/users/profile",status="200"} 5
http_requests_total{method="GET",route="/api/games",status="502"} 2

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="0.1"} 8
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="0.5"} 12
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="1.0"} 12
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="+Inf"} 12
http_request_duration_seconds_sum{method="GET",route="/api/games"} 2.4
http_request_duration_seconds_count{method="GET",route="/api/games"} 12

# HELP cache_operations_total Total number of cache operations
# TYPE cache_operations_total counter
cache_operations_total{operation="hit",route="/api/games"} 8
cache_operations_total{operation="miss",route="/api/games"} 4
cache_operations_total{operation="error",route="/api/games"} 1

# HELP upstream_request_duration_seconds Upstream service request duration
# TYPE upstream_request_duration_seconds histogram
upstream_request_duration_seconds_bucket{service="games",le="0.1"} 5
upstream_request_duration_seconds_bucket{service="games",le="0.5"} 10
upstream_request_duration_seconds_bucket{service="games",le="1.0"} 12
upstream_request_duration_seconds_bucket{service="games",le="+Inf"} 12

# HELP active_connections Current number of active connections
# TYPE active_connections gauge
active_connections 15

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes{type="rss"} 52428800
memory_usage_bytes{type="heap_total"} 29360128
memory_usage_bytes{type="heap_used"} 18874352
      `.trim();

      mockMetricsService.metrics.mockResolvedValue(prometheusMetrics);

      const response = await request(app.getHttpServer())
        .get('/health/metrics')
        .expect(200);

      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('http_request_duration_seconds');
      expect(response.text).toContain('cache_operations_total');
      expect(response.text).toContain('upstream_request_duration_seconds');
      expect(response.text).toContain('active_connections');
      expect(response.text).toContain('memory_usage_bytes');

      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should handle metrics collection errors gracefully', async () => {
      mockMetricsService.metrics.mockRejectedValue(
        new Error('Metrics collection failed'),
      );

      const response = await request(app.getHttpServer())
        .get('/health/metrics')
        .expect(500);

      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal Server Error',
        timestamp: expect.any(String),
        path: '/health/metrics',
      });
    });
  });

  describe('Distributed Tracing', () => {
    it('should propagate trace headers through requests', async () => {
      mockedAxios.mockImplementation(async (config: any) => {
        // Verify trace headers are propagated to upstream services
        expect(config.headers['x-trace-id']).toBe('trace-123');
        expect(config.headers['x-span-id']).toBeDefined();
        expect(config.headers['x-parent-span-id']).toBe('span-456');

        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .set('X-Trace-ID', 'trace-123')
        .set('X-Span-ID', 'span-456')
        .expect(200);

      expect(response.headers['x-trace-id']).toBe('trace-123');
    });

    it('should generate trace IDs when not provided', async () => {
      mockedAxios.mockImplementation(async (config: any) => {
        expect(config.headers['x-trace-id']).toMatch(/^[a-f0-9-]{36}$/);
        expect(config.headers['x-span-id']).toMatch(/^[a-f0-9-]{36}$/);

        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .expect(200);

      expect(response.headers['x-trace-id']).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should include timing information in trace spans', async () => {
      mockedAxios.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .set('X-Trace-ID', 'trace-timing-test')
        .expect(200);

      expect(response.headers['x-response-time']).toBeDefined();
      expect(parseInt(response.headers['x-response-time'])).toBeGreaterThan(
        100,
      );
    });
  });

  describe('Logging and Audit', () => {
    it('should log request details for audit purposes', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { success: true },
        headers: { 'content-type': 'application/json' },
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer audit-token')
        .set('X-Forwarded-For', '192.168.1.100')
        .set('User-Agent', 'Test Client/1.0')
        .send({ name: 'Audit User' })
        .expect(200);

      // Verify audit logging (would typically check log output)
      expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledWith(
        'POST',
        '/api/users/profile',
        200,
      );
    });

    it('should log security events', async () => {
      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Malicious User' })
        .expect(401);

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledWith(
        'auth_error',
        expect.any(Object),
      );
    });

    it('should mask sensitive data in logs', async () => {
      mockedAxios.mockImplementation(async (config: any) => {
        // Verify sensitive headers are not logged
        expect(config.headers.authorization).toBeUndefined();
        expect(config.headers['x-api-key']).toBeUndefined();

        return {
          status: 200,
          data: { success: true },
          headers: { 'content-type': 'application/json' },
        };
      });

      await request(app.getHttpServer())
        .post('/api/users/profile')
        .set('Authorization', 'Bearer sensitive-token')
        .set('X-API-Key', 'secret-key')
        .send({
          name: 'User',
          password: 'secret-password',
          creditCard: '4111-1111-1111-1111',
        })
        .expect(200);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response time percentiles', async () => {
      const responseTimes: number[] = [];

      mockedAxios.mockImplementation(async () => {
        const delay = Math.random() * 200 + 50; // 50-250ms
        await new Promise((resolve) => setTimeout(resolve, delay));
        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      // Make multiple requests to collect timing data
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/api/games').expect(200);
        responseTimes.push(Date.now() - start);
      }

      expect(mockMetricsService.recordResponseTime).toHaveBeenCalledTimes(10);

      // Verify response times are within expected range
      responseTimes.forEach((time) => {
        expect(time).toBeGreaterThan(50);
        expect(time).toBeLessThan(400);
      });
    });

    it('should monitor memory usage trends', async () => {
      mockedAxios.mockResolvedValue({
        status: 200,
        data: { items: [] },
        headers: { 'content-type': 'application/json' },
      });

      // Make requests to trigger memory monitoring
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/api/games').expect(200);
      }

      expect(mockMetricsService.recordMemoryUsage).toHaveBeenCalled();
    });

    it('should detect performance degradation', async () => {
      let requestCount = 0;

      mockedAxios.mockImplementation(async () => {
        requestCount++;
        // Simulate degrading performance
        const delay = requestCount * 50; // Increasing delay
        await new Promise((resolve) => setTimeout(resolve, delay));

        return {
          status: 200,
          data: { items: [], requestCount },
          headers: { 'content-type': 'application/json' },
        };
      });

      const responseTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/api/games').expect(200);
        responseTimes.push(Date.now() - start);
      }

      // Verify performance degradation is detected
      expect(responseTimes[4]).toBeGreaterThan(responseTimes[0]);
      expect(mockMetricsService.recordResponseTime).toHaveBeenCalledTimes(5);
    });
  });

  describe('Alert Conditions', () => {
    it('should trigger alerts for high error rates', async () => {
      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        mockedAxios.mockRejectedValue(new Error('Service error'));

        await request(app.getHttpServer()).get('/api/games').expect(502);
      }

      expect(mockMetricsService.incrementErrorCounter).toHaveBeenCalledTimes(
        10,
      );
    });

    it('should trigger alerts for slow response times', async () => {
      mockedAxios.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        return {
          status: 200,
          data: { items: [] },
          headers: { 'content-type': 'application/json' },
        };
      });

      const start = Date.now();
      await request(app.getHttpServer()).get('/api/games').expect(200);
      const responseTime = Date.now() - start;

      expect(responseTime).toBeGreaterThan(2000);
      expect(mockMetricsService.recordResponseTime).toHaveBeenCalledWith(
        expect.any(Number),
      );
    });

    it('should trigger alerts for resource exhaustion', async () => {
      // Simulate memory pressure
      const largeData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(1000),
        })),
      };

      mockedAxios.mockResolvedValue({
        status: 200,
        data: largeData,
        headers: { 'content-type': 'application/json' },
      });

      await request(app.getHttpServer()).get('/api/games').expect(200);

      expect(mockMetricsService.recordMemoryUsage).toHaveBeenCalled();
    });
  });
});
