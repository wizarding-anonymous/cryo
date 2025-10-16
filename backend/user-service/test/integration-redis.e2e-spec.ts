import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { CacheService } from '../src/common/cache/cache.service';
import { UserService } from '../src/user/user.service';
import Redis from 'ioredis';

describe('Redis Integration Tests (e2e)', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let userService: UserService;
  let redisClient: Redis;

  beforeAll(async () => {
    // Create real Redis client for integration testing
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
      console.log('✅ Redis connection successful');
    } catch (error) {
      console.warn('⚠️ Redis not available, using mock for tests');
      // Use mock Redis for CI/CD environments where Redis might not be available
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
        subscribe: jest.fn().mockResolvedValue(undefined),
        unsubscribe: jest.fn().mockResolvedValue(undefined),
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
  }, 30000);

  afterAll(async () => {
    // Clean up Redis data
    if (redisClient && typeof redisClient.flushdb === 'function') {
      await redisClient.flushdb();
      await redisClient.disconnect();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    if (redisClient && typeof redisClient.flushdb === 'function') {
      await redisClient.flushdb();
    }
  });

  describe('Redis Cache Integration', () => {
    const testUser = {
      name: 'Redis Test User',
      email: `redis-test-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };
    let createdUserId: string;

    beforeAll(async () => {
      // Create a test user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      createdUserId = response.body.data.id;
    });

    it('should cache user data on first access', async () => {
      // First request - should hit database and cache the result
      const response1 = await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response1.body.data.id).toBe(createdUserId);

      // Check if user is cached in Redis
      const cacheKey = `user-service:user:${createdUserId}`;
      const cachedUser = await redisClient.get(cacheKey);
      
      if (typeof redisClient.get === 'function') {
        expect(cachedUser).toBeTruthy();
        const parsedUser = JSON.parse(cachedUser);
        expect(parsedUser.id).toBe(createdUserId);
        expect(parsedUser.email).toBe(testUser.email);
      }
    });

    it('should serve cached data on subsequent requests', async () => {
      // First request to populate cache
      await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Second request should be served from cache
      const response2 = await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response2.body.data.id).toBe(createdUserId);
      expect(response2.body.data.email).toBe(testUser.email);
    });

    it('should invalidate cache when user is updated', async () => {
      // First, populate cache
      await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Update user (this should invalidate cache)
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${createdUserId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Check that cache was invalidated
      const cacheKey = `user-service:user:${createdUserId}`;
      const cachedUser = await redisClient.get(cacheKey);
      
      if (typeof redisClient.get === 'function') {
        // Cache should be either null or contain updated data
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          expect(parsedUser.lastLoginAt).toBeTruthy();
        }
      }
    });

    it('should handle batch cache operations', async () => {
      // Create multiple test users
      const batchUsers = Array.from({ length: 3 }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createdUserIds: string[] = [];
      for (const user of batchUsers) {
        const response = await request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(user)
          .expect(201);
        createdUserIds.push(response.body.data.id);
      }

      // Batch lookup should cache all users
      const batchResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${createdUserIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(batchResponse.body.data).toHaveLength(3);
      expect(batchResponse.body.stats.found).toBe(3);

      // Verify all users are cached
      for (const userId of createdUserIds) {
        const cacheKey = `user-service:user:${userId}`;
        const cachedUser = await redisClient.get(cacheKey);
        
        if (typeof redisClient.get === 'function') {
          expect(cachedUser).toBeTruthy();
        }
      }
    });

    it('should handle cache failures gracefully', async () => {
      // Temporarily break Redis connection (simulate Redis failure)
      const originalGet = redisClient.get;
      redisClient.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      // Request should still work (fallback to database)
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.id).toBe(createdUserId);

      // Restore Redis connection
      redisClient.get = originalGet;
    });

    it('should respect cache TTL settings', async () => {
      // Get user to populate cache
      await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Check TTL is set
      const cacheKey = `user-service:user:${createdUserId}`;
      const ttl = await redisClient.ttl(cacheKey);
      
      if (typeof redisClient.ttl === 'function') {
        expect(ttl).toBeGreaterThan(0); // Should have a TTL set
        expect(ttl).toBeLessThanOrEqual(300); // Should be <= 5 minutes (default TTL)
      }
    });

    it('should handle cache statistics', async () => {
      // Populate some cache data
      await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Get cache statistics
      const statsResponse = await request(app.getHttpServer())
        .get('/api/batch/cache/stats')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('hitRate');
      expect(statsResponse.body.data).toHaveProperty('missRate');
      expect(statsResponse.body.data).toHaveProperty('totalRequests');
    });

    it('should support cache warm-up operations', async () => {
      // Create additional test users
      const warmUpUsers = Array.from({ length: 2 }, (_, i) => ({
        name: `Warm Up User ${i}`,
        email: `warmup-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const warmUpUserIds: string[] = [];
      for (const user of warmUpUsers) {
        const response = await request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(user)
          .expect(201);
        warmUpUserIds.push(response.body.data.id);
      }

      // Warm up cache
      const warmUpResponse = await request(app.getHttpServer())
        .post('/api/batch/cache/warm-up')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds: warmUpUserIds })
        .expect(200);

      expect(warmUpResponse.body.success).toBe(true);
      expect(warmUpResponse.body.message).toContain(`${warmUpUserIds.length} users`);

      // Verify users are cached
      for (const userId of warmUpUserIds) {
        const cacheKey = `user-service:user:${userId}`;
        const cachedUser = await redisClient.get(cacheKey);
        
        if (typeof redisClient.get === 'function') {
          expect(cachedUser).toBeTruthy();
        }
      }
    });

    it('should support cache clearing operations', async () => {
      // Populate cache
      await request(app.getHttpServer())
        .get(`/api/internal/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify cache is populated
      const cacheKey = `user-service:user:${createdUserId}`;
      let cachedUser = await redisClient.get(cacheKey);
      
      if (typeof redisClient.get === 'function') {
        expect(cachedUser).toBeTruthy();
      }

      // Clear cache
      const clearResponse = await request(app.getHttpServer())
        .post('/api/batch/cache/clear')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(clearResponse.body.success).toBe(true);
      expect(clearResponse.body.message).toContain('cleared successfully');

      // Verify cache is cleared
      cachedUser = await redisClient.get(cacheKey);
      
      if (typeof redisClient.get === 'function') {
        expect(cachedUser).toBeNull();
      }
    });
  });

  describe('Redis Pub/Sub Integration', () => {
    it('should publish user events to Redis channels', async () => {
      const testUser = {
        name: 'PubSub Test User',
        email: `pubsub-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Mock subscriber to capture published events
      const publishedEvents: any[] = [];
      const originalPublish = redisClient.publish;
      
      if (typeof redisClient.publish === 'function') {
        redisClient.publish = jest.fn().mockImplementation((channel, message) => {
          publishedEvents.push({ channel, message: JSON.parse(message) });
          return Promise.resolve(1);
        });
      }

      // Create user (should publish USER_CREATED event)
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = response.body.data.id;

      // Update user (should publish USER_UPDATED event)
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify events were published
      if (typeof redisClient.publish === 'function') {
        expect(publishedEvents.length).toBeGreaterThanOrEqual(1);
        
        const userCreatedEvent = publishedEvents.find(
          event => event.message.type === 'USER_CREATED'
        );
        
        if (userCreatedEvent) {
          expect(userCreatedEvent.channel).toBe('user-service:events');
          expect(userCreatedEvent.message.userId).toBe(userId);
          expect(userCreatedEvent.message.data.email).toBe(testUser.email);
        }
      }

      // Restore original publish function
      redisClient.publish = originalPublish;
    });
  });

  describe('Redis Connection Health', () => {
    it('should report Redis health status', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('info');
      expect(healthResponse.body).toHaveProperty('details');

      // Check if Redis health is included
      if (healthResponse.body.details.redis) {
        expect(healthResponse.body.details.redis).toHaveProperty('status');
      }
    });

    it('should handle Redis connection failures in health checks', async () => {
      // Temporarily break Redis connection
      const originalPing = redisClient.ping;
      redisClient.ping = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      // Health check should still respond (might be degraded)
      expect(healthResponse.body).toHaveProperty('status');

      // Restore Redis connection
      redisClient.ping = originalPing;
    });
  });
});