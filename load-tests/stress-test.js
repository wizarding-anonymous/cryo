import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Метрики для стресс-тестирования
const errorRate = new Rate('stress_errors');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const responseTime = new Trend('response_time');

// Конфигурация стресс-теста
export let options = {
  scenarios: {
    // Экстремальная нагрузка на аутентификацию
    extreme_auth_load: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 10000,
      stages: [
        { duration: '1m', target: 5000 },   // 5K RPS
        { duration: '2m', target: 10000 },  // 10K RPS
        { duration: '5m', target: 25000 },  // 25K RPS
        { duration: '10m', target: 50000 }, // 50K RPS - целевая нагрузка
        { duration: '5m', target: 75000 },  // 75K RPS - стресс
        { duration: '2m', target: 100000 }, // 100K RPS - экстремальный стресс
        { duration: '1m', target: 0 },
      ],
    },

    // Тест отказоустойчивости
    resilience_test: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 100,
      maxVUs: 1000,
    },

    // Тест graceful degradation
    degradation_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 1000 },
        { duration: '10m', target: 5000 },
        { duration: '15m', target: 10000 },
        { duration: '20m', target: 15000 }, // Превышение лимитов
        { duration: '10m', target: 20000 }, // Критическая нагрузка
        { duration: '5m', target: 0 },
      ],
    },
  },

  thresholds: {
    // Более строгие пороги для стресс-теста
    'http_req_duration': ['p(50)<100', 'p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:auth}': ['p(95)<200'],
    'stress_errors': ['rate<0.1'], // До 10% ошибок допустимо при стрессе
    'http_req_failed': ['rate<0.05'],
    'response_time': ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Пул пользователей для стресс-теста
const STRESS_USERS = [];
for (let i = 0; i < 10000; i++) {
  STRESS_USERS.push({
    email: `stressuser${i}@example.com`,
    password: 'StressTest123',
    username: `stressuser${i}`,
  });
}

export function setup() {
  console.log('Setting up stress test environment...');
  
  // Создаем базовых пользователей для теста
  const setupUsers = STRESS_USERS.slice(0, 1000);
  let created = 0;
  
  for (const user of setupUsers) {
    const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      username: user.username,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (registerResponse.status === 201) {
      created++;
    }
    
    if (created % 100 === 0) {
      console.log(`Created ${created} stress test users`);
    }
  }
  
  console.log(`Stress test setup complete. Created ${created} users.`);
  return { usersCreated: created };
}

export default function (data) {
  const startTime = Date.now();
  
  // Выбираем случайного пользователя
  const userIndex = Math.floor(Math.random() * STRESS_USERS.length);
  const user = STRESS_USERS[userIndex];
  
  // Основной стресс-тест: аутентификация
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'auth', test_type: 'stress' },
  });

  const endTime = Date.now();
  const duration = endTime - startTime;
  responseTime.add(duration);

  const loginSuccess = check(loginResponse, {
    'stress - login status ok': (r) => r.status === 201 || r.status === 429, // 429 = rate limited
    'stress - response time acceptable': () => duration < 2000, // 2s max под стрессом
  });

  if (loginSuccess) {
    successfulRequests.add(1);
    
    // Если аутентификация успешна, тестируем дополнительные эндпоинты
    if (loginResponse.status === 201 && loginResponse.json('accessToken')) {
      const token = loginResponse.json('accessToken');
      
      // Тест профиля под нагрузкой
      const profileResponse = http.get(`${BASE_URL}/users/profile`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tags: { endpoint: 'profile', test_type: 'stress' },
      });

      check(profileResponse, {
        'stress - profile accessible': (r) => r.status === 200 || r.status === 503, // 503 = service unavailable
      });

      // Случайные операции для имитации реального использования
      if (Math.random() < 0.1) {
        // Обновление профиля (10% запросов)
        http.put(`${BASE_URL}/users/profile`, JSON.stringify({
          displayName: `Stress User ${randomString(5)}`,
        }), {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          tags: { endpoint: 'profile_update', test_type: 'stress' },
        });
      }

      if (Math.random() < 0.05) {
        // Получение сессий (5% запросов)
        http.get(`${BASE_URL}/users/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { endpoint: 'sessions', test_type: 'stress' },
        });
      }
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }

  // Минимальная пауза для имитации реального поведения
  sleep(0.1);
}

export function teardown(data) {
  console.log('Stress test completed');
  console.log(`Successful requests: ${successfulRequests.count}`);
  console.log(`Failed requests: ${failedRequests.count}`);
  console.log(`Error rate: ${(failedRequests.count / (successfulRequests.count + failedRequests.count) * 100).toFixed(2)}%`);
}

// Специализированные тесты

export function authStressTest() {
  // Тест только аутентификации для определения максимальной пропускной способности
  const user = STRESS_USERS[Math.floor(Math.random() * STRESS_USERS.length)];
  
  const response = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'auth stress - status ok': (r) => r.status === 201 || r.status === 429,
  });
}

export function databaseStressTest() {
  // Тест нагрузки на базу данных через операции с профилем
  const user = STRESS_USERS[Math.floor(Math.random() * STRESS_USERS.length)];
  
  // Сначала аутентификация
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 201) {
    const token = loginResponse.json('accessToken');
    
    // Множественные операции с БД
    const operations = [
      () => http.get(`${BASE_URL}/users/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
      () => http.get(`${BASE_URL}/users/sessions`, { headers: { 'Authorization': `Bearer ${token}` } }),
      () => http.put(`${BASE_URL}/users/profile`, JSON.stringify({
        bio: `Updated at ${Date.now()}`,
      }), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
    ];

    // Выполняем случайную операцию
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const response = operation();
    
    check(response, {
      'db stress - operation successful': (r) => r.status < 500,
    });
  }
}

export function memoryStressTest() {
  // Тест нагрузки на память через создание множественных сессий
  const user = STRESS_USERS[Math.floor(Math.random() * STRESS_USERS.length)];
  
  // Создаем множественные сессии для одного пользователя
  for (let i = 0; i < 5; i++) {
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginResponse, {
      'memory stress - login successful': (r) => r.status === 201,
    });
  }
}