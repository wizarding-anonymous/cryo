# Performance Testing Guide - Notification Service MVP

## Обзор

Данное руководство описывает процесс тестирования производительности Notification Service для проверки соответствия MVP требованиям.

## 🎯 MVP Требования производительности

- **Время отклика**: < 200ms для 95% запросов
- **Успешность**: > 95% успешных запросов
- **Конкурентные пользователи**: поддержка 100+ одновременных пользователей
- **Пропускная способность**: > 50 запросов/секунду

## 🚀 Быстрый запуск тестирования

### 1. Запуск сервиса для тестирования

```bash
# Запуск в development режиме
npm run start:dev

# Или в production режиме с Docker
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Запуск тестов производительности

```bash
# Базовый тест (100 пользователей, 30 секунд)
node scripts/performance-test.js

# Кастомные параметры
TEST_URL=http://localhost:3000 \
CONCURRENT_USERS=200 \
TEST_DURATION=60 \
MAX_RESPONSE_TIME=150 \
node scripts/performance-test.js
```

## 📊 Параметры тестирования

### Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `TEST_URL` | `http://localhost:3000` | URL тестируемого сервиса |
| `CONCURRENT_USERS` | `100` | Количество одновременных пользователей |
| `TEST_DURATION` | `30` | Длительность теста в секундах |
| `MAX_RESPONSE_TIME` | `200` | Максимальное время отклика в мс |

### Тестируемые endpoints

1. **GET /health** - проверка здоровья сервиса
2. **GET /api/notifications/user/:userId** - получение уведомлений пользователя
3. **POST /api/notifications** - создание нового уведомления

## 📈 Интерпретация результатов

### Пример успешного результата

```
📈 Performance Test Results
==================================================
⏱️  Test Duration: 30.12s
📊 Total Requests: 2847
✅ Successful Requests: 2832
❌ Failed Requests: 15
📈 Success Rate: 99.47%
🚀 Requests/Second: 94.52

⏱️  Response Times:
   Average: 127.45ms
   Minimum: 23.12ms
   Maximum: 198.76ms
   95th Percentile: 165.23ms
   99th Percentile: 187.45ms

🎯 MVP Requirements Check:
   Response Time < 200ms: ✅ PASS
   Success Rate > 95%: ✅ PASS
   Concurrent Users (100): ✅ PASS

💡 Performance Recommendations:
   ✅ Performance meets MVP requirements
   🚀 Ready for production deployment
```

### Анализ проблем производительности

#### Высокое время отклика
- Проверьте индексы базы данных
- Оптимизируйте Redis кеширование
- Проверьте производительность email сервиса

#### Низкая успешность запросов
- Проверьте настройки connection pool БД
- Проверьте обработку ошибок и retry логику
- Мониторьте внешние зависимости

#### Низкая пропускная способность
- Рассмотрите горизонтальное масштабирование
- Оптимизируйте SQL запросы
- Найдите узкие места в приложении

## 🔧 Расширенное тестирование

### Нагрузочное тестирование

```bash
# Тест с высокой нагрузкой
CONCURRENT_USERS=500 TEST_DURATION=120 node scripts/performance-test.js

# Стресс-тест
CONCURRENT_USERS=1000 TEST_DURATION=300 node scripts/performance-test.js
```

### Тестирование с различными сценариями

```bash
# Быстрые запросы (только health check)
TEST_ENDPOINTS=health node scripts/performance-test.js

# Только API запросы
TEST_ENDPOINTS=api node scripts/performance-test.js
```

## 📋 Автоматизация тестирования

### Интеграция в CI/CD

```yaml
# .github/workflows/performance-test.yml
name: Performance Test
on: [push, pull_request]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
        working-directory: backend/notification-service
      
      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d
        working-directory: backend/notification-service
      
      - name: Wait for services
        run: sleep 30
      
      - name: Run performance tests
        run: |
          TEST_URL=http://localhost:3000 \
          CONCURRENT_USERS=50 \
          TEST_DURATION=30 \
          node scripts/performance-test.js
        working-directory: backend/notification-service
      
      - name: Stop services
        run: docker-compose -f docker-compose.test.yml down
        working-directory: backend/notification-service
```

### Мониторинг в production

```bash
# Регулярные проверки производительности
# Добавьте в cron или используйте Kubernetes CronJob

# Каждый час
0 * * * * cd /app && node scripts/performance-test.js >> /var/log/performance.log 2>&1
```

## 🎯 Бенчмарки MVP

### Минимальные требования
- **Время отклика**: 95% запросов < 200ms
- **Успешность**: > 95%
- **Пользователи**: 100 одновременных
- **RPS**: > 50 запросов/секунду

### Рекомендуемые показатели
- **Время отклика**: 95% запросов < 150ms
- **Успешность**: > 99%
- **Пользователи**: 200+ одновременных
- **RPS**: > 100 запросов/секунду

## 🔍 Мониторинг производительности

### Метрики для отслеживания

1. **Response Time** - время отклика API
2. **Throughput** - количество запросов в секунду
3. **Error Rate** - процент ошибочных запросов
4. **CPU Usage** - использование процессора
5. **Memory Usage** - использование памяти
6. **Database Performance** - производительность БД
7. **Cache Hit Rate** - эффективность кеширования

### Инструменты мониторинга

- **Prometheus + Grafana** - метрики и дашборды
- **New Relic / DataDog** - APM мониторинг
- **Kubernetes Metrics** - ресурсы кластера
- **Custom Health Checks** - проверки работоспособности

## 🚨 Алерты производительности

Настройте алерты для:
- Время отклика > 300ms
- Успешность < 95%
- CPU > 80%
- Memory > 85%
- Ошибки БД
- Недоступность внешних сервисов

## 📚 Дополнительные ресурсы

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Monitoring Setup](./k8s/monitoring.yaml)
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./PRODUCTION_DEPLOYMENT.md#устранение-неполадок)