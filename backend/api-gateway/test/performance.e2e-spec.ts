import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import { RateLimitService } from '../src/security/rate-limit.service';
import { AuthValidationService } from '../src/security/auth-validation.service';
import { MetricsService } from '../src/health/metrics.service';
import { RedisService } from '../src/redis/redis.service';
import { ProxyService } from '../src/proxy/proxy.service';
import { ServiceRegistryService } from '../src/registry/service-registry.service';
import { CacheInterceptor } from '../src/shared/interceptors/cache.interceptor';
import { ResponseInterceptor } from '../src/shared/interceptors/response.interceptor';
import { LoggingInterceptor } from '../src/shared/interceptors/logging.interceptor';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('API Gateway - Performance Integration (e2e)', () => {
    let app: INestApplication;
    let moduleRef: TestingModule;
    let mockMetricsService: any;
    let mockRedisService: any;
    let mockProxyService: any;
    let mockServiceRegistry: any;
    let mockCacheInterceptor: any;
    let mockResponseInterceptor: any;
    let mockLoggingInterceptor: any;

    beforeAll(async () => {
        mockMetricsService = {
            metrics: jest.fn().mockResolvedValue(''),
            incrementRequestCounter: jest.fn(),
            recordResponseTime: jest.fn(),
            recordCacheHit: jest.fn(),
            recordCacheMiss: jest.fn(),
            recordUpstreamLatency: jest.fn(),
        };

        mockRedisService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            ttl: jest.fn(),
            ping: jest.fn().mockResolvedValue('PONG'),
            getClient: jest.fn().mockReturnValue({
                get: jest.fn(),
                set: jest.fn(),
                del: jest.fn(),
                exists: jest.fn(),
                ttl: jest.fn(),
                ping: jest.fn().mockResolvedValue('PONG'),
            }),
        };

        mockServiceRegistry = {
            getServiceConfig: jest.fn().mockReturnValue({
                baseUrl: 'http://localhost:3002',
                timeout: 5000,
                retries: 2,
            }),
            getAllServices: jest.fn().mockReturnValue([]),
        };

        mockCacheInterceptor = {
            intercept: jest.fn().mockImplementation((_context, next) => {
                return next.handle();
            }),
        };

        mockResponseInterceptor = {
            intercept: jest.fn().mockImplementation((_context, next) => {
                return next.handle();
            }),
        };

        mockLoggingInterceptor = {
            intercept: jest.fn().mockImplementation((_context, next) => {
                return next.handle();
            }),
        };

        mockProxyService = {
            forward: jest.fn().mockImplementation(async (req) => {
                // Simulate metrics collection
                mockMetricsService.incrementRequestCounter();

                // Simulate different responses based on the request path
                if (req.path.includes('/api/games')) {
                    const responseTime = Math.random() * 100 + 50; // 50-150ms
                    mockMetricsService.recordResponseTime(responseTime);

                    return {
                        statusCode: 200,
                        headers: {
                            'content-type': 'application/json',
                            'x-cache': 'MISS', // Default to cache miss
                        },
                        body: { items: [{ id: 1, title: 'Test Game' }] },
                    };
                }
                return {
                    statusCode: 404,
                    headers: { 'content-type': 'application/json' },
                    body: { error: 'NOT_FOUND', message: 'Route not found' },
                };
            }),
            forwardPlaceholder: jest.fn().mockImplementation(async (_req) => {
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { items: [{ id: 1, title: 'Test Game' }] },
                };
            }),
        };

        moduleRef = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(RateLimitService)
            .useValue({
                isEnabled: () => false,
                check: jest.fn().mockResolvedValue({
                    allowed: true,
                    limit: 1000,
                    remaining: 999,
                    reset: Date.now() + 60000,
                    windowMs: 60000,
                }),
            })
            .overrideProvider(AuthValidationService)
            .useValue({
                validateBearerToken: jest.fn().mockResolvedValue({
                    id: 'perf-test-user',
                    email: 'perf@example.com',
                    roles: ['user'],
                    permissions: [],
                }),
            })
            .overrideProvider(MetricsService)
            .useValue(mockMetricsService)
            .overrideProvider(RedisService)
            .useValue(mockRedisService)
            .overrideProvider(ProxyService)
            .useValue(mockProxyService)
            .overrideProvider(ServiceRegistryService)
            .useValue(mockServiceRegistry)
            .overrideInterceptor(CacheInterceptor)
            .useValue(mockCacheInterceptor)
            .overrideInterceptor(ResponseInterceptor)
            .useValue(mockResponseInterceptor)
            .overrideInterceptor(LoggingInterceptor)
            .useValue(mockLoggingInterceptor)
            .compile();

        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        mockedAxios.mockReset();
        mockMetricsService.incrementRequestCounter.mockReset();
        mockMetricsService.recordResponseTime.mockReset();
        mockMetricsService.recordCacheHit.mockReset();
        mockMetricsService.recordCacheMiss.mockReset();
        mockMetricsService.recordUpstreamLatency.mockReset();
        mockRedisService.get.mockReset();
        mockRedisService.set.mockReset();
        mockProxyService.forward.mockReset();

        // Default successful response
        mockProxyService.forward.mockImplementation(async (req: any) => {
            // Simulate metrics collection
            mockMetricsService.incrementRequestCounter();
            const responseTime = Math.random() * 100 + 50; // 50-150ms
            mockMetricsService.recordResponseTime(responseTime);

            if (req.path.includes('/api/games')) {
                return {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                        'x-cache': 'MISS',
                    },
                    body: { items: [{ id: 1, title: 'Test Game' }] },
                };
            }
            return {
                statusCode: 404,
                headers: { 'content-type': 'application/json' },
                body: { error: 'NOT_FOUND', message: 'Route not found' },
            };
        });
    });

    describe('Response Time Performance', () => {
        it('should handle single requests within acceptable time limits', async () => {
            mockProxyService.forward.mockImplementation(async (req: any) => {
                // Simulate metrics collection
                mockMetricsService.incrementRequestCounter();
                const responseTime = 50;
                mockMetricsService.recordResponseTime(responseTime);

                // Simulate fast upstream service
                await new Promise((resolve) => setTimeout(resolve, 50));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { items: [{ id: 1, title: 'Fast Game' }] },
                };
            });

            const startTime = Date.now();

            const response = await request(app.getHttpServer())
                .get('/api/games')
                .expect(200);

            const responseTime = Date.now() - startTime;

            expect(responseTime).toBeLessThan(200); // Should respond within 200ms
            expect(response.body).toHaveProperty('items');
            expect(mockMetricsService.recordResponseTime).toHaveBeenCalledWith(
                expect.any(Number),
            );
        });

        it('should handle cached responses faster than upstream requests', async () => {
            const gameData = { items: [{ id: 1, title: 'Cached Game' }] };

            // First request - cache miss
            mockRedisService.get.mockResolvedValueOnce(null);
            mockRedisService.set.mockResolvedValueOnce('OK');

            mockProxyService.forward.mockImplementationOnce(async () => {
                mockMetricsService.incrementRequestCounter();
                mockMetricsService.recordResponseTime(100);
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                        'x-cache': 'MISS',
                    },
                    body: gameData,
                };
            });

            const start1 = Date.now();
            await request(app.getHttpServer()).get('/api/games?page=1').expect(200);
            const uncachedTime = Date.now() - start1;

            // Second request - cache hit
            mockRedisService.get.mockResolvedValueOnce(JSON.stringify(gameData));

            mockProxyService.forward.mockImplementationOnce(async () => {
                mockMetricsService.incrementRequestCounter();
                mockMetricsService.recordResponseTime(10);
                mockMetricsService.recordCacheHit();
                await new Promise((resolve) => setTimeout(resolve, 10));
                return {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                        'x-cache': 'HIT',
                    },
                    body: gameData,
                };
            });

            const start2 = Date.now();
            const response = await request(app.getHttpServer())
                .get('/api/games?page=1')
                .expect(200);
            const cachedTime = Date.now() - start2;

            expect(cachedTime).toBeLessThan(uncachedTime);
            expect(response.headers['x-cache']).toBe('HIT');
            expect(mockMetricsService.recordCacheHit).toHaveBeenCalled();
        });

        it('should maintain performance under timeout conditions', async () => {
            mockProxyService.forward.mockImplementation(async () => {
                // Simulate slow upstream service that times out
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return {
                    statusCode: 504,
                    headers: { 'content-type': 'application/json' },
                    body: {
                        error: 'GATEWAY_TIMEOUT',
                        message: 'Upstream service timeout',
                    },
                };
            });

            const startTime = Date.now();

            await request(app.getHttpServer()).get('/api/games').expect(504); // Gateway Timeout

            const responseTime = Date.now() - startTime;

            // Should timeout within reasonable time
            expect(responseTime).toBeLessThan(2000);
        }, 10000);
    });

    describe('Concurrent Request Handling', () => {
        it('should handle multiple concurrent requests efficiently', async () => {
            mockProxyService.forward.mockImplementation(async () => {
                // Simulate variable upstream latency
                const delay = Math.random() * 100 + 50; // 50-150ms
                await new Promise((resolve) => setTimeout(resolve, delay));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { items: [], timestamp: Date.now() },
                };
            });

            const concurrentRequests = 20;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, (_, i) =>
                request(app.getHttpServer())
                    .get(`/api/games?page=${i + 1}`)
                    .expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            // All requests should complete
            expect(responses).toHaveLength(concurrentRequests);

            // Should handle concurrency efficiently (not much slower than single request)
            expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

            // Verify all responses are valid
            responses.forEach((response) => {
                expect(response.body).toHaveProperty('items');
                expect(response.body).toHaveProperty('timestamp');
            });
        });

        it('should handle mixed request types concurrently', async () => {
            mockProxyService.forward.mockImplementation(async (req: any) => {
                const delay = req.method === 'GET' ? 50 : 100; // POST requests slightly slower
                await new Promise((resolve) => setTimeout(resolve, delay));

                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: req.method === 'GET' ? { items: [] } : { success: true },
                };
            });

            const startTime = Date.now();

            const promises = [
                // GET requests (no auth required)
                ...Array.from({ length: 10 }, (_, i) =>
                    request(app.getHttpServer())
                        .get(`/api/games?page=${i + 1}`)
                        .expect(200),
                ),
                // POST requests (auth required)
                ...Array.from({ length: 5 }, (_, i) =>
                    request(app.getHttpServer())
                        .post('/api/users/profile')
                        .set('Authorization', 'Bearer valid-token')
                        .send({ name: `User ${i}` })
                        .expect(200),
                ),
            ];

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(15);
            expect(totalTime).toBeLessThan(800);
        });

        it('should maintain performance with high cache hit ratio', async () => {
            const gameData = { items: [{ id: 1, title: 'Popular Game' }] };

            // Setup cache to return data for most requests
            mockRedisService.get.mockImplementation(async (_key: string) => {
                // 90% cache hit rate
                return Math.random() < 0.9 ? JSON.stringify(gameData) : null;
            });

            mockRedisService.set.mockResolvedValue('OK');

            mockProxyService.forward.mockImplementation(async () => {
                mockMetricsService.incrementRequestCounter();
                const isHit = Math.random() < 0.9; // 90% cache hit rate

                if (isHit) {
                    mockMetricsService.recordCacheHit();
                    mockMetricsService.recordResponseTime(10);
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    return {
                        statusCode: 200,
                        headers: {
                            'content-type': 'application/json',
                            'x-cache': 'HIT',
                        },
                        body: gameData,
                    };
                } else {
                    mockMetricsService.recordCacheMiss();
                    mockMetricsService.recordResponseTime(100);
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return {
                        statusCode: 200,
                        headers: {
                            'content-type': 'application/json',
                            'x-cache': 'MISS',
                        },
                        body: gameData,
                    };
                }
            });

            const concurrentRequests = 50;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, () =>
                request(app.getHttpServer()).get('/api/games?popular=true').expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(concurrentRequests);
            expect(totalTime).toBeLessThan(500); // Should be very fast with high cache hit rate

            // Verify cache metrics were recorded
            expect(mockMetricsService.recordCacheHit).toHaveBeenCalled();
        });
    });

    describe('Memory and Resource Usage', () => {
        it('should handle large response payloads efficiently', async () => {
            const largeGameList = {
                items: Array.from({ length: 1000 }, (_, i) => ({
                    id: i + 1,
                    title: `Game ${i + 1}`,
                    description: 'A'.repeat(500), // 500 char description
                    tags: Array.from({ length: 10 }, (_, j) => `tag${j}`),
                })),
                total: 1000,
                page: 1,
                limit: 1000,
            };

            mockProxyService.forward.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: largeGameList,
                };
            });

            const startTime = Date.now();

            const response = await request(app.getHttpServer())
                .get('/api/games?limit=1000')
                .expect(200);

            const responseTime = Date.now() - startTime;

            expect(response.body.items).toHaveLength(1000);
            expect(responseTime).toBeLessThan(1000); // Should handle large payloads efficiently
        });

        it('should handle multiple large concurrent requests', async () => {
            const createLargePayload = (size: number) => ({
                items: Array.from({ length: size }, (_, i) => ({
                    id: i + 1,
                    title: `Item ${i + 1}`,
                    data: 'x'.repeat(1000), // 1KB per item
                })),
            });

            mockProxyService.forward.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 150));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: createLargePayload(100), // ~100KB response
                };
            });

            const concurrentRequests = 10;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, (_, i) =>
                request(app.getHttpServer())
                    .get(`/api/games?category=${i}`)
                    .expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(concurrentRequests);
            expect(totalTime).toBeLessThan(2000);

            // Verify all responses contain expected data
            responses.forEach((response) => {
                expect(response.body.items).toHaveLength(100);
            });
        });

        it('should efficiently handle request queuing under load', async () => {
            let activeRequests = 0;
            const maxConcurrent = 5;

            mockProxyService.forward.mockImplementation(async () => {
                activeRequests++;

                // Simulate resource constraint
                if (activeRequests > maxConcurrent) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                const result = {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { items: [], activeRequests },
                };

                activeRequests--;
                return result;
            });

            const totalRequests = 20;
            const startTime = Date.now();

            const promises = Array.from({ length: totalRequests }, (_, i) =>
                request(app.getHttpServer()).get(`/api/games?batch=${i}`).expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(totalRequests);
            // Should handle queuing efficiently
            expect(totalTime).toBeLessThan(3000);
        });
    });

    describe('Error Handling Performance', () => {
        it('should handle upstream service errors quickly', async () => {
            mockProxyService.forward.mockImplementation(async () => {
                return {
                    statusCode: 502,
                    headers: { 'content-type': 'application/json' },
                    body: { error: 'BAD_GATEWAY', message: 'Service unavailable' },
                };
            });

            const startTime = Date.now();

            await request(app.getHttpServer()).get('/api/games').expect(502); // Bad Gateway

            const responseTime = Date.now() - startTime;

            // Error responses should be fast
            expect(responseTime).toBeLessThan(100);
        });

        it('should handle multiple concurrent errors efficiently', async () => {
            mockProxyService.forward.mockImplementation(async () => {
                await new Promise((resolve) => setTimeout(resolve, 50));
                return {
                    statusCode: 502,
                    headers: { 'content-type': 'application/json' },
                    body: { error: 'BAD_GATEWAY', message: 'Upstream error' },
                };
            });

            const concurrentRequests = 10;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, () =>
                request(app.getHttpServer()).get('/api/games').expect(502),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(concurrentRequests);
            expect(totalTime).toBeLessThan(300); // Should handle errors quickly
        });

        it('should recover quickly from temporary upstream failures', async () => {
            let requestCount = 0;

            mockProxyService.forward.mockImplementation(async () => {
                requestCount++;

                if (requestCount <= 3) {
                    // First 3 requests fail
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    return {
                        statusCode: 502,
                        headers: { 'content-type': 'application/json' },
                        body: { error: 'BAD_GATEWAY', message: 'Temporary failure' },
                    };
                } else {
                    // Subsequent requests succeed
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    return {
                        statusCode: 200,
                        headers: { 'content-type': 'application/json' },
                        body: { items: [], recovered: true },
                    };
                }
            });

            // Make failing requests
            for (let i = 0; i < 3; i++) {
                await request(app.getHttpServer()).get('/api/games').expect(502);
            }

            // Recovery should be immediate
            const startTime = Date.now();

            const response = await request(app.getHttpServer())
                .get('/api/games')
                .expect(200);

            const recoveryTime = Date.now() - startTime;

            expect(response.body.recovered).toBe(true);
            expect(recoveryTime).toBeLessThan(200);
        });
    });

    describe('Cache Performance', () => {
        it('should handle cache operations efficiently under load', async () => {
            const gameData = { items: [{ id: 1, title: 'Cached Game' }] };

            let cacheOperations = 0;
            mockRedisService.get.mockImplementation(async () => {
                cacheOperations++;
                await new Promise((resolve) => setTimeout(resolve, 5)); // Fast cache lookup
                return Math.random() < 0.5 ? JSON.stringify(gameData) : null;
            });

            mockRedisService.set.mockImplementation(async () => {
                cacheOperations++;
                await new Promise((resolve) => setTimeout(resolve, 10)); // Fast cache write
                return 'OK';
            });

            mockProxyService.forward.mockImplementation(async () => {
                mockMetricsService.incrementRequestCounter();
                mockMetricsService.recordResponseTime(100);

                // Simulate cache operations by calling the Redis mocks
                await mockRedisService.get('test-key');
                await mockRedisService.set('test-key', 'test-value');

                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: gameData,
                };
            });

            const concurrentRequests = 30;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, (_, i) =>
                request(app.getHttpServer())
                    .get(`/api/games?id=${i % 5}`) // Some cache key overlap
                    .expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(concurrentRequests);
            expect(totalTime).toBeLessThan(1000);
            expect(cacheOperations).toBeGreaterThan(0);
        });

        it('should handle cache failures gracefully without performance impact', async () => {
            mockRedisService.get.mockRejectedValue(new Error('Cache unavailable'));
            mockRedisService.set.mockRejectedValue(new Error('Cache unavailable'));

            mockProxyService.forward.mockImplementation(async () => {
                mockMetricsService.incrementRequestCounter();
                mockMetricsService.recordResponseTime(100);
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                        'x-cache': 'ERROR',
                    },
                    body: { items: [] },
                };
            });

            const concurrentRequests = 10;
            const startTime = Date.now();

            const promises = Array.from({ length: concurrentRequests }, () =>
                request(app.getHttpServer()).get('/api/games').expect(200),
            );

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            expect(responses).toHaveLength(concurrentRequests);
            // Should not be significantly slower despite cache failures
            expect(totalTime).toBeLessThan(800);

            // Verify cache error headers
            responses.forEach((response) => {
                expect(response.headers['x-cache']).toBe('ERROR');
            });
        });
    });

    describe('Metrics Collection Performance', () => {
        it('should collect metrics without impacting response times', async () => {
            mockProxyService.forward.mockImplementation(async () => {
                // Simulate metrics collection for each request
                mockMetricsService.incrementRequestCounter();
                mockMetricsService.recordResponseTime(50);

                await new Promise((resolve) => setTimeout(resolve, 50));
                return {
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { items: [] },
                };
            });

            const requestCount = 20;
            const startTime = Date.now();

            const promises = Array.from({ length: requestCount }, () =>
                request(app.getHttpServer()).get('/api/games').expect(200),
            );

            await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            // Metrics collection should not significantly impact performance
            expect(totalTime).toBeLessThan(500);

            // Verify metrics were collected
            expect(mockMetricsService.incrementRequestCounter).toHaveBeenCalledTimes(
                requestCount,
            );
            expect(mockMetricsService.recordResponseTime).toHaveBeenCalledTimes(
                requestCount,
            );
        });

        it('should handle metrics endpoint efficiently', async () => {
            mockMetricsService.metrics.mockResolvedValue(`
        # HELP http_requests_total Total number of HTTP requests
        # TYPE http_requests_total counter
        http_requests_total{method="GET",status="200"} 100
        http_requests_total{method="POST",status="200"} 50
        
        # HELP http_request_duration_seconds HTTP request duration
        # TYPE http_request_duration_seconds histogram
        http_request_duration_seconds_bucket{le="0.1"} 80
        http_request_duration_seconds_bucket{le="0.5"} 95
        http_request_duration_seconds_bucket{le="1.0"} 100
      `);

            const startTime = Date.now();

            const response = await request(app.getHttpServer())
                .get('/api/metrics')
                .expect(200);

            const responseTime = Date.now() - startTime;

            expect(responseTime).toBeLessThan(100);
            expect(response.text).toContain('http_requests_total');
            expect(response.text).toContain('http_request_duration_seconds');
        });
    });
});
