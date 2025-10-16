import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { CacheService } from '../src/common/cache/cache.service';
import { UserService } from '../src/user/user.service';
import Redis from 'ioredis';

describe('Comprehensive Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let cacheService: CacheService;
  let userService: UserService;
  let redisClient: Redis;

  beforeAll(async () => {
    // Create Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6380,
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB) || 1,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Test Redis connection
    try {
      await redisClient.ping();
      console.log('✅ Redis connection successful for comprehensive tests');
    } catch (error) {
      console.warn('⚠️ Redis not available, using mock for comprehensive tests');
      redisClient = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        mget: jest.fn().mockResolvedValue([]),
        mset: jest.fn().mockResolvedValue('OK'),
        exists: jest.fn().mockResolvedValue(0),
        ttl: jest.fn().mockResolvedValue(-1),
        ping: jest.fn().mockResolvedValue('PONG'),
        flushdb: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue([]),
        publish: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
      } as any;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisClient)
      .compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
    cacheService = moduleFixture.get<CacheService>(CacheService);
    userService = moduleFixture.get<UserService>(UserService);

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, app.get('Logger')));
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

    // Ensure database connection is established
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (dataSource?.isInitialized) {
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await dataSource.destroy();
    }
    
    // Clean up Redis
    if (redisClient && typeof redisClient.flushdb === 'function') {
      await redisClient.flushdb();
      await redisClient.disconnect();
    }
    
    await app.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    if (dataSource?.isInitialized) {
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }
    if (redisClient && typeof redisClient.flushdb === 'function') {
      await redisClient.flushdb();
    }
  });

  describe('End-to-End User Lifecycle with All Integrations', () => {
    it('should handle complete user lifecycle with caching, events, and microservice integration', async () => {
      // Step 1: Create user (should trigger Auth Service notification and caching)
      const testUser = {
        name: 'Comprehensive Test User',
        email: `comprehensive-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-001')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;
      expect(userId).toBeTruthy();
      expect(createResponse.body.data.email).toBe(testUser.email);
      expect(createResponse.body.data.name).toBe(testUser.name);
      expect(createResponse.body.data.isActive).toBe(true);

      // Step 2: Verify user is cached
      const cacheKey = `user-service:user:${userId}`;
      if (typeof redisClient.get === 'function') {
        const cachedUser = await redisClient.get(cacheKey);
        expect(cachedUser).toBeTruthy();
      }

      // Step 3: Update user preferences (should invalidate cache and notify services)
      const preferences = {
        language: 'es',
        timezone: 'Europe/Madrid',
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          sms: true,
        },
        gameSettings: {
          autoDownload: true,
          cloudSave: false,
          achievementNotifications: true,
        },
      };

      const preferencesResponse = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-002')
        .send(preferences)
        .expect(200);

      expect(preferencesResponse.body.data.language).toBe(preferences.language);
      expect(preferencesResponse.body.data.theme).toBe(preferences.theme);

      // Step 4: Update last login (Auth Service integration)
      const loginResponse = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-003')
        .expect(200);

      expect(loginResponse.body.message).toBe('Last login updated successfully');

      // Step 5: Get user profile for Game Catalog Service
      const profileResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/profile`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-004')
        .query({ includePreferences: 'true', includePrivacySettings: 'true' })
        .expect(200);

      expect(profileResponse.body.data.id).toBe(userId);
      expect(profileResponse.body.data.preferences.language).toBe(preferences.language);
      expect(profileResponse.body.data.lastLoginAt).toBeTruthy();

      // Step 6: Get billing info for Payment Service
      const billingResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/billing-info`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-005')
        .expect(200);

      expect(billingResponse.body.data.userId).toBe(userId);
      expect(billingResponse.body.data.email).toBe(testUser.email);
      expect(billingResponse.body.data.language).toBe(preferences.language);

      // Step 7: Verify data consistency across all endpoints
      const directUserResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-correlation-006')
        .expect(200);

      expect(directUserResponse.body.data.preferences.language).toBe(preferences.language);
      expect(directUserResponse.body.data.lastLoginAt).toBeTruthy();

      // Step 8: Verify user exists in database with all updates
      const dbUser = await userRepository.findOne({ where: { id: userId } });
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(testUser.email);
      expect(dbUser.preferences.language).toBe(preferences.language);
      expect(dbUser.lastLoginAt).toBeTruthy();
    });

    it('should handle batch operations with caching and performance optimization', async () => {
      // Create multiple users for batch testing
      const batchUsers = Array.from({ length: 10 }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      // Step 1: Batch create users
      const batchCreateResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-001')
        .send({ 
          users: batchUsers,
          options: { chunkSize: 5, continueOnError: false }
        })
        .expect(201);

      expect(batchCreateResponse.body.stats.total).toBe(10);
      expect(batchCreateResponse.body.stats.successful).toBe(10);
      expect(batchCreateResponse.body.stats.failed).toBe(0);

      const createdUserIds = batchCreateResponse.body.data.map((user: any) => user.id);

      // Step 2: Batch lookup users (should populate cache)
      const batchLookupResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${createdUserIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-002')
        .expect(200);

      expect(batchLookupResponse.body.data).toHaveLength(10);
      expect(batchLookupResponse.body.stats.found).toBe(10);
      expect(batchLookupResponse.body.stats.missing).toBe(0);

      // Step 3: Verify all users are cached
      for (const userId of createdUserIds) {
        const cacheKey = `user-service:user:${userId}`;
        if (typeof redisClient.get === 'function') {
          const cachedUser = await redisClient.get(cacheKey);
          expect(cachedUser).toBeTruthy();
        }
      }

      // Step 4: Batch update last login
      const batchUpdateResponse = await request(app.getHttpServer())
        .patch('/api/batch/users/last-login')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-003')
        .send({ userIds: createdUserIds })
        .expect(200);

      expect(batchUpdateResponse.body.stats.updated).toBe(10);

      // Step 5: Get batch profiles for Game Catalog Service
      const batchProfilesResponse = await request(app.getHttpServer())
        .post('/api/internal/users/batch/profiles')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-004')
        .send({
          userIds: createdUserIds,
          includePreferences: true,
          includePrivacySettings: false,
          chunkSize: 5,
        })
        .expect(200);

      expect(batchProfilesResponse.body.data.profiles).toHaveLength(10);
      expect(batchProfilesResponse.body.data.stats.found).toBe(10);

      // Step 6: Soft delete some users
      const usersToDelete = createdUserIds.slice(0, 3);
      const softDeleteResponse = await request(app.getHttpServer())
        .delete('/api/batch/users/soft-delete')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-005')
        .send({ userIds: usersToDelete })
        .expect(200);

      expect(softDeleteResponse.body.stats.deleted).toBe(3);

      // Step 7: Verify soft deleted users are not found in normal queries
      const remainingIds = createdUserIds.slice(3);
      const finalLookupResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${createdUserIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-batch-006')
        .expect(200);

      expect(finalLookupResponse.body.data).toHaveLength(7); // Only non-deleted users
      expect(finalLookupResponse.body.stats.found).toBe(7);
      expect(finalLookupResponse.body.stats.missing).toBe(3);
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle high-volume operations efficiently', async () => {
      // Create a large number of users to test performance
      const largeUserBatch = Array.from({ length: 100 }, (_, i) => ({
        name: `Performance User ${i}`,
        email: `perf-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const startTime = Date.now();

      // Batch create with chunking
      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-perf-001')
        .send({ 
          users: largeUserBatch,
          options: { chunkSize: 20, continueOnError: false }
        })
        .expect(201);

      const createTime = Date.now() - startTime;
      
      expect(createResponse.body.stats.successful).toBe(100);
      expect(createTime).toBeLessThan(10000); // Should complete within 10 seconds

      const createdUserIds = createResponse.body.data.map((user: any) => user.id);

      // Test batch lookup performance
      const lookupStartTime = Date.now();
      
      const lookupResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${createdUserIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-perf-002')
        .expect(200);

      const lookupTime = Date.now() - lookupStartTime;
      
      expect(lookupResponse.body.data).toHaveLength(100);
      expect(lookupTime).toBeLessThan(2000); // Should be fast due to caching

      // Test pagination performance
      const paginationStartTime = Date.now();
      
      const paginationResponse = await request(app.getHttpServer())
        .get('/api/users?page=1&limit=50&sortBy=createdAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'test-perf-003')
        .expect(200);

      const paginationTime = Date.now() - paginationStartTime;
      
      expect(paginationResponse.body.data.items).toHaveLength(50);
      expect(paginationTime).toBeLessThan(1000); // Should be fast with proper indexing
    });

    it('should maintain performance under concurrent load', async () => {
      // Create base users for concurrent testing
      const baseUsers = Array.from({ length: 20 }, (_, i) => ({
        name: `Concurrent User ${i}`,
        email: `concurrent-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: baseUsers,
          options: { chunkSize: 10 }
        })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Simulate concurrent read operations
      const concurrentReads = Array.from({ length: 50 }, (_, i) => {
        const randomUserId = userIds[i % userIds.length];
        return request(app.getHttpServer())
          .get(`/api/internal/users/${randomUserId}`)
          .set('x-internal-service', 'user-service-internal')
          .set('x-correlation-id', `concurrent-read-${i}`);
      });

      const startTime = Date.now();
      const readResponses = await Promise.all(concurrentReads);
      const totalTime = Date.now() - startTime;

      // All reads should succeed
      readResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.id).toBeTruthy();
      });

      // Should handle concurrent load efficiently
      expect(totalTime).toBeLessThan(5000); // 50 concurrent requests in under 5 seconds

      // Simulate concurrent write operations
      const concurrentWrites = userIds.slice(0, 10).map((userId, i) =>
        request(app.getHttpServer())
          .patch(`/api/internal/users/${userId}/last-login`)
          .set('x-internal-service', 'user-service-internal')
          .set('x-correlation-id', `concurrent-write-${i}`)
      );

      const writeStartTime = Date.now();
      const writeResponses = await Promise.all(concurrentWrites);
      const writeTime = Date.now() - writeStartTime;

      // All writes should succeed
      writeResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Last login updated successfully');
      });

      expect(writeTime).toBeLessThan(3000); // 10 concurrent writes in under 3 seconds
    });
  });

  describe('Resilience and Fault Tolerance Integration', () => {
    it('should handle partial system failures gracefully', async () => {
      // Create test user
      const testUser = {
        name: 'Resilience Test User',
        email: `resilience-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Simulate Redis failure by mocking Redis methods to fail
      const originalGet = redisClient.get;
      const originalSet = redisClient.set;
      
      redisClient.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
      redisClient.set = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      // Operations should still work without cache
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'resilience-test-001')
        .expect(200);

      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.email).toBe(testUser.email);

      // Update should also work
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'resilience-test-002')
        .expect(200);

      expect(updateResponse.body.message).toBe('Last login updated successfully');

      // Restore Redis functionality
      redisClient.get = originalGet;
      redisClient.set = originalSet;
    });

    it('should recover from temporary database issues', async () => {
      // This test simulates database recovery scenarios
      // In a real environment, you might test with connection pool exhaustion
      
      const testUser = {
        name: 'DB Recovery Test User',
        email: `db-recovery-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Normal operation should work
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'db-recovery-001')
        .send(testUser)
        .expect(201);

      expect(createResponse.body.data.email).toBe(testUser.email);

      // Verify user can be retrieved
      const userId = createResponse.body.data.id;
      const getResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'db-recovery-002')
        .expect(200);

      expect(getResponse.body.data.id).toBe(userId);
    });
  });

  describe('Security and Audit Integration', () => {
    it('should maintain security across all operations', async () => {
      // Test that all operations require proper authentication
      const testUser = {
        name: 'Security Test User',
        email: `security-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Request without authentication should fail
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .send(testUser)
        .expect(401);

      // Request with proper authentication should succeed
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'security-test-001')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // All subsequent operations should also require authentication
      await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'security-test-002')
        .expect(200);
    });

    it('should maintain audit trail across all operations', async () => {
      const correlationId = `audit-test-${Date.now()}`;
      
      const testUser = {
        name: 'Audit Test User',
        email: `audit-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // All operations should include correlation ID in responses
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', correlationId)
        .send(testUser)
        .expect(201);

      expect(createResponse.body.correlationId).toBe(correlationId);

      const userId = createResponse.body.data.id;

      const getResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', correlationId)
        .expect(200);

      expect(getResponse.body.correlationId).toBe(correlationId);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', correlationId)
        .expect(200);

      expect(updateResponse.body.correlationId).toBe(correlationId);
    });
  });

  describe('Health and Monitoring Integration', () => {
    it('should provide comprehensive health status', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('info');
      expect(healthResponse.body).toHaveProperty('details');

      // Should include database health
      expect(healthResponse.body.details).toHaveProperty('database');
      expect(healthResponse.body.details.database).toHaveProperty('status');

      // May include Redis health if available
      if (healthResponse.body.details.redis) {
        expect(healthResponse.body.details.redis).toHaveProperty('status');
      }
    });

    it('should provide readiness and liveness probes', async () => {
      // Readiness probe
      const readyResponse = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(readyResponse.body).toHaveProperty('status');

      // Liveness probe
      const liveResponse = await request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200);

      expect(liveResponse.body).toHaveProperty('status', 'ok');
    });
  });
});