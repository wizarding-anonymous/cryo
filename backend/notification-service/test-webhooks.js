const axios = require('axios');

const BASE_URL = 'http://localhost:3000/notifications/webhook';

// Test data
const testUserId = 'test-user-123';
const testGameId = 'test-game-456';
const testGameName = 'Test Game';

const tests = [
  {
    name: 'Payment Completed Webhook',
    url: `${BASE_URL}/payment/completed`,
    payload: {
      eventType: 'payment.completed',
      userId: testUserId,
      data: {
        paymentId: 'payment-123',
        gameId: testGameId,
        gameName: testGameName,
        amount: 1999.99,
        currency: 'RUB',
      },
    },
  },
  {
    name: 'Payment Failed Webhook',
    url: `${BASE_URL}/payment/failed`,
    payload: {
      eventType: 'payment.failed',
      userId: testUserId,
      data: {
        paymentId: 'payment-456',
        gameId: testGameId,
        gameName: testGameName,
        amount: 1999.99,
        currency: 'RUB',
        errorMessage: 'Insufficient funds',
      },
    },
  },
  {
    name: 'Friend Request Webhook',
    url: `${BASE_URL}/social/friend-request`,
    payload: {
      eventType: 'friend.request',
      userId: testUserId,
      data: {
        fromUserId: 'friend-user-123',
        fromUserName: 'John Doe',
      },
    },
  },
  {
    name: 'Achievement Unlocked Webhook',
    url: `${BASE_URL}/achievement/unlocked`,
    payload: {
      eventType: 'achievement.unlocked',
      userId: testUserId,
      data: {
        achievementId: 'achievement-123',
        achievementName: 'First Victory',
        achievementDescription: 'Win your first game',
        gameId: testGameId,
        gameName: testGameName,
        points: 100,
      },
    },
  },
  {
    name: 'Game Updated Webhook',
    url: `${BASE_URL}/game-catalog/updated`,
    payload: {
      eventType: 'game.updated',
      userId: testUserId,
      data: {
        gameId: testGameId,
        gameName: testGameName,
        updateType: 'patch',
        version: '2.1.0',
      },
    },
  },
  {
    name: 'Library Game Added Webhook',
    url: `${BASE_URL}/library/game-added`,
    payload: {
      eventType: 'library.game_added',
      userId: testUserId,
      data: {
        gameId: testGameId,
        gameName: testGameName,
        addedAt: '2024-01-01T10:00:00Z',
      },
    },
  },
];

async function runTests() {
  console.log('🚀 Testing Notification Service Webhook Endpoints\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const response = await axios.post(test.url, test.payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 202 && response.data.status === 'accepted') {
        console.log(`✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED (Status: ${response.status})`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED (${error.message})`);
      failed++;
    }
    
    console.log(''); // Empty line for readability
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All webhook endpoints are working correctly!');
  } else {
    console.log('\n⚠️  Some webhook endpoints need attention.');
    console.log('Make sure the notification service is running on http://localhost:3000');
  }
}

// Run the tests
runTests().catch(console.error);