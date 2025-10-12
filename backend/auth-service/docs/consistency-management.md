# Управление консистентностью данных между Redis и PostgreSQL

## Обзор

Система обеспечения консистентности данных между Redis и PostgreSQL реализует двухфазный коммит (2PC) для атомарных операций с токенами и периодическую синхронизацию для обнаружения и исправления рассинхронизации.

## Архитектура

### Компоненты

1. **DistributedTransactionService** - основной сервис для выполнения атомарных операций
2. **ConsistencySchedulerService** - планировщик для периодических проверок
3. **ConsistencyMetricsService** - сбор и отправка метрик для мониторинга
4. **ConsistencyController** - API для админских операций

### Двухфазный коммит (2PC)

```
Phase 1: Prepare
├── Проверка готовности Redis
├── Проверка готовности PostgreSQL
├── Резервирование ресурсов
└── Создание prepare locks

Phase 2: Commit
├── Выполнение операций в PostgreSQL
├── Выполнение операций в Redis
├── Очистка prepare locks
└── Логирование результата

Abort Phase (при ошибках)
├── Откат изменений в PostgreSQL
├── Откат изменений в Redis
├── Очистка prepare locks
└── Компенсирующие действия
```

## Использование

### Автоматические операции

Все операции с токенами автоматически используют распределенные транзакции:

```typescript
// Автоматически использует DistributedTransactionService
await tokenService.blacklistToken(token, userId, 'logout');
await tokenService.removeFromBlacklist(token, userId);
await tokenService.blacklistAllUserTokens(userId, 'security');
```

### Периодическая синхронизация

Система автоматически проверяет консистентность каждые 5 минут:

- Сравнивает токены в Redis и PostgreSQL
- Обнаруживает рассинхронизацию
- Автоматически исправляет найденные проблемы
- Отправляет метрики и алерты

### Ручные операции

#### Проверка консистентности

```bash
# Простая проверка
npm run consistency:check

# Проверка с восстановлением
npm run consistency:repair

# Детальный отчет
npm run consistency:report

# Отчет в JSON формате
npm run consistency:report:json

# Отчет в CSV формате
npm run consistency:report:csv
```

#### API для администраторов

```bash
# Проверка консистентности
GET /admin/consistency/check

# Автоматическое восстановление
POST /admin/consistency/repair

# Ручной запуск проверки
POST /admin/consistency/manual-check

# Статистика активных транзакций
GET /admin/consistency/transactions

# Очистка зависших транзакций
POST /admin/consistency/cleanup-transactions

# Метрики консистентности
GET /admin/consistency/metrics

# Метрики для Prometheus
GET /admin/consistency/metrics/prometheus

# Статус планировщика
GET /admin/consistency/scheduler/status

# Очистка старых метрик
POST /admin/consistency/metrics/cleanup
```

## Мониторинг

### Метрики Prometheus

```
# Коэффициент консистентности (0-1)
auth_service_consistency_ratio

# Общее количество несоответствий
auth_service_inconsistencies_total

# Количество проверенных токенов
auth_service_tokens_checked_total

# Токены только в Redis
auth_service_redis_only_tokens

# Токены только в PostgreSQL
auth_service_postgres_only_tokens

# Автоматически исправленные несоответствия
auth_service_repaired_inconsistencies_total

# Race condition конфликты
auth_service_race_condition_conflicts_total

# Успешность атомарных операций
auth_service_atomic_operation_success_rate
```

### Алерты

Система автоматически создает алерты при:

- Критическом уровне несоответствий (>100)
- Низком коэффициенте консистентности (<95%)
- Высоком уровне ошибок (>10)
- Высоком проценте race condition конфликтов (>10%)
- Низкой успешности атомарных операций (<90%)

### Логирование

Все операции логируются с соответствующими уровнями:

```
INFO  - Успешные операции и статистика
WARN  - Найденные несоответствия и восстановления
ERROR - Ошибки операций и критические проблемы
DEBUG - Детальная информация для отладки
```

## Конфигурация

### Переменные окружения

```bash
# Таймаут транзакций (мс)
DISTRIBUTED_TRANSACTION_TIMEOUT=30000

# Интервал проверки консистентности (cron)
CONSISTENCY_CHECK_INTERVAL="0 */5 * * * *"

# Интервал очистки зависших транзакций (cron)
TRANSACTION_CLEANUP_INTERVAL="0 * * * * *"

# Максимальное количество активных транзакций
MAX_ACTIVE_TRANSACTIONS=100

# TTL для метрик в Redis (секунды)
METRICS_TTL=3600

# Размер истории метрик
METRICS_HISTORY_SIZE=24
```

### Настройка планировщика

```typescript
// Изменение интервала проверки
@Cron('0 */10 * * * *') // Каждые 10 минут
async scheduledConsistencyCheck() {
  // ...
}
```

## Устранение неполадок

### Частые проблемы

#### 1. Высокий уровень несоответствий

**Причины:**
- Сбои в сети между сервисами
- Перезапуск Redis без сохранения данных
- Ошибки в коде операций с токенами

**Решение:**
```bash
# Проверить состояние
npm run consistency:check

# Автоматическое восстановление
npm run consistency:repair

# Проверить логи
docker logs auth-service | grep -i consistency
```

#### 2. Зависшие транзакции

**Причины:**
- Таймауты операций
- Сбои в процессе выполнения
- Недостаток ресурсов

**Решение:**
```bash
# Проверить активные транзакции
curl -X GET http://localhost:3001/admin/consistency/transactions

# Очистить зависшие транзакции
curl -X POST http://localhost:3001/admin/consistency/cleanup-transactions
```

#### 3. Ошибки подключения к Redis/PostgreSQL

**Причины:**
- Недоступность сервисов
- Проблемы с сетью
- Исчерпание пула соединений

**Решение:**
```bash
# Проверить состояние сервисов
docker ps | grep -E "(redis|postgres)"

# Проверить логи подключений
docker logs cryo-redis-cache
docker logs cryo-postgres-auth-db

# Перезапустить сервисы при необходимости
docker restart cryo-redis-cache cryo-postgres-auth-db
```

### Диагностические команды

```bash
# Проверка состояния Redis
redis-cli -a redis_password ping

# Проверка состояния PostgreSQL
psql -h localhost -p 5432 -U auth_service -d auth_db -c "SELECT 1;"

# Проверка активных соединений
psql -h localhost -p 5432 -U auth_service -d auth_db -c "SELECT count(*) FROM pg_stat_activity;"

# Проверка размера таблиц
psql -h localhost -p 5432 -U auth_service -d auth_db -c "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename IN ('token_blacklist', 'sessions');"
```

## Производительность

### Оптимизация

1. **Индексы базы данных:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_token_blacklist_expires_at ON token_blacklist(expires_at);
   CREATE INDEX CONCURRENTLY idx_token_blacklist_user_id ON token_blacklist(user_id);
   CREATE INDEX CONCURRENTLY idx_sessions_user_id_active ON sessions(user_id, is_active);
   ```

2. **Настройка Redis:**
   ```
   # Увеличение памяти для Redis
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   
   # Оптимизация для производительности
   save 900 1
   save 300 10
   save 60 10000
   ```

3. **Настройка PostgreSQL:**
   ```
   # Увеличение пула соединений
   max_connections = 200
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   ```

### Мониторинг производительности

```bash
# Время выполнения операций
curl -X GET http://localhost:3001/admin/consistency/metrics | jq '.current.averageDuration'

# Успешность операций
curl -X GET http://localhost:3001/admin/consistency/metrics | jq '.current.atomicOperationSuccessRate'

# Нагрузка на систему
curl -X GET http://localhost:3001/admin/consistency/transactions | jq '.total'
```

## Безопасность

### Контроль доступа

Все админские API защищены JWT аутентификацией:

```typescript
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConsistencyController {
  // Только аутентифицированные пользователи
}
```

### Аудит операций

Все операции консистентности логируются в Security Service:

```typescript
await this.authDatabaseService.logSecurityEvent({
  userId: 'system',
  type: 'consistency_check',
  ipAddress: 'system',
  metadata: {
    eventType: 'redis_postgres_inconsistency',
    severity: 'medium',
    inconsistencies: result.inconsistencies
  }
});
```

### Защита от злоупотреблений

- Rate limiting на API endpoints
- Валидация входных данных
- Ограничение размера операций
- Мониторинг подозрительной активности

## Развертывание

### Docker Compose

Система автоматически запускается с основными сервисами:

```yaml
auth-service:
  # Зависимости для консистентности
  depends_on:
    - postgres-auth
    - redis
  environment:
    - CONSISTENCY_CHECK_ENABLED=true
    - CONSISTENCY_CHECK_INTERVAL="0 */5 * * * *"
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    spec:
      containers:
      - name: auth-service
        env:
        - name: CONSISTENCY_CHECK_ENABLED
          value: "true"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: DATABASE_URL
          value: "postgresql://auth_service:password@postgres-auth:5432/auth_db"
```

### Мониторинг в production

1. **Grafana Dashboard** для визуализации метрик
2. **Alertmanager** для уведомлений о проблемах
3. **ELK Stack** для централизованного логирования
4. **Health checks** для проверки состояния системы

## Заключение

Система консистентности обеспечивает надежную работу с токенами в распределенной архитектуре, автоматически обнаруживает и исправляет проблемы, предоставляет детальные метрики для мониторинга и включает инструменты для диагностики и устранения неполадок.