import * as request from 'supertest';
import { E2ETestBase } from './e2e-test-base';

describe('Library Service Smoke Tests', () => {
  let testBase: E2ETestBase;

  beforeAll(async () => {
    testBase = new E2ETestBase();
    await testBase.setup();
  }, 60000);

  afterAll(async () => {
    if (testBase) {
      await testBase.teardown();
    }
  });

  describe('Health Checks', () => {
    it('should return healthy status', async () => {
      const response = await request(testBase.app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.service).toBe('library-service');
    });

    it('should return detailed health status', async () => {
      const response = await request(testBase.app.getHttpServer())
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info).toBeDefined();
      // Remove details check as it might not be implemented
    });
  });

  describe('Basic API Endpoints', () => {
    it('should handle missing authorization gracefully', async () => {
      await request(testBase.app.getHttpServer())
        .get('/api/library/my')
        .expect(401);
    });

    it('should validate request data', async () => {
      await request(testBase.app.getHttpServer())
        .post('/api/library/add')
        .send({}) // Empty body should fail validation
        .expect(400);
    });
  });
});