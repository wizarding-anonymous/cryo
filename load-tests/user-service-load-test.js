import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp-up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 for peak load
    { duration: '2m', target: 0 },   // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'errors': ['rate<0.1'], // Error rate should be less than 10%
  },
};

const BASE_URL = 'http://localhost:3000'; // Target URL

export default function () {
  // Test authentication endpoint
  let loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'testuser@example.com', // Use a valid test user
    password: 'Password123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginResponse, {
    'login status is 201': (r) => r.status === 201,
  }) || errorRate.add(1);

  if (loginResponse.status === 201 && loginResponse.json('accessToken')) {
    const token = loginResponse.json('accessToken');

    // Test a protected profile endpoint
    let profileResponse = http.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(profileResponse, {
      'profile status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  sleep(1);
}
