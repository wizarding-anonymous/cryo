# Internal Service Guard

## Описание

`InternalServiceGuard` - это guard для защиты внутренних API endpoints от внешних вызовов. Он обеспечивает безопасность межсервисной коммуникации в микросервисной архитектуре.

## Методы аутентификации

Guard поддерживает несколько методов аутентификации:

### 1. API Keys

#### Authorization Header (Bearer Token)
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3001/batch/users/lookup?ids=uuid1,uuid2
```

#### X-API-Key Header
```bash
curl -H "x-api-key: your-api-key" \
  http://localhost:3001/batch/users/create \
  -d '{"users": [...]}'
```

### 2. IP Whitelist

Разрешенные IP адреса настраиваются через переменную окружения `INTERNAL_ALLOWED_IPS`:

```env
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.1.100,10.0.0.0/8
```

### 3. Internal Service Headers

Специальный заголовок для внутренних сервисов:

```bash
curl -H "x-internal-service: user-service-internal" \
  http://localhost:3001/batch/users/lookup?ids=uuid1,uuid2
```

## Конфигурация

### Переменные окружения

```env
# API ключи для внутренних сервисов (через запятую)
INTERNAL_API_KEYS=auth-service-key,game-catalog-key,payment-service-key

# Разрешенные IP адреса (через запятую)
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.1.0/24,10.0.0.0/8

# Секрет для внутренних сервисов
INTERNAL_SERVICE_SECRET=user-service-internal-secret

# Режим работы
NODE_ENV=production
```

### Режимы работы

#### Development Mode
- Разрешает доступ с localhost (127.0.0.1, ::1)
- Разрешает доступ с приватных сетей (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Логирует предупреждения о разрешенном доступе

#### Production Mode
- Строгая проверка API ключей и IP адресов
- Блокирует доступ с неавторизованных IP
- Требует явной настройки всех разрешенных источников

## Использование

### В контроллере

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from '../common/guards';

@Controller('batch')
@UseGuards(InternalServiceGuard)
export class BatchController {
  // Все endpoints защищены InternalServiceGuard
}
```

### На отдельном endpoint

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from '../common/guards';

@Controller('users')
export class UserController {
  @Get('internal-stats')
  @UseGuards(InternalServiceGuard)
  getInternalStats() {
    // Только этот endpoint защищен
  }
}
```

## Swagger документация

Guard автоматически добавляет схемы безопасности в Swagger:

```typescript
@ApiSecurity('internal-api-key')
@ApiSecurity('internal-bearer')
@Controller('batch')
export class BatchController {
  // ...
}
```

## Логирование

Guard логирует все попытки доступа:

```
[InternalServiceGuard] Access granted via API key
[InternalServiceGuard] Access granted via IP whitelist: 192.168.1.100
[InternalServiceGuard] Development mode: allowing access from localhost 127.0.0.1
[InternalServiceGuard] Access denied for IP: 203.0.113.1, no valid credentials found
```

## Обработка ошибок

При отказе в доступе guard возвращает:

```json
{
  "statusCode": 401,
  "message": "Access denied: Internal API requires valid credentials",
  "error": "Unauthorized"
}
```

## Интеграция с другими сервисами

### Auth Service

```typescript
// В Auth Service
const response = await fetch('http://user-service:3001/batch/users/lookup', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer auth-service-api-key',
    'Content-Type': 'application/json'
  }
});
```

### Game Catalog Service

```typescript
// В Game Catalog Service
const response = await fetch('http://user-service:3001/batch/users/create', {
  method: 'POST',
  headers: {
    'x-api-key': 'game-catalog-service-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ users: [...] })
});
```

## Тестирование

Guard включает полный набор unit тестов:

```bash
npm run test -- --testPathPattern=internal-service.guard.spec.ts
```

Тесты покрывают:
- Валидацию API ключей
- Проверку IP адресов
- Обработку заголовков
- Режимы development/production
- Обработку ошибок

## Безопасность

### Рекомендации

1. **Используйте сильные API ключи** - минимум 32 символа, случайные
2. **Ограничивайте IP адреса** - указывайте только необходимые сети
3. **Ротируйте ключи регулярно** - меняйте API ключи каждые 90 дней
4. **Мониторьте доступ** - следите за логами неавторизованных попыток
5. **Используйте HTTPS** - всегда шифруйте трафик между сервисами

### Что НЕ делать

- ❌ Не используйте простые или предсказуемые API ключи
- ❌ Не разрешайте доступ с 0.0.0.0/0 в production
- ❌ Не логируйте API ключи в открытом виде
- ❌ Не используйте один ключ для всех сервисов