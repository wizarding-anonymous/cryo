import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Deployment E2E Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/api/health (GET) - should return basic health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('service', 'security-service');
          expect(res.body).toHaveProperty('version');
        });
    });

    it('/api/health/live (GET) - should return liveness probe status', () => {
      return request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('check', 'live');
          expect(res.body).toHaveProperty('uptime');
        });
    });

    it('/api/health/ready (GET) - should return readiness probe status', () => {
      return request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('check', 'ready');
          expect(res.body).toHaveProperty('dependencies');
          expect(res.body.dependencies).toHaveProperty('database');
          expect(res.body.dependencies).toHaveProperty('redis');
        });
    });
  });

  describe('API Documentation', () => {
    it('/api/docs (GET) - should serve Swagger documentation', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/);
    });

    it('/api/docs-json (GET) - should serve OpenAPI JSON', () => {
      return request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect((res) => {
          expect(res.body).toHaveProperty('openapi');
          expect(res.body).toHaveProperty('info');
          expect(res.body.info).toHaveProperty('title', 'Security Service API');
        });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          // Check for Helmet security headers
          expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
          expect(res.headers).toHaveProperty('x-frame-options', 'DENY');
          expect(res.headers).toHaveProperty('x-xss-protection', '0');
        });
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', () => {
      return request(app.getHttpServer())
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204)
        .expect((res) => {
          expect(res.headers).toHaveProperty('access-control-allow-origin');
          expect(res.headers).toHaveProperty('access-control-allow-methods');
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', () => {
      return request(app.getHttpServer())
        .get('/api/nonexistent-endpoint')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should handle validation errors', () => {
      return request(app.getHttpServer())
        .post('/api/v1/security/check-login')
        .send({
          // Missing required fields
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('Performance', () => {
    it('health check should respond quickly', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should respond in less than 100ms
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/health')
          .expect(200)
      );

      const results = await Promise.all(requests);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.body).toHaveProperty('status', 'ok');
      });
    });
  });

  describe('Environment Configuration', () => {
    it('should use correct environment settings', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          // In test environment, NODE_ENV should be 'test'
          expect(process.env.NODE_ENV).toBe('test');
        });
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle shutdown signals gracefully', async () => {
      // This test verifies that the app can be closed without errors
      const closePromise = app.close();
      await expect(closePromise).resolves.toBeUndefined();
    });
  });

  describe('Metrics Endpoint', () => {
    it('/api/metrics (GET) - should serve Prometheus metrics', () => {
      return request(app.getHttpServer())
        .get('/api/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/)
        .expect((res) => {
          // Should contain basic Node.js metrics
          expect(res.text).toContain('nodejs_');
          expect(res.text).toContain('http_');
        });
    });
  });
});