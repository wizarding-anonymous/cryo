import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';

describe('Performance Batch Operations Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);

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
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('Large Batch Creation Performance (10k+ records)', () => {
    it('should handle batch creation of 10,000 users efficiently', async () => {
      const batchSize = 10000;
      const chunkSize = 500; // Process in chunks of 500
      
      console.log(`\n🚀 Starting batch creation of ${batchSize} users...`);
      
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${i}`,
        email: `batch-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        preferences: {
          language: ['en', 'es', 'fr', 'de', 'it'][i % 5],
          timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'][i % 4],
          theme: (['light', 'dark', 'auto'][i % 3]) as 'light' | 'dark' | 'auto',
          notifications: { 
            email: i % 2 === 0, 
            push: i % 3 === 0, 
            sms: i % 5 === 0 
          },
          gameSettings: { 
            autoDownload: i % 2 === 0, 
            cloudSave: i % 3 === 0, 
            achievementNotifications: i % 4 === 0 
          },
        },
        privacySettings: {
          profileVisibility: (['public', 'friends', 'private'][i % 3]) as 'public' | 'friends' | 'private',
          showOnlineStatus: i % 2 === 0,
          showGameActivity: i % 3 === 0,
          allowFriendRequests: i % 4 === 0,
          showAchievements: i % 5 === 0,
        },
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

      expect(response.body.stats.successful).toBe(batchSize);
      expect(response.body.stats.failed).toBe(0);
      
      // Performance requirements
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      
      // Calculate throughput
      const usersPerSecond = (batchSize / duration) * 1000;
      expect(usersPerSecond).toBeGreaterThan(100); // At least 100 users per second
      
      // Memory usage should not grow excessively (less than 500MB increase)
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(500);

      // Verify data integrity
      const userCount = await userRepository.count();
      expect(userCount).toBe(batchSize);
    }, 120000);

    it('should handle batch creation of 25,000 users with optimal chunking', async () => {
      const batchSize = 25000;
      const chunkSize = 1000; // Larger chunks for better performance
      
      console.log(`\n🚀 Starting large batch creation of ${batchSize} users...`);
      
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Large Batch User ${i}`,
        email: `large-batch-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 10 !== 0, // 90% active users
        lastLoginAt: i % 5 === 0 ? new Date(Date.now() - i * 1000) : null,
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

      expect(response.body.stats.successful).toBe(batchSize);
      expect(response.body.stats.failed).toBe(0);
      
      // Performance requirements for large batch
      expect(duration).toBeLessThan(180000); // Should complete within 3 minutes
      
      // Calculate throughput
      const usersPerSecond = (batchSize / duration) * 1000;
      expect(usersPerSecond).toBeGreaterThan(150); // At least 150 users per second for large batches
      
      // Memory usage should remain reasonable
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(800);

      // Verify data integrity
      const userCount = await userRepository.count();
      expect(userCount).toBe(batchSize);
    }, 300000);
  });

  describe('Large Batch Lookup Performance', () => {
    beforeEach(async () => {
      // Create test data for lookup tests
      const testUsers = Array.from({ length: 15000 }, (_, i) => ({
        name: `Lookup Test User ${i}`,
        email: `lookup-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 7 !== 0,
        lastLoginAt: i % 4 === 0 ? new Date(Date.now() - i * 1000) : null,
      }));

      // Insert in batches to avoid overwhelming the database
      const batchSize = 1000;
      for (let i = 0; i < testUsers.length; i += batchSize) {
        const batch = testUsers.slice(i, i + batchSize);
        await userRepository.save(batch as any);
      }
    });

    it('should handle batch lookup of 10,000 users efficiently', async () => {
      // Get user IDs for lookup
      const users = await userRepository.find({ 
        select: ['id'], 
        take: 10000,
        order: { createdAt: 'ASC' }
      });
      const userIds = users.map(user => user.id);

      console.log(`\n🔍 Starting batch lookup of ${userIds.length} users...`);

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .get(`/api/batch/users/lookup?ids=${userIds.join(',')}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Batch lookup completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Lookup throughput: ${Math.round((userIds.length / duration) * 1000)} lookups/second`);

      expect(response.body.stats.found).toBe(userIds.length);
      expect(response.body.stats.missing).toBe(0);
      expect(response.body.data).toHaveLength(userIds.length);
      
      // Performance requirements
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Calculate lookup throughput
      const lookupsPerSecond = (userIds.length / duration) * 1000;
      expect(lookupsPerSecond).toBeGreaterThan(2000); // At least 2000 lookups per second
      
      // Memory usage should be reasonable
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(200);
    });

    it('should handle paginated batch lookup efficiently', async () => {
      const pageSize = 2000;
      const totalPages = 5;
      
      console.log(`\n📄 Starting paginated batch lookup (${totalPages} pages of ${pageSize} users each)...`);

      const allResults = [];
      let totalDuration = 0;
      const memoryBefore = process.memoryUsage();

      for (let page = 1; page <= totalPages; page++) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get(`/api/users?page=${page}&limit=${pageSize}&sortBy=createdAt&sortOrder=asc`)
          .set('x-internal-service', 'user-service-internal')
          .expect(200);

        const endTime = Date.now();
        const pageDuration = endTime - startTime;
        totalDuration += pageDuration;

        console.log(`  📄 Page ${page} completed in ${pageDuration}ms (${response.body.data.items.length} users)`);

        expect(response.body.data.items.length).toBeGreaterThan(0);
        expect(response.body.data.items.length).toBeLessThanOrEqual(pageSize);
        allResults.push(...response.body.data.items);

        // Each page should be fast
        expect(pageDuration).toBeLessThan(1000);
      }

      const memoryAfter = process.memoryUsage();

      console.log(`✅ Paginated lookup completed in ${totalDuration}ms (${allResults.length} total users)`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Average page throughput: ${Math.round((allResults.length / totalDuration) * 1000)} users/second`);

      expect(allResults.length).toBe(totalPages * pageSize);
      expect(totalDuration).toBeLessThan(5000); // Total should be under 5 seconds
      
      // Memory should not grow significantly during pagination
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(100);
    });
  });

  describe('Large Batch Update Performance', () => {
    let testUserIds: string[];

    beforeEach(async () => {
      // Create test data for update tests
      const testUsers = Array.from({ length: 12000 }, (_, i) => ({
        name: `Update Test User ${i}`,
        email: `update-test-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: true,
        lastLoginAt: new Date(Date.now() - i * 1000),
      }));

      const savedUsers = await userRepository.save(testUsers as any);
      testUserIds = savedUsers.map(user => user.id);
    });

    it('should handle batch update of 10,000 users efficiently', async () => {
      const updateUserIds = testUserIds.slice(0, 10000);
      
      console.log(`\n🔄 Starting batch update of ${updateUserIds.length} users...`);

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .patch('/api/batch/users/last-login')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          userIds: updateUserIds,
          options: { chunkSize: 500 }
        })
        .expect(200);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Batch update completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Update throughput: ${Math.round((updateUserIds.length / duration) * 1000)} updates/second`);

      expect(response.body.stats.successful).toBe(updateUserIds.length);
      expect(response.body.stats.failed).toBe(0);
      
      // Performance requirements
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      
      // Calculate update throughput
      const updatesPerSecond = (updateUserIds.length / duration) * 1000;
      expect(updatesPerSecond).toBeGreaterThan(500); // At least 500 updates per second
      
      // Memory usage should be reasonable
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(150);

      // Verify updates were applied
      const updatedUsers = await userRepository.find({
        where: { id: { $in: updateUserIds.slice(0, 100) } as any },
        select: ['id', 'lastLoginAt']
      });
      
      updatedUsers.forEach(user => {
        expect(user.lastLoginAt).toBeTruthy();
        expect(new Date(user.lastLoginAt).getTime()).toBeGreaterThan(Date.now() - 60000); // Updated within last minute
      });
    });

    it('should handle batch soft delete of large number of users', async () => {
      const deleteUserIds = testUserIds.slice(0, 8000);
      
      console.log(`\n🗑️ Starting batch soft delete of ${deleteUserIds.length} users...`);

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request(app.getHttpServer())
        .delete('/api/batch/users/soft-delete')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          userIds: deleteUserIds,
          options: { chunkSize: 400 }
        })
        .expect(200);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      console.log(`✅ Batch soft delete completed in ${duration}ms`);
      console.log(`📊 Memory usage - Before: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB, After: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📈 Delete throughput: ${Math.round((deleteUserIds.length / duration) * 1000)} deletes/second`);

      expect(response.body.stats.successful).toBe(deleteUserIds.length);
      expect(response.body.stats.failed).toBe(0);
      
      // Performance requirements
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      
      // Calculate delete throughput
      const deletesPerSecond = (deleteUserIds.length / duration) * 1000;
      expect(deletesPerSecond).toBeGreaterThan(300); // At least 300 deletes per second
      
      // Memory usage should be reasonable
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(100);

      // Verify soft deletes were applied
      const activeUserCount = await userRepository.count({ where: { isActive: true } });
      const totalUserCount = await userRepository.count();
      
      expect(totalUserCount).toBe(testUserIds.length); // No hard deletes
      expect(activeUserCount).toBe(testUserIds.length - deleteUserIds.length); // Soft deleted users are inactive
    });
  });

  describe('Memory Leak Detection in Batch Operations', () => {
    it('should not have memory leaks during repeated batch operations', async () => {
      console.log('\n🧠 Starting memory leak detection test...');
      
      const iterations = 10;
      const batchSize = 1000;
      const memoryReadings = [];

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      memoryReadings.push(initialMemory.heapUsed);

      for (let i = 0; i < iterations; i++) {
        console.log(`  🔄 Iteration ${i + 1}/${iterations}`);
        
        // Create batch users
        const batchUsers = Array.from({ length: batchSize }, (_, j) => ({
          name: `Memory Test User ${i}-${j}`,
          email: `memory-test-${i}-${j}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        }));

        // Create users
        await request(app.getHttpServer())
          .post('/api/batch/users/create')
          .set('x-internal-service', 'user-service-internal')
          .send({ 
            users: batchUsers,
            options: { chunkSize: 200 }
          })
          .expect(201);

        // Get user IDs
        const users = await userRepository.find({ 
          select: ['id'], 
          take: batchSize,
          order: { createdAt: 'DESC' }
        });
        const userIds = users.map(user => user.id);

        // Lookup users
        await request(app.getHttpServer())
          .get(`/api/batch/users/lookup?ids=${userIds.join(',')}`)
          .set('x-internal-service', 'user-service-internal')
          .expect(200);

        // Update users
        await request(app.getHttpServer())
          .patch('/api/batch/users/last-login')
          .set('x-internal-service', 'user-service-internal')
          .send({ 
            userIds,
            options: { chunkSize: 200 }
          })
          .expect(200);

        // Clean up for next iteration
        await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Record memory usage
        const currentMemory = process.memoryUsage();
        memoryReadings.push(currentMemory.heapUsed);
        
        console.log(`    📊 Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
      }

      // Analyze memory trend
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const memoryIncrease = (finalMemory - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`📊 Memory analysis:`);
      console.log(`  Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`  Final: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`  Increase: ${Math.round(memoryIncrease)}MB`);

      // Memory should not increase significantly (less than 100MB after 10 iterations)
      expect(memoryIncrease).toBeLessThan(100);

      // Check for consistent memory growth (potential leak)
      const memoryGrowthTrend = memoryReadings.slice(1).map((reading, i) => 
        reading - memoryReadings[i]
      );
      
      const averageGrowth = memoryGrowthTrend.reduce((sum, growth) => sum + growth, 0) / memoryGrowthTrend.length;
      const consistentGrowth = memoryGrowthTrend.filter(growth => growth > 0).length;
      
      // Should not have consistent memory growth in more than 70% of iterations
      expect(consistentGrowth / iterations).toBeLessThan(0.7);
      
      // Average growth per iteration should be minimal
      expect(averageGrowth / 1024 / 1024).toBeLessThan(10); // Less than 10MB average growth per iteration
    }, 300000);
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor CPU and memory usage during intensive batch operations', async () => {
      console.log('\n📊 Starting resource usage monitoring...');
      
      const batchSize = 15000;
      const resourceReadings = [];
      
      // Start monitoring
      const monitoringInterval = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        resourceReadings.push({
          timestamp: Date.now(),
          memory: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
            rss: memoryUsage.rss,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
        });
      }, 1000); // Every second

      try {
        // Create large batch of users with complex data
        const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
          name: `Resource Monitor User ${i}`,
          email: `resource-monitor-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
          preferences: {
            language: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh'][i % 8],
            timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'][i % 5],
            theme: (['light', 'dark', 'auto'][i % 3]) as 'light' | 'dark' | 'auto',
            notifications: { 
              email: i % 2 === 0, 
              push: i % 3 === 0, 
              sms: i % 5 === 0 
            },
            gameSettings: { 
              autoDownload: i % 2 === 0, 
              cloudSave: i % 3 === 0, 
              achievementNotifications: i % 4 === 0 
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
            source: 'performance-test',
            batch: Math.floor(i / 1000),
            index: i,
            tags: [`tag-${i % 10}`, `category-${i % 5}`],
          },
        }));

        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .post('/api/batch/users/create')
          .set('x-internal-service', 'user-service-internal')
          .send({ 
            users: batchUsers,
            options: { chunkSize: 750 }
          })
          .expect(201);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.body.stats.successful).toBe(batchSize);
        expect(response.body.stats.failed).toBe(0);

        // Stop monitoring
        clearInterval(monitoringInterval);

        // Analyze resource usage
        if (resourceReadings.length > 0) {
          const memoryPeaks = resourceReadings.map(r => r.memory.heapUsed);
          const maxMemory = Math.max(...memoryPeaks);
          const minMemory = Math.min(...memoryPeaks);
          const avgMemory = memoryPeaks.reduce((sum, mem) => sum + mem, 0) / memoryPeaks.length;

          console.log(`📊 Resource usage analysis:`);
          console.log(`  Duration: ${duration}ms`);
          console.log(`  Memory - Min: ${Math.round(minMemory / 1024 / 1024)}MB, Max: ${Math.round(maxMemory / 1024 / 1024)}MB, Avg: ${Math.round(avgMemory / 1024 / 1024)}MB`);
          console.log(`  Memory growth: ${Math.round((maxMemory - minMemory) / 1024 / 1024)}MB`);
          console.log(`  Throughput: ${Math.round((batchSize / duration) * 1000)} users/second`);

          // Memory should not exceed reasonable limits
          expect(maxMemory / 1024 / 1024).toBeLessThan(1000); // Less than 1GB
          
          // Memory growth during operation should be reasonable
          const memoryGrowth = (maxMemory - minMemory) / 1024 / 1024;
          expect(memoryGrowth).toBeLessThan(500); // Less than 500MB growth
          
          // Performance should still be good
          const usersPerSecond = (batchSize / duration) * 1000;
          expect(usersPerSecond).toBeGreaterThan(100);
        }

      } finally {
        clearInterval(monitoringInterval);
      }
    }, 180000);
  });
});