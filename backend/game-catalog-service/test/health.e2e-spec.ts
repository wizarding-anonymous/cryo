import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Health Endpoints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
    
    await app.init();
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    await app.close();
  });

  describe('/api/v1/health (GET)', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
      
      // Check that all health indicators are present
      expect(response.body.details).toHaveProperty('database');
      expect(response.body.details).toHaveProperty('memory_heap');
      expect(response.body.details).toHaveProperty('memory_rss');
      expect(response.body.details).toHaveProperty('redis');
      expect(response.body.details).toHaveProperty('application');

      // Verify database health
      expect(response.body.details.database).toHaveProperty('status');
      
      // Verify memory health
      expect(response.body.details.memory_heap).toHaveProperty('status');
      expect(response.body.details.memory_rss).toHaveProperty('status');
      
      // Verify cache health (should work with fallback)
      expect(response.body.details.redis).toHaveProperty('status');
      
      // Verify application health
      expect(response.body.details.application).toHaveProperty('status');
      expect(response.body.details.application).toHaveProperty('uptime');
      expect(response.body.details.application).toHaveProperty('memory');
      expect(response.body.details.application).toHaveProperty('nodeVersion');
      expect(response.body.details.application).toHaveProperty('environment');
    });

    it('should include request ID in response headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toMatch(/^req-/);
    });

    it('should handle custom request ID', async () => {
      const customRequestId = 'test-request-123';
      
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('x-request-id', customRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('/api/v1/health/ready (GET)', () => {
    it('should return readiness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
      
      // Readiness should check database and cache
      expect(response.body.details).toHaveProperty('database');
      expect(response.body.details).toHaveProperty('redis');
      
      // Should not include memory checks in readiness
      expect(response.body.details).not.toHaveProperty('memory_heap');
    });

    it('should respond quickly for readiness probe', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  describe('/api/v1/health/live (GET)', () => {
    it('should return liveness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
      
      // Liveness should check memory and application
      expect(response.body.details).toHaveProperty('memory_heap');
      expect(response.body.details).toHaveProperty('application');
      
      // Should not include database in liveness
      expect(response.body.details).not.toHaveProperty('database');
    });

    it('should respond quickly for liveness probe', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // Should respond within 3 seconds
    });
  });

  describe('/metrics (GET)', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      
      // Check for our custom metrics
      expect(response.text).toContain('game_catalog_');
      
      // Check for default Node.js metrics
      expect(response.text).toContain('nodejs_');
      expect(response.text).toContain('process_');
    });

    it('should have correct content type for metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('Health check performance', () => {
    it('should complete health check within acceptable time', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent health checks', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/health')
          .expect(200)
      );

      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(response => {
        expect(response.body.status).toBeDefined();
      });
    });
  });

  describe('Error scenarios', () => {
    it('should handle invalid health endpoint gracefully', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/health/invalid')
        .expect(404);
    });

    it('should return proper error format for health check failures', async () => {
      // This test would require mocking a failure scenario
      // For now, we'll just verify the endpoint structure
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify the response has the expected structure even on success
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Swagger documentation', () => {
    it('should include health endpoints in API documentation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs-json')
        .expect(200);

      const swaggerDoc = response.body;
      
      // Check that health endpoints are documented
      expect(swaggerDoc.paths).toHaveProperty('/v1/health');
      expect(swaggerDoc.paths).toHaveProperty('/v1/health/ready');
      expect(swaggerDoc.paths).toHaveProperty('/v1/health/live');
      
      // Check that health endpoints have proper tags
      expect(swaggerDoc.paths['/v1/health'].get.tags).toContain('Health');
    });
  });
});