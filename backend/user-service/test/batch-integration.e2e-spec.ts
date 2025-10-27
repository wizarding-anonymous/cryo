import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';

describe('Batch Integration Tests (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [TestAppModule],
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
    }, 30000);

    afterAll(async () => {
        await app.close();
    });

    describe('Batch API Functionality', () => {
        it('should create users in reasonable batches (100 users)', async () => {
            const batchSize = 100;

            console.log(`\n✅ Testing functional batch creation of ${batchSize} users...`);

            const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
                name: `Batch User ${i}`,
                email: `batch-user-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
            }));

            const response = await request(app.getHttpServer())
                .post('/api/batch/users/create')
                .set('x-internal-service', 'user-service-internal')
                .send({
                    users: batchUsers,
                    options: { chunkSize: 50 }
                })
                .expect(201);

            expect(response.body.data.stats.successful).toBe(batchSize);
            expect(response.body.data.stats.failed).toBe(0);
            expect(response.body.data.success).toBe(true);

            console.log(`✅ Successfully created ${batchSize} users`);
        });

        it('should lookup users via POST endpoint', async () => {
            // Create test users first
            const testUsers = Array.from({ length: 50 }, (_, i) => ({
                name: `Lookup User ${i}`,
                email: `lookup-user-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
            }));

            const createResponse = await request(app.getHttpServer())
                .post('/api/batch/users/create')
                .set('x-internal-service', 'user-service-internal')
                .send({
                    users: testUsers,
                    options: { chunkSize: 25 }
                })
                .expect(201);

            const userIds = createResponse.body.data.data.map((user: any) => user.id);

            // Test lookup
            const lookupResponse = await request(app.getHttpServer())
                .post('/api/batch/users/lookup')
                .set('x-internal-service', 'user-service-internal')
                .send({
                    ids: userIds,
                    options: { chunkSize: 25 }
                })
                .expect(200);

            expect(lookupResponse.body.data.stats.found).toBe(userIds.length);
            expect(lookupResponse.body.data.stats.missing).toBe(0);
            expect(lookupResponse.body.data.data).toHaveLength(userIds.length);

            console.log(`✅ Successfully looked up ${userIds.length} users`);
        });

        it('should enforce batch size limits', async () => {
            console.log('\n🚫 Testing batch size limit enforcement...');

            // Test with a mock request that simulates a large batch
            // Instead of creating 5001 actual objects, we'll test the controller logic directly
            const mockLargeBatch = {
                users: new Array(5001).fill(null).map((_, i) => ({
                    name: `User${i}`,
                    email: `u${i}@ex.com`,
                    password: 'test1234'
                })),
                options: { chunkSize: 100 }
            };

            // This should return 201 with success: false due to batch size limit
            const response = await request(app.getHttpServer())
                .post('/api/batch/users/create')
                .set('x-internal-service', 'user-service-internal')
                .send(mockLargeBatch);

            // The request should be rejected either at the application level (201 with success: false)
            // or at the HTTP level (400/500) due to request size limits
            if (response.status === 201) {
                // Application-level rejection
                expect(response.body.data.success).toBe(false);
                expect(response.body.data.message).toContain('Batch size too large');
                expect(response.body.data.message).toContain('Maximum 5000 users per batch');
            } else {
                // HTTP-level rejection (request entity too large)
                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.body.message).toContain('request entity too large');
            }

            console.log('✅ Batch size limit properly enforced');
        });

        it('should enforce GET lookup limits', async () => {
            const manyIds = Array.from({ length: 101 }, () => 'test-id').join(',');

            const response = await request(app.getHttpServer())
                .get(`/api/batch/users/lookup?ids=${manyIds}`)
                .set('x-internal-service', 'user-service-internal')
                .expect(200);

            expect(response.body.data.success).toBe(false);
            expect(response.body.data.message).toContain('Too many IDs for GET request');

            console.log('✅ GET lookup limit properly enforced');
        });
    });

    describe('Batch API Error Handling', () => {
        it('should handle invalid user data gracefully', async () => {
            const invalidUsers = [
                { name: '', email: 'invalid@example.com', password: 'test' }, // Empty name
                { name: 'Valid Name', email: 'invalid-email', password: 'test' }, // Invalid email
            ];

            const response = await request(app.getHttpServer())
                .post('/api/batch/users/create')
                .set('x-internal-service', 'user-service-internal')
                .send({
                    users: invalidUsers,
                    options: { chunkSize: 10 }
                })
                .expect(201);

            // Should handle validation errors gracefully
            expect(response.body.data.stats.total).toBe(2);
            expect(response.body.data.stats.failed).toBeGreaterThan(0);

            console.log('✅ Invalid data handled gracefully');
        });

        it('should require internal service header', async () => {
            const users = [{ name: 'Test', email: 'test@example.com', password: 'test' }];

            await request(app.getHttpServer())
                .post('/api/batch/users/create')
                // Missing x-internal-service header
                .send({ users })
                .expect(401);

            console.log('✅ Internal service authentication working');
        });
    });

    describe('Batch API Response Format', () => {
        it('should return consistent response format', async () => {
            const users = Array.from({ length: 5 }, (_, i) => ({
                name: `Format Test User ${i}`,
                email: `format-test-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
            }));

            const response = await request(app.getHttpServer())
                .post('/api/batch/users/create')
                .set('x-internal-service', 'user-service-internal')
                .send({ users })
                .expect(201);

            // Verify response structure
            expect(response.body.data).toHaveProperty('success');
            expect(response.body.data).toHaveProperty('message');
            expect(response.body.data).toHaveProperty('data');
            expect(response.body.data.data).toBeInstanceOf(Array); // Created users
            expect(response.body.data).toHaveProperty('failed');
            expect(response.body.data).toHaveProperty('stats');

            expect(response.body.data.stats).toHaveProperty('total');
            expect(response.body.data.stats).toHaveProperty('successful');
            expect(response.body.data.stats).toHaveProperty('failed');

            console.log('✅ Response format is consistent');
        });
    });
});