const http = require('http');

const testEndpoint = (path, expectedStatus = 200) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: `/api${path}`,
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
          const result = {
            path,
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          };
          
          if (res.statusCode === expectedStatus) {
            console.log(`✅ ${path} - Status: ${res.statusCode}`);
            resolve(result);
          } else {
            console.log(`❌ ${path} - Expected: ${expectedStatus}, Got: ${res.statusCode}`);
            reject(new Error(`Unexpected status code: ${res.statusCode}`));
          }
        } catch (error) {
          console.log(`❌ ${path} - Parse error:`, error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${path} - Request error:`, error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.log(`❌ ${path} - Request timeout`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

async function testHealthEndpoints() {
  console.log('🔍 Testing Game Catalog Service Health Endpoints...\n');

  const endpoints = [
    '/v1/health',
    '/v1/health/ready',
    '/v1/health/live',
  ];

  try {
    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint);
      
      // Validate response structure
      if (result.body) {
        const requiredFields = ['status', 'details'];
        const missingFields = requiredFields.filter(field => !result.body.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
          console.log(`⚠️  ${endpoint} - Missing fields: ${missingFields.join(', ')}`);
        } else {
          console.log(`✅ ${endpoint} - Response structure valid`);
        }
        
        // Log key health indicators
        if (result.body.details) {
          const indicators = Object.keys(result.body.details);
          console.log(`   Health indicators: ${indicators.join(', ')}`);
        }
      }
      
      console.log(''); // Empty line for readability
    }

    // Test metrics endpoint
    console.log('🔍 Testing Metrics Endpoint...');
    try {
      const metricsResult = await testEndpoint('/metrics');
      if (metricsResult.body && typeof metricsResult.body === 'string') {
        const metricsCount = (metricsResult.body.match(/# HELP/g) || []).length;
        console.log(`✅ /metrics - Found ${metricsCount} metrics`);
      }
    } catch (error) {
      console.log('❌ /metrics - Failed:', error.message);
    }

    console.log('\n🎉 Health endpoint testing completed!');
    
  } catch (error) {
    console.error('\n💥 Health endpoint testing failed:', error.message);
    process.exit(1);
  }
}

// Check if service is running
const checkService = () => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/health',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      reject(false);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(false);
    });

    req.end();
  });
};

// Main execution
checkService()
  .then(() => {
    testHealthEndpoints();
  })
  .catch(() => {
    console.log('❌ Game Catalog Service is not running on port 3002');
    console.log('💡 Please start the service first with: npm run start:dev');
    process.exit(1);
  });