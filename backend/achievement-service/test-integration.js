// Simple integration test script to verify MVP service integration
const http = require('http');

// Test data
const testUserId = '123e4567-e89b-12d3-a456-426614174000';
const testGameId = '123e4567-e89b-12d3-a456-426614174001';
const testReviewId = '123e4567-e89b-12d3-a456-426614174002';
const testFriendId = '123e4567-e89b-12d3-a456-426614174003';

// Helper function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test cases
const tests = [
  {
    name: 'Payment Purchase Webhook',
    options: {
      hostname: 'localhost',
      port: 3003,
      path: '/integration/payment/purchase',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    data: {
      userId: testUserId,
      gameId: testGameId,
      transactionId: 'tx-123',
      amount: 1999,
      currency: 'RUB',
      timestamp: new Date().toISOString(),
    },
  },
  {
    name: 'Review Created Webhook',
    options: {
      hostname: 'localhost',
      port: 3003,
      path: '/integration/review/created',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    data: {
      userId: testUserId,
      reviewId: testReviewId,
      gameId: testGameId,
      rating: 5,
      timestamp: new Date().toISOString(),
    },
  },
  {
    name: 'Social Friend Added Webhook',
    options: {
      hostname: 'localhost',
      port: 3003,
      path: '/integration/social/friend',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    data: {
      userId: testUserId,
      friendId: testFriendId,
      eventType: 'friend_added',
      timestamp: new Date().toISOString(),
    },
  },
  {
    name: 'Library Update Webhook',
    options: {
      hostname: 'localhost',
      port: 3003,
      path: '/integration/library/update',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    data: {
      userId: testUserId,
      gameId: testGameId,
      action: 'added',
      timestamp: new Date().toISOString(),
    },
  },
  {
    name: 'Integration Health Check',
    options: {
      hostname: 'localhost',
      port: 3003,
      path: '/integration/health',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    data: {},
  },
];

// Run tests
async function runTests() {
  console.log('🚀 Starting MVP Integration Tests...\n');

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const result = await makeRequest(test.options, test.data);
      
      if (result.status === 200) {
        console.log('✅ PASS:', result.data);
      } else {
        console.log('❌ FAIL:', result.status, result.data);
      }
    } catch (error) {
      console.log('❌ ERROR:', error.message);
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('🏁 Integration tests completed!');
}

// Check if server is running first
const healthCheck = {
  hostname: 'localhost',
  port: 3003,
  path: '/health',
  method: 'GET',
};

makeRequest(healthCheck)
  .then((result) => {
    if (result.status === 200) {
      console.log('✅ Achievement Service is running');
      runTests();
    } else {
      console.log('❌ Achievement Service is not running. Please start the service first.');
      console.log('Run: npm run start:dev');
    }
  })
  .catch((error) => {
    console.log('❌ Cannot connect to Achievement Service:', error.message);
    console.log('Please make sure the service is running on port 3003');
  });