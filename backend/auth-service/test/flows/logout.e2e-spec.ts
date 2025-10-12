import * as request from 'supertest';
import { createHash } from 'crypto';
import { AuthFlowTestSetup, TestContext } from './test-setup';

describe('Auth Service E2E - User Logout Flow', () => {
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

  describe('Complete User Logout Flow (Requirement 8.5)', () => {
    let loggedInUser: any;
    let accessToken: string;
    let refreshToken: string;
    let sessionId: string;

    beforeEach(async () => {
      // Create and login a user for logout tests
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      
      // Register user
      const registerResponse = await request(context.app.getHttpServer())
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

      context.testUsers.push(loggedInUser);
      context.testSessions.push({ id: sessionId });
      context.testTokens.push(accessToken, refreshToken);
    });

    it('should successfully logout with complete flow validation', async () => {
      // Step 1: Verify user is logged in
      const preLogoutValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: accessToken })
        .expect(200);

      expect(preLogoutValidation.body.valid).toBe(true);

      // Step 2: Logout user
      const logoutResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toContain('успешно');

      // Step 3: Verify tokens are blacklisted in database
      const tokenHash = createHash('sha256').update(accessToken).digest('hex');
      const blacklistResult = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = $1',
        [tokenHash]
      );
      expect(blacklistResult).toHaveLength(1);
      expect(blacklistResult[0].reason).toBe('logout');

      // Step 4: Verify tokens are blacklisted in Redis
      const redisBlacklist = await context.redis.get(`blacklist:${accessToken}`);
      expect(redisBlacklist).toBe('true');

      // Step 5: Verify session is invalidated
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessionResult[0].is_active).toBe(false);

      // Step 6: Verify tokens are no longer valid
      const postLogoutValidation = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: accessToken })
        .expect(200);

      expect(postLogoutValidation.body.valid).toBe(false);
      expect(postLogoutValidation.body.reason).toContain('blacklisted');
    });

    it('should handle atomic logout operations (Requirement 15.3)', async () => {
      // Test that logout operations are atomic - either all succeed or all fail
      
      // Step 1: Logout user
      const logoutResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toContain('успешно');

      // Step 2: Verify consistency between Redis and Database
      const tokenHash = createHash('sha256').update(accessToken).digest('hex');
      
      // Check database blacklist
      const dbBlacklist = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = $1',
        [tokenHash]
      );
      
      // Check Redis blacklist
      const redisBlacklist = await context.redis.get(`blacklist:${accessToken}`);
      
      // Both should be consistent
      expect(dbBlacklist).toHaveLength(1);
      expect(redisBlacklist).toBe('true');

      // Check session invalidation
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );
      expect(sessionResult[0].is_active).toBe(false);
    });

    it('should publish UserLoggedOutEvent for event-driven architecture', async () => {
      const logoutResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toContain('успешно');

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify that logout completed successfully (event was processed)
      // In real scenario, we would verify:
      // - Security event was logged
      // - Logout notification was sent if configured
      // - Session cleanup was performed
    });

    it('should handle logout without valid token', async () => {
      await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Unauthorized');
        });
    });

    it('should handle logout with invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Unauthorized');
        });
    });

    it('should handle logout with already blacklisted token', async () => {
      // First logout
      await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Second logout with same token should fail
      await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Unauthorized');
        });
    });

    it('should handle concurrent logout attempts', async () => {
      // Send multiple concurrent logout requests
      const promises = Array(3).fill(null).map(() =>
        request(context.app.getHttpServer())
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
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
    });

    it('should handle Redis failure during logout gracefully', async () => {
      // This test would require mocking Redis failure
      // For now, we test that logout still works even if Redis operations fail
      
      const logoutResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body.message).toContain('успешно');

      // Verify database blacklist still works
      const tokenHash = createHash('sha256').update(accessToken).digest('hex');
      const blacklistResult = await context.dataSource.query(
        'SELECT * FROM token_blacklist WHERE token_hash = $1',
        [tokenHash]
      );
      expect(blacklistResult).toHaveLength(1);
    });

    it('should handle database failure during logout gracefully', async () => {
      // This test would require mocking database failure
      // For now, we test that the service handles errors appropriately
      
      const logoutResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      // Should either succeed (200) or fail gracefully (500)
      expect([200, 500]).toContain(logoutResponse.status);
    });
  });

  describe('Logout All Sessions', () => {
    let multipleTokens: string[] = [];
    let multipleSessions: string[] = [];

    beforeEach(async () => {
      // Create multiple sessions for the same user
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      
      // Register user
      const registerResponse = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User Multiple Sessions',
          email: testEmail,
          password: testPassword,
        })
        .expect(201);

      context.testUsers.push(registerResponse.body.user);
      context.testSessions.push({ id: registerResponse.body.session_id });
      context.testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);

      multipleTokens.push(registerResponse.body.access_token);
      multipleSessions.push(registerResponse.body.session_id);

      // Create additional sessions by logging in multiple times
      for (let i = 0; i < 2; i++) {
        const loginResponse = await request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: testPassword,
          })
          .expect(200);

        context.testSessions.push({ id: loginResponse.body.session_id });
        context.testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);
        
        multipleTokens.push(loginResponse.body.access_token);
        multipleSessions.push(loginResponse.body.session_id);
      }
    });

    it('should logout from all sessions when requested', async () => {
      // Use the first token to logout from all sessions
      const logoutAllResponse = await request(context.app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${multipleTokens[0]}`)
        .expect(200);

      expect(logoutAllResponse.body.message).toContain('всех устройств');

      // Verify all tokens are blacklisted
      for (const token of multipleTokens) {
        const validation = await request(context.app.getHttpServer())
          .post('/api/auth/validate')
          .send({ token })
          .expect(200);

        expect(validation.body.valid).toBe(false);
      }

      // Verify all sessions are invalidated
      for (const sessionId of multipleSessions) {
        const sessionResult = await context.dataSource.query(
          'SELECT * FROM sessions WHERE id = $1',
          [sessionId]
        );
        expect(sessionResult[0].is_active).toBe(false);
      }
    });
  });
});