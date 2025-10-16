# Internal API Security Guide

## Обзор

User Service использует многоуровневую систему безопасности для защиты внутренних API endpoints от несанкционированного доступа. Эта система обеспечивает безопасную межсервисную коммуникацию в микросервисной архитектуре.

## Архитектура безопасности

### Уровни защиты

1. **API Key Authentication** - Проверка API ключей в заголовках
2. **IP Whitelisting** - Ограничение доступа по IP адресам с поддержкой CIDR
3. **Internal Service Headers** - Специальные заголовки для внутренних сервисов
4. **Environment-based Access Control** - Различные правила для dev/prod окружений

### Защищенные endpoints

- `/internal/*` - Все внутренние API для межсервисной коммуникации
- `/batch/*` - Массовые операции для внутренних сервисов

## Конфигурация

### Переменные окружения

```env
# API ключи для внутренних сервисов (через запятую)
INTERNAL_API_KEYS=auth-service-key,game-catalog-key,payment-service-key

# Разрешенные IP адреса и CIDR диапазоны (через запятую)
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12

# Секрет для внутренних сервисов
INTERNAL_SERVICE_SECRET=user-service-internal-secret

# Режим работы (влияет на строгость проверок)
NODE_ENV=production
```

### Рекомендации по конфигурации

#### Development Environment
```env
NODE_ENV=development
INTERNAL_API_KEYS=auth-service-key-dev,game-catalog-key-dev
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12
INTERNAL_SERVICE_SECRET=user-service-internal-secret-dev
```

#### Production Environment
```env
NODE_ENV=production
INTERNAL_API_KEYS=auth-service-prod-key-32chars-long,game-catalog-prod-key-32chars-long
INTERNAL_ALLOWED_IPS=172.18.0.0/16,172.19.0.0/16
INTERNAL_SERVICE_SECRET=user-service-internal-secret-production-32chars
```

## Методы аутентификации

### 1. API Key Authentication

#### Bearer Token в Authorization заголовке
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://user-service:3001/internal/users/123
```

#### X-API-Key заголовок
```bash
curl -H "x-api-key: your-api-key" \
  http://user-service:3001/batch/users/lookup?ids=uuid1,uuid2
```

### 2. IP Whitelisting

Поддерживает как отдельные IP адреса, так и CIDR диапазоны:

```env
# Отдельные IP адреса
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.1.100

# CIDR диапазоны
INTERNAL_ALLOWED_IPS=192.168.0.0/16,10.0.0.0/8,172.16.0.0/12

# Смешанная конфигурация
INTERNAL_ALLOWED_IPS=127.0.0.1,192.168.0.0/16,10.1.1.1
```

### 3. Internal Service Headers

Специальный заголовок для внутренних сервисов:

```bash
curl -H "x-internal-service: user-service-internal-secret" \
  http://user-service:3001/internal/users/123
```

## Интеграция с микросервисами

### Auth Service

```typescript
// В Auth Service
const response = await fetch('http://user-service:3001/internal/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer auth-service-prod-key-32chars-long',
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId
  },
  body: JSON.stringify(userData)
});
```

### Game Catalog Service

```typescript
// В Game Catalog Service
const response = await fetch('http://user-service:3001/internal/users/batch/profiles', {
  method: 'POST',
  headers: {
    'x-api-key': 'game-catalog-prod-key-32chars-long',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userIds: [...] })
});
```

### Payment Service

```typescript
// В Payment Service
const response = await fetch('http://user-service:3001/internal/users/123/billing-info', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer payment-service-prod-key-32chars-long',
    'Content-Type': 'application/json'
  }
});
```

## Безопасность API ключей

### Требования к API ключам

1. **Минимальная длина**: 16 символов (рекомендуется 32+)
2. **Сложность**: Избегайте простых паттернов (test, dev, 123, password)
3. **Уникальность**: Каждый сервис должен иметь уникальный ключ
4. **Ротация**: Регулярная смена ключей (рекомендуется каждые 90 дней)

### Генерация безопасных ключей

```bash
# Генерация случайного ключа 32 символа
openssl rand -hex 16

# Генерация base64 ключа
openssl rand -base64 32

# Генерация с использованием Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Примеры безопасных ключей

```env
# ✅ Хорошие ключи
INTERNAL_API_KEYS=a1b2c3d4e5f6789012345678901234567890abcd,f9e8d7c6b5a4321098765432109876543210fedc

# ❌ Плохие ключи
INTERNAL_API_KEYS=test-key,dev-123,simple-password
```

## Мониторинг и логирование

### События безопасности

Guard логирует все попытки доступа с детальной информацией:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventType": "API_KEY_ACCESS",
  "clientIP": "172.18.0.5",
  "userAgent": "Auth-Service/1.0",
  "endpoint": "POST /internal/users",
  "success": true,
  "service": "user-service",
  "guard": "InternalServiceGuard"
}
```

### Типы событий

- `API_KEY_ACCESS` - Успешный доступ через API ключ
- `IP_WHITELIST_ACCESS` - Доступ через IP whitelist
- `INTERNAL_HEADER_ACCESS` - Доступ через внутренние заголовки
- `DEV_LOCALHOST_ACCESS` - Доступ с localhost в dev режиме
- `ACCESS_DENIED` - Отказ в доступе

### Алерты безопасности

В production режиме система отправляет алерты при:

- Множественных неудачных попытках доступа
- Попытках доступа с неизвестных IP
- Использовании недействительных API ключей
- Подозрительной активности

## Тестирование

### Unit тесты

```bash
# Запуск тестов для InternalServiceGuard
npm test -- --testPathPattern=internal-service.guard.spec.ts

# Запуск с покрытием
npm run test:cov -- --testPathPattern=internal-service.guard.spec.ts
```

### Integration тесты

```bash
# Тестирование защищенных endpoints
npm run test:e2e -- --testNamePattern="Internal API Security"
```

### Тестирование в разных окружениях

```bash
# Development
NODE_ENV=development npm test

# Production simulation
NODE_ENV=production npm test

# Test environment
NODE_ENV=test npm test
```

## Troubleshooting

### Частые проблемы

#### 1. 401 Unauthorized - Invalid API Key

```json
{
  "statusCode": 401,
  "message": "Access denied: Internal API requires valid credentials",
  "error": "Unauthorized"
}
```

**Решение:**
- Проверьте правильность API ключа
- Убедитесь, что ключ добавлен в `INTERNAL_API_KEYS`
- Проверьте формат заголовка (`Authorization: Bearer key` или `x-api-key: key`)

#### 2. 401 Unauthorized - IP Not Whitelisted

**Решение:**
- Добавьте IP адрес в `INTERNAL_ALLOWED_IPS`
- Проверьте CIDR нотацию для диапазонов
- В Docker убедитесь, что используете правильные сетевые диапазоны

#### 3. API Key Too Short Warning

**Решение:**
- Используйте ключи длиной минимум 16 символов
- Рекомендуется 32+ символов для production

#### 4. Weak API Key Pattern Warning

**Решение:**
- Избегайте простых паттернов (test, dev, 123, password)
- Используйте криптографически стойкие случайные ключи

### Отладка

#### Включение debug логирования

```env
LOG_LEVEL=debug
```

#### Проверка конфигурации

```bash
# Проверка переменных окружения
echo $INTERNAL_API_KEYS
echo $INTERNAL_ALLOWED_IPS
echo $NODE_ENV
```

#### Тестирование доступа

```bash
# Тест с API ключом
curl -v -H "Authorization: Bearer your-api-key" \
  http://localhost:3001/internal/users/123

# Тест с x-api-key
curl -v -H "x-api-key: your-api-key" \
  http://localhost:3001/batch/users/lookup?ids=test-id

# Тест с внутренним заголовком
curl -v -H "x-internal-service: your-secret" \
  http://localhost:3001/internal/users/123
```

## Best Practices

### Разработка

1. **Используйте разные ключи для разных окружений**
2. **Не коммитьте production ключи в git**
3. **Используйте переменные окружения для всех секретов**
4. **Тестируйте безопасность в CI/CD pipeline**

### Production

1. **Используйте сильные, уникальные API ключи**
2. **Ограничивайте IP доступ только необходимыми диапазонами**
3. **Мониторьте логи безопасности**
4. **Регулярно ротируйте ключи**
5. **Используйте HTTPS для всех межсервисных вызовов**

### Мониторинг

1. **Настройте алерты на неудачные попытки доступа**
2. **Мониторьте необычную активность**
3. **Ведите аудит всех изменений конфигурации**
4. **Регулярно проверяйте логи безопасности**

## Compliance

Система безопасности соответствует требованиям:

- **OWASP API Security Top 10**
- **ISO 27001** - Управление информационной безопасностью
- **SOC 2 Type II** - Контроли безопасности
- **GDPR** - Защита персональных данных

## Поддержка

При возникновении проблем с безопасностью:

1. Проверьте логи приложения
2. Убедитесь в правильности конфигурации
3. Протестируйте доступ с помощью curl
4. Обратитесь к команде DevOps для production проблем