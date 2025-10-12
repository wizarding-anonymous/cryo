# Auth Service E2E Tests - Authentication Flows

Этот каталог содержит end-to-end тесты для всех потоков аутентификации Auth Service.

## Структура тестов

### Основные файлы
- `test-setup.ts` - Общая настройка и утилиты для всех e2e тестов
- `index.e2e-spec.ts` - Главный файл для запуска всех тестов потоков

### Тесты потоков аутентификации

#### 1. `registration.e2e-spec.ts` - Поток регистрации пользователей
**Покрытие (Requirement 8.3):**
- ✅ Полный поток регистрации с валидацией
- ✅ Хеширование токенов в БД (Requirement 15.2)
- ✅ Интеграция с User Service
- ✅ Публикация событий для event-driven архитектуры
- ✅ Валидация силы пароля (Requirement 8.4)
- ✅ Обработка дублирующихся email
- ✅ Тестирование race conditions при регистрации
- ✅ Rate limiting
- ✅ Валидация входных данных

#### 2. `login.e2e-spec.ts` - Поток входа пользователей
**Покрытие (Requirement 8.4):**
- ✅ Полный поток входа с валидацией
- ✅ Хеширование токенов в БД (Requirement 15.2)
- ✅ Управление сессиями с ограничениями
- ✅ Распределенные блокировки (Requirement 15.1)
- ✅ Отслеживание метаданных (IP, User Agent)
- ✅ Публикация событий
- ✅ Обработка неверных учетных данных
- ✅ Rate limiting для неудачных попыток
- ✅ Concurrent login handling

#### 3. `logout.e2e-spec.ts` - Поток выхода пользователей
**Покрытие (Requirement 8.5):**
- ✅ Полный поток выхода с валидацией
- ✅ Атомарные операции logout (Requirement 15.3)
- ✅ Blacklisting токенов в Redis и БД
- ✅ Инвалидация сессий
- ✅ Публикация событий
- ✅ Logout из всех сессий
- ✅ Обработка concurrent logout
- ✅ Graceful degradation при сбоях Redis/БД

#### 4. `token-refresh.e2e-spec.ts` - Поток обновления токенов
**Покрытие (Requirement 8.7):**
- ✅ Полный поток refresh с валидацией
- ✅ Атомарная ротация токенов (Requirement 15.4)
- ✅ Blacklisting старых токенов
- ✅ Обновление хешей в сессии
- ✅ Обработка concurrent refresh
- ✅ Валидация expired/invalid токенов
- ✅ Поддержка непрерывности сессии
- ✅ User invalidation handling

#### 5. `token-validation.e2e-spec.ts` - Поток валидации токенов
**Покрытие (Requirement 8.7):**
- ✅ Полная валидация токенов
- ✅ Проверка blacklist в Redis и БД
- ✅ Интеграция с User Service
- ✅ Валидация сессий
- ✅ Обработка user invalidation
- ✅ Microservice integration
- ✅ Performance и caching
- ✅ Concurrent validation
- ✅ Graceful degradation

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

### Запуск отдельных потоков
```bash
# Тесты регистрации
npm run test:e2e -- --testPathPattern=registration.e2e-spec.ts

# Тесты входа
npm run test:e2e -- --testPathPattern=login.e2e-spec.ts

# Тесты выхода
npm run test:e2e -- --testPathPattern=logout.e2e-spec.ts

# Тесты refresh токенов
npm run test:e2e -- --testPathPattern=token-refresh.e2e-spec.ts

# Тесты валидации токенов
npm run test:e2e -- --testPathPattern=token-validation.e2e-spec.ts
```

### Запуск всех тестов потоков
```bash
# Все тесты потоков аутентификации
npm run test:e2e -- --testPathPattern=flows/

# С покрытием кода
npm run test:e2e:cov -- --testPathPattern=flows/

# В watch режиме для разработки
npm run test:e2e:watch -- --testPathPattern=flows/
```

### Запуск в CI/CD
```bash
# Для CI окружения
npm run test:e2e:ci -- --testPathPattern=flows/
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