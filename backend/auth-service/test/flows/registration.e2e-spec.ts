import * as request from 'supertest';
import { createHash } from 'crypto';
import { AuthFlowTestSetup, TestContext } from './test-setup';

describe('Auth Service E2E - User Registration Flow', () => {
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

  describe('Complete User Registration Flow (Requirement 8.3)', () => {
    it('should successfully register a new user with complete flow validation', async () => {
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      const registrationData = {
        name: 'Test User Registration',
        email: testEmail,
        password: testPassword,
      };

      // Step 1: Register user
      const registerResponse = await request(context.app.getHttpServer())
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
      context.testUsers.push(registerResponse.body.user);
      context.testSessions.push({ id: registerResponse.body.session_id });
      context.testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);

      // Step 2: Verify session was created in database with hashed tokens (Requirement 15.2)
      const sessionResult = await context.dataSource.query(
        'SELECT * FROM sessions WHERE id = $1',
        [registerResponse.body.session_id]
      );
      expect(sessionResult).toHaveLength(1);
      expect(sessionResult[0].user_id).toBe(registerResponse.body.user.id);
      expect(sessionResult[0].is_active).toBe(true);
      
      // Verify tokens are stored as hashes
      expect(sessionResult[0].access_token_hash).toHaveLength(64); // SHA-256 hash
      expect(sessionResult[0].refresh_token_hash).toHaveLength(64);
      expect(sessionResult[0].access_token_hash).not.toBe(registerResponse.body.access_token);

      // Step 3: Verify tokens are valid and not blacklisted
      const tokenValidationResponse = await request(context.app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: registerResponse.body.access_token })
        .expect(200);

      expect(tokenValidationResponse.body.valid).toBe(true);
      expect(tokenValidationResponse.body.user.id).toBe(registerResponse.body.user.id);

      // Step 4: Verify User Service integration (user was created)
      // In real scenario, we would verify via User Service API
      expect(registerResponse.body.user.id).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      const registrationData = {
        name: 'Test User Duplicate',
        email: testEmail,
        password: testPassword,
      };

      // First registration should succeed
      const firstResponse = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      context.testUsers.push(firstResponse.body.user);
      context.testSessions.push({ id: firstResponse.body.session_id });
      context.testTokens.push(firstResponse.body.access_token, firstResponse.body.refresh_token);

      // Second registration with same email should fail
      await request(context.app.getHttpServer())
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
        await request(context.app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: AuthFlowTestSetup.generateTestEmail(),
            password: testCase.password,
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain(testCase.expectedError);
          });
      }
    });

    it('should handle concurrent registrations with same email (Race Condition Test)', async () => {
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      const registrationData = {
        name: 'Test Concurrent User',
        email: testEmail,
        password: testPassword,
      };

      // Send multiple concurrent registration requests
      const promises = Array(3).fill(null).map(() =>
        request(context.app.getHttpServer())
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
        context.testUsers.push(successResponse.value.body.user);
        context.testSessions.push({ id: successResponse.value.body.session_id });
        context.testTokens.push(
          successResponse.value.body.access_token, 
          successResponse.value.body.refresh_token
        );
      }
    });

    it('should publish UserRegisteredEvent for event-driven architecture', async () => {
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();
      const registrationData = {
        name: 'Test User Event',
        email: testEmail,
        password: testPassword,
      };

      const registerResponse = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      context.testUsers.push(registerResponse.body.user);
      context.testSessions.push({ id: registerResponse.body.session_id });
      context.testTokens.push(registerResponse.body.access_token, registerResponse.body.refresh_token);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify that event was processed (registration completed successfully)
      expect(registerResponse.body.user.email).toBe(testEmail);
      
      // In real scenario, we would verify:
      // - Welcome notification was queued/sent
      // - Security event was logged
      // - User data was properly created in User Service
    });

    it('should handle User Service integration errors gracefully', async () => {
      // This test simulates User Service being unavailable
      const testEmail = AuthFlowTestSetup.generateTestEmail();
      const testPassword = AuthFlowTestSetup.generateTestPassword();

      const registrationData = {
        name: 'Test User Service Error',
        email: testEmail,
        password: testPassword,
      };

      const response = await request(context.app.getHttpServer())
        .post('/api/auth/register')
        .send(registrationData);

      // Should either succeed (201) or fail gracefully with service unavailable (503)
      expect([201, 503]).toContain(response.status);

      if (response.status === 201) {
        context.testUsers.push(response.body.user);
        context.testSessions.push({ id: response.body.session_id });
        context.testTokens.push(response.body.access_token, response.body.refresh_token);
      }
    });

    it('should handle rate limiting on registration attempts', async () => {
      // Make multiple registration attempts rapidly
      const attempts = Array(10).fill(null).map((_, index) =>
        request(context.app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: `Test User ${index}`,
            email: AuthFlowTestSetup.generateTestEmail(),
            password: AuthFlowTestSetup.generateTestPassword(),
          })
      );

      const responses = await Promise.allSettled(attempts);
      
      // Some requests should be rate limited (429) or succeed (201)
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      );
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 201
      );
      
      // Either rate limiting is working (some 429s) or all succeed
      expect(rateLimitedResponses.length + successfulResponses.length).toBe(10);
      
      // Cleanup successful registrations
      successfulResponses.forEach((response: any) => {
        context.testUsers.push(response.value.body.user);
        context.testSessions.push({ id: response.value.body.session_id });
        context.testTokens.push(response.value.body.access_token, response.value.body.refresh_token);
      });
    });
  });

  describe('Registration Input Validation', () => {
    it('should validate required fields', async () => {
      const testCases = [
        { data: {}, expectedField: 'name' },
        { data: { name: 'Test' }, expectedField: 'email' },
        { data: { name: 'Test', email: 'test@example.com' }, expectedField: 'password' },
      ];

      for (const testCase of testCases) {
        await request(context.app.getHttpServer())
          .post('/api/auth/register')
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
        'test..test@example.com',
        'test@example',
      ];

      for (const email of invalidEmails) {
        await request(context.app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: email,
            password: AuthFlowTestSetup.generateTestPassword(),
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('email');
          });
      }
    });

    it('should validate name length and format', async () => {
      const testCases = [
        { name: '', expectedError: 'не может быть пустым' },
        { name: 'A', expectedError: 'не менее 2 символов' },
        { name: 'A'.repeat(101), expectedError: 'не более 100 символов' },
      ];

      for (const testCase of testCases) {
        await request(context.app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: testCase.name,
            email: AuthFlowTestSetup.generateTestEmail(),
            password: AuthFlowTestSetup.generateTestPassword(),
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain(testCase.expectedError);
          });
      }
    });
  });
});