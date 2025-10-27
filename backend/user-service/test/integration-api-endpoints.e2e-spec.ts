import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestPerformanceModule } from './test-performance.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';

describe('API Endpoints Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestPerformanceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    const loggingService = app.get(LoggingService);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
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
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    if (dataSource?.isInitialized) {
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }
  });

  describe('User Controller API Endpoints', () => {    const
 testUser = {
      name: 'API Test User',
      email: `api-test-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };
    let createdUserId: string;

    beforeEach(async () => {
      // Create a test user for each test
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);
      
      createdUserId = response.body.data.id;
    });

    it('should create user via POST /api/users', async () => {
      const newUser = {
        name: 'New API User',
        email: `new-api-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-create')
        .send(newUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeTruthy();
      expect(response.body.data.email).toBe(newUser.email);
      expect(response.body.data.name).toBe(newUser.name);
      expect(response.body.data.isActive).toBe(true);
      expect(response.body.data.createdAt).toBeTruthy();
      expect(response.body.data.updatedAt).toBeTruthy();
      expect(response.body.correlationId).toBe('api-test-create');
    });

    it('should get user by ID via GET /api/users/:id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-get-by-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdUserId);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.correlationId).toBe('api-test-get-by-id');
    });

    it('should get user by email via GET /api/users/email/:email', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/users/email/${testUser.email}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-get-by-email')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdUserId);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.correlationId).toBe('api-test-get-by-email');
    });
  });

  describe('Batch Operations Integration', () => {
    it('should handle batch user creation and lookup', async () => {
      const batchUsers = Array.from({ length: 5 }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      // Create users in batch
      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-batch-create')
        .send({ 
          users: batchUsers,
          options: { chunkSize: 10, continueOnError: false }
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.stats.total).toBe(5);
      expect(createResponse.body.stats.successful).toBe(5);
      expect(createResponse.body.stats.failed).toBe(0);
      expect(createResponse.body.data).toHaveLength(5);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Lookup users in batch
      const lookupResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${userIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-batch-lookup')
        .expect(200);

      expect(lookupResponse.body.success).toBe(true);
      expect(lookupResponse.body.data).toHaveLength(5);
      expect(lookupResponse.body.stats.found).toBe(5);
      expect(lookupResponse.body.stats.missing).toBe(0);
    });

    it('should handle batch profile operations', async () => {
      // Create test users
      const batchUsers = Array.from({ length: 3 }, (_, i) => ({
        name: `Profile User ${i}`,
        email: `profile-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ users: batchUsers })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Get batch profiles
      const profilesResponse = await request(app.getHttpServer())
        .post('/api/users/batch/profiles')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-batch-profiles')
        .send({
          userIds,
          includePreferences: true,
          includePrivacySettings: false,
          chunkSize: 10,
        })
        .expect(200);

      expect(profilesResponse.body.success).toBe(true);
      expect(profilesResponse.body.data.profiles).toHaveLength(3);
      expect(profilesResponse.body.data.stats.requested).toBe(3);
      expect(profilesResponse.body.data.stats.found).toBe(3);
      expect(profilesResponse.body.data.stats.missing).toBe(0);
    });
  });

  describe('Cache Management Integration', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testUser = {
        name: 'Cache Test User',
        email: `cache-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);
      
      testUserId = response.body.data.id;
    });

    it('should provide cache statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/batch/cache/stats')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-cache-stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hitRate');
      expect(response.body.data).toHaveProperty('missRate');
      expect(response.body.data).toHaveProperty('totalRequests');
    });

    it('should support cache warm-up operations', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/batch/cache/warm-up')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', 'api-test-cache-warmup')
        .send({ userIds: [testUserId] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('1 users');
    });
  });
});
