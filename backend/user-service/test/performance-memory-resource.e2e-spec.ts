import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('Performance Memory & Resource Usage Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let cacheManager: Cache;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
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
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users table and cache before each test
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    try {
      await (cacheManager as any).reset?.();
    } catch (error) {
      // Cache reset not available, continue
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not have memory leaks during repeated API operations', async () => {
      console.log('\n🧠 Starting comprehensive memory leak detection...');
      
      const iterations = 20;
      const operationsPerIteration = 200;
      const memoryReadings = [];
      const heapGrowthReadings = [];

      // Force initial garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
      }

      const initialMemory = process.memoryUsage();
      memoryReadings.push({
        iteration: 0,
        ...initialMemory,
        timestamp: Date.now(),
      });

      console.log(`📊 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB heap, ${Math.round(initialMemory.rss / 1024 / 1024)}MB RSS`);

      for (let iteration = 1; iteration <= iterations; iteration++) {
        console.log(`  🔄 Iteration ${iteration}/${iterations} - ${operationsPerIteration} operations`);
        
        const iterationStartTime = Date.now();

        // Create test users for this iteration
        const testUsers = Array.from({ length: operationsPerIteration }, (_, i) => ({
          name: `Memory Test User ${iteration}-${i}`,
          email: `memory-test-${iteration}-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
          preferences: {
            language: ['en', 'es', 'fr'][i % 3],
            timezone: 'UTC',
            theme: (['light', 'dark'][i % 2]) as 'light' | 'dark' | 'auto',
            notifications: { email: true, push: false, sms: false },
            gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
          },
          metadata: {
            iteration,
            index: i,
            timestamp: Date.now(),
            data: Array.from({ length: 10 }, (_, j) => `data-${j}`), // Some array data
          },
        }));

        // Perform mixed operations
        const operations = [];

        // 40% Create operations
        for (let i = 0; i < Math.floor(operationsPerIteration * 0.4); i++) {
          operations.push(
            request(app.getHttpServer())
              .post('/api/internal/users')
              .set('x-internal-service', 'user-service-internal')
              .send(testUsers[i])
          );
        }

        // Get some user IDs for read/update operations
        const existingUsers = await userRepository.find({ 
          select: ['id'], 
          take: Math.floor(operationsPerIteration * 0.6),
          order: { createdAt: 'DESC' }
        });

        if (existingUsers.length > 0) {
          // 40% Read operations
          for (let i = 0; i < Math.floor(operationsPerIteration * 0.4); i++) {
            const userId = existingUsers[i % existingUsers.length].id;
            operations.push(
              request(app.getHttpServer())
                .get(`/api/internal/users/${userId}`)
                .set('x-internal-service', 'user-service-internal')
            );
          }

          // 20% Update operations
          for (let i = 0; i < Math.floor(operationsPerIteration * 0.2); i++) {
            const userId = existingUsers[i % existingUsers.length].id;
            operations.push(
              request(app.getHttpServer())
                .patch(`/api/internal/users/${userId}/last-login`)
                .set('x-internal-service', 'user-service-internal')
            );
          }
        }

        // Execute all operations
        const responses = await Promise.all(operations);
        const successfulOperations = responses.filter(r => r.status >= 200 && r.status < 300).length;
        
        const iterationDuration = Date.now() - iterationStartTime;
        console.log(`    ✅ ${successfulOperations}/${operations.length} operations completed in ${iterationDuration}ms`);

        // Clean up data from this iteration to prevent database growth
        await userRepository.query('DELETE FROM users WHERE name LIKE $1', [`Memory Test User ${iteration}-%`]);

        // Force garbage collection
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for GC
        }

        // Record memory usage
        const currentMemory = process.memoryUsage();
        memoryReadings.push({
          iteration,
          ...currentMemory,
          timestamp: Date.now(),
        });

        const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
        heapGrowthReadings.push(heapGrowth);

        console.log(`    📊 Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB heap (+${Math.round(heapGrowth / 1024 / 1024)}MB), ${Math.round(currentMemory.rss / 1024 / 1024)}MB RSS`);

        // Early detection of significant memory growth
        if (heapGrowth > 200 * 1024 * 1024) { // More than 200MB growth
          console.warn(`⚠️ Significant memory growth detected at iteration ${iteration}: +${Math.round(heapGrowth / 1024 / 1024)}MB`);
        }
      }

      // Analyze memory usage patterns
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const totalHeapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const totalRSSGrowth = finalMemory.rss - initialMemory.rss;

      console.log(`\n📊 Memory Analysis Summary:`);
      console.log(`  Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`  Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`  Total heap growth: ${Math.round(totalHeapGrowth / 1024 / 1024)}MB`);
      console.log(`  Total RSS growth: ${Math.round(totalRSSGrowth / 1024 / 1024)}MB`);

      // Calculate memory growth trend
      const growthTrend = heapGrowthReadings.map((growth, i) => i > 0 ? growth - heapGrowthReadings[i - 1] : 0);
      const averageGrowthPerIteration = growthTrend.reduce((sum, growth) => sum + growth, 0) / growthTrend.length;
      const consistentGrowthIterations = growthTrend.filter(growth => growth > 5 * 1024 * 1024).length; // More than 5MB growth

      console.log(`  Average growth per iteration: ${Math.round(averageGrowthPerIteration / 1024 / 1024)}MB`);
      console.log(`  Iterations with significant growth: ${consistentGrowthIterations}/${iterations}`);

      // Memory leak detection criteria
      expect(totalHeapGrowth).toBeLessThan(150 * 1024 * 1024); // Less than 150MB total growth
      expect(averageGrowthPerIteration).toBeLessThan(10 * 1024 * 1024); // Less than 10MB average growth per iteration
      expect(consistentGrowthIterations / iterations).toBeLessThan(0.3); // Less than 30% of iterations with significant growth

      // Check for memory stabilization in later iterations
      const lastFiveReadings = heapGrowthReadings.slice(-5);
      const memoryStabilized = lastFiveReadings.every(growth => 
        Math.abs(growth - lastFiveReadings[0]) < 20 * 1024 * 1024 // Within 20MB of first reading in last 5
      );

      console.log(`  Memory stabilized in last 5 iterations: ${memoryStabilized}`);
      expect(memoryStabilized).toBe(true);
    }, 600000); // 10 minutes timeout

    it('should handle large object creation and cleanup without memory leaks', async () => {
      console.log('\n🏗️ Testing large object creation and cleanup...');

      const cycles = 10;
      const objectsPerCycle = 1000;
      const memoryReadings = [];

      // Force initial garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const initialMemory = process.memoryUsage();
      memoryReadings.push(initialMemory.heapUsed);

      for (let cycle = 1; cycle <= cycles; cycle++) {
        console.log(`  🔄 Cycle ${cycle}/${cycles} - Creating ${objectsPerCycle} large objects`);

        // Create large objects with complex data
        const largeObjects = Array.from({ length: objectsPerCycle }, (_, i) => ({
          name: `Large Object User ${cycle}-${i}`,
          email: `large-object-${cycle}-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
          preferences: {
            language: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh'][i % 8],
            timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'][i % 5],
            theme: (['light', 'dark', 'auto'][i % 3]) as 'light' | 'dark' | 'auto',
            notifications: { email: i % 2 === 0, push: i % 3 === 0, sms: i % 5 === 0 },
            gameSettings: { autoDownload: i % 2 === 0, cloudSave: i % 3 === 0, achievementNotifications: i % 4 === 0 },
          },
          privacySettings: {
            profileVisibility: (['public', 'friends', 'private'][i % 3]) as 'public' | 'friends' | 'private',
            showOnlineStatus: i % 2 === 0,
            showGameActivity: i % 3 === 0,
            allowFriendRequests: i % 4 === 0,
            showAchievements: i % 5 === 0,
          },
          metadata: {
            cycle,
            index: i,
            largeArray: Array.from({ length: 100 }, (_, j) => ({
              id: j,
              data: `large-data-${cycle}-${i}-${j}`,
              timestamp: Date.now(),
              nested: {
                level1: { level2: { level3: `deep-data-${j}` } },
                array: Array.from({ length: 10 }, (_, k) => `nested-${k}`),
              },
            })),
            tags: Array.from({ length: 20 }, (_, j) => `tag-${cycle}-${j}`),
            scores: Array.from({ length: 50 }, () => Math.random() * 1000),
          },
        }));

        // Create objects in database
        const createStartTime = Date.now();
        const savedObjects = await userRepository.save(largeObjects as any);
        const createDuration = Date.now() - createStartTime;

        console.log(`    ✅ Created ${savedObjects.length} objects in ${createDuration}ms`);

        // Perform some operations on the objects
        const operationPromises = savedObjects.slice(0, 100).map(user =>
          request(app.getHttpServer())
            .get(`/api/internal/users/${user.id}`)
            .set('x-internal-service', 'user-service-internal')
        );

        await Promise.all(operationPromises);

        // Clean up objects
        const cleanupStartTime = Date.now();
        await userRepository.remove(savedObjects);
        const cleanupDuration = Date.now() - cleanupStartTime;

        console.log(`    🗑️ Cleaned up ${savedObjects.length} objects in ${cleanupDuration}ms`);

        // Force garbage collection
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Record memory usage
        const currentMemory = process.memoryUsage();
        memoryReadings.push(currentMemory.heapUsed);

        const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
        console.log(`    📊 Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB (+${Math.round(memoryGrowth / 1024 / 1024)}MB)`);
      }

      // Analyze memory usage
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const totalGrowth = finalMemory - initialMemory.heapUsed;

      console.log(`\n📊 Large Object Memory Analysis:`);
      console.log(`  Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`  Final: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`  Total growth: ${Math.round(totalGrowth / 1024 / 1024)}MB`);

      // Memory should return close to initial levels after cleanup
      expect(totalGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth after all cleanup

      // Check memory stability in last few cycles
      const lastThreeReadings = memoryReadings.slice(-3);
      const memoryVariation = Math.max(...lastThreeReadings) - Math.min(...lastThreeReadings);
      expect(memoryVariation).toBeLessThan(50 * 1024 * 1024); // Less than 50MB variation in last 3 cycles
    }, 300000);
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor and validate resource usage under sustained load', async () => {
      console.log('\n📊 Starting sustained load resource monitoring...');

      const monitoringDuration = 3 * 60 * 1000; // 3 minutes
      const operationInterval = 500; // Operation every 500ms
      const resourceReadings = [];
      let totalOperations = 0;
      let successfulOperations = 0;

      // Create initial test data
      const initialUsers = Array.from({ length: 500 }, (_, i) => ({
        name: `Resource Monitor User ${i}`,
        email: `resource-monitor-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: true,
      }));

      const savedUsers = await userRepository.save(initialUsers as any);
      const userIds = savedUsers.map(user => user.id);

      // Start resource monitoring
      const startTime = Date.now();
      let isRunning = true;

      const resourceMonitor = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        resourceReadings.push({
          timestamp: Date.now() - startTime,
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

      // Simulate sustained load
      const performOperation = async () => {
        if (!isRunning) return;

        try {
          const operationType = Math.random();
          let response;

          if (operationType < 0.5) {
            // 50% - Read operations
            const userId = userIds[Math.floor(Math.random() * userIds.length)];
            response = await request(app.getHttpServer())
              .get(`/api/internal/users/${userId}`)
              .set('x-internal-service', 'user-service-internal');
          } else if (operationType < 0.7) {
            // 20% - Create operations
            response = await request(app.getHttpServer())
              .post('/api/internal/users')
              .set('x-internal-service', 'user-service-internal')
              .send({
                name: `Sustained Load User ${totalOperations}`,
                email: `sustained-load-${totalOperations}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
              });
          } else if (operationType < 0.9) {
            // 20% - Update operations
            const userId = userIds[Math.floor(Math.random() * userIds.length)];
            response = await request(app.getHttpServer())
              .patch(`/api/internal/users/${userId}/last-login`)
              .set('x-internal-service', 'user-service-internal');
          } else {
            // 10% - Health checks
            response = await request(app.getHttpServer())
              .get('/api/health');
          }

          totalOperations++;
          if (response.status >= 200 && response.status < 300) {
            successfulOperations++;
          }

        } catch (error) {
          totalOperations++;
        }

        // Schedule next operation
        if (isRunning) {
          setTimeout(performOperation, operationInterval + Math.random() * 200); // Add jitter
        }
      };

      // Start multiple concurrent operation streams
      const concurrentStreams = 10;
      for (let i = 0; i < concurrentStreams; i++) {
        setTimeout(() => performOperation(), i * 50); // Stagger start times
      }

      // Wait for monitoring duration
      await new Promise(resolve => setTimeout(resolve, monitoringDuration));
      
      // Stop operations and monitoring
      isRunning = false;
      clearInterval(resourceMonitor);

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      console.log(`✅ Sustained load completed: ${actualDuration}ms`);
      console.log(`📊 Operations: ${totalOperations} total, ${successfulOperations} successful (${((successfulOperations/totalOperations)*100).toFixed(1)}%)`);
      console.log(`📈 Throughput: ${Math.round((totalOperations / actualDuration) * 1000)} operations/second`);

      // Analyze resource usage
      if (resourceReadings.length > 0) {
        const memoryUsages = resourceReadings.map(r => r.memory.heapUsed);
        const rssUsages = resourceReadings.map(r => r.memory.rss);
        
        const minMemory = Math.min(...memoryUsages);
        const maxMemory = Math.max(...memoryUsages);
        const avgMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
        
        const minRSS = Math.min(...rssUsages);
        const maxRSS = Math.max(...rssUsages);
        const avgRSS = rssUsages.reduce((sum, rss) => sum + rss, 0) / rssUsages.length;

        console.log(`\n📊 Resource Usage Analysis:`);
        console.log(`  Heap Memory - Min: ${Math.round(minMemory / 1024 / 1024)}MB, Max: ${Math.round(maxMemory / 1024 / 1024)}MB, Avg: ${Math.round(avgMemory / 1024 / 1024)}MB`);
        console.log(`  RSS Memory - Min: ${Math.round(minRSS / 1024 / 1024)}MB, Max: ${Math.round(maxRSS / 1024 / 1024)}MB, Avg: ${Math.round(avgRSS / 1024 / 1024)}MB`);
        console.log(`  Memory Growth: ${Math.round((maxMemory - minMemory) / 1024 / 1024)}MB heap, ${Math.round((maxRSS - minRSS) / 1024 / 1024)}MB RSS`);

        // Resource usage validation
        expect(maxMemory / 1024 / 1024).toBeLessThan(800); // Less than 800MB heap
        expect(maxRSS / 1024 / 1024).toBeLessThan(1200); // Less than 1.2GB RSS
        
        const memoryGrowth = (maxMemory - minMemory) / 1024 / 1024;
        expect(memoryGrowth).toBeLessThan(200); // Less than 200MB growth during sustained load
        
        // Performance validation
        const successRate = successfulOperations / totalOperations;
        expect(successRate).toBeGreaterThan(0.98); // At least 98% success rate
        
        const throughput = (totalOperations / actualDuration) * 1000;
        expect(throughput).toBeGreaterThan(15); // At least 15 operations per second

        // Check for memory stability (no continuous growth)
        const memoryTrend = memoryUsages.slice(Math.floor(memoryUsages.length * 0.5)); // Last half of readings
        const trendGrowth = Math.max(...memoryTrend) - Math.min(...memoryTrend);
        expect(trendGrowth / 1024 / 1024).toBeLessThan(100); // Less than 100MB variation in second half
      }
    }, 300000);

    it('should handle memory pressure gracefully', async () => {
      console.log('\n💾 Testing memory pressure handling...');

      const pressurePhases = [
        { name: 'Normal Load', users: 1000, operations: 500 },
        { name: 'Increased Load', users: 2000, operations: 1000 },
        { name: 'High Load', users: 5000, operations: 2000 },
        { name: 'Memory Pressure', users: 8000, operations: 3000 },
      ];

      const phaseResults = [];

      for (const phase of pressurePhases) {
        console.log(`  📊 Phase: ${phase.name} (${phase.users} users, ${phase.operations} operations)`);
        
        const phaseStartTime = Date.now();
        const memoryBefore = process.memoryUsage();

        // Create users for this phase
        const phaseUsers = Array.from({ length: phase.users }, (_, i) => ({
          name: `${phase.name} User ${i}`,
          email: `${phase.name.toLowerCase().replace(' ', '-')}-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
          preferences: {
            language: ['en', 'es', 'fr', 'de', 'it'][i % 5],
            timezone: ['UTC', 'America/New_York', 'Europe/London'][i % 3],
            theme: (['light', 'dark', 'auto'][i % 3]) as 'light' | 'dark' | 'auto',
            notifications: { email: i % 2 === 0, push: i % 3 === 0, sms: i % 5 === 0 },
            gameSettings: { autoDownload: i % 2 === 0, cloudSave: i % 3 === 0, achievementNotifications: i % 4 === 0 },
          },
          metadata: {
            phase: phase.name,
            index: i,
            data: Array.from({ length: Math.min(50, Math.floor(phase.users / 100)) }, (_, j) => `data-${j}`),
          },
        }));

        // Create users in batches to avoid overwhelming the system
        const batchSize = Math.min(500, Math.floor(phase.users / 10));
        const savedUserIds = [];
        
        for (let i = 0; i < phaseUsers.length; i += batchSize) {
          const batch = phaseUsers.slice(i, i + batchSize);
          const savedBatch = await userRepository.save(batch as any);
          savedUserIds.push(...savedBatch.map(user => user.id));
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Perform operations
        const operationPromises = Array.from({ length: phase.operations }, (_, i) => {
          const operationType = Math.random();
          
          if (operationType < 0.7) {
            // 70% - Read operations
            const userId = savedUserIds[Math.floor(Math.random() * savedUserIds.length)];
            return request(app.getHttpServer())
              .get(`/api/internal/users/${userId}`)
              .set('x-internal-service', 'user-service-internal');
          } else if (operationType < 0.9) {
            // 20% - Update operations
            const userId = savedUserIds[Math.floor(Math.random() * savedUserIds.length)];
            return request(app.getHttpServer())
              .patch(`/api/internal/users/${userId}/last-login`)
              .set('x-internal-service', 'user-service-internal');
          } else {
            // 10% - Health checks
            return request(app.getHttpServer())
              .get('/api/health');
          }
        });

        const responses = await Promise.all(operationPromises);
        const successfulOperations = responses.filter(r => r.status >= 200 && r.status < 300).length;

        const phaseEndTime = Date.now();
        const memoryAfter = process.memoryUsage();
        const phaseDuration = phaseEndTime - phaseStartTime;

        const result = {
          phase: phase.name,
          users: phase.users,
          operations: phase.operations,
          successfulOperations,
          successRate: successfulOperations / phase.operations,
          duration: phaseDuration,
          throughput: (successfulOperations / phaseDuration) * 1000,
          memoryBefore: memoryBefore.heapUsed,
          memoryAfter: memoryAfter.heapUsed,
          memoryGrowth: memoryAfter.heapUsed - memoryBefore.heapUsed,
          rssBefore: memoryBefore.rss,
          rssAfter: memoryAfter.rss,
          rssGrowth: memoryAfter.rss - memoryBefore.rss,
        };

        phaseResults.push(result);

        console.log(`    ✅ ${successfulOperations}/${phase.operations} operations (${(result.successRate * 100).toFixed(1)}%)`);
        console.log(`    ⏱️ Duration: ${phaseDuration}ms, Throughput: ${result.throughput.toFixed(1)} ops/sec`);
        console.log(`    📊 Memory: ${Math.round(result.memoryBefore / 1024 / 1024)}MB → ${Math.round(result.memoryAfter / 1024 / 1024)}MB (+${Math.round(result.memoryGrowth / 1024 / 1024)}MB)`);
        console.log(`    📊 RSS: ${Math.round(result.rssBefore / 1024 / 1024)}MB → ${Math.round(result.rssAfter / 1024 / 1024)}MB (+${Math.round(result.rssGrowth / 1024 / 1024)}MB)`);

        // Clean up phase data to prevent excessive memory usage
        await userRepository.query('DELETE FROM users WHERE name LIKE $1', [`${phase.name} User %`]);
        
        // Force garbage collection between phases
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Validate phase performance
        expect(result.successRate).toBeGreaterThan(0.95); // At least 95% success rate
        expect(result.memoryGrowth / 1024 / 1024).toBeLessThan(300); // Less than 300MB growth per phase
        expect(result.throughput).toBeGreaterThan(5); // At least 5 operations per second
      }

      // Analyze overall memory pressure handling
      console.log(`\n📊 Memory Pressure Analysis:`);
      phaseResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.phase}: ${result.successRate.toFixed(3)} success rate, ${Math.round(result.memoryGrowth / 1024 / 1024)}MB growth`);
      });

      // System should maintain reasonable performance even under pressure
      const highPressurePhase = phaseResults[phaseResults.length - 1]; // Last phase
      expect(highPressurePhase.successRate).toBeGreaterThan(0.90); // At least 90% success rate under pressure
      expect(highPressurePhase.throughput).toBeGreaterThan(3); // At least 3 operations per second under pressure

      // Memory growth should not be excessive even in high pressure phase
      expect(highPressurePhase.memoryGrowth / 1024 / 1024).toBeLessThan(500); // Less than 500MB growth in highest pressure phase
    }, 600000);
  });

  describe('Garbage Collection Monitoring', () => {
    it('should demonstrate effective garbage collection patterns', async () => {
      console.log('\n🗑️ Testing garbage collection effectiveness...');

      if (!global.gc) {
        console.log('⚠️ Garbage collection not available, skipping GC-specific tests');
        return;
      }

      const cycles = 15;
      const objectsPerCycle = 800;
      const gcReadings = [];

      for (let cycle = 1; cycle <= cycles; cycle++) {
        console.log(`  🔄 GC Cycle ${cycle}/${cycles}`);

        // Force GC before cycle
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 500));
        const beforeGC = process.memoryUsage();

        // Create and process objects
        const objects = Array.from({ length: objectsPerCycle }, (_, i) => ({
          name: `GC Test User ${cycle}-${i}`,
          email: `gc-test-${cycle}-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
          largeData: Array.from({ length: 100 }, (_, j) => ({
            id: j,
            data: `large-data-${cycle}-${i}-${j}`,
            nested: { level1: { level2: `deep-${j}` } },
          })),
        }));

        // Save objects
        const savedObjects = await userRepository.save(objects as any);

        // Perform operations
        const operationPromises = savedObjects.slice(0, 100).map(user =>
          request(app.getHttpServer())
            .get(`/api/internal/users/${user.id}`)
            .set('x-internal-service', 'user-service-internal')
        );

        await Promise.all(operationPromises);

        // Clean up objects
        await userRepository.remove(savedObjects);

        // Force GC after cycle
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 500));
        const afterGC = process.memoryUsage();

        const gcEffectiveness = {
          cycle,
          beforeHeap: beforeGC.heapUsed,
          afterHeap: afterGC.heapUsed,
          heapReduction: beforeGC.heapUsed - afterGC.heapUsed,
          beforeRSS: beforeGC.rss,
          afterRSS: afterGC.rss,
          rssReduction: beforeGC.rss - afterGC.rss,
        };

        gcReadings.push(gcEffectiveness);

        console.log(`    📊 Heap: ${Math.round(beforeGC.heapUsed / 1024 / 1024)}MB → ${Math.round(afterGC.heapUsed / 1024 / 1024)}MB (${Math.round(gcEffectiveness.heapReduction / 1024 / 1024)}MB freed)`);
        console.log(`    📊 RSS: ${Math.round(beforeGC.rss / 1024 / 1024)}MB → ${Math.round(afterGC.rss / 1024 / 1024)}MB (${Math.round(gcEffectiveness.rssReduction / 1024 / 1024)}MB freed)`);
      }

      // Analyze GC effectiveness
      const totalHeapFreed = gcReadings.reduce((sum, reading) => sum + Math.max(0, reading.heapReduction), 0);
      const totalRSSFreed = gcReadings.reduce((sum, reading) => sum + Math.max(0, reading.rssReduction), 0);
      const effectiveGCCycles = gcReadings.filter(reading => reading.heapReduction > 0).length;

      console.log(`\n📊 Garbage Collection Analysis:`);
      console.log(`  Total heap freed: ${Math.round(totalHeapFreed / 1024 / 1024)}MB`);
      console.log(`  Total RSS freed: ${Math.round(totalRSSFreed / 1024 / 1024)}MB`);
      console.log(`  Effective GC cycles: ${effectiveGCCycles}/${cycles} (${((effectiveGCCycles/cycles)*100).toFixed(1)}%)`);

      // GC should be effective
      expect(effectiveGCCycles / cycles).toBeGreaterThan(0.7); // At least 70% of GC cycles should free memory
      expect(totalHeapFreed).toBeGreaterThan(0); // Should free some heap memory overall

      // Memory should not grow continuously despite object creation
      const firstReading = gcReadings[0];
      const lastReading = gcReadings[gcReadings.length - 1];
      const netHeapGrowth = lastReading.afterHeap - firstReading.beforeHeap;

      console.log(`  Net heap growth: ${Math.round(netHeapGrowth / 1024 / 1024)}MB`);
      expect(netHeapGrowth / 1024 / 1024).toBeLessThan(100); // Less than 100MB net growth after all cycles
    }, 300000);
  });
});