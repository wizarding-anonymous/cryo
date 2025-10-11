import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('User Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Create a mock cache that tracks blacklisted tokens
    const mockCache = new Map();
    const cacheManager = {
      get: jest
        .fn()
        .mockImplementation((key) =>
          Promise.resolve(mockCache.get(key) || null),
        ),
      set: jest.fn().mockImplementation((key, value) => {
        mockCache.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key) => {
        mockCache.delete(key);
        return Promise.resolve();
      }),
      reset: jest.fn().mockImplementation(() => {
        mockCache.clear();
        return Promise.resolve();
      }),
    };

    // Create a mock RedisService
    const mockRedisService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: jest.fn().mockResolvedValue(false),
      cacheUserSession: jest.fn().mockResolvedValue(undefined),
      getUserSession: jest.fn().mockResolvedValue(null),
      removeUserSession: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue(cacheManager)
      .overrideProvider('RedisService')
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes, filters, and interceptors as in main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
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
  }, 10000);

  afterAll(async () => {
    await app.close();
  });

  describe('User Profile Management via /users endpoints', () => {
    const testUser = {
      name: 'User Test User',
      email: `user-test-${Date.now()}@example.com`,
      password: 'StrongPass123!',
    };
    let accessToken: string;

    beforeAll(async () => {
      // Register and login to get a token
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser);

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      accessToken = loginRes.body.data.access_token;
    });

    describe('GET /users/profile', () => {
      it('should get user profile with valid token', () => {
        return request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .then((res) => {
            expect(res.body.data.email).toEqual(testUser.email);
            expect(res.body.data.name).toEqual(testUser.name);
            expect(res.body.data).not.toHaveProperty('password');
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
          });
      });

      it('should return 401 for missing token', () => {
        return request(app.getHttpServer())
          .get('/api/users/profile')
          .expect(401)
          .then((res) => {
            expect(res.body.message).toContain('Unauthorized');
          });
      });

      it('should return 401 for invalid token', () => {
        return request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)
          .then((res) => {
            expect(res.body.message).toContain('Unauthorized');
          });
      });
    });

    describe('PUT /users/profile', () => {
      it('should update user profile successfully', () => {
        const updatedName = 'Updated User Name';
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: updatedName })
          .expect(200)
          .then((res) => {
            expect(res.body.data.name).toEqual(updatedName);
            expect(res.body.data.email).toEqual(testUser.email);
            expect(res.body.data).not.toHaveProperty('password');
          });
      });

      it('should return 400 for invalid name (empty string)', () => {
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: '' })
          .expect(400)
          .then((res) => {
            expect(res.body.message).toContain('Имя не может быть пустым');
          });
      });

      it('should return 400 for name too long', () => {
        const longName = 'a'.repeat(101); // Max is 100 characters
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: longName })
          .expect(400)
          .then((res) => {
            expect(res.body.message).toContain('Имя не может быть длиннее 100 символов');
          });
      });

      it('should return 400 for extra fields', () => {
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Valid Name',
            extraField: 'should not be allowed',
          })
          .expect(400)
          .then((res) => {
            expect(res.body.message).toContain('property extraField should not exist');
          });
      });

      it('should return 401 for missing token', () => {
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .send({ name: 'New Name' })
          .expect(401)
          .then((res) => {
            expect(res.body.message).toContain('Unauthorized');
          });
      });

      it('should allow empty body (no updates)', () => {
        return request(app.getHttpServer())
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({})
          .expect(200)
          .then((res) => {
            expect(res.body.data.email).toEqual(testUser.email);
          });
      });
    });

    describe('DELETE /users/profile', () => {
      let deleteTestToken: string;

      beforeEach(async () => {
        // Create a new user for each delete test
        const deleteTestUser = {
          name: 'Delete Test User',
          email: `delete-test-${Date.now()}-${Math.random()}@example.com`,
          password: 'StrongPass123!',
        };

        await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(deleteTestUser);

        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: deleteTestUser.email,
            password: deleteTestUser.password,
          });

        deleteTestToken = loginRes.body.data.access_token;
      });

      it('should delete user profile successfully', () => {
        return request(app.getHttpServer())
          .delete('/api/users/profile')
          .set('Authorization', `Bearer ${deleteTestToken}`)
          .expect(204);
      });

      it('should return 401 for missing token', () => {
        return request(app.getHttpServer())
          .delete('/api/users/profile')
          .expect(401)
          .then((res) => {
            expect(res.body.message).toContain('Unauthorized');
          });
      });

      it('should return 401 for invalid token', () => {
        return request(app.getHttpServer())
          .delete('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)
          .then((res) => {
            expect(res.body.message).toContain('Unauthorized');
          });
      });

      it('should prevent login after account deletion', async () => {
        const deleteTestUser = {
          name: 'Delete Test User 2',
          email: `delete-test-2-${Date.now()}@example.com`,
          password: 'StrongPass123!',
        };

        // Register user
        await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(deleteTestUser);

        // Login to get token
        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: deleteTestUser.email,
            password: deleteTestUser.password,
          });

        const token = loginRes.body.data.access_token;

        // Delete account
        await request(app.getHttpServer())
          .delete('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(204);

        // Try to login again - should fail
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: deleteTestUser.email,
            password: deleteTestUser.password,
          })
          .expect(401);
      });
    });
  });
});
