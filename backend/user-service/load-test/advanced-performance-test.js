const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class AdvancedPerformanceTest {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.BASE_URL || 'http://localhost:3001';
    this.maxConcurrentUsers = options.maxConcurrentUsers || 1500;
    this.testDuration = options.testDuration || 10 * 60 * 1000; // 10 minutes
    this.rampUpDuration = options.rampUpDuration || 2 * 60 * 1000; // 2 minutes
    this.rampDownDuration = options.rampDownDuration || 1 * 60 * 1000; // 1 minute
    
    this.results = {
      requests: [],
      errors: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity,
        requestsPerSecond: 0,
        errorRate: 0,
      },
      resourceUsage: [],
      phases: [],
    };

    this.isRunning = false;
    this.activeUsers = 0;
    this.testUsers = [];
    this.createdUserIds = [];
  }

  async runComprehensiveTest() {
    console.log('🚀 Starting Advanced Performance Test Suite');
    console.log(`📊 Target: ${this.baseUrl}`);
    console.log(`👥 Max Concurrent Users: ${this.maxConcurrentUsers}`);
    console.log(`⏱️ Test Duration: ${this.testDuration / 1000}s`);
    console.log('');

    try {
      // Health check
      await this.healthCheck();
      
      // Run test phases
      await this.runBatchOperationsTest();
      await this.runConcurrentUsersTest();
      await this.runSustainedLoadTest();
      await this.runSpikeTest();
      await this.runMemoryLeakTest();
      
      // Generate final report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async healthCheck() {
    console.log('🏥 Performing health check...');
    
    try {
      const response = await this.makeRequest('GET', '/api/health');
      if (response.statusCode !== 200) {
        throw new Error(`Health check failed: ${response.statusCode}`);
      }
      console.log('✅ Service is healthy');
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async runBatchOperationsTest() {
    console.log('\n📦 Running Batch Operations Performance Test...');
    
    const batchSizes = [1000, 5000, 10000, 15000];
    const batchResults = [];

    for (const batchSize of batchSizes) {
      console.log(`  📊 Testing batch size: ${batchSize} users`);
      
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      // Generate batch users
      const batchUsers = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${batchSize}-${i}`,
        email: `batch-${batchSize}-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        preferences: {
          language: ['en', 'es', 'fr', 'de', 'it'][i % 5],
          timezone: ['UTC', 'America/New_York', 'Europe/London'][i % 3],
          theme: ['light', 'dark', 'auto'][i % 3],
          notifications: { email: i % 2 === 0, push: i % 3 === 0, sms: i % 5 === 0 },
          gameSettings: { autoDownload: i % 2 === 0, cloudSave: i % 3 === 0, achievementNotifications: i % 4 === 0 },
        },
      }));

      try {
        // Create batch
        const createResponse = await this.makeRequest('POST', '/api/batch/users/create', {
          users: batchUsers,
          options: { chunkSize: Math.min(500, Math.floor(batchSize / 10)) }
        }, {
          'x-internal-service': 'user-service-internal',
          'Content-Type': 'application/json'
        });

        if (createResponse.statusCode !== 201) {
          throw new Error(`Batch creation failed: ${createResponse.statusCode}`);
        }

        const createData = JSON.parse(createResponse.body);
        const userIds = createData.data.map(user => user.id);

        const createDuration = performance.now() - startTime;
        const createThroughput = (batchSize / createDuration) * 1000;

        // Test batch lookup
        const lookupStartTime = performance.now();
        const lookupResponse = await this.makeRequest('GET', `/api/batch/users/lookup?ids=${userIds.join(',')}`, null, {
          'x-internal-service': 'user-service-internal'
        });

        const lookupDuration = performance.now() - lookupStartTime;
        const lookupThroughput = (userIds.length / lookupDuration) * 1000;

        // Test batch update
        const updateStartTime = performance.now();
        const updateResponse = await this.makeRequest('PATCH', '/api/batch/users/last-login', {
          userIds: userIds.slice(0, Math.floor(userIds.length / 2)),
          options: { chunkSize: Math.min(200, Math.floor(userIds.length / 20)) }
        }, {
          'x-internal-service': 'user-service-internal',
          'Content-Type': 'application/json'
        });

        const updateDuration = performance.now() - updateStartTime;
        const updateThroughput = (Math.floor(userIds.length / 2) / updateDuration) * 1000;

        const memoryAfter = process.memoryUsage();
        const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;

        const batchResult = {
          batchSize,
          createDuration,
          createThroughput,
          lookupDuration,
          lookupThroughput,
          updateDuration,
          updateThroughput,
          memoryIncrease,
          success: createResponse.statusCode === 201 && lookupResponse.statusCode === 200 && updateResponse.statusCode === 200
        };

        batchResults.push(batchResult);

        console.log(`    ✅ Create: ${createDuration.toFixed(2)}ms (${createThroughput.toFixed(1)} users/sec)`);
        console.log(`    ✅ Lookup: ${lookupDuration.toFixed(2)}ms (${lookupThroughput.toFixed(1)} lookups/sec)`);
        console.log(`    ✅ Update: ${updateDuration.toFixed(2)}ms (${updateThroughput.toFixed(1)} updates/sec)`);
        console.log(`    📊 Memory: +${memoryIncrease.toFixed(1)}MB`);

        // Cleanup
        await this.makeRequest('DELETE', '/api/batch/users/soft-delete', {
          userIds,
          options: { chunkSize: Math.min(300, Math.floor(userIds.length / 15)) }
        }, {
          'x-internal-service': 'user-service-internal',
          'Content-Type': 'application/json'
        });

      } catch (error) {
        console.error(`    ❌ Batch size ${batchSize} failed:`, error.message);
        batchResults.push({
          batchSize,
          success: false,
          error: error.message
        });
      }

      // Wait between batch tests
      await this.sleep(2000);
    }

    this.results.phases.push({
      name: 'Batch Operations',
      results: batchResults
    });

    console.log('✅ Batch Operations Test completed');
  }

  async runConcurrentUsersTest() {
    console.log('\n👥 Running Concurrent Users Test...');
    
    const concurrentLevels = [500, 1000, 1500, 2000];
    const concurrentResults = [];

    // Create initial test data
    await this.createInitialTestData(1000);

    for (const concurrentUsers of concurrentLevels) {
      console.log(`  📊 Testing ${concurrentUsers} concurrent users...`);
      
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      const promises = Array.from({ length: concurrentUsers }, (_, i) => 
        this.simulateUserOperation(i, concurrentUsers)
      );

      try {
        const responses = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const successful = responses.filter(r => r.success).length;
        const failed = responses.filter(r => !r.success).length;
        const responseTimes = responses.filter(r => r.success).map(r => r.responseTime);
        
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        const sortedTimes = responseTimes.sort((a, b) => a - b);
        const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
        const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
        const maxResponseTime = Math.max(...responseTimes);
        
        const memoryAfter = process.memoryUsage();
        const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
        
        const throughput = (successful / duration) * 1000;
        const successRate = successful / concurrentUsers;

        const result = {
          concurrentUsers,
          duration,
          successful,
          failed,
          successRate,
          throughput,
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
          maxResponseTime,
          memoryIncrease
        };

        concurrentResults.push(result);

        console.log(`    ✅ Success: ${successful}/${concurrentUsers} (${(successRate * 100).toFixed(1)}%)`);
        console.log(`    ⏱️ Avg Response: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime.toFixed(2)}ms, P99: ${p99ResponseTime.toFixed(2)}ms`);
        console.log(`    📈 Throughput: ${throughput.toFixed(1)} ops/sec`);
        console.log(`    📊 Memory: +${memoryIncrease.toFixed(1)}MB`);

      } catch (error) {
        console.error(`    ❌ ${concurrentUsers} concurrent users failed:`, error.message);
        concurrentResults.push({
          concurrentUsers,
          success: false,
          error: error.message
        });
      }

      // Wait between tests
      await this.sleep(3000);
    }

    this.results.phases.push({
      name: 'Concurrent Users',
      results: concurrentResults
    });

    console.log('✅ Concurrent Users Test completed');
  }

  async runSustainedLoadTest() {
    console.log('\n⏰ Running Sustained Load Test...');
    
    const sustainedUsers = 800;
    const testDuration = 5 * 60 * 1000; // 5 minutes
    const operationInterval = 2000; // 2 seconds between operations per user
    
    console.log(`  📊 ${sustainedUsers} users for ${testDuration / 1000} seconds`);
    
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;
    const responseTimesSample = [];
    const resourceReadings = [];
    
    // Start resource monitoring
    const resourceMonitor = setInterval(() => {
      const memory = process.memoryUsage();
      resourceReadings.push({
        timestamp: performance.now() - startTime,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        rss: memory.rss,
        external: memory.external
      });
    }, 5000); // Every 5 seconds

    // Create user simulations
    const userPromises = Array.from({ length: sustainedUsers }, (_, userId) => {
      return new Promise((resolve) => {
        const userStartTime = performance.now();
        
        const performOperation = async () => {
          if (performance.now() - userStartTime >= testDuration) {
            resolve();
            return;
          }

          try {
            const operationStartTime = performance.now();
            const operationType = Math.random();
            let response;

            if (operationType < 0.5) {
              // 50% - Read operations
              const targetUserId = this.createdUserIds[Math.floor(Math.random() * this.createdUserIds.length)];
              response = await this.makeRequest('GET', `/api/internal/users/${targetUserId}`, null, {
                'x-internal-service': 'user-service-internal'
              });
            } else if (operationType < 0.7) {
              // 20% - Create operations
              response = await this.makeRequest('POST', '/api/internal/users', {
                name: `Sustained User ${userId}-${Date.now()}`,
                email: `sustained-${userId}-${Date.now()}@example.com`,
                password: '$2b$10$hashedPasswordFromAuthService',
              }, {
                'x-internal-service': 'user-service-internal',
                'Content-Type': 'application/json'
              });
            } else if (operationType < 0.9) {
              // 20% - Update operations
              const targetUserId = this.createdUserIds[Math.floor(Math.random() * this.createdUserIds.length)];
              response = await this.makeRequest('PATCH', `/api/internal/users/${targetUserId}/last-login`, null, {
                'x-internal-service': 'user-service-internal'
              });
            } else {
              // 10% - Health checks
              response = await this.makeRequest('GET', '/api/health');
            }

            const responseTime = performance.now() - operationStartTime;
            totalOperations++;

            if (response.statusCode >= 200 && response.statusCode < 300) {
              successfulOperations++;
              if (totalOperations % 50 === 0) { // Sample every 50th response
                responseTimesSample.push(responseTime);
              }
            } else {
              failedOperations++;
            }

          } catch (error) {
            failedOperations++;
            totalOperations++;
          }

          // Schedule next operation
          setTimeout(performOperation, operationInterval + Math.random() * 1000);
        };

        // Start with staggered timing
        setTimeout(performOperation, Math.random() * operationInterval);
      });
    });

    // Wait for all users to complete
    await Promise.all(userPromises);
    clearInterval(resourceMonitor);

    const endTime = performance.now();
    const actualDuration = endTime - startTime;
    const memoryAfter = process.memoryUsage();

    // Calculate statistics
    const successRate = successfulOperations / totalOperations;
    const throughput = (totalOperations / actualDuration) * 1000;
    const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;

    let avgResponseTime = 0;
    let p95ResponseTime = 0;
    let p99ResponseTime = 0;
    
    if (responseTimesSample.length > 0) {
      responseTimesSample.sort((a, b) => a - b);
      avgResponseTime = responseTimesSample.reduce((sum, time) => sum + time, 0) / responseTimesSample.length;
      p95ResponseTime = responseTimesSample[Math.floor(responseTimesSample.length * 0.95)];
      p99ResponseTime = responseTimesSample[Math.floor(responseTimesSample.length * 0.99)];
    }

    const sustainedResult = {
      duration: actualDuration,
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate,
      throughput,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      memoryIncrease,
      resourceReadings
    };

    this.results.phases.push({
      name: 'Sustained Load',
      results: sustainedResult
    });

    console.log(`    ✅ Operations: ${totalOperations} (${successfulOperations} successful, ${failedOperations} failed)`);
    console.log(`    📊 Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`    📈 Throughput: ${throughput.toFixed(1)} ops/sec`);
    console.log(`    ⏱️ Response Times - Avg: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime.toFixed(2)}ms, P99: ${p99ResponseTime.toFixed(2)}ms`);
    console.log(`    📊 Memory: +${memoryIncrease.toFixed(1)}MB`);

    console.log('✅ Sustained Load Test completed');
  }

  async runSpikeTest() {
    console.log('\n⚡ Running Spike Load Test...');
    
    const spikeUsers = 1800;
    console.log(`  📊 Sudden spike to ${spikeUsers} concurrent users`);
    
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();

    // Create spike operations - all start simultaneously
    const spikePromises = Array.from({ length: spikeUsers }, (_, i) => {
      const operationType = Math.random();
      
      if (operationType < 0.6) {
        // 60% - Read operations
        const userId = this.createdUserIds[i % this.createdUserIds.length];
        return this.makeRequest('GET', `/api/internal/users/${userId}`, null, {
          'x-internal-service': 'user-service-internal'
        });
      } else if (operationType < 0.8) {
        // 20% - Create operations
        return this.makeRequest('POST', '/api/internal/users', {
          name: `Spike User ${i}`,
          email: `spike-user-${i}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        }, {
          'x-internal-service': 'user-service-internal',
          'Content-Type': 'application/json'
        });
      } else if (operationType < 0.95) {
        // 15% - Update operations
        const userId = this.createdUserIds[i % this.createdUserIds.length];
        return this.makeRequest('PATCH', `/api/internal/users/${userId}/last-login`, null, {
          'x-internal-service': 'user-service-internal'
        });
      } else {
        // 5% - Health checks
        return this.makeRequest('GET', '/api/health');
      }
    });

    try {
      const responses = await Promise.all(spikePromises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const memoryAfter = process.memoryUsage();

      const successful = responses.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
      const failed = responses.filter(r => r.statusCode < 200 || r.statusCode >= 300).length;
      const successRate = successful / spikeUsers;
      const throughput = (successful / duration) * 1000;
      const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;

      const spikeResult = {
        spikeUsers,
        duration,
        successful,
        failed,
        successRate,
        throughput,
        memoryIncrease
      };

      this.results.phases.push({
        name: 'Spike Load',
        results: spikeResult
      });

      console.log(`    ✅ Success: ${successful}/${spikeUsers} (${(successRate * 100).toFixed(1)}%)`);
      console.log(`    ⏱️ Duration: ${duration.toFixed(2)}ms`);
      console.log(`    📈 Throughput: ${throughput.toFixed(1)} ops/sec`);
      console.log(`    📊 Memory: +${memoryIncrease.toFixed(1)}MB`);

    } catch (error) {
      console.error(`    ❌ Spike test failed:`, error.message);
      this.results.phases.push({
        name: 'Spike Load',
        results: { success: false, error: error.message }
      });
    }

    console.log('✅ Spike Load Test completed');
  }

  async runMemoryLeakTest() {
    console.log('\n🧠 Running Memory Leak Detection Test...');
    
    const iterations = 15;
    const operationsPerIteration = 300;
    const memoryReadings = [];

    for (let iteration = 1; iteration <= iterations; iteration++) {
      console.log(`  🔄 Iteration ${iteration}/${iterations}`);
      
      const iterationStartTime = performance.now();
      const memoryBefore = process.memoryUsage();

      // Perform operations
      const operations = Array.from({ length: operationsPerIteration }, (_, i) => {
        const operationType = Math.random();
        
        if (operationType < 0.4) {
          // 40% - Create operations
          return this.makeRequest('POST', '/api/internal/users', {
            name: `Memory Test User ${iteration}-${i}`,
            email: `memory-test-${iteration}-${i}-${Date.now()}@example.com`,
            password: '$2b$10$hashedPasswordFromAuthService',
            preferences: {
              language: ['en', 'es', 'fr'][i % 3],
              timezone: 'UTC',
              theme: ['light', 'dark'][i % 2],
              notifications: { email: true, push: false, sms: false },
              gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
            },
          }, {
            'x-internal-service': 'user-service-internal',
            'Content-Type': 'application/json'
          });
        } else if (operationType < 0.7) {
          // 30% - Read operations
          const userId = this.createdUserIds[Math.floor(Math.random() * this.createdUserIds.length)];
          return this.makeRequest('GET', `/api/internal/users/${userId}`, null, {
            'x-internal-service': 'user-service-internal'
          });
        } else {
          // 30% - Update operations
          const userId = this.createdUserIds[Math.floor(Math.random() * this.createdUserIds.length)];
          return this.makeRequest('PATCH', `/api/internal/users/${userId}/last-login`, null, {
            'x-internal-service': 'user-service-internal'
          });
        }
      });

      try {
        const responses = await Promise.all(operations);
        const successful = responses.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
        
        const iterationDuration = performance.now() - iterationStartTime;
        const memoryAfter = process.memoryUsage();
        
        const memoryReading = {
          iteration,
          duration: iterationDuration,
          successful,
          failed: operationsPerIteration - successful,
          memoryBefore: memoryBefore.heapUsed,
          memoryAfter: memoryAfter.heapUsed,
          memoryGrowth: memoryAfter.heapUsed - memoryBefore.heapUsed,
          rss: memoryAfter.rss
        };

        memoryReadings.push(memoryReading);

        console.log(`    ✅ ${successful}/${operationsPerIteration} operations in ${iterationDuration.toFixed(2)}ms`);
        console.log(`    📊 Memory: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB → ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB (+${Math.round(memoryReading.memoryGrowth / 1024 / 1024)}MB)`);

      } catch (error) {
        console.error(`    ❌ Iteration ${iteration} failed:`, error.message);
      }

      // Small delay between iterations
      await this.sleep(1000);
    }

    // Analyze memory leak patterns
    const initialMemory = memoryReadings[0].memoryBefore;
    const finalMemory = memoryReadings[memoryReadings.length - 1].memoryAfter;
    const totalGrowth = finalMemory - initialMemory;
    
    const growthTrend = memoryReadings.map(reading => reading.memoryGrowth);
    const averageGrowth = growthTrend.reduce((sum, growth) => sum + growth, 0) / growthTrend.length;
    const consistentGrowth = growthTrend.filter(growth => growth > 5 * 1024 * 1024).length; // > 5MB

    const memoryLeakResult = {
      iterations,
      initialMemory,
      finalMemory,
      totalGrowth,
      averageGrowth,
      consistentGrowthIterations: consistentGrowth,
      memoryReadings
    };

    this.results.phases.push({
      name: 'Memory Leak Detection',
      results: memoryLeakResult
    });

    console.log(`    📊 Total memory growth: ${Math.round(totalGrowth / 1024 / 1024)}MB`);
    console.log(`    📊 Average growth per iteration: ${Math.round(averageGrowth / 1024 / 1024)}MB`);
    console.log(`    📊 Iterations with significant growth: ${consistentGrowth}/${iterations}`);

    console.log('✅ Memory Leak Detection Test completed');
  }

  async createInitialTestData(count = 1000) {
    console.log(`📝 Creating ${count} initial test users...`);
    
    const initialUsers = Array.from({ length: count }, (_, i) => ({
      name: `Initial Test User ${i}`,
      email: `initial-test-${i}-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
      isActive: true,
    }));

    try {
      const response = await this.makeRequest('POST', '/api/batch/users/create', {
        users: initialUsers,
        options: { chunkSize: 200 }
      }, {
        'x-internal-service': 'user-service-internal',
        'Content-Type': 'application/json'
      });

      if (response.statusCode === 201) {
        const data = JSON.parse(response.body);
        this.createdUserIds = data.data.map(user => user.id);
        console.log(`✅ Created ${this.createdUserIds.length} initial test users`);
      } else {
        throw new Error(`Failed to create initial test data: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('❌ Failed to create initial test data:', error.message);
      throw error;
    }
  }

  async simulateUserOperation(userId, totalUsers) {
    const startTime = performance.now();
    
    try {
      const operationType = Math.random();
      let response;

      if (operationType < 0.5) {
        // 50% - Read operations
        const targetUserId = this.createdUserIds[userId % this.createdUserIds.length];
        response = await this.makeRequest('GET', `/api/internal/users/${targetUserId}`, null, {
          'x-internal-service': 'user-service-internal'
        });
      } else if (operationType < 0.7) {
        // 20% - Create operations
        response = await this.makeRequest('POST', '/api/internal/users', {
          name: `Concurrent User ${userId}`,
          email: `concurrent-${userId}-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        }, {
          'x-internal-service': 'user-service-internal',
          'Content-Type': 'application/json'
        });
      } else if (operationType < 0.9) {
        // 20% - Update operations
        const targetUserId = this.createdUserIds[userId % this.createdUserIds.length];
        response = await this.makeRequest('PATCH', `/api/internal/users/${targetUserId}/last-login`, null, {
          'x-internal-service': 'user-service-internal'
        });
      } else {
        // 10% - Health checks
        response = await this.makeRequest('GET', '/api/health');
      }

      const responseTime = performance.now() - startTime;
      
      return {
        userId,
        success: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
        responseTime,
        operationType: operationType < 0.5 ? 'read' : operationType < 0.7 ? 'create' : operationType < 0.9 ? 'update' : 'health'
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        userId,
        success: false,
        error: error.message,
        responseTime
      };
    }
  }

  makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'User-Agent': 'Advanced-Performance-Test/1.0',
          ...headers
        },
        timeout: 30000 // 30 second timeout
      };

      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }

      const req = httpModule.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async generateReport() {
    console.log('\n📊 Generating Performance Test Report...');
    
    const report = {
      testSuite: 'Advanced Performance Test',
      timestamp: new Date().toISOString(),
      configuration: {
        baseUrl: this.baseUrl,
        maxConcurrentUsers: this.maxConcurrentUsers,
        testDuration: this.testDuration,
      },
      summary: {
        totalPhases: this.results.phases.length,
        overallSuccess: this.results.phases.every(phase => 
          phase.results.success !== false && !phase.results.error
        ),
      },
      phases: this.results.phases,
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `advanced-performance-report-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Generate summary report
    const summaryFile = path.join(reportDir, `performance-summary-${timestamp}.txt`);
    const summaryContent = this.generateSummaryReport(report);
    fs.writeFileSync(summaryFile, summaryContent);

    console.log(`📄 Detailed report saved: ${reportFile}`);
    console.log(`📄 Summary report saved: ${summaryFile}`);
    
    // Print summary to console
    console.log('\n' + summaryContent);
  }

  generateSummaryReport(report) {
    let summary = '🚀 ADVANCED PERFORMANCE TEST SUMMARY\n';
    summary += '=' .repeat(50) + '\n\n';
    
    summary += `Test Date: ${report.timestamp}\n`;
    summary += `Target URL: ${report.configuration.baseUrl}\n`;
    summary += `Max Concurrent Users: ${report.configuration.maxConcurrentUsers}\n\n`;

    report.phases.forEach((phase, index) => {
      summary += `${index + 1}. ${phase.name.toUpperCase()}\n`;
      summary += '-'.repeat(30) + '\n';
      
      if (phase.results.error) {
        summary += `❌ FAILED: ${phase.results.error}\n\n`;
        return;
      }

      switch (phase.name) {
        case 'Batch Operations':
          phase.results.forEach(result => {
            if (result.success) {
              summary += `  📦 Batch Size ${result.batchSize}:\n`;
              summary += `     Create: ${result.createThroughput.toFixed(1)} users/sec\n`;
              summary += `     Lookup: ${result.lookupThroughput.toFixed(1)} lookups/sec\n`;
              summary += `     Update: ${result.updateThroughput.toFixed(1)} updates/sec\n`;
              summary += `     Memory: +${result.memoryIncrease.toFixed(1)}MB\n`;
            } else {
              summary += `  ❌ Batch Size ${result.batchSize}: ${result.error}\n`;
            }
          });
          break;

        case 'Concurrent Users':
          phase.results.forEach(result => {
            if (result.successRate !== undefined) {
              summary += `  👥 ${result.concurrentUsers} users:\n`;
              summary += `     Success Rate: ${(result.successRate * 100).toFixed(1)}%\n`;
              summary += `     Throughput: ${result.throughput.toFixed(1)} ops/sec\n`;
              summary += `     Response Time (P95): ${result.p95ResponseTime.toFixed(2)}ms\n`;
              summary += `     Memory: +${result.memoryIncrease.toFixed(1)}MB\n`;
            }
          });
          break;

        case 'Sustained Load':
          const r = phase.results;
          summary += `  ⏰ Duration: ${(r.duration / 1000).toFixed(1)}s\n`;
          summary += `  📊 Operations: ${r.totalOperations} (${(r.successRate * 100).toFixed(1)}% success)\n`;
          summary += `  📈 Throughput: ${r.throughput.toFixed(1)} ops/sec\n`;
          summary += `  ⏱️ Response Time (P95): ${r.p95ResponseTime.toFixed(2)}ms\n`;
          summary += `  📊 Memory: +${r.memoryIncrease.toFixed(1)}MB\n`;
          break;

        case 'Spike Load':
          const s = phase.results;
          summary += `  ⚡ ${s.spikeUsers} concurrent users\n`;
          summary += `  📊 Success Rate: ${(s.successRate * 100).toFixed(1)}%\n`;
          summary += `  📈 Throughput: ${s.throughput.toFixed(1)} ops/sec\n`;
          summary += `  ⏱️ Duration: ${s.duration.toFixed(2)}ms\n`;
          summary += `  📊 Memory: +${s.memoryIncrease.toFixed(1)}MB\n`;
          break;

        case 'Memory Leak Detection':
          const m = phase.results;
          summary += `  🧠 ${m.iterations} iterations\n`;
          summary += `  📊 Total Memory Growth: ${Math.round(m.totalGrowth / 1024 / 1024)}MB\n`;
          summary += `  📊 Average Growth/Iteration: ${Math.round(m.averageGrowth / 1024 / 1024)}MB\n`;
          summary += `  📊 Significant Growth Iterations: ${m.consistentGrowthIterations}/${m.iterations}\n`;
          break;
      }
      
      summary += '\n';
    });

    summary += 'RECOMMENDATIONS\n';
    summary += '-'.repeat(30) + '\n';
    report.recommendations.forEach((rec, index) => {
      summary += `${index + 1}. ${rec}\n`;
    });

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze batch operations
    const batchPhase = this.results.phases.find(p => p.name === 'Batch Operations');
    if (batchPhase) {
      const successfulBatches = batchPhase.results.filter(r => r.success);
      if (successfulBatches.length > 0) {
        const avgCreateThroughput = successfulBatches.reduce((sum, r) => sum + r.createThroughput, 0) / successfulBatches.length;
        if (avgCreateThroughput < 100) {
          recommendations.push('Consider optimizing batch creation operations - current throughput is below 100 users/sec');
        }
        
        const maxMemoryIncrease = Math.max(...successfulBatches.map(r => r.memoryIncrease));
        if (maxMemoryIncrease > 200) {
          recommendations.push('High memory usage detected during batch operations - consider implementing streaming or chunking');
        }
      }
    }

    // Analyze concurrent users
    const concurrentPhase = this.results.phases.find(p => p.name === 'Concurrent Users');
    if (concurrentPhase) {
      const results = concurrentPhase.results.filter(r => r.successRate !== undefined);
      if (results.length > 0) {
        const worstSuccessRate = Math.min(...results.map(r => r.successRate));
        if (worstSuccessRate < 0.95) {
          recommendations.push('Success rate drops below 95% under high concurrent load - consider scaling or optimization');
        }
        
        const worstP95 = Math.max(...results.map(r => r.p95ResponseTime));
        if (worstP95 > 1000) {
          recommendations.push('P95 response time exceeds 1 second under load - performance optimization needed');
        }
      }
    }

    // Analyze memory leaks
    const memoryPhase = this.results.phases.find(p => p.name === 'Memory Leak Detection');
    if (memoryPhase && memoryPhase.results) {
      const m = memoryPhase.results;
      if (m.totalGrowth > 100 * 1024 * 1024) { // 100MB
        recommendations.push('Potential memory leak detected - total growth exceeds 100MB');
      }
      
      if (m.consistentGrowthIterations / m.iterations > 0.5) {
        recommendations.push('Consistent memory growth pattern detected - investigate for memory leaks');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance metrics are within acceptable ranges');
    }

    return recommendations;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const test = new AdvancedPerformanceTest({
    baseUrl: process.env.BASE_URL || 'http://localhost:3001',
    maxConcurrentUsers: parseInt(process.env.MAX_CONCURRENT_USERS) || 1500,
    testDuration: parseInt(process.env.TEST_DURATION) || 10 * 60 * 1000,
  });

  test.runComprehensiveTest().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = AdvancedPerformanceTest;