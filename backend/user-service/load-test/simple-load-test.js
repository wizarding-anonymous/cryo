/**
 * Simple Load Test for User Service
 * This is a Node.js-based load test that doesn't require external tools
 * Tests 1000+ concurrent users using native Node.js capabilities
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3001',
  maxConcurrentUsers: 1000,
  testDurationMs: 10 * 60 * 1000, // 10 minutes
  rampUpTimeMs: 2 * 60 * 1000, // 2 minutes ramp up
  requestTimeoutMs: 5000,
  targetResponseTimeMs: 200,
  maxErrorRate: 0.01, // 1%
};

// Test statistics
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null,
  concurrentUsers: 0,
  maxConcurrentUsers: 0,
};

// Test scenarios
const scenarios = [
  { name: 'register', weight: 0.3, endpoint: '/api/auth/register', method: 'POST' },
  { name: 'login', weight: 0.4, endpoint: '/api/auth/login', method: 'POST' },
  { name: 'profile', weight: 0.2, endpoint: '/api/users/profile', method: 'GET' },
  { name: 'health', weight: 0.1, endpoint: '/api/health', method: 'GET' },
];

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[36m',
    SUCCESS: '\x1b[32m',
    WARNING: '\x1b[33m',
    ERROR: '\x1b[31m',
    RESET: '\x1b[0m'
  };
  
  console.log(`${colors[level]}[${timestamp}] ${level}: ${message}${colors.RESET}`);
}

function generateTestUser(index) {
  return {
    email: `testuser${index}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${index}`,
  };
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LoadTest/1.0',
        ...options.headers,
      },
      timeout: CONFIG.requestTimeoutMs,
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const startTime = Date.now();
    
    const req = client.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        let parsedData = null;
        try {
          if (responseData) {
            parsedData = JSON.parse(responseData);
          }
        } catch (e) {
          // Response is not JSON, that's okay
        }
        
        resolve({
          statusCode: res.statusCode,
          responseTime,
          data: parsedData,
          headers: res.headers,
        });
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      reject({
        error: error.message,
        responseTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      reject({
        error: 'Request timeout',
        responseTime,
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runScenario(scenarioName, userIndex, token = null) {
  const user = generateTestUser(userIndex);
  
  try {
    switch (scenarioName) {
      case 'register':
        return await makeRequest({
          url: `${CONFIG.baseUrl}/api/auth/register`,
          method: 'POST',
        }, user);
        
      case 'login':
        return await makeRequest({
          url: `${CONFIG.baseUrl}/api/auth/login`,
          method: 'POST',
        }, {
          email: user.email,
          password: user.password,
        });
        
      case 'profile':
        if (!token) {
          // First login to get token
          const loginResponse = await makeRequest({
            url: `${CONFIG.baseUrl}/api/auth/login`,
            method: 'POST',
          }, {
            email: user.email,
            password: user.password,
          });
          
          if (loginResponse.statusCode === 200 || loginResponse.statusCode === 201) {
            token = loginResponse.data?.access_token;
          }
        }
        
        return await makeRequest({
          url: `${CONFIG.baseUrl}/api/users/profile`,
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        
      case 'health':
        return await makeRequest({
          url: `${CONFIG.baseUrl}/api/health`,
          method: 'GET',
        });
        
      default:
        throw new Error(`Unknown scenario: ${scenarioName}`);
    }
  } catch (error) {
    throw error;
  }
}

function selectScenario() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const scenario of scenarios) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      return scenario.name;
    }
  }
  
  return scenarios[0].name; // Fallback
}

async function runUserSession(userIndex) {
  stats.concurrentUsers++;
  stats.maxConcurrentUsers = Math.max(stats.maxConcurrentUsers, stats.concurrentUsers);
  
  const sessionStartTime = Date.now();
  const sessionEndTime = sessionStartTime + CONFIG.testDurationMs;
  
  let token = null;
  
  while (Date.now() < sessionEndTime) {
    const scenarioName = selectScenario();
    
    try {
      stats.totalRequests++;
      
      const response = await runScenario(scenarioName, userIndex, token);
      
      // Update token if login was successful
      if (scenarioName === 'login' && (response.statusCode === 200 || response.statusCode === 201)) {
        token = response.data?.access_token;
      }
      
      // Record response time
      stats.responseTimes.push(response.responseTime);
      
      // Check if request was successful
      if (response.statusCode >= 200 && response.statusCode < 400) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
        stats.errors.push({
          scenario: scenarioName,
          statusCode: response.statusCode,
          responseTime: response.responseTime,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Brief pause between requests
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 900)); // 100-1000ms
      
    } catch (error) {
      stats.totalRequests++;
      stats.failedRequests++;
      stats.errors.push({
        scenario: scenarioName,
        error: error.error || error.message,
        responseTime: error.responseTime || 0,
        timestamp: new Date().toISOString(),
      });
      
      // Brief pause on error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  stats.concurrentUsers--;
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function generateReport() {
  const duration = (stats.endTime - stats.startTime) / 1000; // seconds
  const errorRate = stats.totalRequests > 0 ? stats.failedRequests / stats.totalRequests : 0;
  const avgResponseTime = stats.responseTimes.length > 0 
    ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length 
    : 0;
  
  const report = {
    summary: {
      testDuration: `${duration.toFixed(2)} seconds`,
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
      requestsPerSecond: (stats.totalRequests / duration).toFixed(2),
      maxConcurrentUsers: stats.maxConcurrentUsers,
    },
    performance: {
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      p50ResponseTime: `${calculatePercentile(stats.responseTimes, 50).toFixed(2)}ms`,
      p95ResponseTime: `${calculatePercentile(stats.responseTimes, 95).toFixed(2)}ms`,
      p99ResponseTime: `${calculatePercentile(stats.responseTimes, 99).toFixed(2)}ms`,
      maxResponseTime: `${Math.max(...stats.responseTimes, 0).toFixed(2)}ms`,
      minResponseTime: `${Math.min(...stats.responseTimes, 0).toFixed(2)}ms`,
    },
    requirements: {
      targetResponseTime: `< ${CONFIG.targetResponseTimeMs}ms`,
      actualP95ResponseTime: `${calculatePercentile(stats.responseTimes, 95).toFixed(2)}ms`,
      p95Passed: calculatePercentile(stats.responseTimes, 95) < CONFIG.targetResponseTimeMs,
      targetErrorRate: `< ${(CONFIG.maxErrorRate * 100).toFixed(1)}%`,
      actualErrorRate: `${(errorRate * 100).toFixed(2)}%`,
      errorRatePassed: errorRate < CONFIG.maxErrorRate,
      targetConcurrentUsers: `${CONFIG.maxConcurrentUsers}+`,
      actualMaxConcurrentUsers: stats.maxConcurrentUsers,
      concurrentUsersPassed: stats.maxConcurrentUsers >= CONFIG.maxConcurrentUsers,
    },
    errors: stats.errors.slice(0, 10), // Show first 10 errors
  };
  
  return report;
}

async function checkServiceHealth() {
  log('🔍 Checking service health...');
  
  try {
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}/api/health`,
      method: 'GET',
    });
    
    if (response.statusCode === 200) {
      log('✅ Service is healthy and ready for load testing', 'SUCCESS');
      return true;
    } else {
      log(`❌ Service health check failed with status: ${response.statusCode}`, 'ERROR');
      return false;
    }
  } catch (error) {
    log(`❌ Service health check failed: ${error.error || error.message}`, 'ERROR');
    return false;
  }
}

async function runLoadTest() {
  log('🚀 Starting User Service Load Test');
  log(`📊 Configuration: ${CONFIG.maxConcurrentUsers} users, ${CONFIG.testDurationMs / 1000}s duration`);
  log(`🎯 Target: ${CONFIG.baseUrl}`);
  
  // Check service health
  if (!(await checkServiceHealth())) {
    log('❌ Service is not healthy. Aborting load test.', 'ERROR');
    process.exit(1);
  }
  
  stats.startTime = Date.now();
  
  // Start users gradually (ramp up)
  const userPromises = [];
  const rampUpInterval = CONFIG.rampUpTimeMs / CONFIG.maxConcurrentUsers;
  
  log(`⏳ Ramping up ${CONFIG.maxConcurrentUsers} users over ${CONFIG.rampUpTimeMs / 1000}s...`);
  
  for (let i = 0; i < CONFIG.maxConcurrentUsers; i++) {
    setTimeout(() => {
      const userPromise = runUserSession(i);
      userPromises.push(userPromise);
      
      if ((i + 1) % 100 === 0) {
        log(`📈 Started ${i + 1} users...`);
      }
    }, i * rampUpInterval);
  }
  
  // Wait for all users to complete
  log('⏳ Load test in progress...');
  
  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const progress = Math.min(100, (elapsed / (CONFIG.testDurationMs / 1000)) * 100);
    log(`📊 Progress: ${progress.toFixed(1)}% | Requests: ${stats.totalRequests} | Active Users: ${stats.concurrentUsers}`);
  }, 30000); // Every 30 seconds
  
  await Promise.all(userPromises);
  clearInterval(progressInterval);
  
  stats.endTime = Date.now();
  
  log('✅ Load test completed', 'SUCCESS');
  
  // Generate and display report
  const report = generateReport();
  
  log('📊 Load Test Results:', 'SUCCESS');
  console.log('\n' + '='.repeat(50));
  console.log('LOAD TEST SUMMARY');
  console.log('='.repeat(50));
  
  console.log('\n📈 Test Summary:');
  Object.entries(report.summary).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  console.log('\n⚡ Performance Metrics:');
  Object.entries(report.performance).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  console.log('\n🎯 Requirements Check:');
  Object.entries(report.requirements).forEach(([key, value]) => {
    const icon = key.includes('Passed') ? (value ? '✅' : '❌') : '📋';
    console.log(`  ${icon} ${key}: ${value}`);
  });
  
  if (report.errors.length > 0) {
    console.log('\n❌ Sample Errors:');
    report.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.scenario}: ${error.error || `Status ${error.statusCode}`} (${error.responseTime}ms)`);
    });
  }
  
  // Save detailed report
  const resultsDir = './load-test-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(resultsDir, `load-test-report-${timestamp}.json`);
  
  fs.writeFileSync(reportFile, JSON.stringify({
    config: CONFIG,
    stats,
    report,
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  log(`📄 Detailed report saved to: ${reportFile}`, 'SUCCESS');
  
  // Determine if test passed
  const allRequirementsPassed = 
    report.requirements.p95Passed &&
    report.requirements.errorRatePassed &&
    report.requirements.concurrentUsersPassed;
  
  if (allRequirementsPassed) {
    log('🎉 All performance requirements met! Service is production ready.', 'SUCCESS');
    process.exit(0);
  } else {
    log('⚠️  Some performance requirements not met. Review and optimize.', 'WARNING');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('⚠️  Load test interrupted by user', 'WARNING');
  if (stats.startTime) {
    stats.endTime = Date.now();
    const report = generateReport();
    console.log('\n📊 Partial Results:');
    console.log(JSON.stringify(report.summary, null, 2));
  }
  process.exit(1);
});

// Start the load test
if (require.main === module) {
  runLoadTest().catch((error) => {
    log(`❌ Load test failed: ${error.message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, CONFIG };