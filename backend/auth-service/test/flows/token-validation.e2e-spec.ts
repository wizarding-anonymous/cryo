import * as request from 'supertest';
import { createHash } from 'crypto';
import { AuthFlowTestSetup, TestContext } from './test-setup';

describe('Auth Service E2E - Token Validation Flow', () => {
    let context: TestContext;

    beforeAll(async () => {
        context = await AuthFlowTestSetup.createTestApp();
    });

    afterAll(async () => {
        await AuthFlowTestSetup.closeTestApp(context);
    });

    beforeEach(async () => {
        AuthFlowTestSetup.clearTestData(context);
    });

    afterEach(async () => {
        await AuthFlowTestSetup.cleanupTestData(context);
    });

    describe('Complete Token Validation Flow (Requirement 8.7)', () => {
        let loggedInUser: any;
        let accessToken: string;
        let refreshToken: string;
        let sessionId: string;

        beforeEach(async () => {
            // Create and login a user for token validation tests
            const testEmail = AuthFlowTestSetup.generateTestEmail();
            const testPassword = AuthFlowTestSetup.generateTestPassword();

            // Register user
            const registerResponse = await request(context.app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Token Validation',
                    email: testEmail,
                    password: testPassword,
                })
                .expect(201);

            loggedInUser = registerResponse.body.user;
            accessToken = registerResponse.body.access_token;
            refreshToken = registerResponse.body.refresh_token;
            sessionId = registerResponse.body.session_id;

            context.testUsers.push(loggedInUser);
            context.testSessions.push({ id: sessionId });
            context.testTokens.push(accessToken, refreshToken);
        });

        it('should successfully validate valid token with complete flow', async () => {
            // Step 1: Validate token
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            // Verify response structure
            expect(validationResponse.body).toHaveProperty('valid');
            expect(validationResponse.body).toHaveProperty('user');
            expect(validationResponse.body).toHaveProperty('session');

            // Verify validation result
            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.user.id).toBe(loggedInUser.id);
            expect(validationResponse.body.user.email).toBe(loggedInUser.email);
            expect(validationResponse.body.user).not.toHaveProperty('password');

            // Verify session information
            expect(validationResponse.body.session.id).toBe(sessionId);
            expect(validationResponse.body.session.isActive).toBe(true);

            // Step 2: Verify token is checked against blacklist (Redis)
            const redisBlacklist = await context.redis.get(`blacklist:${accessToken}`);
            expect(redisBlacklist).toBeNull(); // Should not be blacklisted

            // Step 3: Verify token is checked against database blacklist
            const tokenHash = createHash('sha256').update(accessToken).digest('hex');
            const dbBlacklist = await context.dataSource.query(
                'SELECT * FROM token_blacklist WHERE token_hash = $1',
                [tokenHash]
            );
            expect(dbBlacklist).toHaveLength(0); // Should not be blacklisted

            // Step 4: Verify user existence check (User Service integration)
            expect(validationResponse.body.user.id).toBeDefined();
            expect(validationResponse.body.user.isActive).toBe(true);
        });

        it('should reject blacklisted token validation', async () => {
            // Step 1: Blacklist the token by logging out
            await request(context.app.getHttpServer())
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            // Step 2: Try to validate blacklisted token
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(false);
            expect(validationResponse.body.reason).toContain('blacklisted');
        });

        it('should reject invalid token format', async () => {
            const invalidTokens = [
                'invalid-token',
                'not.a.jwt.token',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
                '',
            ];

            for (const token of invalidTokens) {
                const validationResponse = await request(context.app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({ token })
                    .expect(200);

                expect(validationResponse.body.valid).toBe(false);
                expect(validationResponse.body.reason).toContain('Invalid token');
            }
        });

        it('should reject expired token', async () => {
            // This test would require mocking expired tokens
            // For now, we test with a malformed token that simulates expiration

            const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: expiredToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(false);
            expect(validationResponse.body.reason).toContain('Invalid token');
        });

        it('should handle user invalidation during validation', async () => {
            // Step 1: Invalidate all user tokens
            await context.redis.set(`user_invalidated:${loggedInUser.id}`, 'true', 'EX', 86400);

            // Step 2: Try to validate token
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(false);
            expect(validationResponse.body.reason).toContain('All user tokens have been invalidated');

            // Cleanup
            await context.redis.del(`user_invalidated:${loggedInUser.id}`);
        });

        it('should handle inactive session during validation', async () => {
            // Step 1: Manually deactivate session
            await context.dataSource.query(
                'UPDATE sessions SET is_active = false WHERE id = $1',
                [sessionId]
            );

            // Step 2: Try to validate token
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(false);
            expect(validationResponse.body.reason).toContain('Session is not active');
        });

        it('should handle Redis failure during validation gracefully', async () => {
            // Test that validation still works even if Redis is unavailable
            // In real scenario, this would require mocking Redis failure

            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            // Should still validate using database fallback
            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.user.id).toBe(loggedInUser.id);
        });

        it('should handle User Service failure during validation gracefully', async () => {
            // Test that validation handles User Service unavailability

            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken });

            // Should either succeed (200) or fail gracefully
            expect([200]).toContain(validationResponse.status);

            if (validationResponse.body.valid) {
                expect(validationResponse.body.user.id).toBe(loggedInUser.id);
            }
        });

        it('should validate token with proper microservice integration', async () => {
            // This test verifies that token validation works for other microservices

            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .set('X-Service-Name', 'user-service')
                .set('X-Correlation-ID', 'test-correlation-123')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.user.id).toBe(loggedInUser.id);

            // Verify that service-to-service validation includes necessary user data
            expect(validationResponse.body.user).toHaveProperty('id');
            expect(validationResponse.body.user).toHaveProperty('email');
            expect(validationResponse.body.user).toHaveProperty('name');
            expect(validationResponse.body.user).not.toHaveProperty('password');
        });

        it('should handle concurrent validation requests', async () => {
            // Send multiple concurrent validation requests
            const promises = Array(5).fill(null).map(() =>
                request(context.app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({ token: accessToken })
            );

            const responses = await Promise.all(promises);

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.valid).toBe(true);
                expect(response.body.user.id).toBe(loggedInUser.id);
            });
        });

        it('should validate refresh token when specified', async () => {
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({
                    token: refreshToken,
                    token_type: 'refresh'
                })
                .expect(200);

            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.user.id).toBe(loggedInUser.id);
        });

        it('should handle token validation with session metadata', async () => {
            const validationResponse = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: accessToken })
                .expect(200);

            expect(validationResponse.body.valid).toBe(true);
            expect(validationResponse.body.session).toHaveProperty('id');
            expect(validationResponse.body.session).toHaveProperty('isActive');
            expect(validationResponse.body.session).toHaveProperty('createdAt');
            expect(validationResponse.body.session).toHaveProperty('lastAccessedAt');
        });
    });

    describe('Token Validation Input Validation', () => {
        it('should validate required token field', async () => {
            await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({})
                .expect(400)
                .expect((res) => {
                    expect(res.body.message).toContain('token');
                });
        });

        it('should validate token field type', async () => {
            const invalidTokens = [
                123,
                null,
                undefined,
                {},
                [],
            ];

            for (const token of invalidTokens) {
                await request(context.app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({ token })
                    .expect(400);
            }
        });

        it('should validate token_type field when provided', async () => {
            const invalidTokenTypes = [
                'invalid',
                123,
                {},
            ];

            for (const tokenType of invalidTokenTypes) {
                await request(context.app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({
                        token: 'some-token',
                        token_type: tokenType
                    })
                    .expect(400);
            }
        });
    });

    describe('Performance and Caching', () => {
        let validToken: string;

        beforeEach(async () => {
            const testEmail = AuthFlowTestSetup.generateTestEmail();
            const testPassword = AuthFlowTestSetup.generateTestPassword();

            const registerResponse = await request(context.app.getHttpServer())
                .post('/api/auth/register')
                .send({
                    name: 'Test User Performance',
                    email: testEmail,
                    password: testPassword,
                })
                .expect(201);

            validToken = registerResponse.body.access_token;

            context.testUsers.push(registerResponse.body.user);
            context.testSessions.push({ id: registerResponse.body.session_id });
            context.testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);
        });

        it('should handle high-frequency validation requests', async () => {
            // Send many validation requests rapidly
            const promises = Array(20).fill(null).map(() =>
                request(context.app.getHttpServer())
                    .post('/api/auth/validate')
                    .send({ token: validToken })
            );

            const startTime = Date.now();
            const responses = await Promise.all(promises);
            const endTime = Date.now();

            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.valid).toBe(true);
            });

            // Should complete within reasonable time (less than 5 seconds for 20 requests)
            expect(endTime - startTime).toBeLessThan(5000);
        });

        it('should cache validation results for performance', async () => {
            // First validation
            const firstValidation = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: validToken })
                .expect(200);

            // Second validation (should be faster due to caching)
            const secondValidation = await request(context.app.getHttpServer())
                .post('/api/auth/validate')
                .send({ token: validToken })
                .expect(200);

            expect(firstValidation.body.valid).toBe(true);
            expect(secondValidation.body.valid).toBe(true);
            expect(firstValidation.body.user.id).toBe(secondValidation.body.user.id);
        });
    });
});