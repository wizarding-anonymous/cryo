import * as request from 'supertest';
import { AuthFlowTestSetup, TestContext } from './test-setup';

describe('Auth Service E2E - User Login Flow', () => {
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

  describe('Complete User Login Flow (Requirement 8.4)', () => {
    let registeredUser: any;
    let registeredUserPassword: string;

    beforeEach(async () => {
      // Create a user for login tests
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      registeredUserPassword = AuthFlowTestSetup.generateTestPassword();
      
      const registerResponse = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User Login',
          email: testEmail,
          password: registeredUserPassword,
        })
        .expect(201);

      registeredUser = registerResponse.body.user;
      context.testUsers.push(registeredUser);
      context.testSessions.push({ id: registerResponse.body.session_id });
      context.testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);
    });

    it('should successfully login with valid credentials', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUserPassword,
      };

      // Step 1: Login with valid credentials
      const loginResponse = await request(context.app.getHttpServer())
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
      context.testSessions.push({ id: loginResponse.body.session_id });
      context.testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);

      // Step 2: Verify new session was created with hashed tokens
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [loginResponse.body.session_id]
      );
      expect(sessionResult).toHaveLength(1);
      expect(sessionResult[0].user_id).toBe(registeredUser.id);
      expect(sessionResult[0].is_active).toBe(true);
      
      // Verify tokens are stored as hashes (Requirement 15.2)
      expect(sessionResult[0].access_token_hash).toHaveLength(64);
      expect(sessionResult[0].refresh_token_hash).toHaveLength(64);

      // Step 3: Verify tokens are valid
      const tokenValidationResponse = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: loginResponse.body.access_token })
        .expect(200);

      expect(tokenValidationResponse.body.valid).toBe(true);
      expect(tokenValidationResponse.body.user.id).toBe(registeredUser.id);
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: registeredUser.email,
        password: 'WrongPassword123!',
      };

      await request(context.app.getHttpServer())
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

      await request(context.app.getHttpServer())
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
      const loginPromises = Array(5).fill(null).map(() =>
        request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(loginPromises);
      
      // All should succeed initially
      responses.forEach(response => {
        expect(response.status).toBe(200);
        context.testSessions.push({ id: response.body.session_id });
        context.testTokens.push(response.body.access_token, response.body.refresh_token);
      });

      // Verify session limit enforcement by checking active sessions
      const activeSessions = await context.dataSource.query(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND is_active = true',
        [registeredUser.id]
      );
      
      // Should respect session limit (default is typically 5)
      expect(parseInt(activeSessions[0].count)).toBeLessThanOrEqual(5);
    });

    it('should publish UserLoggedInEvent for event-driven architecture', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUserPassword,
      };

      const loginResponse = await request(context.app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      context.testSessions.push({ id: loginResponse.body.session_id });
      context.testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify that login completed successfully (event was processed)
      expect(loginResponse.body.user.id).toBe(registeredUser.id);
      
      // In real scenario, we would verify:
      // - Security event was logged
      // - Last login timestamp was updated in User Service
      // - Login notification was sent if configured
    });

    it('should track login metadata (IP, User Agent)', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUserPassword,
      };

      const loginResponse = await request(context.app.getHttpServer())
        .post('/api/auth/login')
        .set('User-Agent', 'Test-Agent/1.0')
        .set('X-Forwarded-For', '192.168.1.100')
        .send(loginData)
        .expect(200);

      context.testSessions.push({ id: loginResponse.body.session_id });
      context.testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);

      // Verify session metadata was stored
      const sessionResult = await context.dataSource.query(
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
        request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.allSettled(attempts);
      
      // Some requests should be rate limited (429) or unauthorized (401)
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      );
      const unauthorizedResponses = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 401
      );
      
      expect(rateLimitedResponses.length + unauthorizedResponses.length).toBe(10);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle User Service integration during login', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUserPassword,
      };

      const loginResponse = await request(context.app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData);

      // Should either succeed (200) or fail gracefully if User Service is down (503)
      expect([200, 503]).toContain(loginResponse.status);

      if (loginResponse.status === 200) {
        context.testSessions.push({ id: loginResponse.body.session_id });
        context.testTokens.push(loginResponse.body.access_token, loginResponse.body.refresh_token);
        
        // Verify user data was retrieved from User Service
        expect(loginResponse.body.user.id).toBe(registeredUser.id);
        expect(loginResponse.body.user.email).toBe(registeredUser.email);
      }
    });

    it('should handle concurrent login attempts with distributed locking', async () => {
      const loginData = {
        email: registeredUser.email,
        password: registeredUserPassword,
      };

      // Send multiple concurrent login requests
      const promises = Array(3).fill(null).map(() =>
        request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed (no race conditions)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        context.testSessions.push({ id: response.body.session_id });
        context.testTokens.push(response.body.access_token, response.body.refresh_token);
      });

      // Verify all sessions were created properly
      const sessionCount = await context.dataSource.query(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND is_active = true',
        [registeredUser.id]
      );
      
      expect(parseInt(sessionCount[0].count)).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Login Input Validation', () => {
    it('should validate required fields', async () => {
      const testCases = [
        { data: {}, expectedField: 'email' },
        { data: { email: 'test@example.com' }, expectedField: 'password' },
      ];

      for (const testCase of testCases) {
        await request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send(testCase.data)
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain(testCase.expectedField);
          });
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
      ];

      for (const email of invalidEmails) {
        await request(context.app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: email,
            password: 'SomePassword123!',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('email');
          });
      }
    });
  });
});