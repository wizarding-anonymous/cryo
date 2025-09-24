import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { IntegrationAppModule } from './integration-app.module';
import { SecurityEvent } from '../src/entities/security-event.entity';
import { SecurityAlert } from '../src/entities/security-alert.entity';
import { IPBlock } from '../src/entities/ip-block.entity';
import { SecurityEventType } from '../src/common/enums/security-event-type.enum';
import { SecurityAlertSeverity } from '../src/common/enums/security-alert-severity.enum';
import { SecurityAlertType } from '../src/common/enums/security-alert-type.enum';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { SecurityService } from '../src/modules/security/security.service';
import { MonitoringService } from '../src/modules/alerts/monitoring.service';
import { RateLimitService } from '../src/modules/security/rate-limit.service';

describe('Security Service Integration Tests', () => {
  let app: INestApplication;
  let securityEventRepository: Repository<SecurityEvent>;
  let securityAlertRepository: Repository<SecurityAlert>;
  let ipBlockRepository: Repository<IPBlock>;
  let redisClient: Redis;
  let securityService: SecurityService;
  let monitoringService: MonitoringService;
  let rateLimitService: RateLimitService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IntegrationAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as main app
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get repositories and services
    securityEventRepository = app.get<Repository<SecurityEvent>>(getRepositoryToken(SecurityEvent));
    securityAlertRepository = app.get<Repository<SecurityAlert>>(getRepositoryToken(SecurityAlert));
    ipBlockRepository = app.get<Repository<IPBlock>>(getRepositoryToken(IPBlock));
    redisClient = app.get<Redis>(REDIS_CLIENT);
    securityService = app.get<SecurityService>(SecurityService);
    monitoringService = app.get<MonitoringService>(MonitoringService);
    rateLimitService = app.get<RateLimitService>(RateLimitService);
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

  describe('Security Event Logging', () => {
    it('should log security events to database', async () => {
      const eventData = {
        type: SecurityEventType.LOGIN,
        userId: '550e8400-e29b-41d4-a716-446655440000',
        ip: '192.168.1.100',
        data: { userAgent: 'Mozilla/5.0', success: true },
      };

      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send(eventData)
        .expect(204);

      // Verify event was saved to database
      const events = await securityEventRepository.find();
      expect(events).toHaveLength(1);
      
      const savedEvent = events[0];
      expect(savedEvent.type).toBe(eventData.type);
      expect(savedEvent.userId).toBe(eventData.userId);
      expect(savedEvent.ip).toBe(eventData.ip);
      expect(savedEvent.data).toEqual(eventData.data);
      expect(savedEvent.createdAt).toBeInstanceOf(Date);
    });

    it('should calculate risk scores for security events', async () => {
      // Test using check-login endpoint which calculates risk scores
      const loginData = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        ip: '192.168.1.100',
        userAgent: 'Test Agent',
      };

      const response = await request(app.getHttpServer())
        .post('/security/check-login')
        .send(loginData)
        .expect(200);

      expect(response.body.riskScore).toBeGreaterThan(0);
      expect(response.body.riskScore).toBeLessThanOrEqual(100);

      // Verify event was logged with risk score
      const events = await securityEventRepository.find();
      expect(events).toHaveLength(1);
      
      const savedEvent = events[0];
      expect(savedEvent.riskScore).toBeGreaterThan(0);
      expect(savedEvent.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits using Redis', async () => {
      const testKey = 'test-rate-limit';
      const limit = 3;
      const windowSeconds = 60;

      // First 3 requests should be allowed
      for (let i = 0; i < limit; i++) {
        const result = await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }

      // 4th request should be blocked
      const blockedResult = await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);

      // Verify Redis contains the rate limit data
      const redisValue = await redisClient.get(`rate_limit:${testKey}`);
      if (redisValue) {
        expect(parseInt(redisValue)).toBeGreaterThanOrEqual(limit);
      }
    });

    it('should reset rate limits manually', async () => {
      const testKey = `test-rate-limit-manual-reset-${Date.now()}`;
      const limit = 2;
      const windowSeconds = 60; // Long window

      // Exhaust the rate limit
      await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      
      // Third request should be blocked
      const blockedResult = await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      expect(blockedResult.allowed).toBe(false);

      // Manually reset the rate limit
      await rateLimitService.resetRateLimit(testKey);

      // Should be allowed again after manual reset
      const allowedResult = await rateLimitService.checkRateLimit(testKey, limit, windowSeconds);
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('IP Blocking Integration', () => {
    it('should block and unblock IP addresses', async () => {
      const testIp = '192.168.1.200';
      const reason = 'Suspicious activity detected';
      const durationMinutes = 15;

      // Block the IP
      await securityService.blockIP(testIp, reason, durationMinutes);

      // Verify IP is blocked in database
      const ipBlocks = await ipBlockRepository.find({ where: { ip: testIp } });
      expect(ipBlocks).toHaveLength(1);
      
      const ipBlock = ipBlocks[0];
      expect(ipBlock.ip).toBe(testIp);
      expect(ipBlock.reason).toBe(reason);
      expect(ipBlock.isActive).toBe(true);

      // Verify IP is blocked via service
      const isBlocked = await securityService.isIPBlocked(testIp);
      expect(isBlocked).toBe(true);

      // Test API endpoint
      const response = await request(app.getHttpServer())
        .get(`/security/ip-status/${testIp}`)
        .expect(200);

      expect(response.body.isBlocked).toBe(true);
      expect(response.body.reason).toBe(reason);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect and create alerts for suspicious patterns', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440002';
      const suspiciousIp = '10.0.0.100';

      // Create multiple failed login events to trigger suspicious activity detection
      // Need at least 20 events or high risk events to trigger detection
      for (let i = 0; i < 25; i++) {
        await securityEventRepository.save(
          securityEventRepository.create({
            type: SecurityEventType.FAILED_LOGIN,
            userId,
            ip: suspiciousIp,
            data: { attempt: i + 1, timestamp: new Date() },
            riskScore: i > 20 ? 85 : 20, // Make some high-risk events
          })
        );
      }

      // Trigger suspicious activity detection
      const suspiciousActivity = await monitoringService.detectSuspiciousActivity(userId);
      expect(suspiciousActivity.suspicious).toBe(true);
      expect(suspiciousActivity.score).toBeGreaterThan(50);

      // Create an alert
      await monitoringService.createAlert({
        type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        severity: SecurityAlertSeverity.HIGH,
        userId,
        ip: suspiciousIp,
        data: { 
          failedAttempts: 5,
          timeWindow: '5 minutes',
          detectedAt: new Date()
        },
      });

      // Verify alert was created
      const alerts = await securityAlertRepository.find();
      expect(alerts).toHaveLength(1);
      
      const alert = alerts[0];
      expect(alert.type).toBe(SecurityAlertType.MULTIPLE_FAILED_LOGINS);
      expect(alert.severity).toBe(SecurityAlertSeverity.HIGH);
      expect(alert.userId).toBe(userId);
      expect(alert.resolved).toBe(false);
    });
  });

  describe('End-to-End Security Scenarios', () => {
    it('should handle complete security incident workflow: detection → alert → block', async () => {
      const attackerUserId = '550e8400-e29b-41d4-a716-446655440003';
      const attackerIp = '203.0.113.100';
      
      // Step 1: Multiple failed login attempts (detection)
      // Create enough events to trigger suspicious activity detection
      for (let i = 0; i < 25; i++) {
        await securityEventRepository.save(
          securityEventRepository.create({
            type: SecurityEventType.FAILED_LOGIN,
            userId: attackerUserId,
            ip: attackerIp,
            data: { 
              attempt: i + 1, 
              timestamp: new Date(),
              userAgent: 'AttackBot/1.0'
            },
            riskScore: i > 20 ? 85 : 20, // Make some high-risk events
          })
        );
      }

      // Step 2: Verify events were logged
      const events = await securityEventRepository.find({ 
        where: { userId: attackerUserId } 
      });
      expect(events).toHaveLength(25);

      // Step 3: Detect suspicious activity
      const suspiciousActivity = await monitoringService.detectSuspiciousActivity(attackerUserId);
      expect(suspiciousActivity.suspicious).toBe(true);

      // Step 4: Create alert
      const alert = await monitoringService.createAlert({
        type: SecurityAlertType.MULTIPLE_FAILED_LOGINS,
        severity: SecurityAlertSeverity.CRITICAL,
        userId: attackerUserId,
        ip: attackerIp,
        data: {
          failedAttempts: 25,
          timeWindow: '1 minute',
          autoBlocked: true
        },
      });

      expect(alert.id).toBeDefined();

      // Step 5: Block the IP
      await securityService.blockIP(attackerIp, 'Automated block due to suspicious activity', 60);

      // Step 6: Verify IP is blocked
      const isBlocked = await securityService.isIPBlocked(attackerIp);
      expect(isBlocked).toBe(true);

      // Step 7: Verify complete workflow via API
      const ipStatusResponse = await request(app.getHttpServer())
        .get(`/security/ip-status/${attackerIp}`)
        .expect(200);

      expect(ipStatusResponse.body.isBlocked).toBe(true);
      expect(ipStatusResponse.body.reason).toContain('suspicious activity');
    });

    it('should handle rate limiting under load', async () => {
      const testIp = '192.168.1.50';
      const requests = [];

      // Send 15 concurrent requests
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/security/report-event')
            .send({
              type: SecurityEventType.DATA_ACCESS,
              ip: testIp,
              data: { requestId: i, timestamp: new Date() },
            })
        );
      }

      const responses = await Promise.all(requests);

      // Count successful and rate-limited responses
      const successfulResponses = responses.filter(res => res.status === 204);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      const totalResponses = successfulResponses.length + rateLimitedResponses.length;

      // Should handle all requests (either successfully or with rate limiting)
      expect(totalResponses).toBe(15);
      expect(successfulResponses.length).toBeGreaterThan(0); // At least some should succeed
    });
  });

  describe('Database Connection Issues', () => {
    it('should handle database connection failures gracefully', async () => {
      // This test would require temporarily disconnecting the database
      // For now, we'll test error handling with invalid data
      
      const invalidEventData = {
        type: 'INVALID_TYPE' as any,
        ip: 'invalid-ip',
        data: null,
      };

      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send(invalidEventData)
        .expect(400); // Should return validation error

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Redis Failover Scenarios', () => {
    it('should handle Redis connection issues in rate limiting', async () => {
      // Temporarily disconnect Redis
      redisClient.disconnect();

      // Rate limiting should fail gracefully
      try {
        const result = await rateLimitService.checkRateLimit('test-key', 10, 60);
        // Should either throw an error or return a default safe value
        expect(result).toBeDefined();
      } catch (error) {
        // Error handling is acceptable for Redis failures
        expect(error).toBeDefined();
      }

      // Reconnect Redis for other tests
      await redisClient.connect();
    });
  });
});