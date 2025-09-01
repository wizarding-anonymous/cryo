import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Кастомные метрики
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

// Конфигурация нагрузочного тестирования
export const options = {
  stages: [
    // Разогрев
    { duration: '2m', target: 100 },    // Разогрев до 100 пользователей за 2 минуты
    { duration: '5m', target: 1000 },   // Увеличение до 1000 пользователей за 5 минут
    { duration: '10m', target: 5000 },  // Увеличение до 5000 пользователей за 10 минут
    { duration: '15m', target: 10000 }, // Пиковая нагрузка 10000 пользователей на 15 минут
    { duration: '5m', target: 5000 },   // Снижение до 5000 пользователей
    { duration: '5m', target: 1000 },   // Снижение до 1000 пользователей
    { duration: '2m', target: 0 },      // Полная остановка
  ],
  thresholds: {
    // Требования к производительности
    http_req_duration: ['p(95)<500'], // 95% запросов должны выполняться менее чем за 500мс
    http_req_failed: ['rate<0.05'],   // Менее 5% ошибок
    errors: ['rate<0.05'],            // Менее 5% ошибок в кастомной метрике
    response_time: ['p(99)<1000'],    // 99% запросов менее 1 секунды
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Тестовые данные
const testUsers = [
  { email: 'user1@example.com', username: 'user1', password: 'Password123!' },
  { email: 'user2@example.com', username: 'user2', password: 'Password123!' },
  { email: 'user3@example.com', username: 'user3', password: 'Password123!' },
];

export default function () {
  const startTime = Date.now();
  
  // Выбираем случайный сценарий тестирования
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - Тестирование аутентификации
    testAuthentication();
  } else if (scenario < 0.7) {
    // 30% - Тестирование профилей
    testProfileOperations();
  } else if (scenario < 0.85) {
    // 15% - Тестирование системных эндпоинтов
    testSystemEndpoints();
  } else {
    // 15% - Тестирование интеграций
    testIntegrations();
  }
  
  // Записываем время выполнения
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  requestCount.add(1);
  
  // Небольшая пауза между запросами
  sleep(Math.random() * 2);
}

function testAuthentication() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  // Тест регистрации (имитация)
  const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    email: `test_${Date.now()}_${Math.random()}@example.com`,
    username: `user_${Date.now()}_${Math.random()}`,
    password: 'Password123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const registerSuccess = check(registerResponse, {
    'registration status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'registration response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  if (!registerSuccess) {
    errorRate.add(1);
  }
  
  // Тест входа (имитация)
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const loginSuccess = check(loginResponse, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (!loginSuccess) {
    errorRate.add(1);
  }
}

function testProfileOperations() {
  // Тест получения профиля
  const profileResponse = http.get(`${BASE_URL}/users/profile`, {
    headers: {
      'Authorization': 'Bearer fake-token-for-load-test',
    },
  });
  
  const profileSuccess = check(profileResponse, {
    'profile status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'profile response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  if (!profileSuccess) {
    errorRate.add(1);
  }
  
  // Тест обновления профиля
  const updateResponse = http.put(`${BASE_URL}/users/profile`, JSON.stringify({
    displayName: `User ${Date.now()}`,
    bio: 'Load test user',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer fake-token-for-load-test',
    },
  });
  
  const updateSuccess = check(updateResponse, {
    'update status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'update response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  if (!updateSuccess) {
    errorRate.add(1);
  }
}

function testSystemEndpoints() {
  // Тест health check
  const healthResponse = http.get(`${BASE_URL}/health`);
  
  const healthSuccess = check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
    'health response contains status': (r) => r.json('status') !== undefined,
  });
  
  if (!healthSuccess) {
    errorRate.add(1);
  }
  
  // Тест метрик
  const metricsResponse = http.get(`${BASE_URL}/metrics`);
  
  const metricsSuccess = check(metricsResponse, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics response time < 200ms': (r) => r.timings.duration < 200,
    'metrics response is not empty': (r) => r.body.length > 0,
  });
  
  if (!metricsSuccess) {
    errorRate.add(1);
  }
}

function testIntegrations() {
  // Тест мониторинга интеграций
  const integrationResponse = http.get(`${BASE_URL}/integration-monitoring/health`);
  
  const integrationSuccess = check(integrationResponse, {
    'integration status is 200': (r) => r.status === 200,
    'integration response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  if (!integrationSuccess) {
    errorRate.add(1);
  }
  
  // Тест репутации
  const reputationResponse = http.get(`${BASE_URL}/reputation/leaderboard`);
  
  const reputationSuccess = check(reputationResponse, {
    'reputation status is 200': (r) => r.status === 200,
    'reputation response time < 400ms': (r) => r.timings.duration < 400,
  });
  
  if (!reputationSuccess) {
    errorRate.add(1);
  }
}

// Функция для отчета о результатах
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
📊 РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ USER SERVICE

🎯 Целевые показатели:
   • 50,000 RPS для операций чтения
   • 10,000 одновременных пользователей
   • 95% запросов < 500ms
   • < 5% ошибок

📈 Фактические результаты:
   • Всего запросов: ${data.metrics.http_reqs.count}
   • RPS (средний): ${Math.round(data.metrics.http_reqs.rate)}
   • Время отклика (95%): ${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms
   • Время отклика (99%): ${Math.round(data.metrics.http_req_duration.values['p(99)'])}ms
   • Частота ошибок: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%
   • Пиковые пользователи: ${data.metrics.vus_max.value}

✅ Пройденные тесты:
   ${data.metrics.http_req_duration.thresholds['p(95)<500'].ok ? '✅' : '❌'} 95% запросов < 500ms
   ${data.metrics.http_req_failed.thresholds['rate<0.05'].ok ? '✅' : '❌'} Частота ошибок < 5%
   ${data.metrics.errors?.thresholds?.['rate<0.05']?.ok ? '✅' : '❌'} Кастомные ошибки < 5%

🔧 Рекомендации по оптимизации:
   ${data.metrics.http_req_duration.values['p(95)'] > 500 ? '• Оптимизировать медленные запросы' : '• Производительность в норме'}
   ${data.metrics.http_req_failed.rate > 0.05 ? '• Исследовать причины ошибок' : '• Стабильность в норме'}
   ${data.metrics.http_reqs.rate < 10000 ? '• Масштабировать инфраструктуру' : '• Пропускная способность достаточна'}

📝 Детальный отчет сохранен в load-test-results.json
    `,
  };
}