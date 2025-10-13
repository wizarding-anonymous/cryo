#!/usr/bin/env node

/**
 * Enhanced Health Check Script for Auth Service
 * 
 * Optimized for Docker health checks and container orchestration.
 * Supports Kubernetes liveness and readiness probes.
 * 
 * Features:
 * - Fast health checks with configurable timeouts
 * - Support for specific endpoint checking
 * - Container orchestration optimized
 * - Minimal resource usage
 * - Proper exit codes for orchestrators
 */

const http = require('http');

// Health check configuration
const CONFIG = {
  port: process.env.PORT || 3001,
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 1,
  silent: process.env.HEALTH_CHECK_SILENT === 'true',
  
  // Health endpoints with priorities
  endpoints: {
    // Critical endpoints (must pass for container to be healthy)
    critical: [
      '/api/health/ready',  // Kubernetes readiness probe
      '/api/health/live'    // Kubernetes liveness probe
    ],
    
    // Standard endpoints
    standard: [
      '/api/health',
      '/api/health/redis',
      '/api/health/database'
    ],
    
    // Optional endpoints (failures won't fail health check)
    optional: []
  }
};

/**
 * Perform HTTP health check on a specific endpoint
 */
async function checkEndpoint(path, timeout = CONFIG.timeout) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: CONFIG.port,
      path: path,
      method: 'GET',
      timeout: timeout,
      headers: {
        'User-Agent': 'Docker-HealthCheck/1.0',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        
        try {
          const response = JSON.parse(data);
          resolve({
            path,
            status: res.statusCode,
            response,
            success,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          resolve({
            path,
            status: res.statusCode,
            response: data,
            success,
            parseError: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        path,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        path,
        error: 'Request timeout',
        success: false,
        timestamp: new Date().toISOString()
      });
    });

    req.end();
  });
}

/**
 * Check a single endpoint with retries
 */
async function checkEndpointWithRetries(path, retries = CONFIG.retries) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await checkEndpoint(path, CONFIG.timeout);
      if (result.success) {
        return result;
      }
      lastError = result;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        // Brief delay between retries
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  return lastError;
}

/**
 * Run health checks for container orchestration
 */
async function runContainerHealthCheck(endpoint = null) {
  const startTime = Date.now();
  
  try {
    if (endpoint) {
      // Check specific endpoint (used by Docker HEALTHCHECK)
      const result = await checkEndpointWithRetries(endpoint);
      
      if (!CONFIG.silent) {
        if (result.success) {
          console.log(`✅ ${endpoint} - OK (${result.status}) [${Date.now() - startTime}ms]`);
        } else {
          console.error(`❌ ${endpoint} - FAILED (${result.status || 'ERROR'}) [${Date.now() - startTime}ms]`);
          if (result.error) {
            console.error(`   Error: ${result.error}`);
          }
        }
      }
      
      process.exit(result.success ? 0 : 1);
    } else {
      // Check critical endpoints for overall health
      const criticalChecks = await Promise.allSettled(
        CONFIG.endpoints.critical.map(path => checkEndpointWithRetries(path))
      );
      
      const allCriticalPassed = criticalChecks.every(result => 
        result.status === 'fulfilled' && result.value.success
      );
      
      if (!CONFIG.silent) {
        const duration = Date.now() - startTime;
        if (allCriticalPassed) {
          console.log(`✅ Health check passed [${duration}ms]`);
        } else {
          console.error(`❌ Health check failed [${duration}ms]`);
          
          // Log failed critical checks
          criticalChecks.forEach((result, index) => {
            const endpoint = CONFIG.endpoints.critical[index];
            if (result.status === 'rejected' || !result.value.success) {
              const error = result.status === 'rejected' ? result.reason : result.value;
              console.error(`   ${endpoint}: ${error.error || error.status || 'FAILED'}`);
            }
          });
        }
      }
      
      process.exit(allCriticalPassed ? 0 : 1);
    }
  } catch (error) {
    if (!CONFIG.silent) {
      console.error(`❌ Health check error: ${error.message} [${Date.now() - startTime}ms]`);
    }
    process.exit(1);
  }
}

/**
 * Run comprehensive health checks (for manual use)
 */
async function runComprehensiveHealthCheck() {
  console.log('🔍 Running Auth Service Health Checks...\n');
  
  const allEndpoints = [
    ...CONFIG.endpoints.critical,
    ...CONFIG.endpoints.standard,
    ...CONFIG.endpoints.optional
  ];
  
  const results = [];
  
  for (const endpoint of allEndpoints) {
    try {
      console.log(`Checking ${endpoint}...`);
      const result = await checkEndpointWithRetries(endpoint);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${endpoint} - OK (${result.status})`);
      } else {
        console.log(`❌ ${endpoint} - FAILED (${result.status})`);
      }
    } catch (error) {
      results.push(error);
      console.log(`❌ ${endpoint} - ERROR: ${error.error}`);
    }
  }
  
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Total endpoints: ${total}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${total - successful}`);
  
  // Check critical endpoints
  const criticalResults = results.slice(0, CONFIG.endpoints.critical.length);
  const criticalPassed = criticalResults.filter(r => r.success).length;
  const criticalTotal = CONFIG.endpoints.critical.length;
  
  console.log(`Critical endpoints: ${criticalPassed}/${criticalTotal} passed`);
  
  if (criticalPassed === criticalTotal) {
    console.log('\n🎉 All critical health checks passed!');
    if (successful === total) {
      console.log('🎉 All health checks passed!');
    } else {
      console.log('⚠️  Some non-critical checks failed');
    }
    process.exit(0);
  } else {
    console.log('\n❌ Critical health checks failed!');
    
    // Show failed critical endpoints
    const failedCritical = criticalResults.filter(r => !r.success);
    failedCritical.forEach((result, index) => {
      const endpoint = CONFIG.endpoints.critical[index];
      console.log(`\n❌ ${endpoint}:`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.response && typeof result.response === 'object') {
        console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
      }
    });
    
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Auth Service Health Check Script

Usage: node health-check.js [options]

Options:
  --help, -h              Show this help message
  --endpoint, -e <path>   Check specific endpoint (optimized for Docker)
  --comprehensive, -c     Run comprehensive health check (all endpoints)
  --silent, -s           Silent mode (no output, exit codes only)

Environment Variables:
  PORT                    Service port (default: 3001)
  HEALTH_CHECK_TIMEOUT    Request timeout in ms (default: 5000)
  HEALTH_CHECK_RETRIES    Number of retries (default: 1)
  HEALTH_CHECK_SILENT     Silent mode (default: false)

Container Orchestration:
  Docker HEALTHCHECK:     node health-check.js --endpoint /api/health/ready
  Kubernetes Liveness:    node health-check.js --endpoint /api/health/live
  Kubernetes Readiness:   node health-check.js --endpoint /api/health/ready

Examples:
  node health-check.js                              # Quick critical checks
  node health-check.js -c                          # Comprehensive check
  node health-check.js -e /api/health/ready        # Specific endpoint
  node health-check.js -s -e /api/health/live      # Silent liveness check
`);
  process.exit(0);
}

// Handle silent mode
if (args.includes('--silent') || args.includes('-s')) {
  CONFIG.silent = true;
}

// Handle specific endpoint check
const endpointIndex = args.findIndex(arg => arg === '--endpoint' || arg === '-e');
if (endpointIndex !== -1 && args[endpointIndex + 1]) {
  const specificEndpoint = args[endpointIndex + 1];
  runContainerHealthCheck(specificEndpoint);
} else if (args.includes('--comprehensive') || args.includes('-c')) {
  // Run comprehensive health check
  runComprehensiveHealthCheck();
} else {
  // Default: run container health check (critical endpoints only)
  runContainerHealthCheck();
}