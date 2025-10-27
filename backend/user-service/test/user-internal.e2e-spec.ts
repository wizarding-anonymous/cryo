import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';

describe('User Internal API Endpoints (e2e)', () => {
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
    const loggingService = app.get(LoggingService);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
    app.useGlobalInterceptors(
      new ResponseInterceptor(),
    );
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
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Failed to close app:', error.message);
      }
    }
  });

  beforeEach(async () => {
    // Clean up database before each test to ensure isolation
    try {
      const dataSource = app.get('DataSource');
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      }
    } catch (error) {
      // If DataSource is not available, skip cleanup
      console.warn('Could not clean database:', error.message);
    }
  });

  describe('Internal User Management API for Auth Service Integration', () => {
    const testUserData = {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Valid bcrypt hash (60 chars)
    };
    let createdUserId: string;

    beforeAll(async () => {
      // Create a user for tests that need an existing user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-api-key', 'test-api-key')
        .send(testUserData);

      if (response.status !== 201) {
        console.error('Failed to create test user:', response.status, response.body);
        throw new Error(`Failed to create test user: ${response.status} - ${JSON.stringify(response.body)}`);
      }

      createdUserId = response.body.data.id;
    });

    describe('POST /users', () => {
      it('should create a new user with pre-hashed password', () => {
        const newUserData = {
          name: 'New Test User',
          email: `new-test-${Date.now()}@example.com`,
          password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        };

        return request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-api-key', 'test-api-key')
          .send(newUserData)
          .expect(201)
          .then((res) => {
            expect(res.body.data.email).toEqual(newUserData.email);
            expect(res.body.data.name).toEqual(newUserData.name);
            expect(res.body.data).not.toHaveProperty('password'); // Password should be excluded
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
          });
      });

      it('should return 409 for duplicate email', () => {
        return request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-api-key', 'test-api-key')
          .send(testUserData) // Same email as above
          .expect(409);
      });

      it('should return 400 for invalid email', () => {
        return request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-api-key', 'test-api-key')
          .send({
            name: 'Test User',
            email: 'invalid-email',
            password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
          })
          .expect(400)
          .then((res) => {
            expect(res.body.message).toContain('Email must be valid');
          });
      });

      it('should return 400 for missing required fields', () => {
        return request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-api-key', 'test-api-key')
          .send({
            name: 'Test User',
            // Missing email and password
          })
          .expect(400);
      });
    });

    describe('GET /users/email/:email', () => {
      it('should find user by email', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/email/${testUserData.email}`)
          .set('x-api-key', 'test-api-key')
          .expect(200)
          .then((res) => {
            expect(res.body.data.email).toEqual(testUserData.email);
            expect(res.body.data.name).toEqual(testUserData.name);
            expect(res.body.data).not.toHaveProperty('password');
            expect(res.body.data.id).toEqual(createdUserId);
          });
      });

      it('should return 404 for non-existent email', () => {
        return request(app.getHttpServer())
          .get('/api/internal/users/email/nonexistent@example.com')
          .set('x-api-key', 'test-api-key')
          .expect(404)
          .then((res) => {
            expect(res.body.message).toContain('не найден');
          });
      });
    });

    describe('GET /users/:id', () => {
      it('should find user by ID', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/${createdUserId}`)
          .set('x-api-key', 'test-api-key')
          .expect(200)
          .then((res) => {
            expect(res.body.data.email).toEqual(testUserData.email);
            expect(res.body.data.name).toEqual(testUserData.name);
            expect(res.body.data).not.toHaveProperty('password');
            expect(res.body.data.id).toEqual(createdUserId);
          });
      });

      it('should return 404 for non-existent ID', () => {
        return request(app.getHttpServer())
          .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
          .set('x-api-key', 'test-api-key')
          .expect(404)
          .then((res) => {
            expect(res.body.message).toContain('не найден');
          });
      });

      it('should return 400 for invalid UUID format', () => {
        return request(app.getHttpServer())
          .get('/api/internal/users/invalid-uuid')
          .set('x-api-key', 'test-api-key')
          .expect(400);
      });
    });

    describe('PATCH /users/:id/last-login', () => {
      it('should update last login timestamp', () => {
        return request(app.getHttpServer())
          .patch(`/api/internal/users/${createdUserId}/last-login`)
          .set('x-api-key', 'test-api-key')
          .expect(200)
          .then((res) => {
            expect(res.body.data.message).toEqual(
              'Last login updated successfully',
            );
          });
      });

      it('should return 404 for non-existent user ID', () => {
        return request(app.getHttpServer())
          .patch('/api/internal/users/123e4567-e89b-12d3-a456-426614174000/last-login')
          .set('x-api-key', 'test-api-key')
          .expect(404);
      });
    });

    describe('GET /users/:id/exists', () => {
      it('should return true for existing user', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/${createdUserId}/exists`)
          .set('x-api-key', 'test-api-key')
          .expect(200)
          .then((res) => {
            expect(res.body.data.exists).toBe(true);
          });
      });

      it('should return false for non-existent user', () => {
        return request(app.getHttpServer())
          .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000/exists')
          .set('x-api-key', 'test-api-key')
          .expect(200)
          .then((res) => {
            expect(res.body.data.exists).toBe(false);
          });
      });
    });
  });
});