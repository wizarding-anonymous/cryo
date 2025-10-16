import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('Security Improvements (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    // Add validation pipe for tests
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Password Validation', () => {
    it('should reject weak passwords during registration', async () => {
      const weakPasswordTests = [
        {
          password: 'password', // no uppercase, numbers, or special chars
          expectedMessage: 'Пароль должен содержать заглавные и строчные буквы',
        },
        {
          password: 'Password', // no numbers or special chars
          expectedMessage: 'Пароль должен содержать заглавные и строчные буквы',
        },
        {
          password: 'Password1', // no special chars
          expectedMessage: 'Пароль должен содержать заглавные и строчные буквы',
        },
        {
          password: 'Pass1!', // too short
          expectedMessage: 'Пароль должен содержать не менее 8 символов',
        },
        {
          password: '12345678', // no letters or special chars
          expectedMessage: 'Пароль должен содержать заглавные и строчные буквы',
        },
      ];

      for (const test of weakPasswordTests) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: `test${Date.now()}@example.com`,
            password: test.password,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            expect.stringContaining(test.expectedMessage),
          ]),
        );
      }
    });

    it('should accept strong passwords during registration', async () => {
      const strongPassword = 'StrongPass123!';
      const email = `test${Date.now()}@example.com`;

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email,
          password: strongPassword,
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.access_token).toBeDefined();

      // Store for later tests
      authToken = response.body.access_token;
      userId = response.body.user.id;
    });
  });

  describe('Rate Limiting', () => {
    it('should not rate limit login attempts in test environment', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'WrongPass123!',
      };

      // Make multiple failed login attempts
      const promises = Array(6)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).post('/api/auth/login').send(loginData),
        );

      const responses = await Promise.all(promises);

      // In test environment, rate limiting is disabled, so all should return 401 (not 429)
      const unauthorizedResponses = responses.filter((r) => r.status === 401);
      expect(unauthorizedResponses.length).toBe(6);
    });

    it('should not rate limit registration attempts in test environment', async () => {
      // Make multiple registration attempts with different emails
      const promises = Array(4)
        .fill(null)
        .map((_, index) =>
          request(app.getHttpServer())
            .post('/api/auth/register')
            .send({
              name: 'Test User',
              email: `test-rate-limit-${Date.now()}-${index}@example.com`,
              password: 'StrongPass123!',
            }),
        );

      const responses = await Promise.all(promises);

      // In test environment, rate limiting is disabled, so all should succeed
      const successResponses = responses.filter((r) => r.status === 201);
      expect(successResponses.length).toBe(4);
    });
  });

  describe('Password Change Security', () => {
    beforeAll(async () => {
      // Create a user and get auth token for password change tests
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Password Test User',
          email: `password-test-${Date.now()}@example.com`,
          password: 'StrongPass123!',
        });

      authToken = registerResponse.body.access_token;
      userId = registerResponse.body.user.id;
    });

    it('should require current password for password change', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongCurrentPass123!',
          newPassword: 'NewStrongPass123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Неверный текущий пароль');
    });

    it('should successfully change password with correct current password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'StrongPass123!',
          newPassword: 'NewStrongPass123!',
        });

      expect(response.status).toBe(204);
    });

    it('should reject weak passwords during password change', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'NewStrongPass123!',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Пароль должен содержать заглавные и строчные буквы',
          ),
        ]),
      );
    });

    it('should not rate limit password change attempts in test environment', async () => {
      const changePasswordData = {
        currentPassword: 'WrongPass123!',
        newPassword: 'AnotherStrongPass123!',
      };

      // Make multiple password change attempts
      const promises = Array(4)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/api/users/change-password')
            .set('Authorization', `Bearer ${authToken}`)
            .send(changePasswordData),
        );

      const responses = await Promise.all(promises);

      // In test environment, rate limiting is disabled, so all should return 409 (wrong password)
      const conflictResponses = responses.filter((r) => r.status === 409);
      expect(conflictResponses.length).toBe(4);
    });
  });

  describe('Email Uniqueness', () => {
    it('should prevent duplicate email during registration', async () => {
      const email = `unique${Date.now()}@example.com`;

      // First registration should succeed
      const firstResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'First User',
          email,
          password: 'StrongPass123!',
        });

      expect(firstResponse.status).toBe(201);

      // Second registration with same email should fail
      const secondResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email,
          password: 'AnotherStrongPass123!',
        });

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.message).toBe(
        'Пользователь с таким email уже существует',
      );
    });
  });

  describe('Soft Delete', () => {
    it('should soft delete user account', async () => {
      // Create a separate user for deletion test
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Delete Test User',
          email: `delete-test-${Date.now()}@example.com`,
          password: 'StrongPass123!',
        });

      const deleteToken = registerResponse.body.access_token;

      // Delete the account
      const deleteResponse = await request(app.getHttpServer())
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${deleteToken}`);

      expect(deleteResponse.status).toBe(204);

      // Try to access profile after deletion
      const profileResponse = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${deleteToken}`);

      // Should fail because user is soft deleted
      expect(profileResponse.status).toBe(401);
    });
  });
});
