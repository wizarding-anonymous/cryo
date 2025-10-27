import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';

describe('Batch Performance Tests (e2e) - Simplified', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    const loggingService = app.get(LoggingService);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
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
    await app.close();
  });

  describe('Batch Creation Performance (Simplified)', () => {
    it('should handle batch creation of 1,000 users efficiently', async () => {
      const batchSize = 1000;
      const chunkSize = 100;
      
      console.log(`\n🚀 Starting simplified batch creation of ${batchSize} users...`);
      
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Perf Test User ${i}`,
        email: `perf-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchUsers,
          options: { chunkSize }
        })
        .expect(201);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Batch creation completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Throughput: ${Math.round((batchSize / duration) * 1000)} users/second`);

      expect(response.body.data.stats.successful).toBe(batchSize);
      expect(response.body.data.stats.failed).toBe(0);
      
      // Performance requirements (relaxed for mocked environment)
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Calculate throughput (relaxed expectations for mocked environment)
      const usersPerSecond = (batchSize / duration) * 1000;
      expect(usersPerSecond).toBeGreaterThan(50); // At least 50 users per second
    }, 15000);

    it('should handle batch creation of 2,500 users with optimal chunking', async () => {
      const batchSize = 2500;
      const chunkSize = 250;
      
      console.log(`\n🚀 Starting large batch creation of ${batchSize} users...`);
      
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Large Batch User ${i}`,
        email: `large-batch-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchUsers,
          options: { chunkSize }
        })
        .expect(201);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Large batch creation completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Throughput: ${Math.round((batchSize / duration) * 1000)} users/second`);

      expect(response.body.data.stats.successful).toBe(batchSize);
      expect(response.body.data.stats.failed).toBe(0);
      
      // Performance requirements (relaxed for mocked environment)
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      
      // Calculate throughput
      const usersPerSecond = (batchSize / duration) * 1000;
      expect(usersPerSecond).toBeGreaterThan(50); // At least 50 users per second
    }, 25000);
  });

  describe('Batch Lookup Performance (Simplified)', () => {
    let testUserIds: string[];

    beforeAll(async () => {
      // Create test users for lookup tests
      const testUsers = Array.from({ length: 500 }, (_, i) => ({
        name: `Lookup Test User ${i}`,
        email: `lookup-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: testUsers,
          options: { chunkSize: 100 }
        })
        .expect(201);

      testUserIds = response.body.data.data.map((user: any) => user.id);
      console.log(`📝 Created ${testUserIds.length} test users for lookup tests`);
    });

    it('should handle batch lookup of 500 users efficiently', async () => {
      console.log(`\n🔍 Starting batch lookup of ${testUserIds.length} users...`);

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/lookup')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          ids: testUserIds,
          options: { chunkSize: 100 }
        })
        .expect(200);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Batch lookup completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Lookup throughput: ${Math.round((testUserIds.length / duration) * 1000)} lookups/second`);

      expect(response.body.stats.found).toBe(testUserIds.length);
      expect(response.body.stats.missing).toBe(0);
      expect(response.body.data).toHaveLength(testUserIds.length);
      
      // Performance requirements (relaxed for mocked environment)
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Calculate lookup throughput
      const lookupsPerSecond = (testUserIds.length / duration) * 1000;
      expect(lookupsPerSecond).toBeGreaterThan(50); // At least 50 lookups per second
    });
  });

  describe('API Limits Validation', () => {
    it('should reject batch creation exceeding 5,000 users', async () => {
      console.log('\n🚫 Testing batch size limit enforcement...');

      const oversizedBatch = Array.from({ length: 5001 }, (_, i) => ({
        name: `Oversized User ${i}`,
        email: `oversized-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: oversizedBatch,
          options: { chunkSize: 100 }
        })
        .expect(201); // Still returns 201 but with error message

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Batch size too large');
      expect(response.body.message).toContain('Maximum 5000 users per batch');
      
      console.log('✅ Batch size limit properly enforced');
    });

    it('should reject GET lookup with more than 100 IDs', async () => {
      console.log('\n🚫 Testing GET lookup limit enforcement...');

      const manyIds = Array.from({ length: 101 }, () => 'test-id').join(',');

      const response = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${manyIds}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Too many IDs for GET request');
      expect(response.body.message).toContain('max 100 IDs for GET');
      
      console.log('✅ GET lookup limit properly enforced');
    });
  });

  describe('Performance Monitoring', () => {
    it('should provide performance metrics for batch operations', async () => {
      console.log('\n📊 Testing performance monitoring...');

      const batchSize = 100;
      const users = Array.from({ length: batchSize }, (_, i) => ({
        name: `Metrics Test User ${i}`,
        email: `metrics-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users,
          options: { chunkSize: 50 }
        })
        .expect(201);

      const duration = Date.now() - startTime;
      const throughput = (batchSize / duration) * 1000;

      console.log(`📈 Performance metrics:`);
      console.log(`   - Duration: ${duration}ms`);
      console.log(`   - Throughput: ${Math.round(throughput)} users/second`);
      console.log(`   - Success rate: ${(response.body.data.stats.successful / response.body.data.stats.total * 100).toFixed(1)}%`);

      expect(response.body.data.stats).toHaveProperty('total');
      expect(response.body.data.stats).toHaveProperty('successful');
      expect(response.body.data.stats).toHaveProperty('failed');
      expect(response.body.data.stats.total).toBe(batchSize);
      
      console.log('✅ Performance monitoring working correctly');
    });
  });
});