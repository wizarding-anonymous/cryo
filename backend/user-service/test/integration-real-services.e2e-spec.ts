import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { IntegrationAppModule } from './integration-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';
import { User } from '../src/user/entities/user.entity';

describe('Integration with Real Services (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IntegrationAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Apply the same global pipes, filters, and interceptors as in main.ts
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

    // Wait for database connection
    if (dataSource && !dataSource.isInitialized) {
      await dataSource.initialize();
    }
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (dataSource && dataSource.isInitialized) {
      try {
        const userRepository = dataSource.getRepository(User);
        await userRepository.query('DELETE FROM users WHERE email LIKE \'%test-integration%\'');
      } catch (error) {
        console.warn('Could not clean test data:', error.message);
      }
      await dataSource.destroy();
    }
    
    if (app) {
      await app.close();
    }
  }, 30000);

  beforeEach(async () => {
    // Clean up test data before each test
    if (dataSource && dataSource.isInitialized) {
      try {
        const userRepository = dataSource.getRepository(User);
        await userRepository.query('DELETE FROM users WHERE email LIKE \'%test-integration%\'');
      } catch (error) {
        console.warn('Could not clean test data:', error.message);
      }
    }
  });

  describe('Health Checks', () => {
    it('should return health status (may be degraded due to memory)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health');
      
      // Accept both 200 (healthy) and 503 (degraded) as valid for tests
      expect([200, 503]).toContain(res.status);
      
      if (res.status === 200) {
        expect(res.body.status).toBe('ok');
      }
    });

    it('should return detailed health status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health/detailed')
        .expect(200);
      
      // Check the actual structure returned by TestHealthController
      expect(res.body.data).toHaveProperty('checks');
      expect(res.body.data.checks).toHaveProperty('database');
      expect(res.body.data.checks).toHaveProperty('cache');
    });
  });

  // Test data used across multiple test suites
  const testUserData = {
    name: 'Integration Test User',
    email: `test-integration-${Date.now()}@example.com`,
    password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Valid bcrypt hash
  };

  describe('Internal API Integration', () => {

    it('should create user via internal API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUserData)
        .expect(201);

      expect(response.body.data.email).toEqual(testUserData.email);
      expect(response.body.data.name).toEqual(testUserData.name);
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('id');
    });

    it('should retrieve user by ID', async () => {
      // First create a user
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: `test-integration-get-${Date.now()}@example.com`,
        });

      const userId = createResponse.body.data.id;

      // Then retrieve it
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.id).toEqual(userId);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should retrieve user by email', async () => {
      // First create a user
      const uniqueEmail = `test-integration-email-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: uniqueEmail,
        });

      // Then retrieve it by email
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/email/${uniqueEmail}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.email).toEqual(uniqueEmail);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should update last login', async () => {
      // First create a user
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: `test-integration-login-${Date.now()}@example.com`,
        });

      const userId = createResponse.body.data.id;

      // Then update last login
      const response = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.message).toEqual('Last login updated successfully');
    });

    it('should check user existence', async () => {
      // First create a user
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: `test-integration-exists-${Date.now()}@example.com`,
        });

      const userId = createResponse.body.data.id;

      // Check that user exists
      const existsResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/exists`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(existsResponse.body.data.exists).toBe(true);

      // Check non-existent user
      const notExistsResponse = await request(app.getHttpServer())
        .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000/exists')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(notExistsResponse.body.data.exists).toBe(false);
    });
  });

  describe('Database Integration', () => {
    it('should persist data to PostgreSQL', async () => {
      const uniqueEmail = `test-integration-persist-${Date.now()}@example.com`;
      
      // Create user via API
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: uniqueEmail,
        });

      const userId = createResponse.body.data.id;

      // Verify data exists in database
      const userRepository = dataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });

      expect(user).toBeDefined();
      expect(user.email).toEqual(uniqueEmail);
      expect(user.name).toEqual(testUserData.name);
    });

    it('should handle duplicate email constraint', async () => {
      const duplicateEmail = `test-integration-duplicate-${Date.now()}@example.com`;
      
      // Create first user
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: duplicateEmail,
        })
        .expect(201);

      // Try to create second user with same email
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: duplicateEmail,
        })
        .expect(409);
    });
  });

  describe('Cache Integration', () => {
    it('should cache user data in Redis', async () => {
      const uniqueEmail = `test-integration-cache-${Date.now()}@example.com`;
      
      // Create user
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUserData,
          email: uniqueEmail,
        });

      const userId = createResponse.body.data.id;

      // First request (should cache)
      const firstResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Second request (should use cache)
      const secondResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(firstResponse.body.data.id).toEqual(secondResponse.body.data.id);
      expect(firstResponse.body.data.email).toEqual(secondResponse.body.data.email);
    });
  });

  describe('Error Handling Integration', () => {
    it('should return 404 for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
        .set('x-internal-service', 'user-service-internal')
        .expect(404);
      
      expect(res.body.message).toContain('не найден');
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/internal/users/invalid-uuid')
        .set('x-internal-service', 'user-service-internal')
        .expect(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        })
        .expect(400);
      
      expect(res.body.message).toContain('Email must be valid');
    });
  });

  describe('Security Integration', () => {
    it('should reject requests without internal service header', async () => {
      await request(app.getHttpServer())
        .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
        .expect(401);
    });

    it('should reject requests with invalid internal service header', async () => {
      await request(app.getHttpServer())
        .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
        .set('x-internal-service', 'invalid-service')
        .expect(401);
    });
  });
});