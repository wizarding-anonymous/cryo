import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';

describe('Load Test - Concurrent Users (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository: Repository<User>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [TestAppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        dataSource = moduleFixture.get<DataSource>(DataSource);
        userRepository = dataSource.getRepository(User);

        // Apply global configurations
        const httpAdapterHost = app.get(HttpAdapterHost);
        app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, app.get('Logger')));
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
        // Clean up test data
        if (dataSource?.isInitialized) {
            await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
            await dataSource.destroy();
        }
        await app.close();
    });

    beforeEach(async () => {
        // Clean up users table before each test
        await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    });

    describe('1000+ Concurrent User Operations', () => {
        it('should handle 1000 concurrent user registrations', async () => {
            const concurrentUsers = 1000;
            console.log(`\n🚀 Starting ${concurrentUsers} concurrent user registrations...`);

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            // Create promises for concurrent user registrations
            const registrationPromises = Array.from({ length: concurrentUsers }, (_, i) =>
                request(app.getHttpServer())
                    .post('/api/internal/users')
                    .set('x-internal-service', 'user-service-internal')
                    .send({
                        name: `Concurrent User ${i}`,
                        email: `concurrent-user-${i}-${Date.now()}@example.com`,
                        password: '$2b$10$hashedPasswordFromAuthService',
                        preferences: {
                            language: ['en', 'es', 'fr'][i % 3],
                            timezone: 'UTC',
                            theme: (['light', 'dark'][i % 2]) as 'light' | 'dark' | 'auto',
                            notifications: { email: true, push: false, sms: false },
                            gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
                        },
                    })
            );

            // Execute all registrations concurrently
            const responses = await Promise.all(registrationPromises);

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const duration = endTime - startTime;

            console.log(`✅ ${concurrentUsers} concurrent registrations completed in ${duration}ms`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Throughput: ${Math.round((concurrentUsers / duration) * 1000)} registrations/second`);

            // Verify all requests succeeded
            const successfulResponses = responses.filter(response => response.status === 201);
            const failedResponses = responses.filter(response => response.status !== 201);

            console.log(`✅ Successful: ${successfulResponses.length}, ❌ Failed: ${failedResponses.length}`);

            expect(successfulResponses.length).toBeGreaterThan(concurrentUsers * 0.99); // At least 99% success rate
            expect(failedResponses.length).toBeLessThan(concurrentUsers * 0.01); // Less than 1% failure rate

            // Performance requirements
            expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

            // Calculate throughput
            const registrationsPerSecond = (successfulResponses.length / duration) * 1000;
            expect(registrationsPerSecond).toBeGreaterThan(30); // At least 30 registrations per second

            // Verify data integrity
            const userCount = await userRepository.count();
            expect(userCount).toBe(successfulResponses.length);

            // Check response times
            const responseTimes = responses.map(response => {
                const timeHeader = response.header['x-response-time'];
                return typeof timeHeader === 'string' ? parseFloat(timeHeader) : 0;
            });
            const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);

            console.log(`⏱️ Response times - Avg: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);

            // Response times should be reasonable under load
            expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
            expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
        }, 60000);

        it('should handle 1500 concurrent user lookups', async () => {
            // First, create test users
            const testUsers = Array.from({ length: 2000 }, (_, i) => ({
                name: `Lookup Test User ${i}`,
                email: `lookup-test-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
                isActive: true,
            }));

            const savedUsers = await userRepository.save(testUsers as any);
            const userIds = savedUsers.map((user: any) => user.id);

            const concurrentLookups = 1500;
            console.log(`\n🔍 Starting ${concurrentLookups} concurrent user lookups...`);

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            // Create promises for concurrent user lookups
            const lookupPromises = Array.from({ length: concurrentLookups }, (_, i) => {
                const userId = userIds[i % userIds.length]; // Cycle through available user IDs
                return request(app.getHttpServer())
                    .get(`/api/internal/users/${userId}`)
                    .set('x-internal-service', 'user-service-internal');
            });

            // Execute all lookups concurrently
            const responses = await Promise.all(lookupPromises);

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const duration = endTime - startTime;

            console.log(`✅ ${concurrentLookups} concurrent lookups completed in ${duration}ms`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Throughput: ${Math.round((concurrentLookups / duration) * 1000)} lookups/second`);

            // Verify all requests succeeded
            const successfulResponses = responses.filter(response => response.status === 200);
            const failedResponses = responses.filter(response => response.status !== 200);

            console.log(`✅ Successful: ${successfulResponses.length}, ❌ Failed: ${failedResponses.length}`);

            expect(successfulResponses.length).toBeGreaterThan(concurrentLookups * 0.99); // At least 99% success rate
            expect(failedResponses.length).toBeLessThan(concurrentLookups * 0.01); // Less than 1% failure rate

            // Performance requirements
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

            // Calculate throughput
            const lookupsPerSecond = (successfulResponses.length / duration) * 1000;
            expect(lookupsPerSecond).toBeGreaterThan(100); // At least 100 lookups per second

            // Verify response data integrity
            successfulResponses.forEach(response => {
                expect(response.body.data.id).toBeTruthy();
                expect(response.body.data.email).toBeTruthy();
                expect(response.body.data.name).toBeTruthy();
            });
        }, 60000);

        it('should handle 2000 concurrent mixed operations (CRUD)', async () => {
            // Create some initial users for read/update operations
            const initialUsers = Array.from({ length: 500 }, (_, i) => ({
                name: `Initial User ${i}`,
                email: `initial-user-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
                isActive: true,
            }));

            const savedUsers = await userRepository.save(initialUsers as any);
            const existingUserIds = savedUsers.map(user => user.id);

            const concurrentOperations = 2000;
            console.log(`\n🔄 Starting ${concurrentOperations} concurrent mixed operations...`);

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            const operations = [];

            // 40% Read operations
            for (let i = 0; i < Math.floor(concurrentOperations * 0.4); i++) {
                const userId = existingUserIds[i % existingUserIds.length];
                operations.push(
                    request(app.getHttpServer())
                        .get(`/api/internal/users/${userId}`)
                        .set('x-internal-service', 'user-service-internal')
                );
            }

            // 30% Create operations
            for (let i = 0; i < Math.floor(concurrentOperations * 0.3); i++) {
                operations.push(
                    request(app.getHttpServer())
                        .post('/api/internal/users')
                        .set('x-internal-service', 'user-service-internal')
                        .send({
                            name: `Mixed Op User ${i}`,
                            email: `mixed-op-${i}-${Date.now()}@example.com`,
                            password: '$2b$10$hashedPasswordFromAuthService',
                        })
                );
            }

            // 20% Update operations
            for (let i = 0; i < Math.floor(concurrentOperations * 0.2); i++) {
                const userId = existingUserIds[i % existingUserIds.length];
                operations.push(
                    request(app.getHttpServer())
                        .patch(`/api/internal/users/${userId}/last-login`)
                        .set('x-internal-service', 'user-service-internal')
                );
            }

            // 10% Health check operations
            for (let i = 0; i < Math.floor(concurrentOperations * 0.1); i++) {
                operations.push(
                    request(app.getHttpServer())
                        .get('/api/health')
                );
            }

            // Execute all operations concurrently
            const responses = await Promise.all(operations);

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const duration = endTime - startTime;

            console.log(`✅ ${concurrentOperations} concurrent mixed operations completed in ${duration}ms`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Throughput: ${Math.round((concurrentOperations / duration) * 1000)} operations/second`);

            // Analyze responses by operation type
            const readResponses = responses.slice(0, Math.floor(concurrentOperations * 0.4));
            const createResponses = responses.slice(Math.floor(concurrentOperations * 0.4), Math.floor(concurrentOperations * 0.7));
            const updateResponses = responses.slice(Math.floor(concurrentOperations * 0.7), Math.floor(concurrentOperations * 0.9));
            const healthResponses = responses.slice(Math.floor(concurrentOperations * 0.9));

            const successfulReads = readResponses.filter(r => r.status === 200).length;
            const successfulCreates = createResponses.filter(r => r.status === 201).length;
            const successfulUpdates = updateResponses.filter(r => r.status === 200).length;
            const successfulHealthChecks = healthResponses.filter(r => r.status === 200).length;

            console.log(`📊 Operation results:`);
            console.log(`  Reads: ${successfulReads}/${readResponses.length} (${((successfulReads / readResponses.length) * 100).toFixed(1)}%)`);
            console.log(`  Creates: ${successfulCreates}/${createResponses.length} (${((successfulCreates / createResponses.length) * 100).toFixed(1)}%)`);
            console.log(`  Updates: ${successfulUpdates}/${updateResponses.length} (${((successfulUpdates / updateResponses.length) * 100).toFixed(1)}%)`);
            console.log(`  Health: ${successfulHealthChecks}/${healthResponses.length} (${((successfulHealthChecks / healthResponses.length) * 100).toFixed(1)}%)`);

            // All operation types should have high success rates
            expect(successfulReads / readResponses.length).toBeGreaterThan(0.99);
            expect(successfulCreates / createResponses.length).toBeGreaterThan(0.98);
            expect(successfulUpdates / updateResponses.length).toBeGreaterThan(0.99);
            expect(successfulHealthChecks / healthResponses.length).toBeGreaterThan(0.99);

            // Performance requirements
            expect(duration).toBeLessThan(20000); // Should complete within 20 seconds

            // Calculate throughput
            const operationsPerSecond = (concurrentOperations / duration) * 1000;
            expect(operationsPerSecond).toBeGreaterThan(80); // At least 80 operations per second
        }, 60000);
    });

    describe('Sustained Load Testing', () => {
        it('should handle sustained load of 500 concurrent users for 5 minutes', async () => {
            // Create initial test data
            const initialUsers = Array.from({ length: 1000 }, (_, i) => ({
                name: `Sustained Load User ${i}`,
                email: `sustained-load-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
                isActive: true,
            }));

            const savedUsers = await userRepository.save(initialUsers as any);
            const existingUserIds = savedUsers.map(user => user.id);

            const concurrentUsers = 500;
            const testDurationMs = 5 * 60 * 1000; // 5 minutes
            const operationIntervalMs = 2000; // Operation every 2 seconds per user

            console.log(`\n⏰ Starting sustained load test: ${concurrentUsers} users for ${testDurationMs / 1000} seconds...`);

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            let totalOperations = 0;
            let successfulOperations = 0;
            let failedOperations = 0;
            const responseTimesSample = [];

            // Create sustained load simulation
            const userSimulations = Array.from({ length: concurrentUsers }, (_, userId) => {
                return new Promise<void>((resolve) => {
                    const userStartTime = Date.now();

                    const performOperation = async () => {
                        if (Date.now() - userStartTime >= testDurationMs) {
                            resolve();
                            return;
                        }

                        try {
                            const operationStartTime = Date.now();

                            // Randomly choose operation type
                            const operationType = Math.random();
                            let response;

                            if (operationType < 0.5) {
                                // 50% - Read operation
                                const targetUserId = existingUserIds[Math.floor(Math.random() * existingUserIds.length)];
                                response = await request(app.getHttpServer())
                                    .get(`/api/internal/users/${targetUserId}`)
                                    .set('x-internal-service', 'user-service-internal');
                            } else if (operationType < 0.7) {
                                // 20% - Create operation
                                response = await request(app.getHttpServer())
                                    .post('/api/internal/users')
                                    .set('x-internal-service', 'user-service-internal')
                                    .send({
                                        name: `Sustained User ${userId}-${Date.now()}`,
                                        email: `sustained-${userId}-${Date.now()}@example.com`,
                                        password: '$2b$10$hashedPasswordFromAuthService',
                                    });
                            } else if (operationType < 0.9) {
                                // 20% - Update operation
                                const targetUserId = existingUserIds[Math.floor(Math.random() * existingUserIds.length)];
                                response = await request(app.getHttpServer())
                                    .patch(`/api/internal/users/${targetUserId}/last-login`)
                                    .set('x-internal-service', 'user-service-internal');
                            } else {
                                // 10% - Health check
                                response = await request(app.getHttpServer())
                                    .get('/api/health');
                            }

                            const operationEndTime = Date.now();
                            const responseTime = operationEndTime - operationStartTime;

                            totalOperations++;

                            if (response.status >= 200 && response.status < 300) {
                                successfulOperations++;
                            } else {
                                failedOperations++;
                            }

                            // Sample response times (store every 10th response to avoid memory issues)
                            if (totalOperations % 10 === 0) {
                                responseTimesSample.push(responseTime);
                            }

                        } catch (error) {
                            failedOperations++;
                            totalOperations++;
                        }

                        // Schedule next operation
                        setTimeout(performOperation, operationIntervalMs + Math.random() * 1000); // Add some jitter
                    };

                    // Start first operation
                    setTimeout(performOperation, Math.random() * operationIntervalMs); // Stagger start times
                });
            });

            // Wait for all user simulations to complete
            await Promise.all(userSimulations);

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const actualDuration = endTime - startTime;

            console.log(`✅ Sustained load test completed in ${actualDuration}ms`);
            console.log(`📊 Total operations: ${totalOperations}`);
            console.log(`✅ Successful: ${successfulOperations} (${((successfulOperations / totalOperations) * 100).toFixed(1)}%)`);
            console.log(`❌ Failed: ${failedOperations} (${((failedOperations / totalOperations) * 100).toFixed(1)}%)`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Average throughput: ${Math.round((totalOperations / actualDuration) * 1000)} operations/second`);

            // Calculate response time statistics
            if (responseTimesSample.length > 0) {
                responseTimesSample.sort((a, b) => a - b);
                const avgResponseTime = responseTimesSample.reduce((sum, time) => sum + time, 0) / responseTimesSample.length;
                const p95ResponseTime = responseTimesSample[Math.floor(responseTimesSample.length * 0.95)];
                const p99ResponseTime = responseTimesSample[Math.floor(responseTimesSample.length * 0.99)];
                const maxResponseTime = Math.max(...responseTimesSample);

                console.log(`⏱️ Response times - Avg: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime}ms, P99: ${p99ResponseTime}ms, Max: ${maxResponseTime}ms`);

                // Performance requirements
                expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
                expect(p95ResponseTime).toBeLessThan(1000); // 95th percentile under 1 second
                expect(p99ResponseTime).toBeLessThan(2000); // 99th percentile under 2 seconds
            }

            // Success rate should be high
            const successRate = successfulOperations / totalOperations;
            expect(successRate).toBeGreaterThan(0.99); // At least 99% success rate

            // Should handle reasonable throughput
            const operationsPerSecond = (totalOperations / actualDuration) * 1000;
            expect(operationsPerSecond).toBeGreaterThan(50); // At least 50 operations per second

            // Memory usage should not grow excessively
            const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
            expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase
        }, 400000); // 6+ minutes timeout
    });

    describe('Spike Load Testing', () => {
        it('should handle sudden spike to 1200 concurrent users', async () => {
            // Create initial test data
            const initialUsers = Array.from({ length: 800 }, (_, i) => ({
                name: `Spike Test User ${i}`,
                email: `spike-test-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
                isActive: true,
            }));

            const savedUsers = await userRepository.save(initialUsers as any);
            const existingUserIds = savedUsers.map(user => user.id);

            const spikeUsers = 1200;
            console.log(`\n⚡ Starting spike load test: sudden spike to ${spikeUsers} concurrent users...`);

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            // Create spike load - all operations start simultaneously
            const spikeOperations = Array.from({ length: spikeUsers }, (_, i) => {
                const operationType = Math.random();

                if (operationType < 0.6) {
                    // 60% - Read operations (most common during spikes)
                    const userId = existingUserIds[i % existingUserIds.length];
                    return request(app.getHttpServer())
                        .get(`/api/internal/users/${userId}`)
                        .set('x-internal-service', 'user-service-internal');
                } else if (operationType < 0.8) {
                    // 20% - Create operations
                    return request(app.getHttpServer())
                        .post('/api/internal/users')
                        .set('x-internal-service', 'user-service-internal')
                        .send({
                            name: `Spike User ${i}`,
                            email: `spike-user-${i}-${Date.now()}@example.com`,
                            password: '$2b$10$hashedPasswordFromAuthService',
                        });
                } else if (operationType < 0.95) {
                    // 15% - Update operations
                    const userId = existingUserIds[i % existingUserIds.length];
                    return request(app.getHttpServer())
                        .patch(`/api/internal/users/${userId}/last-login`)
                        .set('x-internal-service', 'user-service-internal');
                } else {
                    // 5% - Health checks
                    return request(app.getHttpServer())
                        .get('/api/health');
                }
            });

            // Execute all spike operations simultaneously
            const responses = await Promise.all(spikeOperations);

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const duration = endTime - startTime;

            console.log(`✅ Spike load test completed in ${duration}ms`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Throughput: ${Math.round((spikeUsers / duration) * 1000)} operations/second`);

            // Analyze responses
            const successfulResponses = responses.filter(response =>
                response.status >= 200 && response.status < 300
            );
            const failedResponses = responses.filter(response =>
                response.status < 200 || response.status >= 300
            );

            console.log(`✅ Successful: ${successfulResponses.length} (${((successfulResponses.length / spikeUsers) * 100).toFixed(1)}%)`);
            console.log(`❌ Failed: ${failedResponses.length} (${((failedResponses.length / spikeUsers) * 100).toFixed(1)}%)`);

            // During spike loads, we allow slightly lower success rates but still expect good performance
            expect(successfulResponses.length / spikeUsers).toBeGreaterThan(0.95); // At least 95% success rate
            expect(failedResponses.length / spikeUsers).toBeLessThan(0.05); // Less than 5% failure rate

            // Performance requirements for spike load
            expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

            // Calculate throughput
            const operationsPerSecond = (successfulResponses.length / duration) * 1000;
            expect(operationsPerSecond).toBeGreaterThan(60); // At least 60 operations per second during spike

            // System should remain stable (no excessive memory growth)
            const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
            expect(memoryIncrease).toBeLessThan(300); // Less than 300MB increase during spike

            // Verify health endpoint remains responsive during spike
            const healthResponses = responses.filter((_, i) => i >= Math.floor(spikeUsers * 0.95));
            const successfulHealthChecks = healthResponses.filter(r => r.status === 200);
            expect(successfulHealthChecks.length / healthResponses.length).toBeGreaterThan(0.9); // Health checks should mostly succeed
        }, 60000);
    });

    describe('Gradual Load Ramp-up Testing', () => {
        it('should handle gradual ramp-up from 100 to 1500 concurrent users', async () => {
            // Create initial test data
            const initialUsers = Array.from({ length: 1000 }, (_, i) => ({
                name: `Ramp User ${i}`,
                email: `ramp-user-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
                isActive: true,
            }));

            const savedUsers = await userRepository.save(initialUsers as any);
            const existingUserIds = savedUsers.map(user => user.id);

            console.log(`\n📈 Starting gradual ramp-up load test: 100 → 1500 users...`);

            const rampPhases = [
                { users: 100, duration: 30000 }, // 100 users for 30 seconds
                { users: 300, duration: 30000 }, // 300 users for 30 seconds
                { users: 600, duration: 30000 }, // 600 users for 30 seconds
                { users: 1000, duration: 30000 }, // 1000 users for 30 seconds
                { users: 1500, duration: 60000 }, // 1500 users for 60 seconds (peak load)
            ];

            const startTime = Date.now();
            const memoryBefore = process.memoryUsage();

            let totalOperations = 0;
            let successfulOperations = 0;
            let failedOperations = 0;
            const phaseResults = [];

            for (let phaseIndex = 0; phaseIndex < rampPhases.length; phaseIndex++) {
                const phase = rampPhases[phaseIndex];
                console.log(`  📊 Phase ${phaseIndex + 1}: ${phase.users} concurrent users for ${phase.duration / 1000}s`);

                const phaseStartTime = Date.now();
                let phaseOperations = 0;
                let phaseSuccessful = 0;
                let phaseFailed = 0;

                // Create user simulations for this phase
                const phasePromises = Array.from({ length: phase.users }, (_, userId) => {
                    return new Promise<void>((resolve) => {
                        const userStartTime = Date.now();

                        const performOperation = async () => {
                            if (Date.now() - userStartTime >= phase.duration) {
                                resolve();
                                return;
                            }

                            try {
                                const operationType = Math.random();
                                let response;

                                if (operationType < 0.5) {
                                    // 50% - Read operation
                                    const targetUserId = existingUserIds[Math.floor(Math.random() * existingUserIds.length)];
                                    response = await request(app.getHttpServer())
                                        .get(`/api/internal/users/${targetUserId}`)
                                        .set('x-internal-service', 'user-service-internal');
                                } else if (operationType < 0.7) {
                                    // 20% - Create operation
                                    response = await request(app.getHttpServer())
                                        .post('/api/internal/users')
                                        .set('x-internal-service', 'user-service-internal')
                                        .send({
                                            name: `Ramp User ${phaseIndex}-${userId}-${Date.now()}`,
                                            email: `ramp-${phaseIndex}-${userId}-${Date.now()}@example.com`,
                                            password: '$2b$10$hashedPasswordFromAuthService',
                                        });
                                } else if (operationType < 0.9) {
                                    // 20% - Update operation
                                    const targetUserId = existingUserIds[Math.floor(Math.random() * existingUserIds.length)];
                                    response = await request(app.getHttpServer())
                                        .patch(`/api/internal/users/${targetUserId}/last-login`)
                                        .set('x-internal-service', 'user-service-internal');
                                } else {
                                    // 10% - Health check
                                    response = await request(app.getHttpServer())
                                        .get('/api/health');
                                }

                                phaseOperations++;
                                totalOperations++;

                                if (response.status >= 200 && response.status < 300) {
                                    phaseSuccessful++;
                                    successfulOperations++;
                                } else {
                                    phaseFailed++;
                                    failedOperations++;
                                }

                            } catch (error) {
                                phaseFailed++;
                                failedOperations++;
                                phaseOperations++;
                                totalOperations++;
                            }

                            // Schedule next operation (1-3 seconds interval)
                            setTimeout(performOperation, 1000 + Math.random() * 2000);
                        };

                        // Start first operation with staggered timing
                        setTimeout(performOperation, Math.random() * 1000);
                    });
                });

                // Wait for phase to complete
                await Promise.all(phasePromises);

                const phaseEndTime = Date.now();
                const phaseDuration = phaseEndTime - phaseStartTime;
                const phaseSuccessRate = phaseOperations > 0 ? (phaseSuccessful / phaseOperations) : 0;
                const phaseThroughput = (phaseOperations / phaseDuration) * 1000;

                phaseResults.push({
                    phase: phaseIndex + 1,
                    users: phase.users,
                    operations: phaseOperations,
                    successful: phaseSuccessful,
                    failed: phaseFailed,
                    successRate: phaseSuccessRate,
                    throughput: phaseThroughput,
                    duration: phaseDuration,
                });

                console.log(`    ✅ Phase ${phaseIndex + 1} completed: ${phaseOperations} ops, ${(phaseSuccessRate * 100).toFixed(1)}% success, ${phaseThroughput.toFixed(1)} ops/sec`);

                // Each phase should maintain good performance
                expect(phaseSuccessRate).toBeGreaterThan(0.95); // At least 95% success rate per phase
                expect(phaseThroughput).toBeGreaterThan(20); // At least 20 operations per second per phase
            }

            const endTime = Date.now();
            const memoryAfter = process.memoryUsage();
            const totalDuration = endTime - startTime;

            console.log(`✅ Gradual ramp-up test completed in ${totalDuration}ms`);
            console.log(`📊 Total operations: ${totalOperations}`);
            console.log(`✅ Overall successful: ${successfulOperations} (${((successfulOperations / totalOperations) * 100).toFixed(1)}%)`);
            console.log(`❌ Overall failed: ${failedOperations} (${((failedOperations / totalOperations) * 100).toFixed(1)}%)`);
            console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 Overall throughput: ${Math.round((totalOperations / totalDuration) * 1000)} operations/second`);

            // Overall performance requirements
            const overallSuccessRate = successfulOperations / totalOperations;
            expect(overallSuccessRate).toBeGreaterThan(0.95); // At least 95% overall success rate

            // System should handle increasing load gracefully
            const peakPhase = phaseResults[phaseResults.length - 1]; // Last phase with 1500 users
            expect(peakPhase.successRate).toBeGreaterThan(0.90); // Even at peak loaЫЫd, maintain 90% success rate
            expect(peakPhase.throughput).toBeGreaterThan(30); // At least 30 operations per second at peak

            // Memory usage should remain reasonable throughout ramp-up
            const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
            expect(memoryIncrease).toBeLessThan(400); // Less than 400MB increase during entire ramp-up

            // Performance should not degrade significantly as load increases
            const firstPhase = phaseResults[0];
            const lastPhase = phaseResults[phaseResults.length - 1];
            const throughputDegradation = (firstPhase.throughput - lastPhase.throughput) / firstPhase.throughput;
            expect(throughputDegradation).toBeLessThan(0.5); // Throughput should not degrade by more than 50%
        }, 400000); // 6+ minutes timeout
    });
});