import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Profile and Auth Flow (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Lifecycle', () => {
    let cacheManager: any;

    beforeEach(() => {
      // Get the cache manager instance
      cacheManager = app.get('CACHE_MANAGER');
    });

    const user = {
      name: 'E2E Test User',
      email: `e2e-${Date.now()}@test.com`,
      password: 'StrongPass123!',
    };
    let accessToken: string;

    it('POST /auth/register - should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(user)
        .expect(201)
        .then((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.user.email).toEqual(user.email);
          expect(res.body.data).toHaveProperty('access_token');
        });
    });

    it('POST /auth/login - should log the user in and return a new token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200)
        .then((res) => {
          expect(res.body.data).toHaveProperty('access_token');
          accessToken = res.body.data.access_token as string;
        });
    });

    it('GET /profile - should get the user profile with a valid token', () => {
      return request(app.getHttpServer())
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.data.email).toEqual(user.email);
          expect(res.body.data.name).toEqual(user.name);
        });
    });

    it('PUT /profile - should update the user profile', () => {
      const newName = 'E2E Test User Updated';
      return request(app.getHttpServer())
        .put('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: newName })
        .expect(200)
        .then((res) => {
          expect(res.body.data.name).toEqual(newName);
        });
    });

    it('POST /auth/logout - should blacklist the token and subsequent requests should fail', async () => {
      // First, logout to blacklist the token
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Then verify the token is blacklisted
      await request(app.getHttpServer())
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401)
        .then((res) => {
          expect(res.body.message).toContain('Токен недействителен');
        });
    });

    it('DELETE /profile - should delete the user account', async () => {
      // Clear cache to ensure fresh start
      if (cacheManager && 'reset' in cacheManager) {
        await (cacheManager.reset as () => Promise<void>)();
      }

      // Create a new user for deletion test
      const deleteUser = {
        name: 'Delete Test User',
        email: `delete-${Date.now()}@test.com`,
        password: 'StrongPass123!',
      };

      // Register the new user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(deleteUser)
        .expect(201);

      // Log in to get a token
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: deleteUser.email, password: deleteUser.password });

      const freshToken = loginRes.body.data.access_token as string;

      // Delete the account
      await request(app.getHttpServer())
        .delete('/api/profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(204);

      // Verify user can no longer log in
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: deleteUser.email, password: deleteUser.password })
        .expect(401);
    });
  });
});
