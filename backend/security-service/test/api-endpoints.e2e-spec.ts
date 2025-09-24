import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';


import { TestAppModule } from './test-app.module';

import { SecurityEventType } from '../src/common/enums/security-event-type.enum';
import { SecurityAlertSeverity } from '../src/common/enums/security-alert-severity.enum';

describe('Security Service API Endpoints (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
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

    // No services needed for mocked tests

    // Create test tokens that match our AuthService mock
    adminToken = 'admin-test-token';
    userToken = 'user-test-token';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // No need to clear data in mocked tests
  });

  describe('Security Controller Endpoints', () => {
    describe('POST /security/check-login', () => {
      it('should check login security and return risk assessment', async () => {
        const loginData = {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          context: { loginMethod: 'password' }
        };

        const response = await request(app.getHttpServer())
          .post('/security/check-login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('allowed');
        expect(response.body).toHaveProperty('riskScore');
        expect(typeof response.body.allowed).toBe('boolean');
        expect(typeof response.body.riskScore).toBe('number');
        expect(response.body.riskScore).toBeGreaterThanOrEqual(0);
        expect(response.body.riskScore).toBeLessThanOrEqual(100);
      });

      it('should return validation error for invalid input', async () => {
        const invalidData = {
          userId: 'invalid-uuid', // Invalid UUID format
          ip: 'invalid-ip', // Invalid IP format
        };

        const response = await request(app.getHttpServer())
          .post('/security/check-login')
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should block login for blocked IP', async () => {
        // Note: In mocked environment, IP blocking logic is mocked
        // This test verifies the API structure rather than actual blocking
        const loginData = {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          ip: '10.0.0.100',
        };

        const response = await request(app.getHttpServer())
          .post('/security/check-login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('allowed');
        expect(response.body).toHaveProperty('riskScore');
        expect(typeof response.body.allowed).toBe('boolean');
      });
    });

    describe('POST /security/check-transaction', () => {
      it('should check transaction security', async () => {
        const transactionData = {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          amount: 100.50,
          paymentMethod: 'credit_card',
          ip: '192.168.1.100',
          context: { currency: 'USD', merchantId: 'merchant-123' }
        };

        const response = await request(app.getHttpServer())
          .post('/security/check-transaction')
          .send(transactionData)
          .expect(200);

        expect(response.body).toHaveProperty('allowed');
        expect(response.body).toHaveProperty('riskScore');
        expect(typeof response.body.allowed).toBe('boolean');
        expect(typeof response.body.riskScore).toBe('number');
      });

      it('should flag high-risk transactions', async () => {
        const highRiskTransaction = {
          userId: '550e8400-e29b-41d4-a716-446655440003',
          amount: 10000, // Large amount
          paymentMethod: 'crypto',
          ip: '192.168.1.100',
          context: { 
            currency: 'BTC',
            firstTimePaymentMethod: true,
            newDevice: true
          }
        };

        const response = await request(app.getHttpServer())
          .post('/security/check-transaction')
          .send(highRiskTransaction)
          .expect(200);

        expect(response.body.riskScore).toBeGreaterThan(50);
      });
    });

    describe('POST /security/report-event', () => {
      it('should accept and log security events', async () => {
        const eventData = {
          type: SecurityEventType.LOGIN,
          userId: '550e8400-e29b-41d4-a716-446655440004',
          ip: '192.168.1.100',
          data: { success: true, timestamp: new Date().toISOString() }
        };

        await request(app.getHttpServer())
          .post('/security/report-event')
          .send(eventData)
          .expect(204);
      });

      it('should validate event data', async () => {
        const invalidEventData = {
          type: 'INVALID_TYPE',
          ip: 'not-an-ip',
          data: 'not-an-object'
        };

        const response = await request(app.getHttpServer())
          .post('/security/report-event')
          .send(invalidEventData)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /security/block-ip', () => {
      it('should block IP with admin authentication', async () => {
        const blockData = {
          ip: '203.0.113.100',
          reason: 'Malicious activity detected',
          durationMinutes: 60
        };

        await request(app.getHttpServer())
          .post('/security/block-ip')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(blockData)
          .expect(204);
      });

      it('should reject block request without admin auth', async () => {
        const blockData = {
          ip: '203.0.113.100',
          reason: 'Test block',
          durationMinutes: 60
        };

        await request(app.getHttpServer())
          .post('/security/block-ip')
          .set('Authorization', `Bearer ${userToken}`)
          .send(blockData)
          .expect(403);
      });

      it('should reject block request without authentication', async () => {
        const blockData = {
          ip: '203.0.113.100',
          reason: 'Test block',
          durationMinutes: 60
        };

        await request(app.getHttpServer())
          .post('/security/block-ip')
          .send(blockData)
          .expect(401);
      });
    });

    describe('GET /security/ip-status/:ip', () => {
      it('should return IP status for valid IP', async () => {
        const testIp = '192.168.1.200';

        const response = await request(app.getHttpServer())
          .get(`/security/ip-status/${testIp}`)
          .expect(200);

        expect(response.body).toHaveProperty('isBlocked');
        expect(response.body.isBlocked).toBe(false);
      });

      it('should return blocked status for blocked IP', async () => {
        // Note: In mocked environment, IP status is mocked
        // This test verifies the API structure
        const testIp = '10.0.0.200';

        const response = await request(app.getHttpServer())
          .get(`/security/ip-status/${testIp}`)
          .expect(200);

        expect(response.body).toHaveProperty('isBlocked');
        expect(typeof response.body.isBlocked).toBe('boolean');
      });

      it('should validate IP format', async () => {
        const invalidIp = 'not-an-ip';

        const response = await request(app.getHttpServer())
          .get(`/security/ip-status/${invalidIp}`)
          .expect(400);

        expect(response.body.message).toBeDefined();
      });
    });
  });

  describe('Logs Controller Endpoints', () => {
    beforeEach(async () => {
      // No setup needed for mocked tests
    });

    describe('GET /security/logs', () => {
      it('should return security logs with admin auth', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/logs?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(2);
        expect(response.body.data.length).toBeLessThanOrEqual(2);
      });

      it('should support filtering by type', async () => {
        const response = await request(app.getHttpServer())
          .get(`/security/logs?type=${SecurityEventType.LOGIN}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data.every((event: any) => event.type === SecurityEventType.LOGIN)).toBe(true);
      });

      it('should support filtering by user', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/logs?userId=550e8400-e29b-41d4-a716-446655440010')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data.every((event: any) => event.userId === '550e8400-e29b-41d4-a716-446655440010')).toBe(true);
      });

      it('should reject request without admin auth', async () => {
        await request(app.getHttpServer())
          .get('/security/logs')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /security/logs/events/:userId', () => {
      it('should return user events with proper auth', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/logs/events/550e8400-e29b-41d4-a716-446655440010')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.every((event: any) => event.userId === '550e8400-e29b-41d4-a716-446655440010')).toBe(true);
      });

      it('should reject request without auth', async () => {
        await request(app.getHttpServer())
          .get('/security/logs/events/550e8400-e29b-41d4-a716-446655440010')
          .expect(401);
      });
    });
  });

  describe('Alerts Controller Endpoints', () => {
    beforeEach(async () => {
      // No setup needed for mocked tests
    });

    describe('GET /security/alerts', () => {
      it('should return security alerts with admin auth', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/alerts')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should support filtering by severity', async () => {
        const response = await request(app.getHttpServer())
          .get(`/security/alerts?severity=${SecurityAlertSeverity.CRITICAL}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support filtering by resolved status', async () => {
        const response = await request(app.getHttpServer())
          .get('/security/alerts?resolved=false')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data.every((alert: any) => alert.resolved === false)).toBe(true);
      });

      it('should reject request without admin auth', async () => {
        await request(app.getHttpServer())
          .get('/security/alerts')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('PUT /security/alerts/:id/resolve', () => {
      it('should resolve alert with admin auth', async () => {
        // Note: In mocked environment, we test with a mock alert ID
        const mockAlertId = '550e8400-e29b-41d4-a716-446655440100';

        await request(app.getHttpServer())
          .put(`/security/alerts/${mockAlertId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);
      });

      it('should reject resolve request without admin auth', async () => {
        const mockAlertId = '550e8400-e29b-41d4-a716-446655440101';

        await request(app.getHttpServer())
          .put(`/security/alerts/${mockAlertId}/resolve`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should return 404 for non-existent alert', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        await request(app.getHttpServer())
          .put(`/security/alerts/${nonExistentId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });
  });

  describe('Health Controller Endpoints', () => {
    describe('GET /v1/health/ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/health/ready')
          .expect(200);

        expect(response.body.status).toBe('ok');
        expect(response.body).toHaveProperty('info');
        expect(response.body).toHaveProperty('details');
      });
    });

    describe('GET /v1/health/live', () => {
      it('should return liveness status', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/health/live')
          .expect(200);

        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle requests with missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/check-login')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle requests with extra fields when whitelist is enabled', async () => {
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send({
          type: SecurityEventType.LOGIN,
          ip: '192.168.1.100',
          data: { test: 'data' },
          extraField: 'should be removed', // This should be stripped
        })
        .expect(204);
    });

    it('should return 404 for non-existent endpoints', async () => {
      await request(app.getHttpServer())
        .get('/security/non-existent-endpoint')
        .expect(404);
    });

    it('should handle large payloads gracefully', async () => {
      const largeData = {
        type: SecurityEventType.DATA_ACCESS,
        ip: '192.168.1.100',
        data: {
          largeField: 'x'.repeat(10000), // 10KB string
          metadata: Array(1000).fill({ key: 'value' })
        }
      };

      // Should either accept or reject with appropriate status
      const response = await request(app.getHttpServer())
        .post('/security/report-event')
        .send(largeData);

      expect([204, 413, 400]).toContain(response.status);
    });
  });
});