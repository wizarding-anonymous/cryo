#!/usr/bin/env node

/**
 * Performance Testing Script for Notification Service MVP
 * 
 * This script performs basic performance testing to ensure the service
 * meets MVP requirements: < 200ms response time, 1000 concurrent users
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 100,
  testDuration: parseInt(process.env.TEST_DURATION) || 30, // seconds
  maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME) || 200, // ms
  endpoints: [
    { path: '/health', method: 'GET' },
    { path: '/api/notifications/user/test-user-123', method: 'GET' },
    { path: '/api/notifications', method: 'POST', body: {
      userId: 'test-user-123',
      type: 'system',
      title: 'Test Notification',
      message: 'Performance test notification',
      priority: 'normal',
      channels: ['in_app']
    }}
  ]
};

class PerformanceTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  async runTest() {
    console.log('🚀 Starting Performance Test for Notification Service MVP');
    console.log(`📊 Configuration:`);
    console.log(`   Base URL: ${CONFIG.baseUrl}`);
    console.log(`   Concurrent Users: ${CONFIG.concurrentUsers}`);
    console.log(`   Test Duration: ${CONFIG.testDuration}s`);
    console.log(`   Max Response Time: ${CONFIG.maxResponseTime}ms`);
    console.log('');

    this.results.startTime = performance.now();

    // Run concurrent tests
    const promises = [];
    for (let i = 0; i < CONFIG.concurrentUsers; i++) {
      promises.push(this.runUserSimulation(i));
    }

    await Promise.all(promises);

    this.results.endTime = performance.now();
    this.generateReport();
  }

  async runUserSimulation(userId) {
    const endTime = Date.now() + (CONFIG.testDuration * 1000);
    
    while (Date.now() < endTime) {
      for (const endpoint of CONFIG.endpoints) {
        try {
          await this.makeRequest(endpoint, userId);
          await this.sleep(Math.random() * 1000); // Random delay 0-1s
        } catch (error) {
          // Continue testing even if some requests fail
        }
      }
    }
  }

  async makeRequest(endpoint, userId) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      const url = new URL(endpoint.path, CONFIG.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `PerformanceTest-User-${userId}`
        }
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          this.results.totalRequests++;
          this.results.responseTimes.push(responseTime);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.results.successfulRequests++;
          } else {
            this.results.failedRequests++;
            this.results.errors.push({
              endpoint: endpoint.path,
              statusCode: res.statusCode,
              responseTime,
              userId
            });
          }

          resolve({
            statusCode: res.statusCode,
            responseTime,
            data
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        this.results.totalRequests++;
        this.results.failedRequests++;
        this.results.errors.push({
          endpoint: endpoint.path,
          error: error.message,
          responseTime,
          userId
        });

        reject(error);
      });

      // Send request body if provided
      if (endpoint.body) {
        req.write(JSON.stringify(endpoint.body));
      }

      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateReport() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
    const maxResponseTime = Math.max(...this.results.responseTimes);
    const minResponseTime = Math.min(...this.results.responseTimes);
    const p95ResponseTime = this.calculatePercentile(this.results.responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(this.results.responseTimes, 99);
    const requestsPerSecond = this.results.totalRequests / duration;
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;

    console.log('📈 Performance Test Results');
    console.log('=' .repeat(50));
    console.log(`⏱️  Test Duration: ${duration.toFixed(2)}s`);
    console.log(`📊 Total Requests: ${this.results.totalRequests}`);
    console.log(`✅ Successful Requests: ${this.results.successfulRequests}`);
    console.log(`❌ Failed Requests: ${this.results.failedRequests}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`🚀 Requests/Second: ${requestsPerSecond.toFixed(2)}`);
    console.log('');
    console.log('⏱️  Response Times:');
    console.log(`   Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Minimum: ${minResponseTime.toFixed(2)}ms`);
    console.log(`   Maximum: ${maxResponseTime.toFixed(2)}ms`);
    console.log(`   95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`   99th Percentile: ${p99ResponseTime.toFixed(2)}ms`);
    console.log('');

    // MVP Requirements Check
    console.log('🎯 MVP Requirements Check:');
    console.log(`   Response Time < ${CONFIG.maxResponseTime}ms: ${avgResponseTime < CONFIG.maxResponseTime ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Success Rate > 95%: ${successRate > 95 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Concurrent Users (${CONFIG.concurrentUsers}): ${CONFIG.concurrentUsers >= 100 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // Error Summary
    if (this.results.errors.length > 0) {
      console.log('❌ Error Summary:');
      const errorGroups = this.groupErrors();
      Object.entries(errorGroups).forEach(([key, errors]) => {
        console.log(`   ${key}: ${errors.length} occurrences`);
      });
      console.log('');
    }

    // Performance Recommendations
    this.generateRecommendations(avgResponseTime, successRate, requestsPerSecond);

    // Exit with appropriate code
    const testPassed = avgResponseTime < CONFIG.maxResponseTime && successRate > 95;
    process.exit(testPassed ? 0 : 1);
  }

  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  groupErrors() {
    const groups = {};
    this.results.errors.forEach(error => {
      const key = error.statusCode ? `HTTP ${error.statusCode}` : error.error;
      if (!groups[key]) groups[key] = [];
      groups[key].push(error);
    });
    return groups;
  }

  generateRecommendations(avgResponseTime, successRate, requestsPerSecond) {
    console.log('💡 Performance Recommendations:');
    
    if (avgResponseTime > CONFIG.maxResponseTime) {
      console.log('   ⚠️  Response time exceeds MVP requirement');
      console.log('      - Consider adding database indexes');
      console.log('      - Optimize Redis caching strategy');
      console.log('      - Review email service performance');
    }

    if (successRate < 95) {
      console.log('   ⚠️  Success rate below 95%');
      console.log('      - Check database connection pool settings');
      console.log('      - Review error handling and retry logic');
      console.log('      - Monitor external service dependencies');
    }

    if (requestsPerSecond < 50) {
      console.log('   ⚠️  Low throughput detected');
      console.log('      - Consider horizontal scaling');
      console.log('      - Optimize database queries');
      console.log('      - Review application bottlenecks');
    }

    if (avgResponseTime < CONFIG.maxResponseTime && successRate > 95) {
      console.log('   ✅ Performance meets MVP requirements');
      console.log('   🚀 Ready for production deployment');
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runTest().catch(error => {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTester;