import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Auth Endpoints (e2e)', () => {
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

  describe('POST /auth/register', () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: uniqueEmail,
          password: 'password123',
        })
        .expect(201)
        .then((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.user.email).toEqual(uniqueEmail);
          expect(res.body.data.user.name).toEqual('Test User');
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data.user).not.toHaveProperty('password');
        });
    });

    it('should return 409 when email already exists', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User 2',
          email: uniqueEmail, // Same email as above
          password: 'password123',
        })
        .expect(409)
        .then((res) => {
          expect(res.body.error.code).toEqual('CONFLICT');
        });
    });

    it('should return 400 for invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });

    it('should return 400 for short password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test2@example.com',
          password: '123', // Too short
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test3@example.com',
          // Missing name and password
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });

    it('should return 400 for extra fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test4@example.com',
          password: 'password123',
          extraField: 'should not be allowed',
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      name: 'Login Test User',
      email: `login-test-${Date.now()}@example.com`,
      password: 'password123',
    };

    beforeAll(async () => {
      // Register a user for login tests
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login successfully with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200)
        .then((res) => {
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data.user.email).toEqual(testUser.email);
          expect(res.body.data.user).not.toHaveProperty('password');
        });
    });

    it('should return 401 for incorrect password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401)
        .then((res) => {
          expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });

    it('should return 401 for non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401)
        .then((res) => {
          expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });

    it('should return 400 for invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });

    it('should return 400 for missing credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          // Missing password
        })
        .expect(400)
        .then((res) => {
          expect(res.body.error.code).toEqual('VALIDATION_ERROR');
        });
    });
  });

  describe('POST /auth/logout', () => {
    const testUser = {
      name: 'Logout Test User',
      email: `logout-test-${Date.now()}@example.com`,
      password: 'password123',
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

      accessToken = loginRes.body.data.accessToken;
    });

    it('should logout successfully with valid token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should return 401 for missing token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401)
        .then((res) => {
          expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });

    it('should return 401 for invalid token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .then((res) => {
          expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });

    it('should return 401 for malformed authorization header', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', 'InvalidFormat')
        .expect(401)
        .then((res) => {
          expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });
  });
});
