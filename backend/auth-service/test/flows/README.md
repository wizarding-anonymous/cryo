# Auth Service E2E Tests - Authentication Flows

**ПРИМЕЧАНИЕ:** Все тесты потоков аутентификации были консолидированы в основной файл `../auth-flows-refactored.e2e-spec.ts` для лучшей поддержки и избежания дублирования кода.

## Покрытие тестов

Основной файл `auth-flows-refactored.e2e-spec.ts` покрывает все критические потоки аутентификации:

### 1. Complete User Registration Flow (Requirement 8.3)
- ✅ Полный поток регистрации с валидацией
- ✅ Хеширование токенов в БД (Requirement 15.2)
- ✅ Интеграция с User Service
- ✅ Публикация событий для event-driven архитектуры
- ✅ Валидация силы пароля (Requirement 8.4)
- ✅ Обработка дублирующихся email
- ✅ Graceful handling при сбоях User Service

### 2. Complete User Login Flow (Requirement 8.4)
- ✅ Полный поток входа с валидацией
- ✅ Хеширование токенов в БД (Requirement 15.2)
- ✅ Управление сессиями с ограничениями
- ✅ Отслеживание метаданных (IP, User Agent)
- ✅ Публикация событий
- ✅ Обработка неверных учетных данных
- ✅ Suspicious activity detection

### 3. Complete Logout Flow (Requirement 8.5)
- ✅ Полный поток выхода с валидацией
- ✅ Атомарные операции logout (Requirement 15.3)
- ✅ Blacklisting токенов в Redis и БД
- ✅ Инвалидация сессий
- ✅ Graceful handling при invalid токенах

### 4. Token Refresh Flow (Requirement 8.7)
- ✅ Полный поток refresh с валидацией
- ✅ Атомарная ротация токенов (Requirement 15.4)
- ✅ Blacklisting старых токенов
- ✅ Обновление хешей в сессии
- ✅ Валидация expired/invalid токенов
- ✅ Rejection blacklisted refresh токенов

### 5. Token Validation Flow (Requirement 8.7)
- ✅ Полная валидация токенов
- ✅ Проверка blacklist в Redis и БД
- ✅ Интеграция с User Service
- ✅ Валидация сессий
- ✅ Обработка user invalidation
- ✅ Rejection malformed токенов

## Требования безопасности

### Критические исправления (протестированы)
- **15.1** - Race Condition в управлении сессиями ✅
- **15.2** - Безопасное хранение токенов (SHA-256 хеши) ✅
- **15.3** - Атомарность операций logout ✅
- **15.4** - Безопасная ротация токенов ✅

### Интеграция микросервисов
- **User Service** - Создание/проверка пользователей ✅
- **Security Service** - Логирование событий безопасности ✅
- **Notification Service** - Отправка уведомлений ✅
- **Redis** - Shared cache для blacklist токенов ✅

## Запуск тестов

### Предварительные требования
```bash
# Запуск зависимостей через Docker Compose
cd backend
docker-compose up -d postgres-auth redis

# Или запуск всех сервисов для полной интеграции
docker-compose up -d
```

### Запуск основного файла тестов потоков
```bash
# Все тесты потоков аутентификации (16 тестов)
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts

# С покрытием кода
npm run test:e2e:cov -- --testPathPattern=auth-flows-refactored.e2e-spec.ts

# В watch режиме для разработки
npm run test:e2e:watch -- --testPathPattern=auth-flows-refactored.e2e-spec.ts
```

### Запуск отдельных групп тестов
```bash
# Только тесты регистрации
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts --testNamePattern="Complete User Registration Flow"

# Только тесты входа
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts --testNamePattern="Complete User Login Flow"

# Только тесты выхода
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts --testNamePattern="Complete Logout Flow"

# Только тесты refresh токенов
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts --testNamePattern="Token Refresh Flow"

# Только тесты валидации токенов
npm run test:e2e -- --testPathPattern=auth-flows-refactored.e2e-spec.ts --testNamePattern="Token Validation Flow"
```

### Запуск в CI/CD
```bash
# Для CI окружения
npm run test:e2e:ci -- --testPathPattern=auth-flows-refactored.e2e-spec.ts
```

## Переменные окружения

### Обязательные
```env
# База данных
DATABASE_URL=postgresql://auth_service:auth_password@localhost:5432/auth_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### Для интеграционных тестов
```env
# Микросервисы (Docker network URLs)
USER_SERVICE_URL=http://user-service:3002
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007

# Или localhost для локальной разработки
USER_SERVICE_URL=http://localhost:3002
SECURITY_SERVICE_URL=http://localhost:3010
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

## Отладка тестов

### Логирование
```bash
# Включить подробное логирование
DEBUG=auth-service:* npm run test:e2e -- --testPathPattern=flows/

# Логирование только ошибок
LOG_LEVEL=error npm run test:e2e -- --testPathPattern=flows/
```

### Изоляция тестов
```bash
# Запуск одного теста
npm run test:e2e -- --testNamePattern="should successfully register a new user"

# Пропуск cleanup для отладки
SKIP_CLEANUP=true npm run test:e2e -- --testPathPattern=registration.e2e-spec.ts
```

## Метрики и мониторинг

Тесты включают проверки:
- ⏱️ Производительности (время отклика < 5 сек для 20 запросов)
- 🔄 Concurrent operations (race conditions)
- 💾 Использования памяти (cleanup после тестов)
- 🔒 Безопасности (хеширование, blacklisting)
- 🌐 Интеграции сервисов (fallback при сбоях)

## Troubleshooting

### Частые проблемы

1. **Тесты падают с timeout**
   ```bash
   # Увеличить timeout
   JEST_TIMEOUT=30000 npm run test:e2e -- --testPathPattern=flows/
   ```

2. **Redis connection refused**
   ```bash
   # Проверить Redis
   docker-compose ps redis
   docker-compose logs redis
   ```

3. **Database connection failed**
   ```bash
   # Проверить PostgreSQL
   docker-compose ps postgres-auth
   docker-compose logs postgres-auth
   ```

4. **Cleanup errors**
   ```bash
   # Ручная очистка БД
   npm run db:reset
   ```

### Полезные команды
```bash
# Проверка состояния сервисов
npm run health-check

# Очистка тестовых данных
npm run test:cleanup

# Сброс БД для тестов
npm run test:db:reset
```