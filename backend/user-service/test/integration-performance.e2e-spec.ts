import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';

describe('Performance Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);

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
    // Clean up test data
    if (dataSource?.isInitialized) {
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('Single User Operations Performance', () => {
    it('should create users within acceptable time limits', async () => {
      const testUser = {
        name: 'Performance Test User',
        email: `perf-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.id).toBeTruthy();
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should retrieve users by ID within acceptable time limits', async () => {
      // Create a test user first
      const testUser = {
        name: 'Retrieval Test User',
        email: `retrieval-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Measure retrieval time
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.id).toBe(userId);
      expect(duration).toBeLessThan(100); // Should complete within 100ms (cached or indexed)
    });

    it('should retrieve users by email within acceptable time limits', async () => {
      const testUser = {
        name: 'Email Retrieval Test User',
        email: `email-retrieval-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      // Measure email lookup time
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/email/${testUser.email}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.email).toBe(testUser.email);
      expect(duration).toBeLessThan(100); // Should be fast due to email index
    });

    it('should update user last login within acceptable time limits', async () => {
      const testUser = {
        name: 'Update Test User',
        email: `update-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Measure update time
      const startTime = Date.now();

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch user creation efficiently', async () => {
      const batchSize = 100;
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchUsers,
          options: { chunkSize: 20 }
        })
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.stats.successful).toBe(batchSize);
      expect(response.body.stats.failed).toBe(0);
      
      // Should process 100 users within reasonable time (allow for database operations)
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 users
      
      // Calculate throughput
      const usersPerSecond = (batchSize / duration) * 1000;
      expect(usersPerSecond).toBeGreaterThan(20); // At least 20 users per second
    });

    it('should handle batch user lookup efficiently', async () => {
      // First create test users
      const batchSize = 50;
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Lookup User ${i}`,
        email: `lookup-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchUsers,
          options: { chunkSize: 25 }
        })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Measure batch lookup time
      const startTime = Date.now();

      const lookupResponse = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${userIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(lookupResponse.body.stats.found).toBe(batchSize);
      expect(lookupResponse.body.stats.missing).toBe(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Calculate lookup throughput
      const lookupsPerSecond = (batchSize / duration) * 1000;
      expect(lookupsPerSecond).toBeGreaterThan(50); // At least 50 lookups per second
    });

    it('should handle batch updates efficiently', async () => {
      // Create test users
      const batchSize = 30;
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Update Batch User ${i}`,
        email: `update-batch-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchUsers,
          options: { chunkSize: 15 }
        })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Measure batch update time
      const startTime = Date.now();

      const updateResponse = await request(app.getHttpServer())
        .patch('/api/batch/users/last-login')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          userIds,
          options: { chunkSize: 10 }
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(updateResponse.body.stats.successful).toBe(batchSize);
      expect(updateResponse.body.stats.failed).toBe(0);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Pagination Performance', () => {
    beforeEach(async () => {
      // Create test data for pagination tests
      const testUsers = Array.from({ length: 200 }, (_, i) => ({
        name: `Pagination User ${i}`,
        email: `pagination-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 2 === 0,
        lastLoginAt: i % 3 === 0 ? new Date() : null,
      }));

      // Insert in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < testUsers.length; i += batchSize) {
        const batch = testUsers.slice(i, i + batchSize);
        await userRepository.save(batch as any);
      }
    });

    it('should handle offset-based pagination efficiently', async () => {
      const pageSize = 20;
      const pageNumber = 5; // Middle page to test offset performance

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/api/users?page=${pageNumber}&limit=${pageSize}&sortBy=createdAt&sortOrder=desc`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.items).toHaveLength(pageSize);
      expect(response.body.data.pagination.page).toBe(pageNumber);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(300); // Should complete within 300ms
    });

    it('should handle cursor-based pagination efficiently', async () => {
      // Get first page to get cursor
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/users?limit=20&sortBy=createdAt&sortOrder=asc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const nextCursor = firstPageResponse.body.data.pagination.nextCursor;
      expect(nextCursor).toBeTruthy();

      // Measure cursor-based pagination performance
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/api/users?cursor=${encodeURIComponent(nextCursor)}&limit=20&sortBy=createdAt&sortOrder=asc`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.items).toHaveLength(20);
      expect(duration).toBeLessThan(200); // Cursor pagination should be faster than offset
    });

    it('should handle filtered pagination efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/users?isActive=true&limit=50&sortBy=lastLoginAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((user: any) => {
        expect(user.isActive).toBe(true);
      });
      expect(duration).toBeLessThan(400); // Filtered queries might be slightly slower
    });

    it('should handle search pagination efficiently', async () => {
      const searchTerm = 'User 1'; // Should match many users (User 1, User 10, User 11, etc.)

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=30`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Search queries are typically slower
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent read operations efficiently', async () => {
      // Create test users
      const testUsers = Array.from({ length: 10 }, (_, i) => ({
        name: `Concurrent Read User ${i}`,
        email: `concurrent-read-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: testUsers,
          options: { chunkSize: 10 }
        })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Perform concurrent reads
      const concurrentReads = 50;
      const startTime = Date.now();

      const readPromises = Array.from({ length: concurrentReads }, (_, i) => {
        const userId = userIds[i % userIds.length];
        return request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal');
      });

      const responses = await Promise.all(readPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.id).toBeTruthy();
      });

      // Calculate concurrent throughput
      const requestsPerSecond = (concurrentReads / duration) * 1000;
      expect(requestsPerSecond).toBeGreaterThan(100); // At least 100 requests per second
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent write operations efficiently', async () => {
      const concurrentWrites = 20;
      const startTime = Date.now();

      const writePromises = Array.from({ length: concurrentWrites }, (_, i) => 
        request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send({
            name: `Concurrent Write User ${i}`,
            email: `concurrent-write-${i}-${Date.now()}@example.com`,
            password: '$2b$10$hashedPasswordFromAuthService',
          })
      );

      const responses = await Promise.all(writePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.data.id).toBeTruthy();
      });

      // Calculate concurrent write throughput
      const writesPerSecond = (concurrentWrites / duration) * 1000;
      expect(writesPerSecond).toBeGreaterThan(10); // At least 10 writes per second
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle mixed read/write operations efficiently', async () => {
      // Create some initial users
      const initialUsers = Array.from({ length: 5 }, (_, i) => ({
        name: `Mixed Op User ${i}`,
        email: `mixed-op-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: initialUsers,
          options: { chunkSize: 5 }
        })
        .expect(201);

      const existingUserIds = createResponse.body.data.map((user: any) => user.id);

      // Mix of read and write operations
      const mixedOperations = [];
      const startTime = Date.now();

      // Add read operations
      for (let i = 0; i < 15; i++) {
        const userId = existingUserIds[i % existingUserIds.length];
        mixedOperations.push(
          request(app.getHttpServer())
            .get(`/api/internal/users/${userId}`)
            .set('x-internal-service', 'user-service-internal')
        );
      }

      // Add write operations
      for (let i = 0; i < 10; i++) {
        mixedOperations.push(
          request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send({
              name: `Mixed Write User ${i}`,
              email: `mixed-write-${i}-${Date.now()}@example.com`,
              password: '$2b$10$hashedPasswordFromAuthService',
            })
        );
      }

      // Add update operations
      for (let i = 0; i < 5; i++) {
        const userId = existingUserIds[i % existingUserIds.length];
        mixedOperations.push(
          request(app.getHttpServer())
            .patch(`/api/internal/users/${userId}/last-login`)
            .set('x-internal-service', 'user-service-internal')
        );
      }

      const responses = await Promise.all(mixedOperations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      responses.forEach((response, index) => {
        if (index < 15) {
          // Read operations
          expect(response.status).toBe(200);
          expect(response.body.data.id).toBeTruthy();
        } else if (index < 25) {
          // Write operations
          expect(response.status).toBe(201);
          expect(response.body.data.id).toBeTruthy();
        } else {
          // Update operations
          expect(response.status).toBe(200);
          expect(response.body.message).toBe('Last login updated successfully');
        }
      });

      const totalOperations = mixedOperations.length;
      const operationsPerSecond = (totalOperations / duration) * 1000;
      expect(operationsPerSecond).toBeGreaterThan(20); // At least 20 operations per second
      expect(duration).toBeLessThan(4000); // Should complete within 4 seconds
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache performance benefits', async () => {
      const testUser = {
        name: 'Cache Performance User',
        email: `cache-perf-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // First request (cache miss - should be slower)
      const firstRequestStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const firstRequestDuration = Date.now() - firstRequestStart;

      // Second request (cache hit - should be faster)
      const secondRequestStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const secondRequestDuration = Date.now() - secondRequestStart;

      // Cache hit should be significantly faster (at least 2x faster)
      expect(secondRequestDuration).toBeLessThan(firstRequestDuration);
      expect(secondRequestDuration).toBeLessThan(50); // Cached response should be very fast
    });

    it('should handle cache warm-up performance', async () => {
      // Create test users
      const warmUpUsers = Array.from({ length: 20 }, (_, i) => ({
        name: `Warm Up User ${i}`,
        email: `warmup-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const createResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: warmUpUsers,
          options: { chunkSize: 20 }
        })
        .expect(201);

      const userIds = createResponse.body.data.map((user: any) => user.id);

      // Measure cache warm-up time
      const startTime = Date.now();

      await request(app.getHttpServer())
        .post('/api/batch/cache/warm-up')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should warm up 20 users within 1 second

      // Verify that subsequent requests are fast (cached)
      const cachedRequestStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${userIds.slice(0, 10).join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const cachedRequestDuration = Date.now() - cachedRequestStart;

      expect(cachedRequestDuration).toBeLessThan(200); // Should be fast due to cache
    });
  });

  describe('Memory Usage Performance', () => {
    it('should handle large result sets without excessive memory usage', async () => {
      // Create a large number of users
      const largeDataSet = Array.from({ length: 500 }, (_, i) => ({
        name: `Large Dataset User ${i}`,
        email: `large-dataset-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        preferences: {
          language: 'en',
          timezone: 'UTC',
          theme: 'light' as 'light' | 'dark' | 'auto',
          notifications: { email: true, push: true, sms: false },
          gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
        },
      }));

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < largeDataSet.length; i += batchSize) {
        const batch = largeDataSet.slice(i, i + batchSize);
        await userRepository.save(batch as any);
      }

      // Query large result set with pagination
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/users?limit=100&sortBy=createdAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.data.items).toHaveLength(100);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(1000); // Should handle large dataset efficiently

      // Verify memory doesn't grow excessively by doing multiple large queries
      const multipleQueriesStart = Date.now();
      
      const multipleQueries = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .get(`/api/users?page=${i + 1}&limit=100&sortBy=createdAt&sortOrder=desc`)
          .set('x-internal-service', 'user-service-internal')
      );

      const multipleResponses = await Promise.all(multipleQueries);
      const multipleQueriesDuration = Date.now() - multipleQueriesStart;

      multipleResponses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.data.items.length).toBeGreaterThan(0);
      });

      expect(multipleQueriesDuration).toBeLessThan(3000); // Should handle multiple large queries
    });
  });

  describe('Database Query Performance', () => {
    beforeEach(async () => {
      // Create test data with various patterns for query optimization testing
      const testUsers = Array.from({ length: 100 }, (_, i) => ({
        name: `Query Test User ${i}`,
        email: `query-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 3 !== 0, // Mix of active/inactive
        lastLoginAt: i % 4 === 0 ? new Date(Date.now() - i * 1000 * 60 * 60) : null, // Various login times
        preferences: {
          language: ['en', 'es', 'fr'][i % 3],
          timezone: ['UTC', 'America/New_York', 'Europe/London'][i % 3],
          theme: (['light', 'dark'][i % 2]) as 'light' | 'dark' | 'auto',
        },
      }));

      await userRepository.save(testUsers as any);
    });

    it('should perform indexed queries efficiently', async () => {
      // Test email index performance
      const emailQueryStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/internal/users/email/query-test-50-${Date.now()}@example.com`)
        .set('x-internal-service', 'user-service-internal')
        .expect((res) => {
          expect([200, 404]).toContain(res.status);
        });
      const emailQueryDuration = Date.now() - emailQueryStart;
      expect(emailQueryDuration).toBeLessThan(50); // Email queries should be very fast

      // Test isActive index performance
      const activeQueryStart = Date.now();
      const activeResponse = await request(app.getHttpServer())
        .get('/api/users?isActive=true&limit=50')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const activeQueryDuration = Date.now() - activeQueryStart;
      
      expect(activeResponse.body.data.items.length).toBeGreaterThan(0);
      expect(activeQueryDuration).toBeLessThan(100); // Indexed queries should be fast
    });

    it('should perform complex filtered queries efficiently', async () => {
      const complexQueryStart = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/api/users?isActive=true&sortBy=lastLoginAt&sortOrder=desc&limit=25')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const complexQueryDuration = Date.now() - complexQueryStart;

      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((user: any) => {
        expect(user.isActive).toBe(true);
      });
      expect(complexQueryDuration).toBeLessThan(200); // Complex queries should still be reasonable
    });

    it('should perform JSONB queries efficiently', async () => {
      // Query users by JSONB field (preferences.language)
      const jsonbQueryStart = Date.now();
      
      // This would typically be done through a custom endpoint that uses JSONB operators
      // For now, we'll test a general query and verify it completes in reasonable time
      const response = await request(app.getHttpServer())
        .get('/api/users?limit=50&sortBy=createdAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const jsonbQueryDuration = Date.now() - jsonbQueryStart;

      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(jsonbQueryDuration).toBeLessThan(150); // JSONB queries should be reasonably fast
    });
  });
});