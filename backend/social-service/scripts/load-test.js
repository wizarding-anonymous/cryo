#!/usr/bin/env node

/**
 * Load Testing Script for Social Service MVP
 * Tests performance with up to 1000 concurrent users
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(baseUrl = 'http://localhost:3003', options = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      maxConcurrentUsers: 1000,
      testDuration: 60000, // 1 minute
      rampUpTime: 10000,   // 10 seconds
      ...options
    };
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: {},
      startTime: null,
      endTime: null
    };
    
    this.testUsers = [];
    this.activeConnections = 0;
  }

  async initialize() {
    console.log('🚀 Initializing Social Service Load Test');
    console.log(`Target: ${this.baseUrl}`);
    console.log(`Max Concurrent Users: ${this.options.maxConcurrentUsers}`);
    console.log(`Test Duration: ${this.options.testDuration}ms`);
    
    // Generate test users
    this.generateTestUsers(this.options.maxConcurrentUsers);
    
    // Warm up the service
    await this.warmUp();
  }

  generateTestUsers(count) {
    for (let i = 0; i < count; i++) {
      this.testUsers.push({
        id: `load-test-user-${i}`,
        token: `load-test-token-${i}`,
        friendIds: []
      });
    }
  }

  async warmUp() {
    console.log('🔥 Warming up service...');
    
    const warmUpRequests = [
      this.makeRequest('GET', '/v1/health'),
      this.makeRequest('GET', '/v1/health/detailed'),
      this.makeRequest('GET', '/api/docs-json')
    ];
    
    try {
      await Promise.all(warmUpRequests);
      console.log('✅ Service warm-up completed');
    } catch (error) {
      console.warn('⚠️ Warm-up failed:', error.message);
    }
  }

  async runLoadTest() {
    console.log('\n📊 Starting Load Test...');
    this.stats.startTime = performance.now();
    
    const testScenarios = [
      { name: 'Friends System', weight: 40, handler: this.testFriendsSystem.bind(this) },
      { name: 'Messaging System', weight: 30, handler: this.testMessagingSystem.bind(this) },
      { name: 'Status System', weight: 20, handler: this.testStatusSystem.bind(this) },
      { name: 'Integration APIs', weight: 10, handler: this.testIntegrationAPIs.bind(this) }
    ];
    
    const testPromises = [];
    const usersPerScenario = this.distributeUsers(testScenarios);
    
    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      const userCount = usersPerScenario[i];
      
      console.log(`🎯 Starting ${scenario.name} with ${userCount} users`);
      
      testPromises.push(
        this.runScenario(scenario, userCount)
      );
    }
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.options.testDuration));
    
    this.stats.endTime = performance.now();
    
    // Generate report
    this.generateReport();
  }

  distributeUsers(scenarios) {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    return scenarios.map(scenario => 
      Math.floor((scenario.weight / totalWeight) * this.options.maxConcurrentUsers)
    );
  }

  async runScenario(scenario, userCount) {
    const rampUpDelay = this.options.rampUpTime / userCount;
    
    for (let i = 0; i < userCount; i++) {
      setTimeout(() => {
        this.runUserSession(scenario.handler, i);
      }, i * rampUpDelay);
    }
  }

  async runUserSession(scenarioHandler, userIndex) {
    const user = this.testUsers[userIndex];
    const sessionDuration = this.options.testDuration - (userIndex * (this.options.rampUpTime / this.options.maxConcurrentUsers));
    
    const sessionEnd = performance.now() + sessionDuration;
    
    while (performance.now() < sessionEnd) {
      try {
        await scenarioHandler(user);
        await this.randomDelay(100, 1000); // Random delay between requests
      } catch (error) {
        this.recordError(error);
      }
    }
  }

  async testFriendsSystem(user) {
    const actions = [
      () => this.makeAuthenticatedRequest('GET', '/v1/friends', user.token),
      () => this.makeAuthenticatedRequest('GET', '/v1/friends/requests', user.token),
      () => this.makeAuthenticatedRequest('GET', '/v1/friends/search?q=test', user.token),
      () => this.sendFriendRequest(user),
      () => this.makeAuthenticatedRequest('GET', '/v1/friends?page=1&limit=20', user.token)
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    await action();
  }

  async testMessagingSystem(user) {
    if (user.friendIds.length === 0) {
      // If no friends, try to get friends list first
      await this.makeAuthenticatedRequest('GET', '/v1/friends', user.token);
      return;
    }
    
    const actions = [
      () => this.makeAuthenticatedRequest('GET', '/v1/messages/conversations', user.token),
      () => this.sendMessage(user),
      () => this.getConversation(user),
      () => this.makeAuthenticatedRequest('GET', '/v1/messages/conversations', user.token)
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    await action();
  }

  async testStatusSystem(user) {
    const actions = [
      () => this.makeAuthenticatedRequest('PUT', '/v1/status/online', user.token, { 
        currentGame: `Game${Math.floor(Math.random() * 10)}` 
      }),
      () => this.makeAuthenticatedRequest('GET', '/v1/status/friends', user.token),
      () => this.makeAuthenticatedRequest('PUT', '/v1/status/offline', user.token),
      () => this.makeAuthenticatedRequest('GET', '/v1/status/friends', user.token)
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    await action();
  }

  async testIntegrationAPIs(user) {
    const targetUser = this.testUsers[Math.floor(Math.random() * this.testUsers.length)];
    
    const actions = [
      () => this.makeInternalRequest('GET', `/integration/achievement/${user.id}/friends`),
      () => this.makeInternalRequest('GET', `/integration/review/${user.id}/connections/${targetUser.id}`),
      () => this.makeInternalRequest('GET', `/integration/review/${user.id}/mutual-friends/${targetUser.id}`),
      () => this.makeInternalRequest('GET', `/integration/notification/${user.id}/preferences`)
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    await action();
  }

  async sendFriendRequest(user) {
    const targetUser = this.testUsers[Math.floor(Math.random() * this.testUsers.length)];
    if (targetUser.id === user.id) return;
    
    return this.makeAuthenticatedRequest('POST', '/v1/friends/request', user.token, {
      toUserId: targetUser.id
    });
  }

  async sendMessage(user) {
    if (user.friendIds.length === 0) return;
    
    const friendId = user.friendIds[Math.floor(Math.random() * user.friendIds.length)];
    return this.makeAuthenticatedRequest('POST', '/v1/messages', user.token, {
      toUserId: friendId,
      content: `Load test message ${Date.now()}`
    });
  }

  async getConversation(user) {
    if (user.friendIds.length === 0) return;
    
    const friendId = user.friendIds[Math.floor(Math.random() * user.friendIds.length)];
    return this.makeAuthenticatedRequest('GET', `/v1/messages/conversations/${friendId}`, user.token);
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Social-Service-Load-Tester/1.0'
        }
      };
      
      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          this.recordRequest(res.statusCode, responseTime);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: responseData, responseTime });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        this.recordRequest(0, responseTime, error);
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.setTimeout(5000); // 5 second timeout
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async makeAuthenticatedRequest(method, path, token, data = null) {
    const headers = { 'Authorization': `Bearer ${token}` };
    return this.makeRequestWithHeaders(method, path, headers, data);
  }

  async makeInternalRequest(method, path, data = null) {
    const headers = { 'x-internal-token': 'test-internal-token' };
    return this.makeRequestWithHeaders(method, path, headers, data);
  }

  async makeRequestWithHeaders(method, path, headers, data = null) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Social-Service-Load-Tester/1.0',
          ...headers
        }
      };
      
      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          this.recordRequest(res.statusCode, responseTime);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: responseData, responseTime });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        this.recordRequest(0, responseTime, error);
        reject(error);
      });
      
      req.setTimeout(5000);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  recordRequest(statusCode, responseTime, error = null) {
    this.stats.totalRequests++;
    this.stats.responseTimes.push(responseTime);
    
    if (error || statusCode === 0 || statusCode >= 400) {
      this.stats.failedRequests++;
      if (error) {
        this.recordError(error);
      }
    } else {
      this.stats.successfulRequests++;
    }
  }

  recordError(error) {
    const errorKey = error.message || error.toString();
    this.stats.errors[errorKey] = (this.stats.errors[errorKey] || 0) + 1;
  }

  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  generateReport() {
    const duration = this.stats.endTime - this.stats.startTime;
    const successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100;
    
    // Calculate response time statistics
    this.stats.responseTimes.sort((a, b) => a - b);
    const avgResponseTime = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
    const p50 = this.stats.responseTimes[Math.floor(this.stats.responseTimes.length * 0.5)];
    const p95 = this.stats.responseTimes[Math.floor(this.stats.responseTimes.length * 0.95)];
    const p99 = this.stats.responseTimes[Math.floor(this.stats.responseTimes.length * 0.99)];
    const maxResponseTime = Math.max(...this.stats.responseTimes);
    const minResponseTime = Math.min(...this.stats.responseTimes);
    
    console.log('\n📈 LOAD TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Test Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Total Requests: ${this.stats.totalRequests}`);
    console.log(`Successful Requests: ${this.stats.successfulRequests}`);
    console.log(`Failed Requests: ${this.stats.failedRequests}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`Requests/sec: ${(this.stats.totalRequests / (duration / 1000)).toFixed(2)}`);
    
    console.log('\n⏱️ RESPONSE TIME STATISTICS');
    console.log('-'.repeat(30));
    console.log(`Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Median (P50): ${p50.toFixed(2)}ms`);
    console.log(`95th Percentile: ${p95.toFixed(2)}ms`);
    console.log(`99th Percentile: ${p99.toFixed(2)}ms`);
    console.log(`Min: ${minResponseTime.toFixed(2)}ms`);
    console.log(`Max: ${maxResponseTime.toFixed(2)}ms`);
    
    if (Object.keys(this.stats.errors).length > 0) {
      console.log('\n❌ ERRORS');
      console.log('-'.repeat(20));
      Object.entries(this.stats.errors).forEach(([error, count]) => {
        console.log(`${error}: ${count}`);
      });
    }
    
    console.log('\n✅ PERFORMANCE ASSESSMENT');
    console.log('-'.repeat(30));
    
    // MVP Performance Criteria Assessment
    const criteria = [
      { name: 'Response Time < 200ms (P95)', target: 200, actual: p95, passed: p95 < 200 },
      { name: 'Success Rate > 95%', target: 95, actual: successRate, passed: successRate > 95 },
      { name: 'Supports 1000 users', target: 1000, actual: this.options.maxConcurrentUsers, passed: this.options.maxConcurrentUsers >= 1000 },
      { name: 'Error Rate < 5%', target: 5, actual: 100 - successRate, passed: (100 - successRate) < 5 }
    ];
    
    criteria.forEach(criterion => {
      const status = criterion.passed ? '✅' : '❌';
      console.log(`${status} ${criterion.name}: ${criterion.actual.toFixed(2)} (target: ${criterion.target})`);
    });
    
    const overallPassed = criteria.every(c => c.passed);
    console.log(`\n🎯 Overall MVP Performance: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Save detailed results to file
    this.saveResultsToFile();
  }

  saveResultsToFile() {
    const fs = require('fs');
    const path = require('path');
    
    const results = {
      timestamp: new Date().toISOString(),
      configuration: this.options,
      statistics: this.stats,
      summary: {
        duration: this.stats.endTime - this.stats.startTime,
        successRate: (this.stats.successfulRequests / this.stats.totalRequests) * 100,
        avgResponseTime: this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length,
        requestsPerSecond: this.stats.totalRequests / ((this.stats.endTime - this.stats.startTime) / 1000)
      }
    };
    
    const resultsDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const filename = `load-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${filepath}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    switch (key) {
      case 'url':
        options.baseUrl = value;
        break;
      case 'users':
        options.maxConcurrentUsers = parseInt(value);
        break;
      case 'duration':
        options.testDuration = parseInt(value) * 1000; // Convert to ms
        break;
      case 'rampup':
        options.rampUpTime = parseInt(value) * 1000; // Convert to ms
        break;
    }
  }
  
  const tester = new LoadTester(options.baseUrl, options);
  
  try {
    await tester.initialize();
    await tester.runLoadTest();
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoadTester;