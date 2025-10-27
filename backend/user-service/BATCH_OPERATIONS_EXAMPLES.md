# Примеры использования Batch операций User Service

## Обзор

User Service предоставляет мощные batch операции для эффективной обработки больших объемов пользовательских данных. Все операции оптимизированы для высокой производительности с поддержкой chunk-based обработки, кэширования и мониторинга.

## Основные возможности

- **Массовое создание пользователей** - до 1000 пользователей за запрос
- **Batch поиск и получение данных** - до 5000 пользователей за запрос  
- **Массовое обновление профилей** - до 1000 обновлений за запрос
- **Оптимизированное кэширование** - автоматическое кэширование результатов
- **Chunk-based обработка** - автоматическое разбиение на части для больших объемов
- **Детальная статистика** - метрики производительности и ошибок

## Аутентификация

Все batch операции требуют аутентификации через Internal API:

```bash
# Через API ключ
curl -H "x-api-key: your-internal-api-key" \
  http://user-service:3001/api/batch/users/lookup

# Через Authorization Bearer
curl -H "Authorization: Bearer your-internal-api-key" \
  http://user-service:3001/api/batch/users/create
```
## 1
. Массовое создание пользователей

### POST /api/batch/users/create

Создание множества пользователей одновременно с оптимизированной обработкой.

**Запрос:**
```bash
curl -X POST http://user-service:3001/api/batch/users/create \
  -H "x-api-key: auth-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {
        "name": "Иван Петров",
        "email": "ivan.petrov@example.com",
        "password": "$2b$10$hashedPasswordFromAuthService1"
      },
      {
        "name": "Мария Сидорова", 
        "email": "maria.sidorova@example.com",
        "password": "$2b$10$hashedPasswordFromAuthService2"
      },
      {
        "name": "Алексей Козлов",
        "email": "alexey.kozlov@example.com", 
        "password": "$2b$10$hashedPasswordFromAuthService3"
      }
    ],
    "options": {
      "chunkSize": 100,
      "skipDuplicates": true,
      "validateEmails": true,
      "enableParallelProcessing": true,
      "auditCreation": true
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "created": 3,
  "skipped": 0,
  "errors": [],
  "processingTime": "245ms",
  "chunkStats": {
    "totalChunks": 1,
    "avgChunkProcessingTime": "245ms",
    "parallelProcessing": true
  },
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Иван Петров",
      "email": "ivan.petrov@example.com",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Мария Сидорова",
      "email": "maria.sidorova@example.com", 
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.100Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Алексей Козлов",
      "email": "alexey.kozlov@example.com",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.200Z"
    }
  ],
  "auditInfo": {
    "correlationId": "batch-create-20240115-103000",
    "requestedBy": "auth-service",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Обработка ошибок при создании

**Запрос с дубликатами:**
```json
{
  "users": [
    {
      "name": "Новый Пользователь",
      "email": "new.user@example.com",
      "password": "$2b$10$hashedPassword1"
    },
    {
      "name": "Существующий Пользователь",
      "email": "existing.user@example.com", // Уже существует
      "password": "$2b$10$hashedPassword2"
    }
  ],
  "options": {
    "skipDuplicates": true
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "created": 1,
  "skipped": 1,
  "errors": [],
  "processingTime": "156ms",
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "Новый Пользователь",
      "email": "new.user@example.com",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "skippedUsers": [
    {
      "email": "existing.user@example.com",
      "reason": "Email already exists",
      "existingUserId": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

## 2. Массовый поиск пользователей

### GET /api/batch/users/lookup

Получение множества пользователей по ID с оптимизированным кэшированием.

**Запрос:**
```bash
curl "http://user-service:3001/api/batch/users/lookup?ids=550e8400-e29b-41d4-a716-446655440001,550e8400-e29b-41d4-a716-446655440002,550e8400-e29b-41d4-a716-446655440003&fields=name,email,preferences,avatarUrl&includeDeleted=false" \
  -H "x-api-key: game-catalog-key"
```

**Ответ:**
```json
{
  "success": true,
  "found": 3,
  "notFound": 0,
  "processingTime": "89ms",
  "cacheStats": {
    "hits": 2,
    "misses": 1,
    "hitRatio": 0.67
  },
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Иван Петров",
      "email": "ivan.petrov@example.com",
      "avatarUrl": "https://cdn.example.com/avatars/ivan.jpg",
      "preferences": {
        "language": "ru",
        "timezone": "Europe/Moscow",
        "theme": "dark",
        "gameSettings": {
          "autoDownload": true,
          "cloudSave": true,
          "achievementNotifications": true,
          "preferredGenres": ["action", "rpg"]
        }
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002", 
      "name": "Мария Сидорова",
      "email": "maria.sidorova@example.com",
      "avatarUrl": null,
      "preferences": {
        "language": "ru",
        "timezone": "Europe/Moscow", 
        "theme": "light",
        "gameSettings": {
          "autoDownload": false,
          "cloudSave": true,
          "achievementNotifications": false,
          "preferredGenres": ["puzzle", "strategy"]
        }
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Алексей Козлов", 
      "email": "alexey.kozlov@example.com",
      "avatarUrl": "https://cdn.example.com/avatars/alexey.jpg",
      "preferences": {
        "language": "en",
        "timezone": "Europe/Moscow",
        "theme": "auto", 
        "gameSettings": {
          "autoDownload": true,
          "cloudSave": false,
          "achievementNotifications": true,
          "preferredGenres": ["fps", "racing", "sports"]
        }
      }
    }
  ],
  "notFoundIds": []
}
```

### Поиск с частично отсутствующими пользователями

**Запрос:**
```bash
curl "http://user-service:3001/api/batch/users/lookup?ids=550e8400-e29b-41d4-a716-446655440001,non-existent-id,550e8400-e29b-41d4-a716-446655440002&fields=name,email" \
  -H "x-api-key: payment-service-key"
```

**Ответ:**
```json
{
  "success": true,
  "found": 2,
  "notFound": 1,
  "processingTime": "67ms",
  "cacheStats": {
    "hits": 2,
    "misses": 1,
    "hitRatio": 0.67
  },
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Иван Петров",
      "email": "ivan.petrov@example.com"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Мария Сидорова", 
      "email": "maria.sidorova@example.com"
    }
  ],
  "notFoundIds": ["non-existent-id"]
}
```

## 3. Массовое обновление пользователей

### PATCH /api/batch/users/update

Обновление множества пользователей с валидацией и аудитом изменений.

**Запрос:**
```bash
curl -X PATCH http://user-service:3001/api/batch/users/update \
  -H "x-api-key: library-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "data": {
          "preferences": {
            "gameSettings": {
              "autoDownload": false,
              "preferredGenres": ["action", "rpg", "strategy"]
            },
            "notifications": {
              "email": true,
              "push": false,
              "sms": false
            }
          }
        }
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "data": {
          "avatarUrl": "https://cdn.example.com/avatars/maria-new.jpg",
          "preferences": {
            "theme": "dark",
            "language": "en"
          }
        }
      }
    ],
    "options": {
      "validateUniqueness": true,
      "skipNotFound": false,
      "auditChanges": true,
      "invalidateCache": true
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "updated": 2,
  "failed": 0,
  "processingTime": "234ms",
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "updated",
      "changes": [
        "preferences.gameSettings.autoDownload",
        "preferences.gameSettings.preferredGenres", 
        "preferences.notifications"
      ],
      "previousValues": {
        "preferences.gameSettings.autoDownload": true,
        "preferences.gameSettings.preferredGenres": ["action", "rpg"]
      },
      "updatedAt": "2024-01-15T11:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "status": "updated",
      "changes": [
        "avatarUrl",
        "preferences.theme",
        "preferences.language"
      ],
      "previousValues": {
        "avatarUrl": null,
        "preferences.theme": "light",
        "preferences.language": "ru"
      },
      "updatedAt": "2024-01-15T11:00:00.100Z"
    }
  ],
  "auditInfo": {
    "correlationId": "batch-update-20240115-110000",
    "requestedBy": "library-service",
    "changesLogged": true
  },
  "cacheInvalidation": {
    "invalidatedKeys": [
      "user-service:user:550e8400-e29b-41d4-a716-446655440001",
      "user-service:profile:550e8400-e29b-41d4-a716-446655440001",
      "user-service:user:550e8400-e29b-41d4-a716-446655440002",
      "user-service:profile:550e8400-e29b-41d4-a716-446655440002"
    ]
  }
}
```

## 4. Массовое обновление времени последнего входа

### PATCH /api/batch/users/last-login

Специализированная операция для Auth Service для обновления активности пользователей.

**Запрос:**
```bash
curl -X PATCH http://user-service:3001/api/batch/users/last-login \
  -H "Authorization: Bearer auth-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "lastLoginAt": "2024-01-15T12:00:00.000Z",
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      {
        "userId": "550e8400-e29b-41d4-a716-446655440002", 
        "lastLoginAt": "2024-01-15T12:01:00.000Z",
        "ipAddress": "192.168.1.101",
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    ],
    "options": {
      "skipNotFound": true,
      "auditLogin": true
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "updated": 2,
  "skipped": 0,
  "processingTime": "123ms",
  "results": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "updated",
      "previousLastLogin": "2024-01-15T08:30:00.000Z",
      "newLastLogin": "2024-01-15T12:00:00.000Z"
    },
    {
      "userId": "550e8400-e29b-41d4-a716-446655440002",
      "status": "updated", 
      "previousLastLogin": "2024-01-14T15:45:00.000Z",
      "newLastLogin": "2024-01-15T12:01:00.000Z"
    }
  ],
  "auditInfo": {
    "loginEventsLogged": 2,
    "securityServiceNotified": true
  }
}
```

## 5. Массовое soft delete пользователей

### DELETE /api/batch/users/soft-delete

Безопасное удаление множества пользователей с возможностью восстановления.

**Запрос:**
```bash
curl -X DELETE http://user-service:3001/api/batch/users/soft-delete \
  -H "x-api-key: admin-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002"
    ],
    "options": {
      "reason": "GDPR deletion request",
      "auditDeletion": true,
      "notifyServices": true,
      "scheduleDataPurge": false
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "deleted": 2,
  "failed": 0,
  "processingTime": "189ms",
  "results": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "soft_deleted",
      "deletedAt": "2024-01-15T13:00:00.000Z",
      "reason": "GDPR deletion request"
    },
    {
      "userId": "550e8400-e29b-41d4-a716-446655440002",
      "status": "soft_deleted",
      "deletedAt": "2024-01-15T13:00:00.100Z", 
      "reason": "GDPR deletion request"
    }
  ],
  "auditInfo": {
    "correlationId": "batch-delete-20240115-130000",
    "deletionReason": "GDPR deletion request",
    "auditLogged": true
  },
  "serviceNotifications": {
    "notifiedServices": [
      "auth-service",
      "game-catalog-service", 
      "payment-service",
      "library-service",
      "social-service"
    ],
    "notificationsSent": 5
  }
}
```

## 6. Управление кэшем

### GET /api/batch/cache/stats

Получение статистики кэша по сервисам и типам данных.

**Запрос:**
```bash
curl "http://user-service:3001/api/batch/cache/stats" \
  -H "x-api-key: monitoring-service-key"
```

**Ответ:**
```json
{
  "success": true,
  "timestamp": "2024-01-15T14:00:00.000Z",
  "overall": {
    "totalKeys": 15420,
    "totalMemoryUsage": "245MB",
    "hitRatio": 0.87,
    "totalHits": 125430,
    "totalMisses": 18760
  },
  "byService": {
    "auth-service": {
      "keys": 8500,
      "memoryUsage": "120MB",
      "hitRatio": 0.92,
      "avgResponseTime": "12ms"
    },
    "game-catalog-service": {
      "keys": 4200,
      "memoryUsage": "85MB", 
      "hitRatio": 0.85,
      "avgResponseTime": "18ms"
    },
    "payment-service": {
      "keys": 1800,
      "memoryUsage": "25MB",
      "hitRatio": 0.78,
      "avgResponseTime": "15ms"
    },
    "library-service": {
      "keys": 920,
      "memoryUsage": "15MB",
      "hitRatio": 0.81,
      "avgResponseTime": "14ms"
    }
  },
  "byDataType": {
    "users": {
      "keys": 8500,
      "hitRatio": 0.91,
      "avgTtl": "300s"
    },
    "profiles": {
      "keys": 4200,
      "hitRatio": 0.86,
      "avgTtl": "600s"
    },
    "preferences": {
      "keys": 2100,
      "hitRatio": 0.79,
      "avgTtl": "1800s"
    },
    "batch-results": {
      "keys": 620,
      "hitRatio": 0.73,
      "avgTtl": "300s"
    }
  }
}
```

### POST /api/batch/cache/warm-up

Прогрев кэша для часто используемых пользователей.

**Запрос:**
```bash
curl -X POST http://user-service:3001/api/batch/cache/warm-up \
  -H "x-api-key: admin-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003"
    ],
    "dataTypes": ["user", "profile", "preferences"],
    "options": {
      "forceRefresh": false,
      "setLongTtl": true
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "warmedUp": 3,
  "skipped": 0,
  "processingTime": "156ms",
  "results": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "dataTypes": ["user", "profile", "preferences"],
      "cacheKeys": [
        "user-service:user:550e8400-e29b-41d4-a716-446655440001",
        "user-service:profile:550e8400-e29b-41d4-a716-446655440001", 
        "user-service:preferences:550e8400-e29b-41d4-a716-446655440001"
      ],
      "ttl": "3600s"
    }
  ]
}
```

## 7. Метрики производительности

### GET /api/batch/metrics/performance

Получение метрик производительности batch операций.

**Запрос:**
```bash
curl "http://user-service:3001/api/batch/metrics/performance?timeRange=1h" \
  -H "x-api-key: monitoring-service-key"
```

**Ответ:**
```json
{
  "success": true,
  "timeRange": "1h",
  "timestamp": "2024-01-15T15:00:00.000Z",
  "operations": {
    "batch_create": {
      "totalRequests": 45,
      "avgProcessingTime": "234ms",
      "maxProcessingTime": "1.2s",
      "minProcessingTime": "89ms",
      "avgRecordsPerRequest": 156,
      "maxRecordsPerRequest": 1000,
      "successRate": 0.98,
      "errorRate": 0.02
    },
    "batch_lookup": {
      "totalRequests": 1250,
      "avgProcessingTime": "67ms",
      "maxProcessingTime": "245ms", 
      "minProcessingTime": "12ms",
      "avgRecordsPerRequest": 23,
      "maxRecordsPerRequest": 500,
      "successRate": 0.99,
      "cacheHitRate": 0.87
    },
    "batch_update": {
      "totalRequests": 89,
      "avgProcessingTime": "189ms",
      "maxProcessingTime": "567ms",
      "minProcessingTime": "45ms", 
      "avgRecordsPerRequest": 67,
      "maxRecordsPerRequest": 500,
      "successRate": 0.97
    }
  },
  "resourceUsage": {
    "avgCpuUsage": "23%",
    "avgMemoryUsage": "456MB",
    "avgDatabaseConnections": 12,
    "avgRedisConnections": 8
  }
}
```

## Лучшие практики

### 1. Оптимальные размеры batch операций

```javascript
// Рекомендуемые размеры для различных операций
const OPTIMAL_BATCH_SIZES = {
  create: 100,      // Создание пользователей
  lookup: 500,      // Поиск пользователей  
  update: 200,      // Обновление данных
  lastLogin: 1000,  // Обновление активности
  softDelete: 50    // Удаление пользователей
};
```

### 2. Обработка больших объемов данных

```javascript
// Для обработки 10000+ пользователей
async function processBigBatch(users) {
  const chunkSize = 100;
  const chunks = chunkArray(users, chunkSize);
  
  for (const chunk of chunks) {
    await batchCreateUsers(chunk);
    // Пауза между chunk'ами для снижения нагрузки
    await sleep(100);
  }
}
```

### 3. Мониторинг и алерты

```javascript
// Настройка алертов для batch операций
const ALERT_THRESHOLDS = {
  processingTime: '5s',     // Время обработки > 5 сек
  errorRate: 0.05,          // Процент ошибок > 5%
  cacheHitRate: 0.7,        // Hit rate кэша < 70%
  memoryUsage: '1GB'        // Использование памяти > 1GB
};
```

### 4. Retry логика

```javascript
// Автоматические повторы при временных сбоях
const retryConfig = {
  retries: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000
};
```

## Заключение

Batch операции User Service обеспечивают:

- **Высокую производительность** - обработка тысяч записей за секунды
- **Надежность** - автоматические повторы и graceful degradation  
- **Масштабируемость** - chunk-based обработка для любых объемов
- **Мониторинг** - детальные метрики и статистика
- **Безопасность** - аудит всех операций и валидация данных

Все операции оптимизированы для работы в высоконагруженной микросервисной среде.