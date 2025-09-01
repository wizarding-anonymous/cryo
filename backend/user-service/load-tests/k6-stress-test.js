import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Кастомные метрики для stress тестирования
const errorRate = new Rate('stress_errors');
const responseTime = new Trend('stress_response_time');
const requestCount = new Counter('stress_requests');
const degradationPoint = new Counter('degradation_points');

// Конфигурация stress тестирования
export const options = {
  stages: [
    // Постепенное увеличение нагрузки до критической точки
    { duration: '2m', target: 1000 },   // Базовая нагрузка
    { duration: '5m', target: 5000 },   // Увеличение нагрузки
    { duration: '5m', target: 10000 },  // Высокая нагрузка
    { duration: '5m', target: 20000 },  // Очень высокая нагрузка
    { duration: '5m', target: 30000 },  // Критическая нагрузка
    { duration: '5m', target: 50000 },  // Экстремальная нагрузка
    { duration: '10m', target: 50000 }, // Удержание экстремальной нагрузки
    { duration: '5m', target: 10000 },  // Снижение нагрузки
    { duration: '2m', target: 0 },      // Полная остановка
  ],
  thresholds: {
    // Более мягкие требования для stress тестирования
    http_req_duration: ['p(95)<2000'],  // 95% запросов менее 2 секунд
    http_req_failed: ['rate<0.20'],     // Менее 20% ошибок (допускаем деградацию)
    stress_errors: ['rate<0.30'],       // Менее 30% ошибок в кастомной метрике
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const startTime = Date.now();
  
  // В stress тесте фокусируемся на самых критичных операциях
  const scenario = Math.random();
  
  if (scenario < 0.6) {
    // 60% - Критичные операции аутентификации
    stressTestAuthentication();
  } else if (scenario < 0.8) {
    // 20% - Операции с профилями
    stressTestProfiles();
  } else {
    // 20% - Системные операции
    stressTestSystem();
  }
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  requestCount.add(1);
  
  // Проверяем деградацию производительности
  if (duration > 1000) {
    degradationPoint.add(1);
  }
  
  // Минимальная пауза для stress теста
  sleep(0.1);
}

function stressTestAuthentication() {
  // Тест входа с высокой нагрузкой
  const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `stress_user_${Math.floor(Math.random() * 1000)}@example.com`,
    password: 'Password123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s', // Увеличенный таймаут для stress теста
  });
  
  const success = check(loginResponse, {
    'login completed (any status)': (r) => r.status !== 0, // Любой HTTP статус лучше таймаута
    'login response time < 5000ms': (r) => r.timings.duration < 5000,
  });
  
  if (!success || loginResponse.status === 0) {
    errorRate.add(1);
  }
  
  // Тест валидации токена
  if (loginResponse.status === 200) {
    const validateResponse = http.get(`${BASE_URL}/auth/validate`, {
      headers: {
        'Authorization': 'Bearer fake-token',
      },
      timeout: '3s',
    });
    
    const validateSuccess = check(validateResponse, {
      'validate completed': (r) => r.status !== 0,
      'validate response time < 3000ms': (r) => r.timings.duration < 3000,
    });
    
    if (!validateSuccess) {
      errorRate.add(1);
    }
  }
}

function stressTestProfiles() {
  // Тест чтения профилей с высокой нагрузкой
  const profileId = Math.floor(Math.random() * 10000);
  const profileResponse = http.get(`${BASE_URL}/users/${profileId}/profile`, {
    timeout: '3s',
  });
  
  const success = check(profileResponse, {
    'profile request completed': (r) => r.status !== 0,
    'profile response time < 3000ms': (r) => r.timings.duration < 3000,
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  // Тест репутации
  const reputationResponse = http.get(`${BASE_URL}/reputation/user/${profileId}`, {
    timeout: '2s',
  });
  
  const reputationSuccess = check(reputationResponse, {
    'reputation request completed': (r) => r.status !== 0,
    'reputation response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  if (!reputationSuccess) {
    errorRate.add(1);
  }
}

function stressTestSystem() {
  // Тест health check под нагрузкой
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '1s',
  });
  
  const healthSuccess = check(healthResponse, {
    'health check completed': (r) => r.status !== 0,
    'health response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  if (!healthSuccess) {
    errorRate.add(1);
  }
  
  // Тест метрик под нагрузкой
  const metricsResponse = http.get(`${BASE_URL}/metrics`, {
    timeout: '2s',
  });
  
  const metricsSuccess = check(metricsResponse, {
    'metrics request completed': (r) => r.status !== 0,
    'metrics response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  if (!metricsSuccess) {
    errorRate.add(1);
  }
}

export function handleSummary(data) {
  const maxVUs = data.metrics.vus_max.value;
  const avgResponseTime = data.metrics.http_req_duration.values.avg;
  const p95ResponseTime = data.metrics.http_req_duration.values['p(95)'];
  const p99ResponseTime = data.metrics.http_req_duration.values['p(99)'];
  const errorRate = data.metrics.http_req_failed.rate * 100;
  const totalRequests = data.metrics.http_reqs.count;
  const avgRPS = data.metrics.http_reqs.rate;
  
  // Определяем точку деградации
  let degradationAnalysis = '';
  if (p95ResponseTime > 2000) {
    degradationAnalysis = '🔴 КРИТИЧЕСКАЯ ДЕГРАДАЦИЯ: Время отклика превышает 2 секунды';
  } else if (p95ResponseTime > 1000) {
    degradationAnalysis = '🟡 УМЕРЕННАЯ ДЕГРАДАЦИЯ: Время отклика увеличилось до 1+ секунд';
  } else if (p95ResponseTime > 500) {
    degradationAnalysis = '🟠 ЛЕГКАЯ ДЕГРАДАЦИЯ: Время отклика увеличилось до 500+ мс';
  } else {
    degradationAnalysis = '🟢 БЕЗ ДЕГРАДАЦИИ: Производительность в норме';
  }
  
  // Рекомендации по масштабированию
  let scalingRecommendations = '';
  if (errorRate > 20) {
    scalingRecommendations = '• КРИТИЧНО: Немедленно увеличить количество инстансов\n• Проверить ресурсы базы данных\n• Рассмотреть горизонтальное масштабирование';
  } else if (errorRate > 10) {
    scalingRecommendations = '• Увеличить количество инстансов на 50%\n• Оптимизировать медленные запросы\n• Увеличить лимиты подключений к БД';
  } else if (p95ResponseTime > 1000) {
    scalingRecommendations = '• Добавить кэширование для частых запросов\n• Оптимизировать индексы базы данных\n• Рассмотреть CDN для статического контента';
  } else {
    scalingRecommendations = '• Текущая конфигурация справляется с нагрузкой\n• Мониторить метрики при росте трафика';
  }

  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
🔥 РЕЗУЛЬТАТЫ STRESS ТЕСТИРОВАНИЯ USER SERVICE

🎯 Цель stress тестирования:
   • Найти точку отказа системы
   • Проверить graceful degradation
   • Определить максимальную пропускную способность
   • Выявить узкие места

📊 Результаты нагрузки:
   • Максимальные пользователи: ${maxVUs}
   • Всего запросов: ${totalRequests}
   • Средний RPS: ${Math.round(avgRPS)}
   • Частота ошибок: ${errorRate.toFixed(2)}%

⏱️ Производительность:
   • Среднее время отклика: ${Math.round(avgResponseTime)}ms
   • 95-й процентиль: ${Math.round(p95ResponseTime)}ms
   • 99-й процентиль: ${Math.round(p99ResponseTime)}ms

${degradationAnalysis}

🔧 Рекомендации по масштабированию:
${scalingRecommendations}

📈 Анализ пропускной способности:
   • Пиковый RPS: ${Math.round(avgRPS)}
   • Целевой RPS (50K): ${avgRPS >= 50000 ? '✅ ДОСТИГНУТ' : '❌ НЕ ДОСТИГНУТ'}
   • Рекомендуемая нагрузка: ${Math.round(avgRPS * 0.7)} RPS (70% от пика)

🛡️ Устойчивость системы:
   ${errorRate < 5 ? '✅ ОТЛИЧНАЯ' : errorRate < 15 ? '🟡 ХОРОШАЯ' : errorRate < 30 ? '🟠 УДОВЛЕТВОРИТЕЛЬНАЯ' : '🔴 ТРЕБУЕТ ВНИМАНИЯ'}

📝 Детальный отчет сохранен в stress-test-results.json
    `,
  };
}