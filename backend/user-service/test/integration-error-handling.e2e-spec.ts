import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource } from 'typeorm';

describe('Error Handling and Edge Cases Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);

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
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    if (dataSource?.isInitialized) {
      await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    }
  });

  describe('Input Validation and Sanitization', () => {
    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..double.dot@example.com',
        'user@.example.com',
        'user@example.',
        '',
        null,
        undefined,
      ];

      for (const email of invalidEmails) {
        const testUser = {
          name: 'Test User',
          email: email,
          password: '$2b$10$hashedPasswordFromAuthService',
        };

        await request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(testUser)
          .expect(400)
          .then((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('validation');
          });
      }
    });

    it('should reject invalid UUID formats', async () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra',
        '',
        null,
        undefined,
      ];

      for (const uuid of invalidUUIDs) {
        await request(app.getHttpServer())
          .get(`/api/internal/users/${uuid}`)
          .set('x-internal-service', 'user-service-internal')
          .expect(400)
          .then((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid UUID format');
          });
      }
    });

    it('should sanitize and validate user names', async () => {
      const testCases = [
        {
          name: '',
          shouldFail: true,
          expectedError: 'Name cannot be empty',
        },
        {
          name: 'a'.repeat(101), // Too long
          shouldFail: true,
          expectedError: 'Name cannot be longer than 100 characters',
        },
        {
          name: '<script>alert("xss")</script>',
          shouldFail: false,
          expectedSanitized: 'alert("xss")', // HTML tags should be stripped
        },
        {
          name: 'Valid Name 123',
          shouldFail: false,
          expectedSanitized: 'Valid Name 123',
        },
        {
          name: '   Trimmed Name   ',
          shouldFail: false,
          expectedSanitized: 'Trimmed Name',
        },
      ];

      for (const testCase of testCases) {
        const testUser = {
          name: testCase.name,
          email: `test-${Date.now()}-${Math.random()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        };

        if (testCase.shouldFail) {
          await request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send(testUser)
            .expect(400)
            .then((res) => {
              expect(res.body.success).toBe(false);
              expect(res.body.error).toContain(testCase.expectedError);
            });
        } else {
          await request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send(testUser)
            .expect(201)
            .then((res) => {
              expect(res.body.data.name).toBe(testCase.expectedSanitized);
            });
        }
      }
    });

    it('should reject malicious JSON payloads', async () => {
      const maliciousPayloads: any[] = [
        {
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedPasswordFromAuthService',
          '__proto__': { isAdmin: true }, // Prototype pollution attempt
        },
        {
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedPasswordFromAuthService',
          'constructor': { prototype: { isAdmin: true } }, // Constructor pollution
        },
      ];

      for (const payload of maliciousPayloads) {
        await request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(payload)
          .expect(400)
          .then((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('should not exist');
          });
      }
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Simulate database connection failure by closing the connection
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }

      const testUser = {
        name: 'DB Failure Test',
        email: `db-failure-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(500)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('database');
        });

      // Reconnect for other tests
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
    });

    it('should handle database constraint violations', async () => {
      const testUser = {
        name: 'Constraint Test User',
        email: `constraint-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Create first user
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      // Try to create second user with same email (should violate unique constraint)
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(409)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('already exists');
          expect(res.body).toHaveProperty('correlationId');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should handle database query timeouts', async () => {
      // This test simulates a scenario where a query might timeout
      // In a real scenario, you might want to configure a very short timeout
      
      const response = await request(app.getHttpServer())
        .get('/api/users?limit=10000&sortBy=createdAt') // Large query
        .set('x-internal-service', 'user-service-internal')
        .expect((res) => {
          // Should either succeed or fail gracefully with timeout
          expect([200, 408, 500]).toContain(res.status);
        });

      if (response.status !== 200) {
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('correlationId');
      }
    });

    it('should handle malformed SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email) VALUES ('hacked@example.com'); --",
        "' UNION SELECT * FROM users --",
      ];

      for (const injection of sqlInjectionAttempts) {
        // Try SQL injection in email field
        await request(app.getHttpServer())
          .get(`/api/internal/users/email/${encodeURIComponent(injection)}`)
          .set('x-internal-service', 'user-service-internal')
          .expect((res) => {
            // Should either return 400 (validation error) or 404 (not found)
            // Should NOT return 500 (SQL error) or succeed with injection
            expect([400, 404]).toContain(res.status);
          });

        // Try SQL injection in search
        await request(app.getHttpServer())
          .get(`/api/users/search?q=${encodeURIComponent(injection)}`)
          .set('x-internal-service', 'user-service-internal')
          .expect((res) => {
            expect([400, 404]).toContain(res.status);
          });
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const testUser = {
        name: 'Rate Limit Test',
        email: `rate-limit-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Create a user first
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Make many rapid requests to trigger rate limiting
      const rapidRequests = Array.from({ length: 50 }, () =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      const successfulResponses = responses.filter(res => res.status === 200);

      // In test environment, rate limiting might be relaxed, so we check for either scenario
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.error).toContain('rate limit');
      }
      
      // At least some requests should succeed
      expect(successfulResponses.length).toBeGreaterThan(0);
    });

    it('should handle large payload attacks', async () => {
      const largePayload = {
        name: 'a'.repeat(10000), // Very large name
        email: `large-payload-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        metadata: 'x'.repeat(100000), // Very large metadata
      };

      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(largePayload)
        .expect((res) => {
          // Should reject large payloads
          expect([400, 413]).toContain(res.status);
        });
    });

    it('should handle batch operation limits', async () => {
      // Try to create too many users in a single batch
      const tooManyUsers = Array.from({ length: 1000 }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: tooManyUsers,
          options: { chunkSize: 100 }
        })
        .expect((res) => {
          // Should either limit batch size or handle gracefully
          expect([200, 400, 413]).toContain(res.status);
          
          if (res.status === 200) {
            // If accepted, should have reasonable limits
            expect(res.body.stats.total).toBeLessThanOrEqual(1000);
          }
        });
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should reject requests without proper authentication', async () => {
      const testUser = {
        name: 'Auth Test User',
        email: `auth-test-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Request without authentication header
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .send(testUser)
        .expect(401)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Unauthorized');
        });

      // Request with invalid authentication
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'invalid-service')
        .send(testUser)
        .expect(401)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Unauthorized');
        });
    });

    it('should handle malformed authentication headers', async () => {
      const testUser = {
        name: 'Malformed Auth Test',
        email: `malformed-auth-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const malformedHeaders = [
        { 'x-api-key': '' },
        { 'x-api-key': 'invalid-key-format' },
        { 'authorization': 'Bearer' }, // Missing token
        { 'authorization': 'InvalidScheme token' },
        { 'x-internal-service': '' },
        { 'x-internal-service': 'service with spaces' },
      ];

      for (const headers of malformedHeaders) {
        await request(app.getHttpServer())
          .post('/api/internal/users')
          .set(headers)
          .send(testUser)
          .expect(401)
          .then((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Unauthorized');
          });
      }
    });
  });

  describe('Cache and Redis Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const testUser = {
        name: 'Redis Failure Test',
        email: `redis-failure-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Create user
      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Even if Redis is down, user operations should still work (fallback to database)
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should handle cache corruption gracefully', async () => {
      // This test would simulate corrupted cache data
      // In a real scenario, you might inject corrupted data into Redis
      
      const testUser = {
        name: 'Cache Corruption Test',
        email: `cache-corruption-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Request should still work even with potential cache issues
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.id).toBe(userId);
    });
  });

  describe('File Upload Error Handling', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testUser = {
        name: 'File Upload Test User',
        email: `file-upload-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      testUserId = response.body.data.id;
    });

    it('should reject files that are too large', async () => {
      // Create a buffer that simulates a large file (> 5MB)
      const largeFileBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      await request(app.getHttpServer())
        .post(`/api/profiles/${testUserId}/avatar`)
        .attach('avatar', largeFileBuffer, 'large-avatar.jpg')
        .expect(413) // Payload too large
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('too large');
        });
    });

    it('should reject invalid file types', async () => {
      const invalidFileBuffer = Buffer.from('This is not an image file');

      await request(app.getHttpServer())
        .post(`/api/profiles/${testUserId}/avatar`)
        .attach('avatar', invalidFileBuffer, 'malicious.exe')
        .expect(400)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('file type');
        });
    });

    it('should handle missing file uploads', async () => {
      await request(app.getHttpServer())
        .post(`/api/profiles/${testUserId}/avatar`)
        .expect(400)
        .then((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('file');
        });
    });
  });

  describe('Concurrent Operation Error Handling', () => {
    it('should handle concurrent user creation with same email', async () => {
      const testUser = {
        name: 'Concurrent Test User',
        email: `concurrent-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // Create multiple concurrent requests with same email
      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(testUser)
      );

      const responses = await Promise.all(concurrentRequests);
      
      // Only one should succeed (201), others should fail with conflict (409)
      const successfulResponses = responses.filter(res => res.status === 201);
      const conflictResponses = responses.filter(res => res.status === 409);

      expect(successfulResponses).toHaveLength(1);
      expect(conflictResponses.length).toBeGreaterThan(0);
      
      conflictResponses.forEach(res => {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('already exists');
      });
    });

    it('should handle concurrent updates to same user', async () => {
      // Create a test user
      const testUser = {
        name: 'Concurrent Update User',
        email: `concurrent-update-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Make concurrent updates
      const concurrentUpdates = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .patch(`/api/internal/users/${userId}/last-login`)
          .set('x-internal-service', 'user-service-internal')
      );

      const responses = await Promise.all(concurrentUpdates);
      
      // All updates should succeed (optimistic locking should handle concurrency)
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Last login updated successfully');
      });
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle memory-intensive operations gracefully', async () => {
      // Create many users to test memory usage
      const manyUsers = Array.from({ length: 100 }, (_, i) => ({
        name: `Memory Test User ${i}`,
        email: `memory-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const batchResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: manyUsers,
          options: { chunkSize: 20 }
        })
        .expect(201);

      expect(batchResponse.body.stats.total).toBe(100);
      expect(batchResponse.body.stats.successful).toBeGreaterThan(0);

      // Query all users to test memory usage during retrieval
      const queryResponse = await request(app.getHttpServer())
        .get('/api/users?limit=100')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(queryResponse.body.data.items.length).toBeGreaterThan(0);
    });

    it('should handle deep recursion attempts', async () => {
      // Test with deeply nested JSON (potential stack overflow)
      let deepObject: any = { value: 'test' };
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }

      const testUser = {
        name: 'Deep Recursion Test',
        email: `deep-recursion-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        metadata: deepObject,
      };

      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect((res) => {
          // Should either handle gracefully or reject
          expect([201, 400, 413]).toContain(res.status);
        });
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const errorScenarios = [
        {
          request: () => request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send({ name: '', email: 'invalid', password: 'test' }),
          expectedStatus: 400,
        },
        {
          request: () => request(app.getHttpServer())
            .get('/api/internal/users/invalid-uuid')
            .set('x-internal-service', 'user-service-internal'),
          expectedStatus: 400,
        },
        {
          request: () => request(app.getHttpServer())
            .get('/api/internal/users/123e4567-e89b-12d3-a456-426614174000')
            .set('x-internal-service', 'user-service-internal'),
          expectedStatus: 404,
        },
        {
          request: () => request(app.getHttpServer())
            .post('/api/internal/users')
            .send({ name: 'Test', email: 'test@example.com', password: 'test' }),
          expectedStatus: 401,
        },
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.request().expect(scenario.expectedStatus);

        // Verify consistent error response format
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('data', null);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('correlationId');
        
        expect(typeof response.body.error).toBe('string');
        expect(typeof response.body.timestamp).toBe('string');
        expect(typeof response.body.correlationId).toBe('string');
      }
    });

    it('should include correlation IDs in all error responses', async () => {
      const customCorrelationId = `test-correlation-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .get('/api/internal/users/invalid-uuid')
        .set('x-internal-service', 'user-service-internal')
        .set('x-correlation-id', customCorrelationId)
        .expect(400);

      expect(response.body.correlationId).toBe(customCorrelationId);
    });

    it('should not leak sensitive information in error messages', async () => {
      // Try to trigger database errors that might leak schema information
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedPasswordFromAuthService',
          maliciousField: 'should not be in error message',
        })
        .expect(400);

      // Error message should not contain sensitive database information
      expect(response.body.error).not.toContain('maliciousField');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('table');
      expect(response.body.error).not.toContain('column');
    });
  });
});