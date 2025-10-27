import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestPerformanceModule } from './test-performance.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';

describe('Simple Batch Test (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [TestPerformanceModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply global configurations
        const httpAdapterHost = app.get(HttpAdapterHost);
        const loggingService = app.get(LoggingService);
        app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
        app.useGlobalInterceptors(new ResponseInterceptor());
        app.setGlobalPrefix('api');
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        await app.init();
    }, 60000);

    afterAll(async () => {
        await app.close();
    });

    it('should create a single user via batch endpoint', async () => {
        const testUser = {
            name: 'Test User',
            email: `test-${Date.now()}@example.com`,
            password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        };

        const response = await request(app.getHttpServer())
            .post('/api/batch/users/create')
            .set('x-internal-service', 'user-service-internal')
            .send({
                users: [testUser],
                options: { chunkSize: 1 }
            });

        console.log('Response status:', response.status);
        console.log('Response body:', response.body);

        expect(response.status).toBe(201);
    });

    it('should create 100 users via batch endpoint', async () => {
        const users = Array.from({ length: 100 }, (_, i) => ({
            name: `Test User ${i}`,
            email: `test-${Date.now()}-${i}@example.com`,
            password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        }));

        const response = await request(app.getHttpServer())
            .post('/api/batch/users/create')
            .set('x-internal-service', 'user-service-internal')
            .send({
                users,
                options: { chunkSize: 50 }
            });

        console.log('Response status:', response.status);
        console.log('Response stats:', response.body?.data?.stats);

        expect(response.status).toBe(201);
        expect(response.body.data.stats.successful).toBe(100);
    });

    it('should create 500 users via batch endpoint', async () => {
        const users = Array.from({ length: 500 }, (_, i) => ({
            name: `Test User ${i}`,
            email: `test-500-${Date.now()}-${i}@example.com`,
            password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        }));

        const response = await request(app.getHttpServer())
            .post('/api/batch/users/create')
            .set('x-internal-service', 'user-service-internal')
            .send({
                users,
                options: { chunkSize: 100 }
            });

        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(201);
        expect(response.body.data.stats.successful).toBe(500);
    }, 30000); // 30 second timeout
});