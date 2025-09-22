const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3004';
    this.totalUsers = options.totalUsers || 1000;
    this.rampUpTime = options.rampUpTime || 60; // seconds
    this.testDuration = options.testDuration || 300; // seconds
    this.endpoints = options.endpoints || [
      { path: '/api/v1/health', method: 'GET', weight: 10 },
      { path: '/api/v1/reviews', method: 'GET', weight: 40 },
      { path: '/api/v1/reviews/game/test-game-1', method: 'GET', weight: 30 },
      { path: '/api/v1/ratings/game/test-game-1', method: 'GET', weight: 20 },
    ];
    
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: {},
      startTime: null,
      endTime: null,
    };
    
    this.activeUsers = 0;
    this.isRunning = false;
  }

  async runLoadTest() {
    console.log(`🚀 Starting load test with ${this.totalUsers} users`);
    console.log(`📈 Ramp-up time: ${this.rampUpTime}s`);
    console.log(`⏱️  Test duration: ${this.testDuration}s`);
    console.log(`🎯 Target URL: ${this.baseUrl}`);
    console.log('');

    this.results.startTime = performance.now();
    this.isRunning = true;

    // Start ramping up users
    const userInterval = (this.rampUpTime * 1000) / this.totalUsers;
    
    for (let i = 0; i < this.totalUsers; i++) {
      setTimeout(() => {
        if (this.isRunning) {
          this.startUser(i + 1);
        }
      }, i * userInterval);
    }

    // Stop test after duration
    setTimeout(() => {
      this.stopTest();
    }, (this.rampUpTime + this.testDuration) * 1000);

    // Print progress every 10 seconds
    const progressInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(progressInterval);
        return;
      }
      this.printProgress();
    }, 10000);
  }

  startUser(userId) {
    this.activeUsers++;
    this.simulateUser(userId);
  }

  async simulateUser(userId) {
    while (this.isRunning) {
      try {
        const endpoint = this.selectRandomEndpoint();
        const startTime = performance.now();
        
        await this.makeRequest(endpoint);
        
        const responseTime = performance.now() - startTime;
        this.recordSuccess(responseTime);
        
        // Random think time between requests (1-5 seconds)
        const thinkTime = Math.random() * 4000 + 1000;
        await this.sleep(thinkTime);
        
      } catch (error) {
        this.recordError(error);
        await this.sleep(1000); // Wait before retry
      }
    }
    this.activeUsers--;
  }

  selectRandomEndpoint() {
    const totalWeight = this.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of this.endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }
    
    return this.endpoints[0]; // fallback
  }

  makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint.path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: endpoint.method,
        headers: {
          'User-Agent': 'LoadTester/1.0',
          'Accept': 'application/json',
          'Connection': 'keep-alive',
        },
        timeout: 10000,
      };

      // Add sample data for POST requests
      let postData = '';
      if (endpoint.method === 'POST') {
        if (endpoint.path.includes('/reviews')) {
          postData = JSON.stringify({
            gameId: `test-game-${Math.floor(Math.random() * 100) + 1}`,
            rating: Math.floor(Math.random() * 5) + 1,
            comment: `Load test review ${Date.now()}`,
          });
          options.headers['Content-Type'] = 'application/json';
          options.headers['Content-Length'] = Buffer.byteLength(postData);
        }
      }

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  recordSuccess(responseTime) {
    this.results.totalRequests++;
    this.results.successfulRequests++;
    this.results.responseTimes.push(responseTime);
  }

  recordError(error) {
    this.results.totalRequests++;
    this.results.failedRequests++;
    
    const errorType = error.code || error.message || 'Unknown';
    this.results.errors[errorType] = (this.results.errors[errorType] || 0) + 1;
  }

  printProgress() {
    const elapsed = (performance.now() - this.results.startTime) / 1000;
    const rps = this.results.totalRequests / elapsed;
    const successRate = (this.results.successfulRequests / this.results.totalRequests * 100) || 0;
    
    console.log(`⏱️  ${elapsed.toFixed(0)}s | 👥 ${this.activeUsers} users | 📊 ${this.results.totalRequests} reqs | 📈 ${rps.toFixed(1)} RPS | ✅ ${successRate.toFixed(1)}%`);
  }

  stopTest() {
    console.log('\n🛑 Stopping load test...');
    this.isRunning = false;
    this.results.endTime = performance.now();
    
    // Wait for active users to finish
    setTimeout(() => {
      this.printFinalResults();
    }, 5000);
  }

  printFinalResults() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const avgRps = this.results.totalRequests / duration;
    const successRate = (this.results.successfulRequests / this.results.totalRequests * 100) || 0;
    
    // Calculate response time statistics
    const sortedTimes = this.results.responseTimes.sort((a, b) => a - b);
    const avgResponseTime = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length || 0;
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
    const maxResponseTime = sortedTimes[sortedTimes.length - 1] || 0;

    console.log('\n📊 LOAD TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
    console.log(`👥 Target Users: ${this.totalUsers}`);
    console.log(`📊 Total Requests: ${this.results.totalRequests}`);
    console.log(`✅ Successful: ${this.results.successfulRequests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${this.results.failedRequests} (${(100 - successRate).toFixed(1)}%)`);
    console.log(`📈 Average RPS: ${avgRps.toFixed(1)}`);
    console.log('');
    console.log('📊 RESPONSE TIMES (ms)');
    console.log('-'.repeat(30));
    console.log(`Average: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`50th percentile: ${p50.toFixed(1)}ms`);
    console.log(`95th percentile: ${p95.toFixed(1)}ms`);
    console.log(`99th percentile: ${p99.toFixed(1)}ms`);
    console.log(`Maximum: ${maxResponseTime.toFixed(1)}ms`);
    
    if (Object.keys(this.results.errors).length > 0) {
      console.log('');
      console.log('❌ ERRORS');
      console.log('-'.repeat(20));
      Object.entries(this.results.errors).forEach(([error, count]) => {
        console.log(`${error}: ${count}`);
      });
    }

    console.log('');
    console.log('🎯 PERFORMANCE ASSESSMENT');
    console.log('-'.repeat(30));
    
    if (successRate >= 99.5) {
      console.log('✅ Excellent: Success rate > 99.5%');
    } else if (successRate >= 99) {
      console.log('✅ Good: Success rate > 99%');
    } else if (successRate >= 95) {
      console.log('⚠️  Acceptable: Success rate > 95%');
    } else {
      console.log('❌ Poor: Success rate < 95%');
    }

    if (p95 < 100) {
      console.log('✅ Excellent: 95th percentile < 100ms');
    } else if (p95 < 500) {
      console.log('✅ Good: 95th percentile < 500ms');
    } else if (p95 < 1000) {
      console.log('⚠️  Acceptable: 95th percentile < 1000ms');
    } else {
      console.log('❌ Poor: 95th percentile > 1000ms');
    }

    if (avgRps >= 100) {
      console.log('✅ Excellent: Average RPS > 100');
    } else if (avgRps >= 50) {
      console.log('✅ Good: Average RPS > 50');
    } else if (avgRps >= 20) {
      console.log('⚠️  Acceptable: Average RPS > 20');
    } else {
      console.log('❌ Poor: Average RPS < 20');
    }

    process.exit(0);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'users') options.totalUsers = parseInt(value);
    if (key === 'url') options.baseUrl = value;
    if (key === 'rampup') options.rampUpTime = parseInt(value);
    if (key === 'duration') options.testDuration = parseInt(value);
  }

  const tester = new LoadTester(options);
  tester.runLoadTest().catch(console.error);
}

module.exports = LoadTester;