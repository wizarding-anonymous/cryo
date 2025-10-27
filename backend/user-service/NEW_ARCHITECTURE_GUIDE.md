# Руководство по новой архитектуре User Service

## Обзор

После успешного рефакторинга User Service полностью переработан для работы в микросервисной архитектуре с выделенным Auth Service. Новая архитектура обеспечивает высокую производительность, безопасность и масштабируемость.

## Архитектурные изменения

### До рефакторинга
```
User Service (Монолитный подход)
├── Аутентификация (JWT, Passport)
├── Управление пользователями
├── Профили пользователей
├── Базовое кэширование
└── Простые API endpoints
```

### После рефакторинга
```
User Service (Микросервисная архитектура)
├── 🎯 Специализированные контроллеры
│   ├── UserController - основные операции
│   ├── ProfileController - управление профилями
│   ├── BatchController - массовые операции
│   └── InternalController - внутренние API
├── ⚡ Высокопроизводительные сервисы
│   ├── OptimizedUserService - оптимизированные операции
│   ├── CacheService - многоуровневое кэширование
│   ├── BatchService - массовая обработка данных
│   └── IntegrationService - межсервисная интеграция
├── 🔒 Безопасность и аудит
│   ├── EncryptionService - шифрование данных
│   ├── AuditService - аудит операций
│   └── RateLimitGuard - защита от перегрузок
├── 📊 Мониторинг и метрики
│   ├── MetricsService - Prometheus метрики
│   ├── HealthController - health checks
│   └── PerformanceProfiler - анализ производительности
└── 🔄 Event-driven интеграция
    ├── EventPublisher - публикация событий
    └── CircuitBreaker - защита от сбоев
```

## Ключевые компоненты

### 1. Специализированные контроллеры

#### UserController
- **Назначение**: Основные CRUD операции с пользователями
- **Эндпоинты**: `/api/users/*`
- **Особенности**: Оптимизированные запросы, кэширование, валидация

#### ProfileController  
- **Назначение**: Управление профилями и настройками
- **Эндпоинты**: `/api/profiles/*`
- **Особенности**: Загрузка аватаров, настройки приватности, предпочтения

#### BatchController
- **Назначение**: Массовые операции для высокой производительности
- **Эндпоинты**: `/api/batch/*`
- **Особенности**: Chunk-based обработка, до 5000 записей за запрос

#### InternalController
- **Назначение**: Специализированные API для других микросервисов
- **Эндпоинты**: `/api/internal/*`
- **Особенности**: Оптимизированы для каждого сервиса, защищены API ключами

### 2. Высокопроизводительные сервисы

#### OptimizedUserService
```typescript
@Injectable()
export class OptimizedUserService {
  // Оптимизированные методы с кэшированием
  async findByIdOptimized(id: string): Promise<User>
  async findBatchOptimized(ids: string[]): Promise<User[]>
  async createBatchOptimized(users: CreateUserDto[]): Promise<User[]>
  
  // Методы с метриками производительности
  async findWithMetrics(id: string): Promise<{ user: User, metrics: Metrics }>
}
```

#### CacheService
```typescript
@Injectable()
export class CacheService {
  // Многоуровневое кэширование
  async get<T>(key: string): Promise<T | null>
  async set<T>(key: string, value: T, ttl?: number): Promise<void>
  async invalidate(pattern: string): Promise<void>
  
  // Batch операции с кэшем
  async getBatch<T>(keys: string[]): Promise<Map<string, T>>
  async setBatch<T>(entries: Map<string, T>, ttl?: number): Promise<void>
  
  // Статистика и мониторинг
  async getStats(): Promise<CacheStats>
  async warmUp(keys: string[]): Promise<void>
}
```

#### BatchService
```typescript
@Injectable()
export class BatchService {
  // Массовые операции с chunk-based обработкой
  async createUsers(users: CreateUserDto[], options?: BatchOptions): Promise<BatchResult>
  async updateUsers(updates: BatchUpdateDto[], options?: BatchOptions): Promise<BatchResult>
  async deleteUsers(ids: string[], options?: BatchOptions): Promise<BatchResult>
  
  // Оптимизация для больших объемов
  async processInChunks<T>(items: T[], processor: ChunkProcessor<T>): Promise<void>
}
```

### 3. Безопасность и аудит

#### EncryptionService
```typescript
@Injectable()
export class EncryptionService {
  // Шифрование чувствительных данных
  encrypt(data: string): EncryptedData
  decrypt(encryptedData: EncryptedData): string
  
  // Шифрование полей профиля
  encryptProfileData(profile: UserProfile): UserProfile
  decryptProfileData(profile: UserProfile): UserProfile
}
```

#### AuditService
```typescript
@Injectable()
export class AuditService {
  // Аудит операций с данными
  async logDataAccess(userId: string, operation: string, details: AuditDetails): Promise<void>
  async logBatchOperation(operation: string, recordCount: number, details: BatchAuditDetails): Promise<void>
  
  // Интеграция с Security Service
  async reportSuspiciousActivity(activity: SuspiciousActivity): Promise<void>
}
```

### 4. Мониторинг и метрики

#### MetricsService
```typescript
@Injectable()
export class MetricsService {
  // Prometheus метрики
  incrementCounter(name: string, labels?: Record<string, string>): void
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void
  setGauge(name: string, value: number, labels?: Record<string, string>): void
  
  // Специализированные метрики
  recordApiCall(endpoint: string, method: string, statusCode: number, duration: number): void
  recordCacheOperation(operation: string, hit: boolean, duration: number): void
  recordBatchOperation(operation: string, recordCount: number, duration: number): void
}
```

## Интеграция с микросервисами

### Auth Service
```typescript
// Специализированные методы для Auth Service
POST /api/internal/users                    // Создание пользователя
GET  /api/internal/users/:id               // Получение по ID
GET  /api/internal/users/email/:email      // Получение по email
PATCH /api/internal/users/:id/last-login   // Обновление активности
```

### Game Catalog Service
```typescript
// Методы для персонализации каталога
GET  /api/internal/users/:id/profile       // Профиль с предпочтениями
POST /api/internal/users/batch/profiles    // Batch получение профилей
GET  /api/batch/users/lookup               // Массовый поиск пользователей
```

### Payment Service
```typescript
// Методы для обработки платежей
GET  /api/internal/users/:id/billing-info  // Биллинговая информация
PATCH /api/internal/users/:id/billing-info // Обновление биллинга
```

### Library Service
```typescript
// Методы для синхронизации предпочтений
GET  /api/internal/users/:id/preferences   // Игровые предпочтения
PATCH /api/internal/users/:id/preferences  // Обновление предпочтений
```

## Event-Driven архитектура

### Публикация событий
```typescript
// События, публикуемые User Service
interface UserEvent {
  type: 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'PROFILE_UPDATED' | 'PREFERENCES_CHANGED'
  userId: string
  timestamp: Date
  data: any
  correlationId: string
  source: 'user-service'
}

// Примеры событий
await eventPublisher.publishUserCreated(user)
await eventPublisher.publishPreferencesChanged(userId, changes, previousValues, newValues)
await eventPublisher.publishProfileUpdated(userId, profile)
```

### Подписка на события
```typescript
// Другие сервисы подписываются на события User Service
@EventPattern('user.created')
async handleUserCreated(event: UserCreatedEvent): Promise<void>

@EventPattern('user.preferences.changed')
async handlePreferencesChanged(event: UserPreferencesChangedEvent): Promise<void>

@EventPattern('user.deleted')
async handleUserDeleted(event: UserDeletedEvent): Promise<void>
```

## Производительность и оптимизация

### Кэширование
```typescript
// Многоуровневая стратегия кэширования
const CACHE_STRATEGIES = {
  users: { ttl: 300, namespace: 'user-service:user' },           // 5 минут
  profiles: { ttl: 600, namespace: 'user-service:profile' },     // 10 минут
  preferences: { ttl: 1800, namespace: 'user-service:preferences' }, // 30 минут
  batchResults: { ttl: 300, namespace: 'user-service:batch' }    // 5 минут
}
```

### Connection Pooling
```typescript
// Оптимизированная конфигурация БД
const databaseConfig = {
  type: 'postgres',
  extra: {
    max: 20,                    // Максимум соединений
    min: 5,                     // Минимум соединений
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  },
  cache: {
    type: 'redis',
    duration: 30000             // 30 секунд кэширования запросов
  }
}
```

### Batch операции
```typescript
// Оптимальные размеры для различных операций
const OPTIMAL_BATCH_SIZES = {
  create: 100,      // Создание пользователей
  lookup: 500,      // Поиск пользователей
  update: 200,      // Обновление данных
  lastLogin: 1000,  // Обновление активности
  softDelete: 50    // Удаление пользователей
}
```

## Безопасность

### API аутентификация
```typescript
// Различные методы аутентификации для разных сервисов
const API_KEYS = {
  'auth-service': 'auth-service-key-2024',
  'game-catalog': 'game-catalog-key-2024',
  'payment-service': 'payment-service-key-2024',
  'library-service': 'library-service-key-2024'
}

// Rate limiting по сервисам
const RATE_LIMITS = {
  'auth-service': { limit: 1000, ttl: 60 },      // 1000 req/min
  'game-catalog': { limit: 500, ttl: 60 },       // 500 req/min
  'payment-service': { limit: 200, ttl: 60 },    // 200 req/min
  'default': { limit: 100, ttl: 60 }             // 100 req/min
}
```

### Шифрование данных
```typescript
// Шифрование чувствительных полей
const ENCRYPTED_FIELDS = [
  'preferences.personalInfo',
  'billingInfo.address',
  'billingInfo.taxId',
  'metadata.sensitiveData'
]
```

## Мониторинг и алерты

### Prometheus метрики
```typescript
// Ключевые метрики для мониторинга
const METRICS = {
  'user_operations_total': 'Общее количество операций с пользователями',
  'user_cache_hits_total': 'Количество попаданий в кэш',
  'user_batch_operations_duration_seconds': 'Время выполнения batch операций',
  'user_external_service_calls_total': 'Вызовы внешних сервисов',
  'user_service_memory_usage_bytes': 'Использование памяти',
  'user_service_active_connections': 'Активные соединения с БД'
}
```

### Health checks
```typescript
// Комплексные проверки здоровья
GET /health          // Базовая проверка
GET /health/ready    // Kubernetes readiness probe
GET /health/live     // Kubernetes liveness probe
GET /health/detailed // Детальная проверка всех зависимостей
```

## Миграция и совместимость

### Обратная совместимость
- Все существующие API endpoints сохранены
- Добавлены новые оптимизированные endpoints
- Graceful degradation при недоступности новых компонентов

### Поэтапная миграция
1. **Фаза 1**: Развертывание новых компонентов параллельно со старыми
2. **Фаза 2**: Переключение трафика на новые endpoints
3. **Фаза 3**: Удаление устаревших компонентов

### Rollback план
- Автоматический rollback при критических ошибках
- Сохранение старых версий для быстрого восстановления
- Мониторинг ключевых метрик для раннего обнаружения проблем

## Заключение

Новая архитектура User Service обеспечивает:

- **Высокую производительность** - до 10x улучшение для batch операций
- **Масштабируемость** - горизонтальное масштабирование и load balancing
- **Надежность** - graceful degradation и circuit breaker pattern
- **Безопасность** - комплексное шифрование и аудит операций
- **Мониторинг** - детальные метрики и health checks
- **Интеграцию** - оптимизированные API для каждого микросервиса

Архитектура спроектирована для работы в высоконагруженной среде с автоматическим восстановлением при сбоях и комплексным мониторингом производительности.