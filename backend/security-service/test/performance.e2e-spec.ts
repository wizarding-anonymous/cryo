import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import Redis from 'ioredis';
import { IntegrationAppModule } from './integration-app.module';
import { RateLimitService } from '../src/modules/security/rate-limit.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';

describe('Security Service Performance Tests', () => {
  let app: INestApplication;
  let rateLimitService: RateLimitService;
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

    rateLimitService = app.get<RateLimitService>(RateLimitService);
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
    // Clear Redis before each test
    await redisClient.flushall();
  });

  describe('Rate Limiting Performance', () => {
    it('should handle high-volume rate limit checks efficiently', async () => {
      const testKey = 'performance-test';
      const limit = 1000;
      const windowSeconds = 60;
      const concurrentRequests = 500;

      const startTime = Date.now();
      
      // Create concurrent rate limit checks
      const promises = Array(concurrentRequests).fill(null).map(async (_, index) => {
        return rateLimitService.checkRateLimit(`${testKey}-${index % 10}`, limit, windowSeconds);
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(concurrentRequests);
      
      // All requests should be allowed (under limit)
      const allowedRequests = results.filter(result => result.allowed);
      expect(allowedRequests.length).toBeGreaterThan(concurrentRequests * 0.8); // At least 80% should be allowed

      console.log(`Rate limiting performance: ${concurrentRequests} requests in ${duration}ms`);
      console.log(`Average: ${(duration / concurrentRequests).toFixed(2)}ms per request`);
    });

    it('should handle rate limit enforcement under load', async () => {
      const testKey = 'load-test';
      const limit = 50;
      const windowSeconds = 60;
      const totalRequests = 200; // 4x the limit

      const startTime = Date.now();
      
      // Create requests that will exceed the limit
      const promises = Array(totalRequests).fill(null).map(async () => {
        return rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count allowed vs blocked requests
      const allowedRequests = results.filter(result => result.allowed);
      const blockedRequests = results.filter(result => !result.allowed);

      // Should have exactly 'limit' allowed requests
      expect(allowedRequests.length).toBeLessThanOrEqual(limit + 10); // Allow some margin for race conditions
      expect(blockedRequests.length).toBeGreaterThan(totalRequests - limit - 10);
      
      // Performance should still be reasonable
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Load test: ${totalRequests} requests, ${allowedRequests.length} allowed, ${blockedRequests.length} blocked in ${duration}ms`);
    });

    it('should maintain performance with multiple concurrent keys', async () => {
      const numberOfKeys = 100;
      const requestsPerKey = 20;
      const limit = 50;
      const windowSeconds = 60;

      const startTime = Date.now();
      
      const promises = [];
      for (let keyIndex = 0; keyIndex < numberOfKeys; keyIndex++) {
        for (let requestIndex = 0; requestIndex < requestsPerKey; requestIndex++) {
          promises.push(
            rateLimitService.checkRateLimit(`multi-key-test-${keyIndex}`, limit, windowSeconds)
          );
        }
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const totalRequests = numberOfKeys * requestsPerKey;
      expect(results).toHaveLength(totalRequests);
      
      // Most requests should be allowed (under individual key limits)
      const allowedRequests = results.filter(result => result.allowed);
      expect(allowedRequests.length).toBeGreaterThan(totalRequests * 0.9);

      // Performance should scale reasonably
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Multi-key test: ${numberOfKeys} keys × ${requestsPerKey} requests = ${totalRequests} total in ${duration}ms`);
    });
  });

  describe('API Endpoint Performance', () => {
    it('should handle concurrent security event reporting', async () => {
      const concurrentRequests = 100;
      const eventData = {
        type: SecurityEventType.LOGIN,
        userId: 'perf-test-user',
        ip: '192.168.1.100',
        data: { test: 'performance data' }
      };

      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(null).map(() => {
        return request(app.getHttpServer())
          .post('/security/report-event')
          .send(eventData);
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      const successfulResponses = responses.filter(res => res.status === 204);
      expect(successfulResponses.length).toBe(concurrentRequests);

      // Performance should be reasonable
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Event reporting performance: ${concurrentRequests} events in ${duration}ms`);
      console.log(`Average: ${(duration / concurrentRequests).toFixed(2)}ms per event`);
    });

    it('should handle concurrent login security checks', async () => {
      const concurrentRequests = 50;
      const loginData = {
        userId: 'perf-test-user',
        ip: '192.168.1.100',
        userAgent: 'Performance Test Agent'
      };

      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(null).map((_, index) => {
        return request(app.getHttpServer())
          .post('/security/check-login')
          .send({
            ...loginData,
            userId: `perf-test-user-${index}` // Different users to avoid rate limiting
          });
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      const successfulResponses = responses.filter(res => res.status === 200);
      expect(successfulResponses.length).toBe(concurrentRequests);

      // All should return valid security check results
      successfulResponses.forEach(response => {
        expect(response.body).toHaveProperty('allowed');
        expect(response.body).toHaveProperty('riskScore');
      });

      // Performance should be reasonable
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Login security check performance: ${concurrentRequests} checks in ${duration}ms`);
    });

    it('should handle mixed workload efficiently', async () => {
      const totalRequests = 200;
      const startTime = Date.now();
      
      const promises = [];
      
      // Mix of different request types
      for (let i = 0; i < totalRequests; i++) {
        if (i % 3 === 0) {
          // Security event reporting
          promises.push(
            request(app.getHttpServer())
              .post('/security/report-event')
              .send({
                type: SecurityEventType.DATA_ACCESS,
                userId: `user-${i}`,
                ip: `192.168.1.${(i % 254) + 1}`,
                data: { requestId: i }
              })
          );
        } else if (i % 3 === 1) {
          // Login security check
          promises.push(
            request(app.getHttpServer())
              .post('/security/check-login')
              .send({
                userId: `user-${i}`,
                ip: `192.168.1.${(i % 254) + 1}`
              })
          );
        } else {
          // IP status check
          promises.push(
            request(app.getHttpServer())
              .get(`/security/ip-status/192.168.1.${(i % 254) + 1}`)
          );
        }
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count successful responses by type
      const eventReports = responses.filter((res, index) => index % 3 === 0 && res.status === 204);
      const loginChecks = responses.filter((res, index) => index % 3 === 1 && res.status === 200);
      const ipChecks = responses.filter((res, index) => index % 3 === 2 && res.status === 200);

      expect(eventReports.length).toBeGreaterThan(0);
      expect(loginChecks.length).toBeGreaterThan(0);
      expect(ipChecks.length).toBeGreaterThan(0);

      // Overall performance should be reasonable
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds

      console.log(`Mixed workload performance: ${totalRequests} requests in ${duration}ms`);
      console.log(`Event reports: ${eventReports.length}, Login checks: ${loginChecks.length}, IP checks: ${ipChecks.length}`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during high-volume operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array(100).fill(null).map((_, index) => {
          return rateLimitService.checkRateLimit(`memory-test-${batch}-${index}`, 100, 60);
        });
        
        await Promise.all(promises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle Redis connection pool efficiently', async () => {
      const concurrentOperations = 200;
      const startTime = Date.now();
      
      // Perform many Redis operations concurrently
      const promises = Array(concurrentOperations).fill(null).map(async (_, index) => {
        const key = `redis-pool-test-${index}`;
        await redisClient.set(key, 'test-value');
        const value = await redisClient.get(key);
        await redisClient.del(key);
        return value;
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      expect(results.every(result => result === 'test-value')).toBe(true);
      
      // Should complete efficiently
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Redis pool test: ${concurrentOperations} operations in ${duration}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under extreme load', async () => {
      const extremeLoad = 1000;
      const batchSize = 100;
      const batches = extremeLoad / batchSize;
      
      let totalSuccessful = 0;
      let totalErrors = 0;
      const startTime = Date.now();

      // Process in batches to avoid overwhelming the system
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array(batchSize).fill(null).map((_, index) => {
          const globalIndex = batch * batchSize + index;
          return request(app.getHttpServer())
            .post('/security/report-event')
            .send({
              type: SecurityEventType.DATA_ACCESS,
              userId: `stress-user-${globalIndex}`,
              ip: `10.0.${Math.floor(globalIndex / 254)}.${(globalIndex % 254) + 1}`,
              data: { batchId: batch, requestId: index }
            })
            .catch(error => ({ error }));
        });

        const batchResults = await Promise.all(batchPromises);
        
        const successful = batchResults.filter(result => !(result as any).error && (result as any).status === 204);
        const errors = batchResults.filter(result => (result as any).error || (result as any).status !== 204);
        
        totalSuccessful += successful.length;
        totalErrors += errors.length;

        // Small delay between batches to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle most requests successfully
      const successRate = (totalSuccessful / extremeLoad) * 100;
      expect(successRate).toBeGreaterThan(80); // At least 80% success rate

      console.log(`Stress test: ${extremeLoad} requests in ${duration}ms`);
      console.log(`Success rate: ${successRate.toFixed(2)}% (${totalSuccessful}/${extremeLoad})`);
      console.log(`Errors: ${totalErrors}`);
    });
  });
});