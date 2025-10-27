import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
// import { CacheService } from '../src/common/services/cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('Performance Cache & Database Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  // let cacheService: CacheService;
  let cacheManager: Cache;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
    // cacheService = moduleFixture.get<CacheService>(CacheService);
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, app.get('Logger')));
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
  }, 60000);

  afterAll(async () => {
    // Clean up test data
    if (dataSource?.isInitialized) {
      try {
        await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
        await dataSource.destroy();
      } catch (error) {
        console.warn('Failed to cleanup database:', error.message);
      }
    }
    
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Failed to close app:', error.message);
      }
    }
  });

  beforeEach(async () => {
    // Clean up users table and cache before each test
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    try {
      await (cacheManager as any).reset?.();
    } catch (error) {
      // Cache reset not available, continue
    }
  });

  describe('Cache Performance Tests', () => {
    it('should demonstrate significant cache performance benefits', async () => {
      // Create test users
      const testUsers = Array.from({ length: 1000 }, (_, i) => ({
        name: `Cache Test User ${i}`,
        email: `cache-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        preferences: {
          language: ['en', 'es', 'fr'][i % 3],
          timezone: 'UTC',
          theme: (['light', 'dark'][i % 2]) as 'light' | 'dark' | 'auto',
          notifications: { email: true, push: false, sms: false },
          gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
        },
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      const userIds = savedUsers.map(user => user.id);

      console.log('\n🧠 Testing cache performance benefits...');

      // Test 1: Cold cache (cache miss) performance
      console.log('  📊 Phase 1: Cold cache performance (cache misses)');
      const coldCacheStartTime = Date.now();
      
      const coldCachePromises = userIds.slice(0, 500).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const coldCacheResponses = await Promise.all(coldCachePromises);
      const coldCacheDuration = Date.now() - coldCacheStartTime;
      const coldCacheAvgTime = coldCacheDuration / coldCacheResponses.length;

      console.log(`    ⏱️ Cold cache: ${coldCacheDuration}ms total, ${coldCacheAvgTime.toFixed(2)}ms avg per request`);

      // Verify all requests succeeded
      expect(coldCacheResponses.every(r => r.status === 200)).toBe(true);

      // Test 2: Warm cache (cache hit) performance
      console.log('  📊 Phase 2: Warm cache performance (cache hits)');
      const warmCacheStartTime = Date.now();
      
      const warmCachePromises = userIds.slice(0, 500).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const warmCacheResponses = await Promise.all(warmCachePromises);
      const warmCacheDuration = Date.now() - warmCacheStartTime;
      const warmCacheAvgTime = warmCacheDuration / warmCacheResponses.length;

      console.log(`    ⏱️ Warm cache: ${warmCacheDuration}ms total, ${warmCacheAvgTime.toFixed(2)}ms avg per request`);

      // Verify all requests succeeded
      expect(warmCacheResponses.every(r => r.status === 200)).toBe(true);

      // Cache should provide significant performance improvement
      const performanceImprovement = (coldCacheAvgTime - warmCacheAvgTime) / coldCacheAvgTime;
      console.log(`    🚀 Performance improvement: ${(performanceImprovement * 100).toFixed(1)}%`);

      expect(warmCacheAvgTime).toBeLessThan(coldCacheAvgTime); // Warm cache should be faster
      expect(performanceImprovement).toBeGreaterThan(0.3); // At least 30% improvement
      expect(warmCacheAvgTime).toBeLessThan(50); // Cached responses should be very fast (< 50ms)
    });

    it('should handle cache warm-up efficiently for large datasets', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        name: `Warm Up User ${i}`,
        email: `warmup-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 10 !== 0, // 90% active
        lastLoginAt: i % 5 === 0 ? new Date(Date.now() - i * 1000) : null,
      }));

      const savedUsers = await userRepository.save(largeDataset as any);
      const userIds = savedUsers.map(user => user.id);

      console.log('\n🔥 Testing cache warm-up performance...');

      // Warm up cache in batches
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      const warmUpStartTime = Date.now();
      const memoryBefore = process.memoryUsage();

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();

        const response = await request(app.getHttpServer())
          .post('/api/batch/cache/warm-up')
          .set('x-internal-service', 'user-service-internal')
          .send({ userIds: batch })
          .expect(200);

        const batchDuration = Date.now() - batchStartTime;
        const batchThroughput = (batch.length / batchDuration) * 1000;

        console.log(`  📦 Batch ${batchIndex + 1}/${batches.length}: ${batch.length} users in ${batchDuration}ms (${batchThroughput.toFixed(1)} users/sec)`);

        expect(response.body.stats.cached).toBe(batch.length);
        expect(response.body.stats.failed).toBe(0);
        expect(batchDuration).toBeLessThan(5000); // Each batch should complete within 5 seconds
        expect(batchThroughput).toBeGreaterThan(100); // At least 100 users per second
      }

      const warmUpEndTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const totalWarmUpDuration = warmUpEndTime - warmUpStartTime;
      const overallThroughput = (userIds.length / totalWarmUpDuration) * 1000;

      console.log(`✅ Cache warm-up completed: ${userIds.length} users in ${totalWarmUpDuration}ms`);
      console.log(`📈 Overall throughput: ${overallThroughput.toFixed(1)} users/sec`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);

      // Performance requirements
      expect(totalWarmUpDuration).toBeLessThan(60000); // Should complete within 60 seconds
      expect(overallThroughput).toBeGreaterThan(80); // At least 80 users per second overall

      // Memory usage should be reasonable
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase

      // Verify cache effectiveness after warm-up
      const verificationStartTime = Date.now();
      const sampleUserIds = userIds.slice(0, 1000); // Test first 1000 users

      const verificationPromises = sampleUserIds.map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const verificationResponses = await Promise.all(verificationPromises);
      const verificationDuration = Date.now() - verificationStartTime;
      const avgCachedResponseTime = verificationDuration / verificationResponses.length;

      console.log(`🔍 Verification: ${sampleUserIds.length} cached lookups in ${verificationDuration}ms (${avgCachedResponseTime.toFixed(2)}ms avg)`);

      expect(verificationResponses.every(r => r.status === 200)).toBe(true);
      expect(avgCachedResponseTime).toBeLessThan(30); // Cached responses should be very fast
    });

    it('should handle cache invalidation efficiently', async () => {
      // Create test users
      const testUsers = Array.from({ length: 2000 }, (_, i) => ({
        name: `Invalidation Test User ${i}`,
        email: `invalidation-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: true,
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      const userIds = savedUsers.map(user => user.id);

      console.log('\n🗑️ Testing cache invalidation performance...');

      // First, warm up the cache
      await request(app.getHttpServer())
        .post('/api/batch/cache/warm-up')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds })
        .expect(200);

      // Test individual cache invalidation
      const individualInvalidationStartTime = Date.now();
      const invalidationPromises = userIds.slice(0, 500).map(userId =>
        request(app.getHttpServer())
          .delete(`/api/internal/cache/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const invalidationResponses = await Promise.all(invalidationPromises);
      const individualInvalidationDuration = Date.now() - individualInvalidationStartTime;
      const avgInvalidationTime = individualInvalidationDuration / invalidationResponses.length;

      console.log(`  🗑️ Individual invalidation: 500 users in ${individualInvalidationDuration}ms (${avgInvalidationTime.toFixed(2)}ms avg)`);

      expect(invalidationResponses.every(r => r.status === 200)).toBe(true);
      expect(avgInvalidationTime).toBeLessThan(10); // Cache invalidation should be very fast
      expect(individualInvalidationDuration).toBeLessThan(2000); // Total should be under 2 seconds

      // Test batch cache invalidation
      const batchInvalidationStartTime = Date.now();
      const remainingUserIds = userIds.slice(500, 1500); // 1000 users

      const batchInvalidationResponse = await request(app.getHttpServer())
        .delete('/api/batch/cache/users')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds: remainingUserIds })
        .expect(200);

      const batchInvalidationDuration = Date.now() - batchInvalidationStartTime;
      const batchInvalidationThroughput = (remainingUserIds.length / batchInvalidationDuration) * 1000;

      console.log(`  🗑️ Batch invalidation: ${remainingUserIds.length} users in ${batchInvalidationDuration}ms (${batchInvalidationThroughput.toFixed(1)} invalidations/sec)`);

      expect(batchInvalidationResponse.body.stats.invalidated).toBe(remainingUserIds.length);
      expect(batchInvalidationResponse.body.stats.failed).toBe(0);
      expect(batchInvalidationDuration).toBeLessThan(3000); // Should complete within 3 seconds
      expect(batchInvalidationThroughput).toBeGreaterThan(300); // At least 300 invalidations per second

      // Verify cache invalidation worked (should be cache misses now)
      const verificationStartTime = Date.now();
      const verificationUserIds = userIds.slice(0, 100);

      const verificationPromises = verificationUserIds.map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const verificationResponses = await Promise.all(verificationPromises);
      const verificationDuration = Date.now() - verificationStartTime;
      const avgVerificationTime = verificationDuration / verificationResponses.length;

      console.log(`  🔍 Post-invalidation lookup: ${verificationUserIds.length} users in ${verificationDuration}ms (${avgVerificationTime.toFixed(2)}ms avg)`);

      expect(verificationResponses.every(r => r.status === 200)).toBe(true);
      // These should be slower than cached responses (cache misses)
      expect(avgVerificationTime).toBeGreaterThan(20); // Should be slower than cached responses
    });

    it('should handle cache hit/miss ratio monitoring', async () => {
      // Create test users
      const testUsers = Array.from({ length: 1000 }, (_, i) => ({
        name: `Hit Ratio User ${i}`,
        email: `hit-ratio-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: true,
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      const userIds = savedUsers.map(user => user.id);

      console.log('\n📊 Testing cache hit/miss ratio monitoring...');

      // Phase 1: All cache misses (cold cache)
      console.log('  📊 Phase 1: Cold cache (all misses)');
      const coldCachePromises = userIds.slice(0, 500).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      await Promise.all(coldCachePromises);

      // Get cache stats after cold cache
      const coldCacheStats = await request(app.getHttpServer())
        .get('/api/internal/cache/stats')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      console.log(`    📈 Cold cache stats: ${JSON.stringify(coldCacheStats.body.data)}`);

      // Phase 2: Mix of hits and misses
      console.log('  📊 Phase 2: Mixed cache hits and misses');
      const mixedPromises = [
        // 300 cache hits (repeat previous requests)
        ...userIds.slice(0, 300).map(userId =>
          request(app.getHttpServer())
            .get(`/api/internal/users/${userId}`)
            .set('x-internal-service', 'user-service-internal')
        ),
        // 200 cache misses (new requests)
        ...userIds.slice(500, 700).map(userId =>
          request(app.getHttpServer())
            .get(`/api/internal/users/${userId}`)
            .set('x-internal-service', 'user-service-internal')
        ),
      ];

      await Promise.all(mixedPromises);

      // Get cache stats after mixed operations
      const mixedCacheStats = await request(app.getHttpServer())
        .get('/api/internal/cache/stats')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      console.log(`    📈 Mixed cache stats: ${JSON.stringify(mixedCacheStats.body.data)}`);

      // Phase 3: Mostly cache hits
      console.log('  📊 Phase 3: Mostly cache hits');
      const hotCachePromises = userIds.slice(0, 600).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      await Promise.all(hotCachePromises);

      // Get final cache stats
      const finalCacheStats = await request(app.getHttpServer())
        .get('/api/internal/cache/stats')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      console.log(`    📈 Final cache stats: ${JSON.stringify(finalCacheStats.body.data)}`);

      // Verify cache statistics are reasonable
      const stats = finalCacheStats.body.data;
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.total).toBe(stats.hits + stats.misses);
      
      const hitRatio = stats.hits / stats.total;
      console.log(`    🎯 Final hit ratio: ${(hitRatio * 100).toFixed(1)}%`);
      
      // Should have a reasonable hit ratio (at least 40% given our test pattern)
      expect(hitRatio).toBeGreaterThan(0.4);
      expect(hitRatio).toBeLessThan(1.0);
    });
  });

  describe('Database Performance Tests', () => {
    it('should demonstrate database query optimization with indexes', async () => {
      // Create large dataset for index testing
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        name: `Index Test User ${i}`,
        email: `index-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 7 !== 0, // Mix of active/inactive
        lastLoginAt: i % 4 === 0 ? new Date(Date.now() - i * 1000 * 60) : null,
        createdAt: new Date(Date.now() - i * 1000 * 60 * 60), // Spread over time
      }));

      console.log('\n🗄️ Creating large dataset for database performance testing...');
      const insertStartTime = Date.now();
      
      // Insert in batches to avoid overwhelming the database
      const batchSize = 1000;
      for (let i = 0; i < largeDataset.length; i += batchSize) {
        const batch = largeDataset.slice(i, i + batchSize);
        await userRepository.save(batch as any);
      }
      
      const insertDuration = Date.now() - insertStartTime;
      console.log(`✅ Dataset created: ${largeDataset.length} users in ${insertDuration}ms`);

      // Test 1: Email index performance (unique constraint)
      console.log('  📊 Testing email index performance...');
      const emailQueries = largeDataset.slice(0, 100).map(user => user.email);
      
      const emailQueryStartTime = Date.now();
      const emailQueryPromises = emailQueries.map(email =>
        request(app.getHttpServer())
          .get(`/api/internal/users/email/${email}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const emailQueryResponses = await Promise.all(emailQueryPromises);
      const emailQueryDuration = Date.now() - emailQueryStartTime;
      const avgEmailQueryTime = emailQueryDuration / emailQueries.length;

      console.log(`    ⏱️ Email queries: ${emailQueries.length} queries in ${emailQueryDuration}ms (${avgEmailQueryTime.toFixed(2)}ms avg)`);

      expect(emailQueryResponses.every(r => r.status === 200)).toBe(true);
      expect(avgEmailQueryTime).toBeLessThan(50); // Email queries should be very fast due to unique index

      // Test 2: isActive index performance
      console.log('  📊 Testing isActive index performance...');
      const activeQueryStartTime = Date.now();

      const activeUsersResponse = await request(app.getHttpServer())
        .get('/api/users?isActive=true&limit=1000&sortBy=createdAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const activeQueryDuration = Date.now() - activeQueryStartTime;

      console.log(`    ⏱️ Active users query: ${activeUsersResponse.body.data.items.length} results in ${activeQueryDuration}ms`);

      expect(activeUsersResponse.body.data.items.length).toBeGreaterThan(0);
      expect(activeQueryDuration).toBeLessThan(200); // Indexed queries should be fast
      expect(activeUsersResponse.body.data.items.every((user: any) => user.isActive === true)).toBe(true);

      // Test 3: Composite query performance (multiple conditions)
      console.log('  📊 Testing composite query performance...');
      const compositeQueryStartTime = Date.now();

      const compositeResponse = await request(app.getHttpServer())
        .get('/api/users?isActive=true&sortBy=lastLoginAt&sortOrder=desc&limit=500')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const compositeQueryDuration = Date.now() - compositeQueryStartTime;

      console.log(`    ⏱️ Composite query: ${compositeResponse.body.data.items.length} results in ${compositeQueryDuration}ms`);

      expect(compositeResponse.body.data.items.length).toBeGreaterThan(0);
      expect(compositeQueryDuration).toBeLessThan(300); // Composite queries should still be reasonable
      expect(compositeResponse.body.data.items.every((user: any) => user.isActive === true)).toBe(true);

      // Test 4: Pagination performance with large offset
      console.log('  📊 Testing pagination performance with large offset...');
      const largeOffsetStartTime = Date.now();

      const largeOffsetResponse = await request(app.getHttpServer())
        .get('/api/users?page=50&limit=100&sortBy=createdAt&sortOrder=asc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const largeOffsetDuration = Date.now() - largeOffsetStartTime;

      console.log(`    ⏱️ Large offset pagination: page 50 in ${largeOffsetDuration}ms`);

      expect(largeOffsetResponse.body.data.items.length).toBeGreaterThan(0);
      expect(largeOffsetDuration).toBeLessThan(500); // Even large offsets should be reasonable

      // Test 5: Cursor-based pagination performance
      console.log('  📊 Testing cursor-based pagination performance...');
      
      // Get first page to establish cursor
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/users?limit=100&sortBy=createdAt&sortOrder=asc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const cursor = firstPageResponse.body.data.pagination.nextCursor;
      expect(cursor).toBeTruthy();

      const cursorPaginationStartTime = Date.now();

      const cursorResponse = await request(app.getHttpServer())
        .get(`/api/users?cursor=${encodeURIComponent(cursor)}&limit=100&sortBy=createdAt&sortOrder=asc`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const cursorPaginationDuration = Date.now() - cursorPaginationStartTime;

      console.log(`    ⏱️ Cursor pagination: 100 results in ${cursorPaginationDuration}ms`);

      expect(cursorResponse.body.data.items.length).toBe(100);
      expect(cursorPaginationDuration).toBeLessThan(200); // Cursor pagination should be faster than offset
    });

    it('should handle database connection pooling efficiently', async () => {
      console.log('\n🏊 Testing database connection pooling performance...');

      // Create test data
      const testUsers = Array.from({ length: 500 }, (_, i) => ({
        name: `Pool Test User ${i}`,
        email: `pool-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: true,
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      const userIds = savedUsers.map(user => user.id);

      // Test concurrent database operations to stress connection pool
      const concurrentOperations = 100;
      const operationsPerBatch = 10;
      const batches = Math.ceil(concurrentOperations / operationsPerBatch);

      console.log(`  📊 Testing ${concurrentOperations} concurrent DB operations in ${batches} batches...`);

      const allResults = [];
      const startTime = Date.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchStartTime = Date.now();
        
        const batchOperations = Array.from({ length: operationsPerBatch }, (_, i) => {
          const operationType = Math.random();
          const userId = userIds[Math.floor(Math.random() * userIds.length)];

          if (operationType < 0.6) {
            // 60% read operations
            return request(app.getHttpServer())
              .get(`/api/internal/users/${userId}`)
              .set('x-internal-service', 'user-service-internal');
          } else if (operationType < 0.8) {
            // 20% update operations
            return request(app.getHttpServer())
              .patch(`/api/internal/users/${userId}/last-login`)
              .set('x-internal-service', 'user-service-internal');
          } else {
            // 20% create operations
            return request(app.getHttpServer())
              .post('/api/internal/users')
              .set('x-internal-service', 'user-service-internal')
              .send({
                name: `Pool Batch User ${batch}-${i}`,
                email: `pool-batch-${batch}-${i}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
              });
          }
        });

        const batchResults = await Promise.all(batchOperations);
        const batchDuration = Date.now() - batchStartTime;

        allResults.push(...batchResults);

        console.log(`    📦 Batch ${batch + 1}/${batches}: ${operationsPerBatch} operations in ${batchDuration}ms`);

        // Each batch should complete reasonably quickly
        expect(batchDuration).toBeLessThan(5000);
        expect(batchResults.every(r => r.status >= 200 && r.status < 300)).toBe(true);

        // Small delay between batches to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalDuration = Date.now() - startTime;
      const throughput = (allResults.length / totalDuration) * 1000;

      console.log(`✅ Connection pool test completed: ${allResults.length} operations in ${totalDuration}ms`);
      console.log(`📈 Throughput: ${throughput.toFixed(1)} operations/second`);

      // Verify all operations succeeded
      const successfulOperations = allResults.filter(r => r.status >= 200 && r.status < 300);
      const successRate = successfulOperations.length / allResults.length;

      expect(successRate).toBeGreaterThan(0.99); // At least 99% success rate
      expect(throughput).toBeGreaterThan(20); // At least 20 operations per second
      expect(totalDuration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle database query optimization for complex JSONB operations', async () => {
      // Create users with complex JSONB data
      const complexUsers = Array.from({ length: 2000 }, (_, i) => ({
        name: `JSONB Test User ${i}`,
        email: `jsonb-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        preferences: {
          language: ['en', 'es', 'fr', 'de', 'it'][i % 5],
          timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'][i % 4],
          theme: (['light', 'dark', 'auto'][i % 3]) as 'light' | 'dark' | 'auto',
          notifications: {
            email: i % 2 === 0,
            push: i % 3 === 0,
            sms: i % 5 === 0,
          },
          gameSettings: {
            autoDownload: i % 2 === 0,
            cloudSave: i % 3 === 0,
            achievementNotifications: i % 4 === 0,
          },
        },
        privacySettings: {
          profileVisibility: (['public', 'friends', 'private'][i % 3]) as 'public' | 'friends' | 'private',
          showOnlineStatus: i % 2 === 0,
          showGameActivity: i % 3 === 0,
          allowFriendRequests: i % 4 === 0,
          showAchievements: i % 5 === 0,
        },
        metadata: {
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
          score: Math.floor(Math.random() * 1000),
          level: Math.floor(i / 100) + 1,
          achievements: Array.from({ length: i % 10 }, (_, j) => `achievement-${j}`),
        },
      }));

      console.log('\n📄 Testing JSONB query performance...');
      const insertStartTime = Date.now();
      
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < complexUsers.length; i += batchSize) {
        const batch = complexUsers.slice(i, i + batchSize);
        await userRepository.save(batch as any);
      }
      
      const insertDuration = Date.now() - insertStartTime;
      console.log(`✅ Complex JSONB data inserted: ${complexUsers.length} users in ${insertDuration}ms`);

      // Test JSONB queries through API endpoints that would use JSONB operators
      console.log('  📊 Testing JSONB-based filtering...');

      // Test 1: Filter by language preference
      const languageQueryStartTime = Date.now();
      const languageResponse = await request(app.getHttpServer())
        .get('/api/users/search?preferences.language=en&limit=100')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const languageQueryDuration = Date.now() - languageQueryStartTime;

      console.log(`    ⏱️ Language filter: ${languageResponse.body.data.items.length} results in ${languageQueryDuration}ms`);
      expect(languageQueryDuration).toBeLessThan(500); // JSONB queries should be reasonable

      // Test 2: Filter by notification preferences
      const notificationQueryStartTime = Date.now();
      const notificationResponse = await request(app.getHttpServer())
        .get('/api/users/search?preferences.notifications.email=true&limit=100')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const notificationQueryDuration = Date.now() - notificationQueryStartTime;

      console.log(`    ⏱️ Notification filter: ${notificationResponse.body.data.items.length} results in ${notificationQueryDuration}ms`);
      expect(notificationQueryDuration).toBeLessThan(600);

      // Test 3: Complex nested JSONB query
      const complexQueryStartTime = Date.now();
      const complexResponse = await request(app.getHttpServer())
        .get('/api/users/search?metadata.level=5&privacySettings.profileVisibility=public&limit=50')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const complexQueryDuration = Date.now() - complexQueryStartTime;

      console.log(`    ⏱️ Complex JSONB query: ${complexResponse.body.data.items.length} results in ${complexQueryDuration}ms`);
      expect(complexQueryDuration).toBeLessThan(800); // Complex JSONB queries may be slower but should still be reasonable

      // Test 4: JSONB array operations
      const arrayQueryStartTime = Date.now();
      const arrayResponse = await request(app.getHttpServer())
        .get('/api/users/search?metadata.tags=tag-5&limit=100')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);
      const arrayQueryDuration = Date.now() - arrayQueryStartTime;

      console.log(`    ⏱️ JSONB array query: ${arrayResponse.body.data.items.length} results in ${arrayQueryDuration}ms`);
      expect(arrayQueryDuration).toBeLessThan(700);

      // All queries should return valid results
      expect(languageResponse.body.data.items.length).toBeGreaterThan(0);
      expect(notificationResponse.body.data.items.length).toBeGreaterThan(0);
      expect(arrayResponse.body.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('Cache-Database Integration Performance', () => {
    it('should demonstrate optimal cache-database integration patterns', async () => {
      // Create test dataset
      const testUsers = Array.from({ length: 3000 }, (_, i) => ({
        name: `Integration Test User ${i}`,
        email: `integration-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 8 !== 0,
        lastLoginAt: i % 4 === 0 ? new Date(Date.now() - i * 1000) : null,
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      const userIds = savedUsers.map(user => user.id);

      console.log('\n🔄 Testing cache-database integration patterns...');

      // Pattern 1: Cache-aside (read-through)
      console.log('  📊 Testing cache-aside pattern...');
      const cacheAsideStartTime = Date.now();
      
      const cacheAsidePromises = userIds.slice(0, 1000).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const cacheAsideResponses = await Promise.all(cacheAsidePromises);
      const cacheAsideDuration = Date.now() - cacheAsideStartTime;

      console.log(`    ⏱️ Cache-aside: 1000 requests in ${cacheAsideDuration}ms (${(cacheAsideDuration/1000).toFixed(2)}ms avg)`);
      expect(cacheAsideResponses.every(r => r.status === 200)).toBe(true);

      // Pattern 2: Write-through (update cache on write)
      console.log('  📊 Testing write-through pattern...');
      const writeIds = userIds.slice(1000, 1500);
      const writeThroughStartTime = Date.now();

      const writeThroughPromises = writeIds.map(userId =>
        request(app.getHttpServer())
          .patch(`/api/internal/users/${userId}/last-login`)
          .set('x-internal-service', 'user-service-internal')
      );

      const writeThroughResponses = await Promise.all(writeThroughPromises);
      const writeThroughDuration = Date.now() - writeThroughStartTime;

      console.log(`    ⏱️ Write-through: 500 updates in ${writeThroughDuration}ms (${(writeThroughDuration/500).toFixed(2)}ms avg)`);
      expect(writeThroughResponses.every(r => r.status === 200)).toBe(true);

      // Verify cache was updated (subsequent reads should be fast)
      const verificationStartTime = Date.now();
      const verificationPromises = writeIds.slice(0, 100).map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const verificationResponses = await Promise.all(verificationPromises);
      const verificationDuration = Date.now() - verificationStartTime;
      const avgVerificationTime = verificationDuration / verificationResponses.length;

      console.log(`    🔍 Post-update verification: 100 reads in ${verificationDuration}ms (${avgVerificationTime.toFixed(2)}ms avg)`);
      expect(verificationResponses.every(r => r.status === 200)).toBe(true);
      expect(avgVerificationTime).toBeLessThan(30); // Should be fast due to cache

      // Pattern 3: Cache warming with database preloading
      console.log('  📊 Testing cache warming pattern...');
      const warmingIds = userIds.slice(2000, 2500);
      const warmingStartTime = Date.now();

      const warmingResponse = await request(app.getHttpServer())
        .post('/api/batch/cache/warm-up')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds: warmingIds })
        .expect(200);

      const warmingDuration = Date.now() - warmingStartTime;
      const warmingThroughput = (warmingIds.length / warmingDuration) * 1000;

      console.log(`    🔥 Cache warming: 500 users in ${warmingDuration}ms (${warmingThroughput.toFixed(1)} users/sec)`);
      expect(warmingResponse.body.stats.cached).toBe(warmingIds.length);

      // Verify warmed cache performance
      const warmedCacheStartTime = Date.now();
      const warmedCachePromises = warmingIds.map(userId =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${userId}`)
          .set('x-internal-service', 'user-service-internal')
      );

      const warmedCacheResponses = await Promise.all(warmedCachePromises);
      const warmedCacheDuration = Date.now() - warmedCacheStartTime;
      const avgWarmedCacheTime = warmedCacheDuration / warmedCacheResponses.length;

      console.log(`    ⚡ Warmed cache reads: 500 reads in ${warmedCacheDuration}ms (${avgWarmedCacheTime.toFixed(2)}ms avg)`);
      expect(warmedCacheResponses.every(r => r.status === 200)).toBe(true);
      expect(avgWarmedCacheTime).toBeLessThan(20); // Warmed cache should be very fast

      // Overall performance validation
      expect(cacheAsideDuration).toBeLessThan(30000); // Cache-aside should complete within 30 seconds
      expect(writeThroughDuration).toBeLessThan(15000); // Write-through should complete within 15 seconds
      expect(warmingDuration).toBeLessThan(10000); // Cache warming should complete within 10 seconds
      expect(warmingThroughput).toBeGreaterThan(50); // At least 50 users per second for warming
    });
  });
});