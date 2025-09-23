import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '10s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete within 500ms
    'http_req_failed': ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = 'http://localhost:3004/api'; // Assuming local docker-compose setup

export default function () {
  // --- Test User Library Endpoint ---
  const libraryRes = http.get(`${BASE_URL}/library/my`, {
    headers: {
      // In a real test, this token would be dynamically generated or from a pool
      'Authorization': 'Bearer fake-token-for-load-test',
    },
  });
  check(libraryRes, {
    'GET /library/my status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // --- Test Game Ownership Endpoint ---
  const gameId = 'some-game-id-to-test'; // A game that the test user owns
  const ownershipRes = http.get(`${BASE_URL}/library/ownership/${gameId}`, {
    headers: {
      'Authorization': 'Bearer fake-token-for-load-test',
    },
  });
  check(ownershipRes, {
    'GET /library/ownership/:gameId status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
