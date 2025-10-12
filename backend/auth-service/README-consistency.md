# Система обеспечения консистентности Redis/PostgreSQL

## 🎯 Обзор

Система обеспечивает консистентность данных токенов между Redis и PostgreSQL с помощью:
- **Двухфазный коммит (2PC)** для атомарных операций
- **Периодическая синхронизация** каждые 5 минут
- **Автоматическое восстановление** при обнаружении рассинхронизации
- **Комплексные метрики** для мониторинга

## 🚀 Быстрый старт

### 1. Проверка доступности сервисов

```bash
# Проверить доступность PostgreSQL и Redis
npm run services:check
```

### 2. Демонстрация функциональности (без подключения к БД)

```bash
# Демо проверки консистентности
npm run consistency:demo

# Демо восстановления
npm run consistency:demo:repair

# Демо детального отчета
npm run consistency:demo:report
```

### 3. Реальные операции (требуют запущенные сервисы)

```bash
# Проверка консистентности
npm run consistency:check

# Проверка с автоматическим восстановлением
npm run consistency:repair

# Детальный отчет
npm run consistency:report

# Отчет в JSON формате
npm run consistency:report:json

# Отчет в CSV формате
npm run consistency:report:csv
```

## 📊 API Endpoints

### Админские операции (требуют JWT аутентификации)

```bash
# Проверка консистентности
GET /admin/consistency/check

# Автоматическое восстановление
POST /admin/consistency/repair

# Ручной запуск проверки
POST /admin/consistency/manual-check

# Статистика активных транзакций
GET /admin/consistency/transactions

# Метрики консистентности
GET /admin/consistency/metrics

# Метрики для Prometheus
GET /admin/consistency/metrics/prometheus

# Статус планировщика
GET /admin/consistency/scheduler/status
```

## 🔧 Автоматические операции

Все операции с токенами автоматически используют распределенные транзакции:

```typescript
// Автоматически использует DistributedTransactionService
await tokenService.blacklistToken(token, userId, 'logout');
await tokenService.removeFromBlacklist(token, userId);
await tokenService.blacklistAllUserTokens(userId, 'security');
```

## 📈 Метрики Prometheus

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

# Успешность атомарных операций
auth_service_atomic_operation_success_rate
```

## 🚨 Алерты

Система автоматически создает алерты при:
- Критическом уровне несоответствий (>100)
- Низком коэффициенте консистентности (<95%)
- Высоком уровне ошибок (>10)
- Низкой успешности атомарных операций (<90%)

## 🛠 Устранение неполадок

### Проблема: Высокий уровень несоответствий

```bash
# 1. Проверить состояние
npm run consistency:check

# 2. Автоматическое восстановление
npm run consistency:repair

# 3. Проверить логи
docker logs auth-service | grep -i consistency
```

### Проблема: Зависшие транзакции

```bash
# Проверить активные транзакции
curl -X GET http://localhost:3001/admin/consistency/transactions

# Очистить зависшие транзакции
curl -X POST http://localhost:3001/admin/consistency/cleanup-transactions
```

### Проблема: Недоступность сервисов

```bash
# Проверить состояние сервисов
npm run services:check

# Запустить сервисы с Docker
docker-compose up -d postgres redis
```

## 🔄 Архитектура

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   TokenService  │───▶│ DistributedTxService │───▶│ ConsistencyMgr  │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│      Redis      │    │    PostgreSQL       │    │   Prometheus    │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## 📝 Логирование

```
INFO  - Успешные операции и статистика
WARN  - Найденные несоответствия и восстановления
ERROR - Ошибки операций и критические проблемы
DEBUG - Детальная информация для отладки
```

## 🧪 Тестирование

```bash
# Запуск тестов консистентности
npm test -- --testPathPattern=distributed-transaction.service.spec.ts

# Запуск всех тестов
npm test

# Тесты с покрытием
npm run test:cov
```

## 📚 Дополнительная документация

- [Полная документация](./docs/consistency-management.md)
- [API документация](http://localhost:3001/api/docs)
- [Конфигурация](./src/common/distributed-transaction/)

---

**Статус:** ✅ Реализовано и протестировано  
**Версия:** 1.0.0  
**Последнее обновление:** 12.10.2025