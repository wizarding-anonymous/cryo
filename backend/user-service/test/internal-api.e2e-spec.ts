import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Internal API Endpoints (e2e)', () => {
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
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)), // For @Exclude decorator
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
    await app.close();
  });

  describe('Internal API for Microservice Integration', () => {
    const testUserData = {
      name: 'Internal Test User',
      email: `internal-test-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };
    let createdUserId: string;

    beforeAll(async () => {
      // Create a user for tests that need an existing user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUserData)
        .expect(201);

      createdUserId = response.body.data.id;
    });

    describe('Auth Service Integration', () => {
      describe('POST /internal/users', () => {
        it('should create a new user for Auth Service', () => {
          const newUserData = {
            name: 'New Internal User',
            email: `new-internal-${Date.now()}@example.com`,
            password: '$2b$10$anotherHashedPasswordFromAuthService',
          };

          return request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send(newUserData)
            .expect(201)
            .then((res) => {
              expect(res.body.data.email).toEqual(newUserData.email);
              expect(res.body.data.name).toEqual(newUserData.name);
              expect(res.body.data).not.toHaveProperty('password');
              expect(res.body.data).toHaveProperty('id');
              expect(res.body.data).toHaveProperty('isActive');
            });
        });

        it('should reject request without internal service header', () => {
          const newUserData = {
            name: 'Unauthorized User',
            email: `unauthorized-${Date.now()}@example.com`,
            password: '$2b$10$hashedPassword',
          };

          return request(app.getHttpServer())
            .post('/api/internal/users')
            .send(newUserData)
            .expect(401);
        });
      });

      describe('GET /internal/users/:id', () => {
        it('should get user by ID for Auth Service', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/${createdUserId}`)
            .set('x-internal-service', 'user-service-internal')
            .expect(200)
            .then((res) => {
              expect(res.body.data.id).toEqual(createdUserId);
              expect(res.body.data.email).toEqual(testUserData.email);
              expect(res.body.data).not.toHaveProperty('password');
              expect(res.body.data).toHaveProperty('isActive');
            });
        });

        it('should return 404 for non-existent user', () => {
          return request(app.getHttpServer())
            .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
            .set('x-internal-service', 'user-service-internal')
            .expect(404);
        });
      });

      describe('GET /internal/users/email/:email', () => {
        it('should get user by email for Auth Service', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/email/${testUserData.email}`)
            .set('x-internal-service', 'user-service-internal')
            .expect(200)
            .then((res) => {
              expect(res.body.data.email).toEqual(testUserData.email);
              expect(res.body.data.id).toEqual(createdUserId);
              expect(res.body.data).not.toHaveProperty('password');
            });
        });
      });

      describe('PATCH /internal/users/:id/last-login', () => {
        it('should update last login for Auth Service', () => {
          return request(app.getHttpServer())
            .patch(`/api/internal/users/${createdUserId}/last-login`)
            .set('x-internal-service', 'user-service-internal')
            .expect(200)
            .then((res) => {
              expect(res.body.data.message).toEqual(
                'Last login updated successfully',
              );
            });
        });
      });
    });

    describe('Game Catalog Service Integration', () => {
      describe('GET /internal/users/:id/profile', () => {
        it('should get user profile for Game Catalog Service', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/${createdUserId}/profile`)
            .set('x-internal-service', 'user-service-internal')
            .query({ includePreferences: 'true' })
            .expect(200)
            .then((res) => {
              expect(res.body.data.id).toEqual(createdUserId);
              expect(res.body.data.name).toEqual(testUserData.name);
              expect(res.body.data).toHaveProperty('avatarUrl');
              expect(res.body.data).toHaveProperty('preferences');
              expect(res.body.data).toHaveProperty('isActive');
            });
        });

        it('should exclude privacy settings when not requested', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/${createdUserId}/profile`)
            .set('x-internal-service', 'user-service-internal')
            .query({
              includePreferences: 'true',
              includePrivacySettings: 'false',
            })
            .expect(200)
            .then((res) => {
              expect(res.body.data.privacySettings).toBeNull();
            });
        });
      });

      describe('POST /internal/users/batch/profiles', () => {
        it('should get batch profiles for Game Catalog Service', () => {
          const requestBody = {
            userIds: [createdUserId],
            includePreferences: true,
            includePrivacySettings: false,
            chunkSize: 50,
          };

          return request(app.getHttpServer())
            .post('/api/internal/users/batch/profiles')
            .set('x-internal-service', 'user-service-internal')
            .send(requestBody)
            .expect(200)
            .then((res) => {
              expect(res.body.data.profiles).toHaveLength(1);
              expect(res.body.data.profiles[0].id).toEqual(createdUserId);
              expect(res.body.data.stats.requested).toBe(1);
              expect(res.body.data.stats.found).toBe(1);
              expect(res.body.data.stats.missing).toBe(0);
            });
        });
      });
    });

    describe('Payment Service Integration', () => {
      describe('GET /internal/users/:id/billing-info', () => {
        it('should get billing info for Payment Service', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/${createdUserId}/billing-info`)
            .set('x-internal-service', 'user-service-internal')
            .expect(200)
            .then((res) => {
              expect(res.body.data.userId).toEqual(createdUserId);
              expect(res.body.data.name).toEqual(testUserData.name);
              expect(res.body.data.email).toEqual(testUserData.email);
              expect(res.body.data).toHaveProperty('language');
              expect(res.body.data).toHaveProperty('timezone');
              expect(res.body.data).toHaveProperty('isActive');
              expect(res.body.data).toHaveProperty('createdAt');
            });
        });
      });

      describe('PATCH /internal/users/:id/billing-info', () => {
        it('should update billing info for Payment Service', () => {
          const updateData = {
            name: 'Updated Billing Name',
            language: 'es',
            timezone: 'America/New_York',
          };

          return request(app.getHttpServer())
            .patch(`/api/internal/users/${createdUserId}/billing-info`)
            .set('x-internal-service', 'user-service-internal')
            .send(updateData)
            .expect(200)
            .then((res) => {
              expect(res.body.data.name).toEqual(updateData.name);
              expect(res.body.data.language).toEqual(updateData.language);
              expect(res.body.data.timezone).toEqual(updateData.timezone);
            });
        });
      });
    });

    describe('Library Service Integration', () => {
      describe('GET /internal/users/:id/preferences', () => {
        it('should get preferences for Library Service', () => {
          return request(app.getHttpServer())
            .get(`/api/internal/users/${createdUserId}/preferences`)
            .set('x-internal-service', 'user-service-internal')
            .expect(200)
            .then((res) => {
              expect(res.body.data).toHaveProperty('language');
              expect(res.body.data).toHaveProperty('timezone');
              expect(res.body.data).toHaveProperty('theme');
              expect(res.body.data).toHaveProperty('notifications');
              expect(res.body.data).toHaveProperty('gameSettings');
            });
        });
      });

      describe('PATCH /internal/users/:id/preferences', () => {
        it('should update preferences for Library Service', () => {
          const updateData = {
            theme: 'dark',
            gameSettings: {
              autoDownload: true,
              cloudSave: true,
              achievementNotifications: false,
            },
          };

          return request(app.getHttpServer())
            .patch(`/api/internal/users/${createdUserId}/preferences`)
            .set('x-internal-service', 'user-service-internal')
            .send(updateData)
            .expect(200)
            .then((res) => {
              expect(res.body.data.theme).toEqual(updateData.theme);
              expect(res.body.data.gameSettings.autoDownload).toEqual(
                updateData.gameSettings.autoDownload,
              );
            });
        });
      });
    });

    describe('Security Tests', () => {
      it('should reject requests without proper authentication', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/${createdUserId}`)
          .expect(401);
      });

      it('should reject requests with invalid internal service header', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/${createdUserId}`)
          .set('x-internal-service', 'invalid-service')
          .expect(401);
      });

      it('should accept requests with valid API key', () => {
        return request(app.getHttpServer())
          .get(`/api/internal/users/${createdUserId}`)
          .set('x-api-key', 'test-api-key')
          .expect(200);
      });
    });
  });
});
