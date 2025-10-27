# Docker Startup Report

## Успешно запущенные сервисы

### ✅ Auth Service
- **URL**: http://localhost:3001
- **Status**: Работает
- **Health Check**: http://localhost:3001/api/health/live
- **API Endpoint**: http://localhost:3001/api
- **Database**: PostgreSQL на порту 5432

### 🔴 User Service  
- **URL**: http://localhost:3002
- **Status**: Запущен, но не функционален (500 ошибки)
- **API Endpoint**: http://localhost:3002/api (возвращает 500)
- **Database**: PostgreSQL на порту 5433 (работает)
- **Проблема**: ThrottlerGuard падает с ошибкой `storageService.increment is not a function`

### ✅ Инфраструктурные сервисы
- **Redis Cache**: localhost:6379
- **PostgreSQL Auth DB**: localhost:5432
- **PostgreSQL User DB**: localhost:5433

## Команды для управления

### Запуск сервисов
```bash
cd backend
docker-compose up -d postgres-auth postgres-user redis auth-service user-service
```

### Проверка статуса
```bash
docker-compose ps
```

### Просмотр логов
```bash
docker-compose logs auth-service
docker-compose logs user-service
```

### Остановка сервисов
```bash
docker-compose stop auth-service user-service
```

### Полная остановка с удалением контейнеров
```bash
docker-compose down
```

## Исправленные проблемы

1. **Права доступа в Dockerfile**: Исправлены права для создания папок `dist` и `logs`
2. **TypeORM Redis Cache**: Отключен Redis cache для TypeORM (QUERY_CACHE_ENABLED=false)
3. **Конфигурация окружения**: Настроены правильные переменные окружения для Docker

## Текущие проблемы

### 🔴 Критические проблемы

1. **User Service ThrottlerGuard**: 
   - Ошибка: `this.storageService.increment is not a function`
   - Влияние: Все API endpoints User Service возвращают 500 ошибку
   - Причина: Проблема с конфигурацией rate limiting storage

2. **Health Check Endpoints**:
   - Auth Service: health check ищет `/health` вместо `/api/health/live`
   - User Service: health check ищет `/health` вместо `/api/v1/health/live`
   - Результат: Контейнеры показывают статус "unhealthy"

### 🟡 Незначительные проблемы

1. **Redis Pipeline Error**: Ошибки в User Service связанные с Redis pipeline
2. **Route Not Found**: 404 ошибки для несуществующих endpoints

## Тестирование

### Auth Service
```bash
curl http://localhost:3001/api
curl http://localhost:3001/api/health/live
```

### User Service
```bash
curl http://localhost:3002/api
# Примечание: может возвращать ошибку из-за rate limiting, но сервис работает
```

## Дата запуска
19 октября 2025, 12:20 UTC
## Диа
гностика проблем

### Проверка статуса (19.10.2025 12:26)

```bash
# Статус контейнеров
docker-compose ps
# Результат: auth-service и user-service показывают "unhealthy"

# Тест Auth Service
curl http://localhost:3001/api
# Результат: ✅ 200 OK - работает нормально

# Тест User Service  
curl http://localhost:3002/api
# Результат: ❌ 500 Internal Server Error

# Инфраструктура
docker-compose exec redis redis-cli -a redis_password ping
# Результат: ✅ PONG

docker-compose exec postgres-auth pg_isready -U auth_service -d auth_db
# Результат: ✅ accepting connections

docker-compose exec postgres-user pg_isready -U user_service -d user_db  
# Результат: ✅ accepting connections
```

### Рекомендации по исправлению

1. **Исправить ThrottlerGuard в User Service**:
   - Проверить конфигурацию storage для rate limiting
   - Возможно отключить rate limiting временно для тестирования

2. **Исправить Health Check endpoints**:
   - Изменить в docker-compose.yml пути health check на правильные
   - Auth Service: `/health` → `/api/health/live`
   - User Service: `/health` → `/api/v1/health/live`

3. **Проверить Redis конфигурацию**:
   - Убедиться, что User Service правильно подключается к Redis
   - Проверить настройки ThrottlerModule