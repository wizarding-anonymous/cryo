import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 100 users over 2 minutes
    { duration: '2m', target: 100 },
    // Stay at 100 users for 5 minutes
    { duration: '5m', target: 100 },
    // Ramp up to 500 users over 2 minutes
    { duration: '2m', target: 500 },
    // Stay at 500 users for 5 minutes
    { duration: '5m', target: 500 },
    // Ramp up to 1000 users over 3 minutes
    { duration: '3m', target: 1000 },
    // Stay at 1000 users for 10 minutes (main load test)
    { duration: '10m', target: 1000 },
    // Ramp down to 0 users over 2 minutes
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // HTTP request duration should be below 200ms for 95% of requests
    http_req_duration: ['p(95)<200'],
    // Error rate should be below 1%
    errors: ['rate<0.01'],
    // HTTP request failure rate should be below 1%
    http_req_failed: ['rate<0.01'],
  },
};

// Base URL - can be overridden with environment variable
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Test data
const testUsers = [];
for (let i = 0; i < 1000; i++) {
  testUsers.push({
    email: `testuser${i}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${i}`,
  });
}

export function setup() {
  console.log('Starting load test setup...');
  
  // Health check
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Health check failed: ${healthResponse.status}`);
  }
  
  console.log('Service is healthy, starting load test...');
  return { baseUrl: BASE_URL };
}

export default function (data) {
  const userIndex = Math.floor(Math.random() * testUsers.length);
  const testUser = testUsers[userIndex];
  
  // Test scenario: Register -> Login -> Get Profile -> Update Profile
  
  // 1. Register user (30% of requests)
  if (Math.random() < 0.3) {
    registerUser(testUser);
  }
  
  // 2. Login user (40% of requests)
  if (Math.random() < 0.4) {
    const token = loginUser(testUser);
    if (token) {
      // 3. Get profile (20% of requests)
      if (Math.random() < 0.5) {
        getProfile(token);
      }
      
      // 4. Update profile (10% of requests)
      if (Math.random() < 0.25) {
        updateProfile(token);
      }
    }
  }
  
  // 5. Health check (10% of requests)
  if (Math.random() < 0.1) {
    healthCheck();
  }
  
  sleep(1); // Wait 1 second between iterations
}

function registerUser(user) {
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
    name: user.name,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = http.post(`${BASE_URL}/api/auth/register`, payload, params);
  
  const success = check(response, {
    'register status is 201': (r) => r.status === 201,
    'register response time < 200ms': (r) => r.timings.duration < 200,
    'register returns access_token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.access_token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  
  if (response.status === 201) {
    try {
      const body = JSON.parse(response.body);
      return body.access_token;
    } catch (e) {
      console.error('Failed to parse register response:', e);
    }
  }
  
  return null;
}

function loginUser(user) {
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  
  const success = check(response, {
    'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login response time < 200ms': (r) => r.timings.duration < 200,
    'login returns access_token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.access_token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  
  if (response.status === 200 || response.status === 201) {
    try {
      const body = JSON.parse(response.body);
      return body.access_token;
    } catch (e) {
      console.error('Failed to parse login response:', e);
    }
  }
  
  return null;
}

function getProfile(token) {
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };
  
  const response = http.get(`${BASE_URL}/api/users/profile`, params);
  
  const success = check(response, {
    'get profile status is 200': (r) => r.status === 200,
    'get profile response time < 200ms': (r) => r.timings.duration < 200,
    'get profile returns user data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined && body.email !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
}

function updateProfile(token) {
  const payload = JSON.stringify({
    name: `Updated User ${Math.floor(Math.random() * 1000)}`,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  
  const response = http.put(`${BASE_URL}/api/users/profile`, payload, params);
  
  const success = check(response, {
    'update profile status is 200': (r) => r.status === 200,
    'update profile response time < 200ms': (r) => r.timings.duration < 200,
    'update profile returns updated data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.name !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
}

function healthCheck() {
  const response = http.get(`${BASE_URL}/api/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
    'health check returns status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
}

export function teardown(data) {
  console.log('Load test completed');
}