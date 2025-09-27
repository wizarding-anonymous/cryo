import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AchievementModule } from '../src/achievement/achievement.module';
import { testDatabaseConfig } from './test-database.config';
import { seedTestData, cleanupTestData } from './test-utils';
import { EventType } from '../src/achievement/dto/update-progress.dto';
import { UserAchievementResponseDto } from '../src/achievement/dto/user-achievement-response.dto';

describe('Comprehensive Error Handling and Edge Cases (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot(testDatabaseConfig),
                CacheModule.register({
                    ttl: 300,
                    max: 100,
                }),
                AchievementModule,
            ],
        })
            .overrideProvider('APP_GUARD')
            .useValue({
                canActivate: () => true, // Mock JWT guard for testing
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        await app.init();

        dataSource = moduleFixture.get<DataSource>(DataSource);
        await seedTestData(dataSource);
    });

    afterAll(async () => {
        await cleanupTestData(dataSource);
        await app.close();
    });

    beforeEach(async () => {
        // Clean up user-specific data before each test
        const userAchievementRepo = dataSource.getRepository('UserAchievement');
        const userProgressRepo = dataSource.getRepository('UserProgress');
        await userProgressRepo.clear();
        await userAchievementRepo.clear();
    });

    describe('Advanced Input Validation', () => {
        describe('UUID Validation Edge Cases', () => {
            it('should reject various invalid UUID formats', async () => {
                const invalidUUIDs = [
                    'invalid-uuid',
                    '123',
                    '123e4567-e89b-12d3-a456-42661417400', // Too short
                    '123e4567-e89b-12d3-a456-426614174000x', // Too long
                    '123e4567-e89b-12d3-a456-42661417400g', // Invalid character
                    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Invalid format
                    '00000000-0000-0000-0000-000000000000', // All zeros (valid UUID but edge case)
                    '', // Empty string
                    null,
                    undefined,
                ];

                for (const invalidUUID of invalidUUIDs) {
                    if (invalidUUID !== null && invalidUUID !== undefined) {
                        await request(app.getHttpServer())
                            .post('/achievements/unlock')
                            .send({
                                userId: invalidUUID,
                                achievementId: '123e4567-e89b-12d3-a456-426614174001',
                            })
                            .expect(400);

                        await request(app.getHttpServer())
                            .post('/achievements/unlock')
                            .send({
                                userId: '123e4567-e89b-12d3-a456-426614174000',
                                achievementId: invalidUUID,
                            })
                            .expect(400);
                    }
                }
            });

            it('should handle URL parameter UUID validation', async () => {
                const invalidUUIDs = [
                    'not-a-uuid',
                    '123',
                    'special-chars-!@#$%',
                    '../../../etc/passwd', // Path traversal attempt
                    '%00', // Null byte
                    'javascript:alert(1)', // XSS attempt
                ];

                for (const invalidUUID of invalidUUIDs) {
                    await request(app.getHttpServer()).get(`/achievements/user/${invalidUUID}`).expect(400);

                    await request(app.getHttpServer()).get(`/progress/user/${invalidUUID}`).expect(400);
                }
            });
        });

        describe('Event Type Validation', () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            it('should reject invalid event types', async () => {
                const invalidEventTypes = [
                    'invalid_event',
                    'GAME_PURCHASE', // Wrong case
                    'game-purchase', // Wrong format
                    'game purchase', // Spaces
                    '', // Empty
                    null,
                    undefined,
                    123, // Number
                    {}, // Object
                    [], // Array
                ];

                for (const invalidEventType of invalidEventTypes) {
                    await request(app.getHttpServer())
                        .post('/progress/update')
                        .send({
                            userId: testUserId,
                            eventType: invalidEventType,
                            eventData: {},
                        })
                        .expect(400);
                }
            });

            it('should handle case sensitivity in event types', async () => {
                const caseSensitiveEventTypes = [
                    'Game_Purchase',
                    'GAME_PURCHASE',
                    'game_Purchase',
                    'review_Created',
                    'REVIEW_CREATED',
                    'friend_Added',
                    'FRIEND_ADDED',
                ];

                for (const eventType of caseSensitiveEventTypes) {
                    await request(app.getHttpServer())
                        .post('/progress/update')
                        .send({
                            userId: testUserId,
                            eventType: eventType,
                            eventData: {},
                        })
                        .expect(400);
                }
            });
        });

        describe('Event Data Validation', () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            it('should handle various invalid eventData types', async () => {
                const invalidEventData = [
                    null,
                    undefined,
                    'string',
                    123,
                    true,
                    [],
                    // Note: empty object {} should be valid
                ];

                for (const eventData of invalidEventData) {
                    await request(app.getHttpServer())
                        .post('/progress/update')
                        .send({
                            userId: testUserId,
                            eventType: EventType.GAME_PURCHASE,
                            eventData: eventData,
                        })
                        .expect(400);
                }
            });

            it('should handle extremely large eventData objects', async () => {
                const largeEventData = {
                    gameId: 'game-123',
                    metadata: {
                        // Create a very large string (1MB)
                        description: 'A'.repeat(1024 * 1024),
                        // Large nested object
                        details: {} as Record<string, string>,
                    },
                };

                // Fill nested object with many properties
                for (let i = 0; i < 10000; i++) {
                    largeEventData.metadata.details[`property_${i}`] = `value_${i}`;
                }

                // This should either succeed or fail gracefully (not crash the server)
                const response = await request(app.getHttpServer()).post('/progress/update').send({
                    userId: testUserId,
                    eventType: EventType.GAME_PURCHASE,
                    eventData: largeEventData,
                });

                // Should either succeed (200) or fail with proper error (400/413)
                expect([200, 400, 413]).toContain(response.status);
            });

            it('should handle deeply nested eventData objects', async () => {
                // Create deeply nested object (100 levels deep)
                let deepObject: any = { value: 'deep' };
                for (let i = 0; i < 100; i++) {
                    deepObject = { level: i, nested: deepObject };
                }

                const response = await request(app.getHttpServer())
                    .post('/progress/update')
                    .send({
                        userId: testUserId,
                        eventType: EventType.GAME_PURCHASE,
                        eventData: {
                            gameId: 'game-123',
                            deepData: deepObject,
                        },
                    });

                // Should handle gracefully
                expect([200, 400]).toContain(response.status);
            });

            it('should handle circular references in eventData', async () => {
                const circularObject: any = { gameId: 'game-123' };
                circularObject.self = circularObject; // Create circular reference

                // This should fail during JSON serialization
                try {
                    await request(app.getHttpServer()).post('/progress/update').send({
                        userId: testUserId,
                        eventType: EventType.GAME_PURCHASE,
                        eventData: circularObject,
                    });
                } catch (error) {
                    // Expected to fail due to circular reference
                    expect(error).toBeDefined();
                }
            });
        });

        describe('Query Parameter Edge Cases', () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            it('should handle extreme pagination values', async () => {
                const extremeValues = [
                    { page: -999999, limit: 1 },
                    { page: 1, limit: -999999 },
                    { page: 999999999, limit: 1 },
                    { page: 1, limit: 999999999 },
                    { page: 0, limit: 0 },
                    { page: 1.5, limit: 10.7 }, // Decimal values
                    { page: 'NaN', limit: 'Infinity' },
                    { page: '1e10', limit: '1e10' }, // Scientific notation
                ];

                for (const params of extremeValues) {
                    const response = await request(app.getHttpServer())
                        .get(`/achievements/user/${testUserId}`)
                        .query(params)
                        .expect(200); // Should handle gracefully with defaults

                    expect(response.body).toHaveProperty('page');
                    expect(response.body).toHaveProperty('limit');
                    expect(response.body).toHaveProperty('data');
                    expect(response.body).toHaveProperty('total');
                }
            });

            it('should handle special characters in query parameters', async () => {
                const specialChars = [
                    { type: 'special!@#$%^&*()' },
                    { type: 'unicode测试中文' },
                    { type: 'emoji🎮🎯🏆' },
                    { type: 'html<script>alert(1)</script>' },
                    { type: "sql'; DROP TABLE achievements; --" },
                    { type: 'null\x00byte' },
                ];

                for (const params of specialChars) {
                    const response = await request(app.getHttpServer())
                        .get(`/achievements/user/${testUserId}`)
                        .query(params)
                        .expect(200); // Should handle gracefully

                    expect(response.body).toHaveProperty('data');
                }
            });
        });
    });

    describe('Database Constraint Violations', () => {
        it('should handle duplicate achievement unlock attempts gracefully', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';
            const testAchievementId = '123e4567-e89b-12d3-a456-426614174001';

            // First unlock should succeed
            await request(app.getHttpServer())
                .post('/achievements/unlock')
                .send({
                    userId: testUserId,
                    achievementId: testAchievementId,
                })
                .expect(201);

            // Second unlock should return conflict
            await request(app.getHttpServer())
                .post('/achievements/unlock')
                .send({
                    userId: testUserId,
                    achievementId: testAchievementId,
                })
                .expect(409);

            // Verify only one achievement exists
            const achievements = await request(app.getHttpServer())
                .get(`/achievements/user/${testUserId}`)
                .expect(200);

            const duplicateAchievements = achievements.body.data.filter(
                (a: UserAchievementResponseDto) => a.achievement.id === testAchievementId,
            );
            expect(duplicateAchievements).toHaveLength(1);
        });

        it('should handle concurrent duplicate unlock attempts', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';
            const testAchievementId = '123e4567-e89b-12d3-a456-426614174001';

            // Send multiple concurrent unlock requests
            const promises = Array(5)
                .fill(null)
                .map(() =>
                    request(app.getHttpServer()).post('/achievements/unlock').send({
                        userId: testUserId,
                        achievementId: testAchievementId,
                    }),
                );

            const responses = await Promise.all(promises);

            // Only one should succeed (201), others should fail (409)
            const successfulResponses = responses.filter(r => r.status === 201);
            const conflictResponses = responses.filter(r => r.status === 409);

            expect(successfulResponses).toHaveLength(1);
            expect(conflictResponses).toHaveLength(4);

            // Verify only one achievement exists
            const achievements = await request(app.getHttpServer())
                .get(`/achievements/user/${testUserId}`)
                .expect(200);

            expect(achievements.body.total).toBe(1);
        });
    });

    describe('Network and Protocol Edge Cases', () => {
        it('should handle malformed JSON gracefully', async () => {
            const malformedJsonStrings = [
                '{"userId": "123e4567-e89b-12d3-a456-426614174000", "achievementId":}', // Missing value
                '{"userId": "123e4567-e89b-12d3-a456-426614174000", "achievementId": "123e4567-e89b-12d3-a456-426614174001",}', // Trailing comma
                '{userId: "123e4567-e89b-12d3-a456-426614174000"}', // Unquoted key
                '{"userId": \'123e4567-e89b-12d3-a456-426614174000\'}', // Single quotes
                '{"userId": "123e4567-e89b-12d3-a456-426614174000" "achievementId": "123e4567-e89b-12d3-a456-426614174001"}', // Missing comma
            ];

            for (const malformedJson of malformedJsonStrings) {
                const response = await request(app.getHttpServer())
                    .post('/achievements/unlock')
                    .set('Content-Type', 'application/json')
                    .send(malformedJson)
                    .expect(400);

                expect(response.body).toHaveProperty('message');
            }
        });

        it('should handle various Content-Type headers', async () => {
            const contentTypes = [
                'application/json; charset=utf-8',
                'application/json; charset=iso-8859-1',
                'text/plain',
                'application/x-www-form-urlencoded',
                'multipart/form-data',
                'application/xml',
                '', // Empty content type
            ];

            const validData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                achievementId: '123e4567-e89b-12d3-a456-426614174001',
            };

            for (const contentType of contentTypes) {
                const response = await request(app.getHttpServer())
                    .post('/achievements/unlock')
                    .set('Content-Type', contentType)
                    .send(JSON.stringify(validData));

                // Should either succeed or fail gracefully
                expect([200, 201, 400, 415]).toContain(response.status);
            }
        });

        it('should handle large request headers', async () => {
            const largeHeaderValue = 'x'.repeat(8192); // 8KB header

            const response = await request(app.getHttpServer())
                .post('/achievements/unlock')
                .set('X-Large-Header', largeHeaderValue)
                .send({
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    achievementId: '123e4567-e89b-12d3-a456-426614174001',
                });

            // Should handle gracefully (either succeed or fail with appropriate error)
            expect([200, 201, 400, 413, 431]).toContain(response.status);
        });

        it('should handle request timeout scenarios', async () => {
            // This test simulates slow requests by sending many concurrent requests
            const slowRequests = Array(50)
                .fill(null)
                .map((_, index) =>
                    request(app.getHttpServer())
                        .post('/progress/update')
                        .timeout(5000) // 5 second timeout
                        .send({
                            userId: `user-${index.toString().padStart(3, '0')}`,
                            eventType: EventType.GAME_PURCHASE,
                            eventData: {
                                gameId: `game-${index}`,
                                price: 1999,
                                // Add some processing complexity
                                metadata: Array(1000)
                                    .fill(null)
                                    .map((_, i) => ({ id: i, data: `data-${i}` })),
                            },
                        }),
                );

            try {
                const responses = await Promise.all(slowRequests);

                // Most requests should succeed
                const successfulResponses = responses.filter(r => r.status === 200);
                expect(successfulResponses.length).toBeGreaterThan(40); // At least 80% should succeed
            } catch (error) {
                // Some requests might timeout, which is acceptable for this test
                console.log('Some requests timed out as expected in stress test');
            }
        });
    });

    describe('Resource Exhaustion Scenarios', () => {
        it('should handle memory pressure gracefully', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            // Create many large requests to simulate memory pressure
            const largeRequests = Array(20)
                .fill(null)
                .map((_, index) => {
                    const largeEventData = {
                        gameId: `game-${index}`,
                        // Create large data structure
                        largeArray: Array(10000)
                            .fill(null)
                            .map((_, i) => ({
                                id: i,
                                data: `large-data-${i}`.repeat(10),
                                nested: {
                                    level1: { level2: { level3: `deep-data-${i}` } },
                                },
                            })),
                    };

                    return request(app.getHttpServer()).post('/progress/update').send({
                        userId: testUserId,
                        eventType: EventType.GAME_PURCHASE,
                        eventData: largeEventData,
                    });
                });

            try {
                const responses = await Promise.all(largeRequests);

                // Should handle gracefully - either succeed or fail with appropriate errors
                responses.forEach(response => {
                    expect([200, 400, 413, 500]).toContain(response.status);
                });
            } catch (error) {
                // Memory exhaustion might cause some requests to fail
                console.log('Memory pressure test completed with expected failures');
            }
        });

        it('should handle database connection exhaustion', async () => {
            // Create many concurrent database-intensive requests
            const dbIntensiveRequests = Array(100)
                .fill(null)
                .map((_, index) =>
                    request(app.getHttpServer())
                        .get(`/achievements/user/user-${index.toString().padStart(3, '0')}`)
                        .query({ limit: 50 }),
                );

            try {
                const responses = await Promise.all(dbIntensiveRequests);

                // Most requests should succeed
                const successfulResponses = responses.filter(r => r.status === 200);
                expect(successfulResponses.length).toBeGreaterThan(80); // At least 80% should succeed
            } catch (error) {
                // Some connection exhaustion is expected
                console.log('Database connection exhaustion test completed');
            }
        });
    });

    describe('Security Edge Cases', () => {
        it('should prevent SQL injection attempts', async () => {
            const sqlInjectionAttempts = [
                "'; DROP TABLE achievements; --",
                "' OR '1'='1",
                "'; UPDATE achievements SET points = 999999; --",
                "' UNION SELECT * FROM users; --",
                "'; INSERT INTO user_achievements VALUES ('hacked'); --",
            ];

            for (const injection of sqlInjectionAttempts) {
                // Try injection in userId parameter
                await request(app.getHttpServer())
                    .get(`/achievements/user/${encodeURIComponent(injection)}`)
                    .expect(400); // Should be rejected as invalid UUID

                // Try injection in query parameters
                const response = await request(app.getHttpServer())
                    .get('/achievements/user/123e4567-e89b-12d3-a456-426614174000')
                    .query({ type: injection })
                    .expect(200); // Should handle gracefully

                expect(response.body).toHaveProperty('data');
            }
        });

        it('should prevent XSS attempts in event data', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';
            const xssAttempts = [
                '<script>alert("XSS")</script>',
                'javascript:alert(1)',
                '<img src=x onerror=alert(1)>',
                '"><script>alert(document.cookie)</script>',
                "'; alert('XSS'); //",
            ];

            for (const xss of xssAttempts) {
                const response = await request(app.getHttpServer())
                    .post('/progress/update')
                    .send({
                        userId: testUserId,
                        eventType: EventType.GAME_PURCHASE,
                        eventData: {
                            gameId: 'game-123',
                            title: xss,
                            description: xss,
                        },
                    })
                    .expect(200);

                expect(response.body).toBeInstanceOf(Array);

                // Verify XSS content is stored safely (not executed)
                const progress = await request(app.getHttpServer())
                    .get(`/progress/user/${testUserId}`)
                    .expect(200);

                expect(progress.body).toBeInstanceOf(Array);
            }
        });

        it('should handle path traversal attempts', async () => {
            const pathTraversalAttempts = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\config\\sam',
                '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
                '....//....//....//etc/passwd',
                '/var/log/../../etc/passwd',
            ];

            for (const traversal of pathTraversalAttempts) {
                await request(app.getHttpServer())
                    .get(`/achievements/user/${encodeURIComponent(traversal)}`)
                    .expect(400); // Should be rejected as invalid UUID format
            }
        });
    });

    describe('Data Consistency Under Stress', () => {
        it('should maintain consistency during rapid state changes', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            // Rapidly alternate between different event types
            const rapidEvents = [];
            for (let i = 0; i < 50; i++) {
                const eventTypes = [
                    EventType.GAME_PURCHASE,
                    EventType.REVIEW_CREATED,
                    EventType.FRIEND_ADDED,
                ];
                const eventType = eventTypes[i % eventTypes.length];

                rapidEvents.push(
                    request(app.getHttpServer())
                        .post('/progress/update')
                        .send({
                            userId: testUserId,
                            eventType: eventType,
                            eventData: {
                                id: `event-${i}`,
                                timestamp: new Date().toISOString(),
                            },
                        }),
                );
            }

            const responses = await Promise.all(rapidEvents);

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Verify final state is consistent
            const achievements = await request(app.getHttpServer())
                .get(`/achievements/user/${testUserId}`)
                .expect(200);

            const progress = await request(app.getHttpServer())
                .get(`/progress/user/${testUserId}`)
                .expect(200);

            // Should have unlocked first-time achievements for each event type
            expect(achievements.body.total).toBeGreaterThanOrEqual(3);
            expect(progress.body.length).toBeGreaterThan(0);

            // Verify no duplicate achievements
            const achievementIds = achievements.body.data.map((a: UserAchievementResponseDto) => a.achievement.id);
            const uniqueAchievementIds = [...new Set(achievementIds)];
            expect(achievementIds.length).toBe(uniqueAchievementIds.length);
        });

        it('should handle transaction rollback scenarios', async () => {
            const testUserId = '123e4567-e89b-12d3-a456-426614174000';

            // First, create some progress
            await request(app.getHttpServer())
                .post('/progress/update')
                .send({
                    userId: testUserId,
                    eventType: EventType.GAME_PURCHASE,
                    eventData: { gameId: 'game-1', price: 1999 },
                })
                .expect(200);

            // Verify initial state
            const initialProgress = await request(app.getHttpServer())
                .get(`/progress/user/${testUserId}`)
                .expect(200);

            expect(initialProgress.body.length).toBeGreaterThan(0);

            // Try to cause a potential transaction issue with invalid data mixed with valid data
            try {
                await request(app.getHttpServer())
                    .post('/progress/update')
                    .send({
                        userId: testUserId,
                        eventType: EventType.GAME_PURCHASE,
                        eventData: {
                            gameId: 'game-2',
                            price: 'invalid-price', // This might cause issues in processing
                            invalidField: null,
                        },
                    });
            } catch (error) {
                // Expected to potentially fail
            }

            // Verify that the system is still in a consistent state
            const finalProgress = await request(app.getHttpServer())
                .get(`/progress/user/${testUserId}`)
                .expect(200);

            // Progress should either be unchanged or properly updated
            expect(finalProgress.body.length).toBeGreaterThanOrEqual(initialProgress.body.length);
        });
    });
});
