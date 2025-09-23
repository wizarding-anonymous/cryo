import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import {
  TestApiClient,
  extractHealthResponse,
  expectValidHealthResponse,
} from './utils/test-helpers';
import { TestHealthResponse } from './types/test-interfaces';

describe('Health Endpoints (e2e)', () => {
  let app: INestApplication;
  let apiClient: TestApiClient;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    dataSource = moduleFixture.get<DataSource>(DataSource);
    apiClient = new TestApiClient(app);

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
      const response = await apiClient.getHealth();
      expect(response.status).toBe(200);

      const health: TestHealthResponse = extractHealthResponse(response);
      expectValidHealthResponse(health);

      // Check that all health indicators are present
      expect(health.details).toHaveProperty('database');
      expect(health.details).toHaveProperty('memory_heap');
      expect(health.details).toHaveProperty('memory_rss');
      expect(health.details).toHaveProperty('redis');
      expect(health.details).toHaveProperty('application');

      // Verify database health
      const databaseHealth = health.details.database as Record<string, unknown>;
      expect(databaseHealth).toHaveProperty('status');

      // Verify memory health
      const memoryHeapHealth = health.details.memory_heap as Record<
        string,
        unknown
      >;
      const memoryRssHealth = health.details.memory_rss as Record<
        string,
        unknown
      >;
      expect(memoryHeapHealth).toHaveProperty('status');
      expect(memoryRssHealth).toHaveProperty('status');

      // Verify cache health (should work with fallback)
      const redisHealth = health.details.redis as Record<string, unknown>;
      expect(redisHealth).toHaveProperty('status');

      // Verify application health
      const appHealth = health.details.application as Record<string, unknown>;
      expect(appHealth).toHaveProperty('status');
      expect(appHealth).toHaveProperty('uptime');
      expect(appHealth).toHaveProperty('memory');
      expect(appHealth).toHaveProperty('nodeVersion');
      expect(appHealth).toHaveProperty('environment');
    });
  });

  describe('/api/v1/health/ready (GET)', () => {
    it('should return readiness status', async () => {
      const response = await apiClient.getHealthReady();
      expect(response.status).toBe(200);

      const health: TestHealthResponse = extractHealthResponse(response);
      expectValidHealthResponse(health);
      expect(health.details).toHaveProperty('database');
      expect(health.details).toHaveProperty('redis');
    });
  });

  describe('/api/v1/health/live (GET)', () => {
    it('should return liveness status', async () => {
      const response = await apiClient.getHealthLive();
      expect(response.status).toBe(200);

      const health: TestHealthResponse = extractHealthResponse(response);
      expectValidHealthResponse(health);

      // Liveness should check memory and application
      expect(health.details).toHaveProperty('memory_heap');
      expect(health.details).toHaveProperty('application');
    });
  });
});
