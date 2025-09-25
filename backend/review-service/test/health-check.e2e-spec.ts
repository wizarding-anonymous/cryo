import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('Health Check Endpoints (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Basic Health Checks', () => {
    it('/ (GET) should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('/health (GET) should return health status with timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('/health (GET) should return consistent format', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response1.body.status).toBe(response2.body.status);
      expect(typeof response1.body.timestamp).toBe('string');
      expect(typeof response2.body.timestamp).toBe('string');
    });
  });

  describe('Health Check Performance', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Health check should respond within 100ms
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent health checks', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('timestamp');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);
    });

    it('should handle malformed requests gracefully', () => {
      return request(app.getHttpServer())
        .post('/health') // POST to GET endpoint
        .expect(404);
    });
  });
});