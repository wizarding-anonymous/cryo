# Security Service Test Suite

Этот документ описывает тестовую инфраструктуру и процедуры тестирования для Security Service.

## Обзор тестов

### Типы тестов

1. **Unit Tests** - Модульные тесты для отдельных компонентов
2. **Integration Tests** - Интеграционные тесты с реальной БД и Redis
3. **E2E Tests** - End-to-end тесты API эндпоинтов
4. **Performance Tests** - Тесты производительности под нагрузкой
5. **Error Handling Tests** - Тесты обработки ошибок и edge cases

### Структура тестов

```
test/
├── jest-e2e.json              # Конфигурация E2E тестов
├── jest-integration.json      # Конфигурация интеграционных тестов
├── setup-e2e.ts             # Настройка E2E тестов
├── setup-integration.ts      # Настройка интеграционных тестов
├── test-app.module.ts        # Тестовый модуль для E2E (с моками)
├── integration-app.module.ts # Тестовый модуль для интеграции (с реальными сервисами)
├── health.e2e-spec.ts       # E2E тесты health endpoints
├── security.e2e-spec.ts     # E2E тесты security endpoints
├── logs-alerts.e2e-spec.ts  # E2E тесты logs/alerts endpoints
├── security.integration-spec.ts    # Интеграционные тесты
├── api-endpoints.e2e-spec.ts       # Полные E2E тесты всех API
├── performance.e2e-spec.ts         # Тесты производительности
└── error-handling.e2e-spec.ts     # Тесты обработки ошибок
```

## Требования

### Системные требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL 15+ (для интеграционных тестов)
- Redis 7+ (для интеграционных тестов)

### Зависимости

```bash
npm install
```

## Запуск тестов

### Быстрый старт

```bash
# Запуск всех тестов с автоматической настройкой инфраструктуры
npm run scripts/run-tests.sh

# Или на Windows
scripts/run-tests.bat
```

### Отдельные типы тестов

```bash
# Модульные тесты (без внешних зависимостей)
npm run test

# Интеграционные тесты
npm run test:integration

# E2E тесты
npm run test:e2e

# Тесты производительности
npm run test:performance

# Тесты обработки ошибок
npm run test:error-handling
```

### Ручная настройка инфраструктуры

```bash
# Запуск тестовой инфраструктуры
docker-compose -f docker-compose.test.yml up -d

# Ожидание готовности сервисов
sleep 10

# Установка переменных окружения
export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=5436
export REDIS_HOST=localhost
export REDIS_PORT=6382

# Запуск тестов
npm run test:integration

# Очистка
docker-compose -f docker-compose.test.yml down -v
```

## Конфигурация

### Переменные окружения

Тесты используют следующие переменные окружения:

```bash
# База данных
DB_HOST=localhost
DB_PORT=5436
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=security_service_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6382

# Общие
NODE_ENV=test
```

### Файлы конфигурации

- `.env.test` - Переменные окружения для тестов
- `docker-compose.test.yml` - Тестовая инфраструктура
- `jest-*.json` - Конфигурации Jest для разных типов тестов

## Тестовые сценарии

### Интеграционные тесты

1. **Security Event Logging** - Логирование событий безопасности в БД
2. **Rate Limiting Integration** - Интеграция с Redis для rate limiting
3. **IP Blocking Integration** - Блокировка IP адресов
4. **Suspicious Activity Detection** - Обнаружение подозрительной активности
5. **End-to-End Security Scenarios** - Полные сценарии: обнаружение → алерт → блокировка

### E2E тесты

1. **Security Controller Endpoints** - Все эндпоинты безопасности
2. **Logs Controller Endpoints** - Эндпоинты логов с аутентификацией
3. **Alerts Controller Endpoints** - Эндпоинты алертов с авторизацией
4. **Health Controller Endpoints** - Health check эндпоинты

### Тесты производительности

1. **Rate Limiting Performance** - Производительность rate limiting под нагрузкой
2. **API Endpoint Performance** - Производительность API эндпоинтов
3. **Memory and Resource Usage** - Использование памяти и ресурсов
4. **Stress Testing** - Стресс-тестирование под экстремальной нагрузкой

### Тесты обработки ошибок

1. **Input Validation Errors** - Ошибки валидации входных данных
2. **Database Connection Errors** - Ошибки подключения к БД
3. **Redis Connection Errors** - Ошибки подключения к Redis
4. **Authentication and Authorization Errors** - Ошибки аутентификации/авторизации
5. **Rate Limiting Edge Cases** - Граничные случаи rate limiting
6. **Network and Timeout Errors** - Сетевые ошибки и таймауты
7. **Resource Exhaustion** - Исчерпание ресурсов
8. **Data Consistency Errors** - Ошибки консистентности данных

## Отладка тестов

### Логирование

```bash
# Включить подробное логирование
DEBUG=* npm run test:integration

# Логирование только SQL запросов
DEBUG=typeorm:* npm run test:integration
```

### Изоляция тестов

```bash
# Запуск конкретного теста
npm run test:integration -- --testNamePattern="Security Event Logging"

# Запуск тестов из конкретного файла
npm run test:integration -- security.integration-spec.ts
```

### Отладка в IDE

Для отладки в VS Code добавьте в `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Integration Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--config",
    "./test/jest-integration.json",
    "--runInBand"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen",
  "env": {
    "NODE_ENV": "test"
  }
}
```

## Мониторинг и метрики

### Покрытие кода

```bash
# Генерация отчета о покрытии
npm run test:cov

# Просмотр отчета
open coverage/lcov-report/index.html
```

### Производительность

Тесты производительности выводят метрики:
- Время выполнения запросов
- Throughput (запросов в секунду)
- Использование памяти
- Успешность запросов

### Мониторинг ресурсов

```bash
# Мониторинг Docker контейнеров
docker stats security-postgres-test security-redis-test

# Мониторинг использования памяти Node.js
node --expose-gc --inspect test-script.js
```

## Troubleshooting

### Частые проблемы

1. **Порты заняты** - Убедитесь, что порты 5436 и 6382 свободны
2. **Docker не запущен** - Запустите Docker Desktop
3. **Недостаточно памяти** - Увеличьте лимиты памяти для Docker
4. **Таймауты тестов** - Увеличьте timeout в конфигурации Jest

### Очистка

```bash
# Полная очистка тестовой инфраструктуры
docker-compose -f docker-compose.test.yml down -v
docker system prune -f

# Очистка node_modules и переустановка
rm -rf node_modules package-lock.json
npm install
```

## CI/CD интеграция

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: ./scripts/run-tests.sh all
```

### Локальные pre-commit хуки

```bash
# Установка husky
npm install --save-dev husky

# Настройка pre-commit хука
npx husky add .husky/pre-commit "npm run test"
```

## Лучшие практики

1. **Изоляция тестов** - Каждый тест должен быть независимым
2. **Очистка данных** - Очищайте БД и Redis между тестами
3. **Моки для внешних сервисов** - Используйте моки для внешних API
4. **Таймауты** - Устанавливайте разумные таймауты для тестов
5. **Параллельное выполнение** - Используйте `--maxWorkers` для ускорения
6. **Детерминированность** - Тесты должны давать одинаковый результат
7. **Читаемость** - Используйте описательные названия тестов
8. **Покрытие** - Стремитесь к высокому покрытию кода тестами