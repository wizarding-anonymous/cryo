import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from './health.module';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Health Module Integration', () => {
    let app: INestApplication;
    let mockRegistry: jest.Mocked<ServiceRegistryService>;
    let mockRedisService: jest.Mocked<RedisService>;

    beforeEach(async () => {
        mockRegistry = {
            getAll: jest.fn(),
        } as any;

        mockRedisService = {
            getClient: jest.fn().mockReturnValue({
                ping: jest.fn().mockResolvedValue('PONG'),
            }),
        } as any;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [HealthModule],
        })
            .overrideProvider(ServiceRegistryService)
            .useValue(mockRegistry)
            .overrideProvider(RedisService)
            .useValue(mockRedisService)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return gateway health status', async () => {
            const response = await request(app.getHttpServer())
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: expect.stringMatching(/^(ok|error)$/),
                timestamp: expect.any(String),
                uptime: expect.any(Number),
            });

            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
            expect(response.body.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should return valid JSON response', async () => {
            const response = await request(app.getHttpServer())
                .get('/health')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toBeDefined();
            expect(typeof response.body).toBe('object');
        });

        it('should have consistent response structure', async () => {
            const response = await request(app.getHttpServer())
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(Object.keys(response.body)).toHaveLength(3);
        });
    });

    describe('GET /health/services', () => {
        it('should return empty array when no services registered', async () => {
            mockRegistry.getAll.mockReturnValue([]);

            const response = await request(app.getHttpServer())
                .get('/health/services')
                .expect(200);

            expect(response.body).toEqual([]);
        });

        it('should return health status of registered services', async () => {
            const mockServices = [
                {
                    name: 'user-service',
                    baseUrl: 'http://user-service:3001',
                    healthCheckPath: '/health',
                    timeout: 5000,
                },
                {
                    name: 'game-service',
                    baseUrl: 'http://game-service:3002',
                    healthCheckPath: '/api/health',
                    timeout: 3000,
                },
            ];

            mockRegistry.getAll.mockReturnValue(mockServices as any);
            mockedAxios.get
                .mockResolvedValueOnce({ status: 200 })
                .mockResolvedValueOnce({ status: 200 });

            const response = await request(app.getHttpServer())
                .get('/health/services')
                .expect(200);

            expect(response.body).toHaveLength(2);
            expect(response.body[0]).toEqual({
                name: 'user-service',
                status: 'healthy',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
            });
            expect(response.body[1]).toEqual({
                name: 'game-service',
                status: 'healthy',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
            });
        });

        it('should handle unhealthy services', async () => {
            const mockServices = [
                {
                    name: 'failing-service',
                    baseUrl: 'http://failing-service:3001',
                    healthCheckPath: '/health',
                    timeout: 5000,
                },
            ];

            mockRegistry.getAll.mockReturnValue(mockServices as any);
            mockedAxios.get.mockResolvedValue({ status: 503 });

            const response = await request(app.getHttpServer())
                .get('/health/services')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toEqual({
                name: 'failing-service',
                status: 'unhealthy',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
                error: 'HTTP 503',
            });
        });

        it('should handle network errors', async () => {
            const mockServices = [
                {
                    name: 'unreachable-service',
                    baseUrl: 'http://unreachable-service:3001',
                    healthCheckPath: '/health',
                    timeout: 5000,
                },
            ];

            mockRegistry.getAll.mockReturnValue(mockServices as any);
            mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));

            const response = await request(app.getHttpServer())
                .get('/health/services')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toEqual({
                name: 'unreachable-service',
                status: 'unhealthy',
                responseTime: expect.any(Number),
                lastCheck: expect.any(String),
                error: 'ECONNREFUSED',
            });
        });

        it('should return valid JSON array', async () => {
            mockRegistry.getAll.mockReturnValue([]);

            const response = await request(app.getHttpServer())
                .get('/health/services')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /metrics', () => {
        it('should return Prometheus metrics', async () => {
            const response = await request(app.getHttpServer())
                .get('/metrics')
                .expect(200)
                .expect('Content-Type', /text\/plain/);

            expect(typeof response.text).toBe('string');
            expect(response.text).toContain('gateway_');
        });

        it('should return metrics in Prometheus format', async () => {
            const response = await request(app.getHttpServer())
                .get('/metrics')
                .expect(200);

            // Check for typical Prometheus metric format
            const lines = response.text.split('\n');
            const hasHelpLines = lines.some((line: string) => line.startsWith('# HELP'));
            const hasTypeLines = lines.some((line: string) => line.startsWith('# TYPE'));
            const hasMetricLines = lines.some((line: string) => line.match(/^gateway_\w+/));

            expect(hasHelpLines).toBe(true);
            expect(hasTypeLines).toBe(true);
            expect(hasMetricLines).toBe(true);
        });

        it('should include default Node.js metrics', async () => {
            const response = await request(app.getHttpServer())
                .get('/metrics')
                .expect(200);

            // Check for common Node.js metrics with gateway_ prefix
            expect(response.text).toMatch(/gateway_.*process_cpu/);
            expect(response.text).toMatch(/gateway_.*nodejs_/);
        });
    });

    describe('Error handling', () => {
        it('should handle 404 for non-existent health endpoints', async () => {
            await request(app.getHttpServer())
                .get('/health/nonexistent')
                .expect(404);
        });

        it('should handle invalid HTTP methods', async () => {
            await request(app.getHttpServer())
                .post('/health')
                .expect(404);

            await request(app.getHttpServer())
                .put('/health/services')
                .expect(404);

            await request(app.getHttpServer())
                .delete('/metrics')
                .expect(404);
        });
    });

    describe('Response headers', () => {
        it('should set correct content type for health endpoints', async () => {
            await request(app.getHttpServer())
                .get('/health')
                .expect('Content-Type', /json/);

            await request(app.getHttpServer())
                .get('/health/services')
                .expect('Content-Type', /json/);
        });

        it('should set correct content type for metrics endpoint', async () => {
            await request(app.getHttpServer())
                .get('/metrics')
                .expect('Content-Type', /text\/plain/);
        });
    });
});