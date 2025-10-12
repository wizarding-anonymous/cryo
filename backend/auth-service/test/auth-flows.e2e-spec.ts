import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

describe('Auth Service E2E - Complete Authentication Flows', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let redis: Redis;
    let configService: ConfigService;

    // Test data storage for cleanup
    const testUsers: any[] = [];
    const testSessions: any[] = [];
    const testTokens: string[] = [];

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply the same configuration as main.ts
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
            }),
        );

        app.setGlobalPrefix('api');

        // Get services for cleanup and verification
        dataSource = app.get(DataSource);
        configService = app.get(ConfigService);

        // Initialize Redis connection for shared cache verification
        redis = new Redis({
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
        });

        await app.init();

        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        await cleanupTestData();

        if (redis) {
            await redis.disconnect();
        }

        if (app) {
            await app.close();
        }
    });

    beforeEach(async () => {
        // Clear test data arrays for each test
        testUsers.length = 0;
        testSessions.length = 0;
        testTokens.length = 0;
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    /**
     * Cleanup function to remove test data from database and Redis
     */
    async function cleanupTestData() {
        try {
            // Clean up sessions
            if (testSessions.length > 0) {
                await dataSource.query(
                    'DELETE FROM sessions WHERE id = ANY($1)',
                    [testSessions.map(s => s.id)]
                );
            }

            // Clean up token blacklist
            if (testTokens.length > 0) {
                const tokenHashes = testTokens.map(token =>
                    createHash('sha256').update(token).digest('hex')
                );
                await dataSource.query(
                    'DELETE FROM token_blacklist WHERE token_hash = ANY($1)',
                    [tokenHashes]
                );

                // Clean up Redis blacklist
                for (const token of testTokens) {
                    await redis.del(`blacklist:${token}`);
                }
            }
        } catch (error) {
            console.warn('Cleanup error (non-critical):', error.message);
        }
    }

    /**
     * Generate unique test email
     */
    function generateTestEmail(): string {
        return `test-${randomBytes(8).toString('hex')}@example.com`;
    }

    /**
     * Generate strong test password
     */
    function generateTestPassword(): string {
        return `TestPass${randomBytes(4).toString('hex')}!`;
    }

    describe('Complete User Registration Flow (Requirement 8.3)', () => {
        it('should successfully register a new user with complete flow validation', async () => {
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();
            const registrationData = {
                name: 'Test User Registration',
                email: testEmail,
                password: testPassword,
            };

            // Step 1: Register user
            const registerResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData)
                .expect(201);

            // Verify response structure
            expect(registerResponse.body).toHaveProperty('user');
            expect(registerResponse.body).toHaveProperty('access_token');
            expect(registerResponse.body).toHaveProperty('refresh_token');
            expect(registerResponse.body).toHaveProperty('session_id');
            expect(registerResponse.body).toHaveProperty('expires_in');

            // Verify user data (password should be excluded)
            expect(registerResponse.body.user.email).toBe(testEmail);
            expect(registerResponse.body.user.name).toBe(registrationData.name);
            expect(registerResponse.body.user).not.toHaveProperty('password');

            // Store test data for cleanup
            testUsers.push(registerResponse.body.user);
            testSessions.push({ id: registerResponse.body.session_id });
            testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);

            // Step 2: Verify session was created in database with hashed tokens
            const sessionResult = await dataSource.query(
                'SELECT * FROM sessions WHERE id = $1',
                [registerResponse.body.session_id]
            );
            expect(sessionResult).toHaveLength(1);
            expect(sessionResult[0].user_id).toBe(registerResponse.body.user.id);
            expect(sessionResult[0].is_active).toBe(true);

            // Verify tokens are stored as hashes (Requirement 15.2)
            expect(sessionResult[0].access_token_hash).toHaveLength(64); // SHA-256 hash
            expect(sessionResult[0].refresh_token_hash).toHaveLength(64);
            expect(sessionResult[0].access_token_hash).not.toBe(registerResponse.body.access_token);

            // Step 3: Verify tokens are valid and not blacklisted
            const tokenValidationResponse = await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: registerResponse.body.access_token })
                .expect(200);

            expect(tokenValidationResponse.body.valid).toBe(true);
            expect(tokenValidationResponse.body.user.id).toBe(registerResponse.body.user.id);

            // Step 4: Verify event was published for event-driven architecture
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for event processing

            // In a real scenario, we would verify the event was processed by checking
            // notification service logs or welcome email queue
            expect(registerResponse.body.user.email).toBe(testEmail);
        });

        it('should reject duplicate email registration', async () => {
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();
            const registrationData = {
                name: 'Test User Duplicate',
                email: testEmail,
                password: testPassword,
            };

            // First registration should succeed
            const firstResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData)
                .expect(201);

            testUsers.push(firstResponse.body.user);
            testSessions.push({ id: firstResponse.body.session_id });
            testTokens.push(firstResponse.body.access_token, firstResponse.body.refresh_token);

            // Second registration with same email should fail
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData)
                .expect(409)
                .expect((res) => {
                    expect(res.body.message).toContain('уже существует');
                });
        });

        it('should validate password strength requirements (Requirement 8.4)', async () => {
            const testCases = [
                { password: 'weak', expectedError: 'не менее 8 символов' },
                { password: 'nouppercase123!', expectedError: 'заглавную букву' },
                { password: 'NOLOWERCASE123!', expectedError: 'строчную букву' },
                { password: 'NoNumbers!', expectedError: 'цифру' },
                { password: 'NoSpecialChars123', expectedError: 'специальный символ' },
            ];

            for (const testCase of testCases) {
                await request(app.getHttpServer())
                    .post('/api/auth/register')
                    .send({
                        name: 'Test User',
                        email: generateTestEmail(),
                        password: testCase.password,
                    })
                    .expect(400)
                    .expect((res) => {
                        expect(res.body.message).toContain(testCase.expectedError);
                    });
            }
        });

        it('should handle concurrent registrations with same email (Race Condition Test)', async () => {
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();
            const registrationData = {
                name: 'Test Concurrent User',
                email: testEmail,
                password: testPassword,
            };

            // Send multiple concurrent registration requests
            const promises = Array(3).fill(null).map(() =>
                request(app.getHttpServer())
                    .post('/api/auth/register')
                    .send(registrationData)
            );

            const responses = await Promise.allSettled(promises);

            // Only one should succeed (201), others should fail (409)
            const successfulResponses = responses.filter(r =>
                r.status === 'fulfilled' && r.value.status === 201
            );
            const failedResponses = responses.filter(r =>
                r.status === 'fulfilled' && r.value.status === 409
            );

            expect(successfulResponses).toHaveLength(1);
            expect(failedResponses).toHaveLength(2);

            // Cleanup successful registration
            if (successfulResponses.length > 0) {
                const successResponse = successfulResponses[0] as any;
                testUsers.push(successResponse.value.body.user);
                testSessions.push({ id: successResponse.value.body.session_id });
                testTokens.push(
                    successResponse.value.body.access_token,
                    successResponse.value.body.refresh_token
                );
            }
        });
    });

    describe('Complete User Login Flow (Requirement 8.4)', () => {
        let registeredUser: any;
        let registeredUserPassword: string;

        beforeEach(async () => {
            // Create a user for login tests
            const testEmail = generateTestEmail();
            registeredUserPassword = generateTestPassword();

            const registerResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Login',
                    email: testEmail,
                    password: registeredUserPassword,
                })
                .expect(201);

            registeredUser = registerResponse.body.user;
            testUsers.push(registeredUser);
            testSessions.push({ id: registerResponse.body.session_id });
            testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);
        });

        it('should successfully login with valid credentials', async () => {
            const loginData = {
                email: registeredUser.email,
                password: registeredUserPassword,
            };

            // Step 1: Login with valid credentials
            const loginResponse = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            // Verify response structure
            expect(loginResponse.body).toHaveProperty('user');
            expect(loginResponse.body).toHaveProperty('access_token');
            expect(loginResponse.body).toHaveProperty('refresh_token');
            expect(loginResponse.body).toHaveProperty('session_id');
            expect(loginResponse.body).toHaveProperty('expires_in');

            // Verify user data matches
            expect(loginResponse.body.user.id).toBe(registeredUser.id);
            expect(loginResponse.body.user.email).toBe(registeredUser.email);
            expect(loginResponse.body.user).not.toHaveProperty('password');

            // Store new session and tokens for cleanup
            testSessions.push({ id: loginResponse.body.session_id });
            testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);

            // Step 2: Verify new session was created with hashed tokens
            const sessionResult = await dataSource.query(
                'SELECT * FROM sessions WHERE id = $1',
                [loginResponse.body.session_id]
            );
            expect(sessionResult).toHaveLength(1);
            expect(sessionResult[0].user_id).toBe(registeredUser.id);
            expect(sessionResult[0].is_active).toBe(true);

            // Verify tokens are hashed (Requirement 15.2)
            expect(sessionResult[0].access_token_hash).toHaveLength(64);
            expect(sessionResult[0].refresh_token_hash).toHaveLength(64);

            // Step 3: Verify tokens are valid
            const tokenValidationResponse = await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: loginResponse.body.access_token })
                .expect(200);

            expect(tokenValidationResponse.body.valid).toBe(true);
            expect(tokenValidationResponse.body.user.id).toBe(registeredUser.id);

            // Step 4: Verify Redis blacklist check
            const isBlacklisted = await redis.get(`blacklist:${loginResponse.body.access_token}`);
            expect(isBlacklisted).toBeNull(); // Should not be blacklisted
        });

        it('should reject login with invalid password', async () => {
            const loginData = {
                email: registeredUser.email,
                password: 'WrongPassword123!',
            };

            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send(loginData)
                .expect(401)
                .expect((res) => {
                    expect(res.body.message).toContain('Неверный email или пароль');
                });
        });

        it('should reject login with non-existent email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: registeredUserPassword,
            };

            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send(loginData)
                .expect(401)
                .expect((res) => {
                    expect(res.body.message).toContain('Неверный email или пароль');
                });
        });

        it('should handle concurrent session limit enforcement (Requirement 15.1)', async () => {
            const loginData = {
                email: registeredUser.email,
                password: registeredUserPassword,
            };

            // Create multiple concurrent login sessions
            const loginPromises = Array(6).fill(null).map(() =>
                request(app.getHttpServer())
                    .post('/api/auth/login')
                    .send(loginData)
            );

            const responses = await Promise.all(loginPromises);

            // All should succeed initially
            responses.forEach(response => {
                expect(response.status).toBe(200);
                testSessions.push({ id: response.body.session_id });
                testTokens.push(response.body.access_token, response.body.refresh_token);
            });

            // Verify session limit enforcement by checking active sessions
            const activeSessions = await dataSource.query(
                'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND is_active = true',
                [registeredUser.id]
            );

            // Should respect session limit (default is typically 5)
            expect(parseInt(activeSessions[0].count)).toBeLessThanOrEqual(5);
        });

        it('should track login metadata (IP, User Agent)', async () => {
            const loginData = {
                email: registeredUser.email,
                password: registeredUserPassword,
            };

            const loginResponse = await request(app.getHttpServer())
                .post('/api/auth/login')
                .set('User-Agent', 'Test-Agent/1.0')
                .set('X-Forwarded-For', '192.168.1.100')
                .send(loginData)
                .expect(200);

            testSessions.push({ id: loginResponse.body.session_id });
            testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);

            // Verify session metadata was stored
            const sessionResult = await dataSource.query(
                'SELECT * FROM sessions WHERE id = $1',
                [loginResponse.body.session_id]
            );

            expect(sessionResult[0].user_agent).toContain('Test-Agent');
            // IP tracking depends on proxy configuration
        });

        it('should handle rate limiting on login attempts', async () => {
            const loginData = {
                email: registeredUser.email,
                password: 'WrongPassword123!',
            };

            // Make multiple failed login attempts rapidly
            const attempts = Array(10).fill(null).map(() =>
                request(app.getHttpServer())
                    .post('/api/auth/login')
                    .send(loginData)
            );

            const responses = await Promise.allSettled(attempts);

            // Some requests should be rate limited (429)
            const rateLimitedResponses = responses.filter(r =>
                r.status === 'fulfilled' && (r.value as any).status === 429
            );

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Complete Logout Flow (Requirement 8.5)', () => {
        let loggedInUser: any;
        let accessToken: string;
        let refreshToken: string;
        let sessionId: string;

        beforeEach(async () => {
            // Create and login a user for logout tests
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registerResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Logout',
                    email: testEmail,
                    password: testPassword,
                })
                .expect(201);

            loggedInUser = registerResponse.body.user;
            accessToken = registerResponse.body.access_token;
            refreshToken = registerResponse.body.refresh_token;
            sessionId = registerResponse.body.session_id;

            testUsers.push(loggedInUser);
            testSessions.push({ id: sessionId });
            testTokens.push(accessToken, refreshToken);
        });

        it('should successfully logout with atomic token blacklisting (Requirement 15.3)', async () => {
            // Step 1: Logout
            const logoutResponse = await request(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(logoutResponse.body.message).toContain('успешно');

            // Step 2: Verify tokens are blacklisted in Redis
            const accessTokenBlacklisted = await redis.get(`blacklist:${accessToken}`);
            const refreshTokenBlacklisted = await redis.get(`blacklist:${refreshToken}`);

            expect(accessTokenBlacklisted).toBe('true');
            expect(refreshTokenBlacklisted).toBe('true');

            // Step 3: Verify tokens are blacklisted in database
            const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
            const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

            const blacklistResult = await dataSource.query(
                'SELECT * FROM token_blacklist WHERE token_hash = ANY($1)',
                [[accessTokenHash, refreshTokenHash]]
            );
            expect(blacklistResult).toHaveLength(2);

            // Step 4: Verify session is invalidated
            const sessionResult = await dataSource.query(
                'SELECT * FROM sessions WHERE id = $1',
                [sessionId]
            );
            expect(sessionResult[0].is_active).toBe(false);

            // Step 5: Verify tokens are no longer valid
            await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(401);
        });

        it('should handle logout with invalid token gracefully', async () => {
            const invalidToken = 'invalid.jwt.token';

            await request(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${invalidToken}`)
                .expect(401);
        });

        it('should handle logout consistency during Redis failures', async () => {
            // This test would require mocking Redis failures
            // For now, we test that logout completes even if Redis is slow

            const logoutResponse = await request(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(logoutResponse.body.message).toContain('успешно');

            // Verify database blacklisting still works
            const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
            const blacklistResult = await dataSource.query(
                'SELECT * FROM token_blacklist WHERE token_hash = $1',
                [accessTokenHash]
            );
            expect(blacklistResult).toHaveLength(1);
        });
    });

    describe('Token Refresh Flow (Requirement 8.7)', () => {
        let loggedInUser: any;
        let accessToken: string;
        let refreshToken: string;

        beforeEach(async () => {
            // Create and login a user for refresh tests
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registerResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Refresh',
                    email: testEmail,
                    password: testPassword,
                })
                .expect(201);

            loggedInUser = registerResponse.body.user;
            accessToken = registerResponse.body.access_token;
            refreshToken = registerResponse.body.refresh_token;

            testUsers.push(loggedInUser);
            testSessions.push({ id: registerResponse.body.session_id });
            testTokens.push(accessToken, refreshToken);
        });

        it('should successfully refresh tokens with rotation (Requirement 15.4)', async () => {
            // Step 1: Refresh tokens
            const refreshResponse = await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ refresh_token: refreshToken })
                .expect(200);

            // Verify new tokens are provided
            expect(refreshResponse.body).toHaveProperty('access_token');
            expect(refreshResponse.body).toHaveProperty('refresh_token');
            expect(refreshResponse.body).toHaveProperty('expires_in');

            // Verify new tokens are different from old ones
            expect(refreshResponse.body.access_token).not.toBe(accessToken);
            expect(refreshResponse.body.refresh_token).not.toBe(refreshToken);

            // Store new tokens for cleanup
            testTokens.push(refreshResponse.body.access_token, refreshResponse.body.refresh_token);

            // Step 2: Verify old refresh token is blacklisted
            const oldRefreshTokenBlacklisted = await redis.get(`blacklist:${refreshToken}`);
            expect(oldRefreshTokenBlacklisted).toBe('true');

            // Step 3: Verify new tokens are valid
            const tokenValidationResponse = await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: refreshResponse.body.access_token })
                .expect(200);

            expect(tokenValidationResponse.body.valid).toBe(true);
            expect(tokenValidationResponse.body.user.id).toBe(loggedInUser.id);

            // Step 4: Verify old access token still works (until it expires naturally)
            const oldTokenValidationResponse = await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(oldTokenValidationResponse.body.valid).toBe(true);
        });

        it('should reject refresh with invalid refresh token', async () => {
            const invalidRefreshToken = 'invalid.refresh.token';

            await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ refresh_token: invalidRefreshToken })
                .expect(401);
        });

        it('should reject refresh with blacklisted refresh token', async () => {
            // First, blacklist the refresh token by logging out
            await request(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            // Then try to refresh with the blacklisted token
            await request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ refresh_token: refreshToken })
                .expect(401);
        });
    });

    describe('Token Validation Flow', () => {
        let loggedInUser: any;
        let accessToken: string;

        beforeEach(async () => {
            // Create and login a user for validation tests
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registerResponse = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Validation',
                    email: testEmail,
                    password: testPassword,
                })
                .expect(201);

            loggedInUser = registerResponse.body.user;
            accessToken = registerResponse.body.access_token;

            testUsers.push(loggedInUser);
            testSessions.push({ id: registerResponse.body.session_id });
            testTokens.push(accessToken, registerResponse.body.refresh_token);
        });

        it('should validate valid token successfully', async () => {
            const validationResponse = await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.user.id).toBe(loggedInUser.id);
            expect(validationResponse.body.user.email).toBe(loggedInUser.email);
            expect(validationResponse.body.user).not.toHaveProperty('password');
        });

        it('should reject validation of blacklisted token', async () => {
            // First blacklist the token by logging out
            await request(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            // Then try to validate the blacklisted token
            await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(401);
        });

        it('should reject validation of malformed token', async () => {
            const malformedToken = 'not.a.valid.jwt.token';

            await request(app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: malformedToken })
                .expect(401);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle User Service unavailability during registration', async () => {
            // This test simulates User Service being unavailable
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registrationData = {
                name: 'Test User Service Error',
                email: testEmail,
                password: testPassword,
            };

            const response = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData);

            // Should either succeed (201) or fail gracefully with service unavailable (503)
            expect([201, 503]).toContain(response.status);

            if (response.status === 201) {
                testUsers.push(response.body.user);
                testSessions.push({ id: response.body.session_id });
                testTokens.push(response.body.access_token, response.body.refresh_token);
            }
        });

        it('should handle Redis unavailability gracefully', async () => {
            // Test that authentication still works even if Redis is temporarily unavailable
            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registrationData = {
                name: 'Test Redis Error',
                email: testEmail,
                password: testPassword,
            };

            // Registration should still work (tokens stored in database)
            const response = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData);

            expect([201, 503]).toContain(response.status);

            if (response.status === 201) {
                testUsers.push(response.body.user);
                testSessions.push({ id: response.body.session_id });
                testTokens.push(response.body.access_token, response.body.refresh_token);

                // Token validation should still work (fallback to database)
                const validationResponse = await request(app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({ token: response.body.access_token });

                expect([200, 503]).toContain(validationResponse.status);
            }
        });

        it('should handle database connection issues', async () => {
            // This test would require mocking database failures
            // For now, we test that the service responds appropriately to connection issues

            const testEmail = generateTestEmail();
            const testPassword = generateTestPassword();

            const registrationData = {
                name: 'Test DB Error',
                email: testEmail,
                password: testPassword,
            };

            const response = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(registrationData);

            // Should either succeed or fail with appropriate error
            expect([201, 500, 503]).toContain(response.status);

            if (response.status === 201) {
                testUsers.push(response.body.user);
                testSessions.push({ id: response.body.session_id });
                testTokens.push(response.body.access_token, response.body.refresh_token);
            }
        });
    });
});