import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const loginAttempts = new Counter('login_attempts');
const registrationAttempts = new Counter('registration_attempts');
const profileUpdates = new Counter('profile_updates');
const authLatency = new Trend('auth_latency');

// Test scenarios
export let options = {
  scenarios: {
    // Базовый сценарий - постоянная нагрузка
    constant_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
    
    // Пиковая нагрузка - имитация наплыва пользователей
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '10m', target: 1000 },
        { duration: '5m', target: 2000 }, // Пиковая нагрузка
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
    },

    // Стресс-тестирование - проверка пределов
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 5000,
      stages: [
        { duration: '2m', target: 500 },   // 500 RPS
        { duration: '5m', target: 1000 },  // 1000 RPS
        { duration: '10m', target: 5000 }, // 5000 RPS
        { duration: '5m', target: 10000 }, // 10000 RPS - стресс
        { duration: '10m', target: 50000 }, // 50000 RPS - экстремальная нагрузка
        { duration: '2m', target: 0 },
      ],
    },
  },
  
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'http_req_duration{endpoint:auth}': ['p(95)<200'], // Аутентификация должна быть быстрой
    'http_req_duration{endpoint:profile}': ['p(95)<300'],
    'errors': ['rate<0.05'], // Менее 5% ошибок
    'auth_latency': ['p(95)<200'],
    'http_req_failed': ['rate<0.02'], // Менее 2% неудачных запросов
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Пул тестовых пользователей
const TEST_USERS = [];
for (let i = 0; i < 1000; i++) {
  TEST_USERS.push({
    email: `testuser${i}@example.com`,
    password: 'Password123',
    username: `testuser${i}`,
  });
}

export function setup() {
  console.log('Starting load test setup...');
  
  // Создаем тестовых пользователей (в реальности они должны быть предварительно созданы)
  const setupUsers = TEST_USERS.slice(0, 100);
  
  for (const user of setupUsers) {
    const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      username: user.username,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'register' },
    });
    
    if (registerResponse.status === 201) {
      console.log(`Created test user: ${user.email}`);
    }
  }
  
  return { users: setupUsers };
}

export default function (data) {
  const user = TEST_USERS[randomIntBetween(0, TEST_USERS.length - 1)];
  
  group('Authentication Flow', function () {
    // Тест аутентификации
    const loginStart = Date.now();
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth' },
    });
    
    const loginDuration = Date.now() - loginStart;
    authLatency.add(loginDuration);
    loginAttempts.add(1);

    const loginSuccess = check(loginResponse, {
      'login status is 201': (r) => r.status === 201,
      'login has access token': (r) => r.json('accessToken') !== undefined,
      'login response time < 500ms': () => loginDuration < 500,
    });

    if (!loginSuccess) {
      errorRate.add(1);
      return;
    }

    const token = loginResponse.json('accessToken');
    
    group('Authenticated Operations', function () {
      // Тест получения профиля
      const profileResponse = http.get(`${BASE_URL}/users/profile`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tags: { endpoint: 'profile' },
      });

      check(profileResponse, {
        'profile status is 200': (r) => r.status === 200,
        'profile has user data': (r) => r.json('id') !== undefined,
      }) || errorRate.add(1);

      // Тест обновления профиля (случайно)
      if (Math.random() < 0.3) {
        const updateResponse = http.put(`${BASE_URL}/users/profile`, JSON.stringify({
          displayName: `Updated User ${randomString(5)}`,
          bio: `Updated bio ${randomString(20)}`,
        }), {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          tags: { endpoint: 'profile_update' },
        });

        check(updateResponse, {
          'profile update status is 200': (r) => r.status === 200,
        }) || errorRate.add(1);
        
        profileUpdates.add(1);
      }

      // Тест получения настроек (случайно)
      if (Math.random() < 0.2) {
        const settingsResponse = http.get(`${BASE_URL}/users/settings`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
          },
          tags: { endpoint: 'settings' },
        });

        check(settingsResponse, {
          'settings status is 200': (r) => r.status === 200,
        }) || errorRate.add(1);
      }

      // Тест сессий (случайно)
      if (Math.random() < 0.1) {
        const sessionsResponse = http.get(`${BASE_URL}/users/sessions`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
          },
          tags: { endpoint: 'sessions' },
        });

        check(sessionsResponse, {
          'sessions status is 200': (r) => r.status === 200,
        }) || errorRate.add(1);
      }
    });
  });

  // Тест регистрации новых пользователей (случайно)
  if (Math.random() < 0.05) {
    group('Registration Flow', function () {
      const newUser = {
        email: `newuser${randomString(10)}@example.com`,
        password: 'Password123',
        username: `newuser${randomString(8)}`,
      };

      const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify(newUser), {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'register' },
      });

      check(registerResponse, {
        'registration status is 201': (r) => r.status === 201,
        'registration returns user id': (r) => r.json('userId') !== undefined,
      }) || errorRate.add(1);
      
      registrationAttempts.add(1);
    });
  }

  // Тест восстановления пароля (случайно)
  if (Math.random() < 0.02) {
    group('Password Recovery', function () {
      const recoveryResponse = http.post(`${BASE_URL}/auth/forgot-password`, JSON.stringify({
        email: user.email,
      }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'password_recovery' },
      });

      check(recoveryResponse, {
        'password recovery status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
  }

  // Имитация реального поведения пользователей
  sleep(randomIntBetween(1, 3));
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total login attempts: ${loginAttempts.count}`);
  console.log(`Total registration attempts: ${registrationAttempts.count}`);
  console.log(`Total profile updates: ${profileUpdates.count}`);
}

// Дополнительные сценарии для специфических тестов

export function authOnlyTest() {
  // Тест только аутентификации для измерения максимальной пропускной способности
  const user = TEST_USERS[randomIntBetween(0, TEST_USERS.length - 1)];
  
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginResponse, {
    'auth only - login success': (r) => r.status === 201,
  });
}

export function profileOnlyTest() {
  // Тест только операций с профилем (предполагается что токен уже есть)
  const token = 'mock-jwt-token'; // В реальности нужен валидный токен
  
  const profileResponse = http.get(`${BASE_URL}/users/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(profileResponse, {
    'profile only - get success': (r) => r.status === 200,
  });
}
