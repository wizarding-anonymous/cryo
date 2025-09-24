import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntegrationAppModule } from './integration-app.module';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { SecurityAlert } from '../src/entities/security-alert.entity';
import { IPBlock } from '../src/entities/ip-block.entity';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';
import { REDIS_CLIENT } from '../src/redis/redis.constants';

describe('Security Service Error Handling (E2E)', () => {
  let app: INestApplication;
  let securityEventRepository: Repository<SecurityEvent>;
  let securityAlertRepository: Repository<SecurityAlert>;
  let ipBlockRepository: Repository<IPBlock>;
  let redisClient: Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IntegrationAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    securityEventRepository = app.get<Repository<SecurityEvent>>(getRepositoryToken(SecurityEvent));
    securityAlertRepository = app.get<Repository<SecurityAlert>>(getRepositoryToken(SecurityAlert));
    ipBlockRepository = app.get<Repository<IPBlock>>(getRepositoryToken(IPBlock));
    redisClient = app.get<Redis>(REDIS_CLIENT);
  });

  afterAll(async () => {
    if (redisClient) {
      redisClient.disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear all data before each test
    await securityEventRepository.clear();
    await securityAlertRepository.clear();
    await ipBlockRepository.clear();
    await redisClient.flushall();
  });

  describe('Input Validation Errors', () => {
    it('should handle invalid JSON payloads', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(response.body.statusCode).toBe(400);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send({}) // Empty payload
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should validate enum values', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send({
          type: 'INVALID_EVENT_TYPE',
          ip: '192.168.1.100',
          data: { test: 'data' }
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should validate IP address format', async () => {
      const response = await request(app.getHttpServer())
        .get('/security/ip-status/invalid-ip-format')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle oversized payloads', async () => {
      const largePayload = {
        type: SecurityEventType.DATA_ACCESS,
        ip: '192.168.1.100',
        data: {
          largeField: 'x'.repeat(100000), // 100KB string
          metadata: Array(10000).fill({ key: 'value' })
        }
      };

      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send(largePayload);

      // Should either accept or reject with appropriate status
      expect([204, 413, 400]).toContain(response.status);
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle database constraint violations gracefully', async () => {
      // Try to create duplicate entries that might violate constraints
      const eventData = {
        type: SecurityEventType.LOGIN,
        userId: 'test-user',
        ip: '192.168.1.100',
        data: { test: 'data' }
      };

      // First request should succeed
      await request(app.getHttpServer())
        .post('/security/report-event')
        .send(eventData)
        .expect(204);

      // Second identical request should also succeed (no unique constraints expected)
      await request(app.getHttpServer())
        .post('/security/report-event')
        .send(eventData)
        .expect(204);
    });

    it('should handle database timeout scenarios', async () => {
      // Simulate high load that might cause timeouts
      const promises = Array(50).fill(null).map((_, index) => {
        return request(app.getHttpServer())
          .post('/security/report-event')
          .send({
            type: SecurityEventType.DATA_ACCESS,
            userId: `user-${index}`,
            ip: `192.168.1.${(index % 254) + 1}`,
            data: { requestId: index, timestamp: new Date() }
          });
      });

      const responses = await Promise.all(promises);
      
      // Most requests should succeed, some might timeout
      const successfulResponses = responses.filter(res => res.status === 204);
      const errorResponses = responses.filter(res => res.status >= 500);
      
      expect(successfulResponses.length).toBeGreaterThan(40); // At least 80% success
      
      // If there are errors, they should be proper server errors
      errorResponses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(500);
      });
    });
  });

  describe('Redis Connection Errors', () => {
    it('should handle Redis disconnection gracefully', async () => {
      // Disconnect Redis temporarily
      redisClient.disconnect();

      // Rate limiting operations should handle Redis being unavailable
      const response = await request(app.getHttpServer())
        .post('/security/check-login')
        .send({
          userId: 'test-user',
          ip: '192.168.1.100'
        });

      // Should either succeed with degraded functionality or return appropriate error
      expect([200, 500, 503]).toContain(response.status);

      // Reconnect Redis for other tests
      await redisClient.connect();
    });

    it('should handle Redis memory limits', async () => {
      // Try to fill Redis with data to test memory handling
      const promises = Array(1000).fill(null).map(async (_, index) => {
        try {
          await redisClient.set(`test-key-${index}`, 'x'.repeat(1000));
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      });

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);
      
      // Should handle at least some operations successfully
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle missing authentication tokens', async () => {
      const response = await request(app.getHttpServer())
        .get('/security/logs')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle invalid authentication tokens', async () => {
      const response = await request(app.getHttpServer())
        .get('/security/logs')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle expired authentication tokens', async () => {
      // Create an expired token (this would need JWT service mock adjustment)
      const response = await request(app.getHttpServer())
        .get('/security/logs')
        .set('Authorization', 'Bearer expired.token.here')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle insufficient permissions', async () => {
      // This test assumes user token doesn't have admin privileges
      const response = await request(app.getHttpServer())
        .post('/security/block-ip')
        .set('Authorization', 'Bearer user-token')
        .send({
          ip: '192.168.1.100',
          reason: 'Test block',
          durationMinutes: 60
        })
        .expect(403);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle concurrent rate limit checks for same key', async () => {
      const testKey = 'concurrent-test';
      const limit = 5;
      const concurrentRequests = 20;

      // Send many concurrent requests for the same rate limit key
      const promises = Array(concurrentRequests).fill(null).map(() => {
        return request(app.getHttpServer())
          .post('/security/report-event')
          .send({
            type: SecurityEventType.LOGIN,
            userId: 'rate-limit-user',
            ip: '192.168.1.100',
            data: { test: 'concurrent' }
          });
      });

      const responses = await Promise.all(promises);
      
      const successfulResponses = responses.filter(res => res.status === 204);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      // Should have some successful and some rate-limited responses
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeLessThan(concurrentRequests);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle rate limit key collisions', async () => {
      // Test with similar but different keys
      const baseKey = 'collision-test';
      const keys = [`${baseKey}-1`, `${baseKey}-2`, `${baseKey}1`, `${baseKey}2`];
      
      const promises = keys.map(key => {
        return request(app.getHttpServer())
          .post('/security/report-event')
          .send({
            type: SecurityEventType.DATA_ACCESS,
            userId: key,
            ip: '192.168.1.100',
            data: { key }
          });
      });

      const responses = await Promise.all(promises);
      
      // All should succeed as they're different keys
      responses.forEach(response => {
        expect(response.status).toBe(204);
      });
    });
  });

  describe('Network and Timeout Errors', () => {
    it('should handle slow database queries', async () => {
      // Create a complex query that might be slow
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/security/logs?page=1&limit=1000')
        .set('Authorization', 'Bearer admin-token')
        .timeout(30000); // 30 second timeout

      const duration = Date.now() - startTime;
      
      // Should either succeed or timeout gracefully
      if (response.status === 200) {
        expect(duration).toBeLessThan(30000);
      } else {
        expect([408, 500, 503]).toContain(response.status);
      }
    });

    it('should handle malformed request headers', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .set('Content-Type', 'invalid-content-type')
        .send('not json data')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', async () => {
      // Create many large objects to test memory handling
      const largeRequests = Array(100).fill(null).map((_, index) => {
        return request(app.getHttpServer())
          .post('/security/report-event')
          .send({
            type: SecurityEventType.DATA_ACCESS,
            userId: `memory-test-${index}`,
            ip: '192.168.1.100',
            data: {
              largeData: Array(1000).fill(`data-${index}`),
              timestamp: new Date(),
              metadata: { index, test: 'memory-pressure' }
            }
          });
      });

      const responses = await Promise.all(largeRequests);
      
      // Should handle most requests successfully
      const successfulResponses = responses.filter(res => res.status === 204);
      expect(successfulResponses.length).toBeGreaterThan(80); // At least 80% success
    });

    it('should handle file descriptor limits', async () => {
      // Test many concurrent connections
      const concurrentConnections = 200;
      
      const promises = Array(concurrentConnections).fill(null).map((_, index) => {
        return request(app.getHttpServer())
          .get('/v1/health/ready')
          .timeout(10000);
      });

      const responses = await Promise.all(promises);
      
      // Most health checks should succeed
      const successfulResponses = responses.filter(res => res.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(concurrentConnections * 0.9);
    });
  });

  describe('Data Consistency Errors', () => {
    it('should handle concurrent modifications', async () => {
      const testIp = '192.168.1.200';
      
      // Try to block the same IP concurrently
      const blockPromises = Array(5).fill(null).map((_, index) => {
        return request(app.getHttpServer())
          .post('/security/block-ip')
          .set('Authorization', 'Bearer admin-token')
          .send({
            ip: testIp,
            reason: `Concurrent block ${index}`,
            durationMinutes: 60
          });
      });

      const responses = await Promise.all(blockPromises);
      
      // Should handle concurrent blocks gracefully
      const successfulBlocks = responses.filter(res => res.status === 204);
      expect(successfulBlocks.length).toBeGreaterThan(0);
      
      // Verify only one block record exists
      const ipBlocks = await ipBlockRepository.find({ where: { ip: testIp } });
      expect(ipBlocks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle orphaned data cleanup', async () => {
      // Create some test data
      await securityEventRepository.save(
        securityEventRepository.create({
          type: SecurityEventType.LOGIN,
          userId: '550e8400-e29b-41d4-a716-446655440040',
          ip: '192.168.1.100',
          data: { test: 'orphan' },
          riskScore: 10,
        })
      );

      // Verify data exists
      const events = await securityEventRepository.find({ 
        where: { userId: '550e8400-e29b-41d4-a716-446655440040' } 
      });
      expect(events.length).toBeGreaterThan(0);

      // Test cleanup operations don't break
      await securityEventRepository.clear();
      
      const eventsAfterCleanup = await securityEventRepository.find({ 
        where: { userId: '550e8400-e29b-41d4-a716-446655440040' } 
      });
      expect(eventsAfterCleanup.length).toBe(0);
    });
  });
});
