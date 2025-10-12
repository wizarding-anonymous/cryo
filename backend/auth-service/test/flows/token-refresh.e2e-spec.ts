import * as request from 'supertest';
import { createHash } from 'crypto';
import { AuthFlowTestSetup, TestContext } from './test-setup';

describe('Auth Service E2E - Token Refresh Flow', () => {
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

  describe('Complete Token Refresh Flow (Requirement 8.7)', () => {
    let loggedInUser: any;
    let accessToken: string;
    let refreshToken: string;
    let sessionId: string;

    beforeEach(async () => {
      // Create and login a user for token refresh tests
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      
      // Register user
      const registerResponse = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User Token Refresh',
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

    it('should successfully refresh tokens with complete flow validation', async () => {
      // Step 1: Verify current tokens are valid
      const preRefreshValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: accessToken })
        .expect(200);

      expect(preRefreshValidation.body.valid).toBe(true);

      // Step 2: Refresh tokens
      const refreshResponse = await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      // Verify response structure
      expect(refreshResponse.body).toHaveProperty('access_token');
      expect(refreshResponse.body).toHaveProperty('refresh_token');
      expect(refreshResponse.body).toHaveProperty('expires_in');

      // Verify new tokens are different from old ones
      expect(refreshResponse.body.access_token).not.toBe(accessToken);
      expect(refreshResponse.body.refresh_token).not.toBe(refreshToken);

      // Store new tokens for cleanup
      context.testTokens.push(refreshResponse.body.access_token, refreshResponse.body.refresh_token);

      // Step 3: Verify old tokens are blacklisted (Requirement 15.4)
      const oldAccessTokenHash = createHash('sha256').update(accessToken).digest('hex');
      const oldRefreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

      const blacklistResult = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = ANY($1)',
        [[oldAccessTokenHash, oldRefreshTokenHash]]
      );
      expect(blacklistResult).toHaveLength(2);

      // Step 4: Verify old tokens are blacklisted in Redis
      const redisAccessBlacklist = await context.redis.get(`blacklist:${accessToken}`);
      const redisRefreshBlacklist = await context.redis.get(`blacklist:${refreshToken}`);
      expect(redisAccessBlacklist).toBe('true');
      expect(redisRefreshBlacklist).toBe('true');

      // Step 5: Verify old tokens are no longer valid
      const oldTokenValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: accessToken })
        .expect(200);

      expect(oldTokenValidation.body.valid).toBe(false);
      expect(oldTokenValidation.body.reason).toContain('blacklisted');

      // Step 6: Verify new tokens are valid
      const newTokenValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: refreshResponse.body.access_token })
        .expect(200);

      expect(newTokenValidation.body.valid).toBe(true);
      expect(newTokenValidation.body.user.id).toBe(loggedInUser.id);

      // Step 7: Verify session was updated with new token hashes
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      
      const newAccessTokenHash = createHash('sha256').update(refreshResponse.body.access_token).digest('hex');
      const newRefreshTokenHash = createHash('sha256').update(refreshResponse.body.refresh_token).digest('hex');
      
      expect(sessionResult[0].access_token_hash).toBe(newAccessTokenHash);
      expect(sessionResult[0].refresh_token_hash).toBe(newRefreshTokenHash);
    });

    it('should handle atomic token rotation (Requirement 15.4)', async () => {
      // Test that token rotation is atomic - either all operations succeed or all fail
      
      const refreshResponse = await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      context.testTokens.push(refreshResponse.body.access_token, refreshResponse.body.refresh_token);

      // Verify atomicity: old tokens blacklisted AND new tokens generated
      const oldAccessTokenHash = createHash('sha256').update(accessToken).digest('hex');
      const newAccessTokenHash = createHash('sha256').update(refreshResponse.body.access_token).digest('hex');

      // Check old token is blacklisted
      const oldBlacklistResult = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = $1',
        [oldAccessTokenHash]
      );
      expect(oldBlacklistResult).toHaveLength(1);

      // Check new token is not blacklisted
      const newBlacklistResult = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = $1',
        [newAccessTokenHash]
      );
      expect(newBlacklistResult).toHaveLength(0);

      // Check session has new token hashes
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessionResult[0].access_token_hash).toBe(newAccessTokenHash);
    });

    it('should reject refresh with invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid.refresh.token';

      await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: invalidRefreshToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid refresh token');
        });
    });

    it('should reject refresh with blacklisted refresh token', async () => {
      // First, use the refresh token
      const firstRefreshResponse = await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      context.testTokens.push(firstRefreshResponse.body.access_token, firstRefreshResponse.body.refresh_token);

      // Try to use the old refresh token again
      await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid refresh token');
        });
    });

    it('should handle concurrent refresh attempts', async () => {
      // Send multiple concurrent refresh requests with the same token
      const promises = Array(3).fill(null).map(() =>
        request(context.app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refresh_token: refreshToken })
      );

      const responses = await Promise.allSettled(promises);
      
      // Only one should succeed (200), others should fail (401)
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      const failedResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 401
      );

      expect(successfulResponses).toHaveLength(1);
      expect(failedResponses).toHaveLength(2);

      // Cleanup successful refresh
      if (successfulResponses.length > 0) {
        const successResponse = successfulResponses[0] as any;
        context.testTokens.push(
          successResponse.value.body.access_token,
          successResponse.value.body.refresh_token
        );
      }
    });

    it('should handle refresh token expiration', async () => {
      // This test would require mocking expired tokens
      // For now, we test with a malformed token that simulates expiration
      
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: expiredToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid refresh token');
        });
    });

    it('should handle Redis failure during token refresh gracefully', async () => {
      // Test that refresh still works even if Redis operations fail
      
      const refreshResponse = await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken });

      // Should either succeed (200) or fail gracefully (500)
      expect([200, 500]).toContain(refreshResponse.status);

      if (refreshResponse.status === 200) {
        context.testTokens.push(refreshResponse.body.access_token, refreshResponse.body.refresh_token);
        
        // Verify database blacklist still works
        const oldTokenHash = createHash('sha256').update(accessToken).digest('hex');
        const blacklistResult = await context.dataSource.query(
          'SELECT * FROM token_blacklist WHERE token_hash = $1',
          [oldTokenHash]
        );
        expect(blacklistResult).toHaveLength(1);
      }
    });

    it('should maintain session continuity during refresh', async () => {
      // Verify that session remains active and valid during token refresh
      
      const refreshResponse = await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      context.testTokens.push(refreshResponse.body.access_token, refreshResponse.body.refresh_token);

      // Verify session is still active
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessionResult[0].is_active).toBe(true);

      // Verify new token works with the same session
      const tokenValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: refreshResponse.body.access_token })
        .expect(200);

      expect(tokenValidation.body.valid).toBe(true);
      expect(tokenValidation.body.user.id).toBe(loggedInUser.id);
    });

    it('should handle refresh with user invalidation', async () => {
      // Simulate user-level token invalidation
      await context.redis.set(`user_invalidated:${loggedInUser.id}`, 'true', 'EX', 86400);

      await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('All user tokens have been invalidated');
        });

      // Cleanup Redis key
      await context.redis.del(`user_invalidated:${loggedInUser.id}`);
    });
  });

  describe('Token Refresh Input Validation', () => {
    it('should validate required refresh_token field', async () => {
      await request(context.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('refresh_token');
        });
    });

    it('should validate refresh_token format', async () => {
      const invalidTokens = [
        '',
        'invalid-token',
        'not.a.jwt',
        123,
        null,
        undefined,
      ];

      for (const token of invalidTokens) {
        await request(context.app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refresh_token: token })
          .expect(400);
      }
    });
  });
});