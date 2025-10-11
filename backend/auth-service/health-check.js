#!/usr/bin/env node

/**
 * Health Check Script for Auth Service
 * 
 * This script is used by Docker health checks and can be run manually
 * to verify that all health endpoints are working correctly.
 */

const http = require('http');

const healthEndpoints = [
  '/api/health',
  '/api/health/ready', 
  '/api/health/live',
  '/api/health/redis',
  '/api/health/database'
];

async function checkEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3001,
      path: path,
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            path,
            status: res.statusCode,
            response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            path,
            status: res.statusCode,
            response: data,
            success: res.statusCode === 200,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        path,
        error: error.message,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        path,
        error: 'Request timeout',
        success: false
      });
    });

    req.end();
  });
}

async function runHealthChecks() {
  console.log('🔍 Running Auth Service Health Checks...\n');
  
  const results = [];
  
  for (const endpoint of healthEndpoints) {
    try {
      console.log(`Checking ${endpoint}...`);
      const result = await checkEndpoint(endpoint);
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
  
  if (successful === total) {
    console.log('\n🎉 All health checks passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some health checks failed!');
    
    // Show failed endpoints
    const failed = results.filter(r => !r.success);
    failed.forEach(result => {
      console.log(`\n❌ ${result.path}:`);
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

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Auth Service Health Check Script

Usage: node health-check.js [options]

Options:
  --help, -h     Show this help message
  --endpoint, -e Check specific endpoint (e.g., --endpoint /api/health/redis)

Environment Variables:
  PORT          Service port (default: 3001)

Examples:
  node health-check.js                    # Check all endpoints
  node health-check.js -e /api/health     # Check main health endpoint
  PORT=3002 node health-check.js          # Check service on port 3002
`);
  process.exit(0);
}

// Check specific endpoint if requested
const endpointIndex = process.argv.indexOf('--endpoint') || process.argv.indexOf('-e');
if (endpointIndex !== -1 && process.argv[endpointIndex + 1]) {
  const specificEndpoint = process.argv[endpointIndex + 1];
  console.log(`🔍 Checking specific endpoint: ${specificEndpoint}\n`);
  
  checkEndpoint(specificEndpoint)
    .then(result => {
      console.log(`Result: ${JSON.stringify(result, null, 2)}`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error(`Error: ${JSON.stringify(error, null, 2)}`);
      process.exit(1);
    });
} else {
  // Run all health checks
  runHealthChecks();
}