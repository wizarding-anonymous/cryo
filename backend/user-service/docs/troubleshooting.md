# Troubleshooting Guide

Руководство по диагностике и решению проблем User Service.

## 🚨 Частые проблемы и решения

### 1. Проблемы компиляции TypeScript

#### ❌ Проблема: Ошибки компиляции TypeScript
```bash
error TS2307: Cannot find module '../reputation.service' or its corresponding type declarations.
```

#### ✅ Решение:
```bash
# 1. Проверьте версию TypeScript
npm list typescript

# 2. Обновите до версии 5.3.0
npm install typescript@5.3.0 --save-dev

# 3. Проверьте tsconfig.json
cat tsconfig.json

# 4. Очистите кэш и пересоберите
npm run clean
npm install
npm run build
```

#### ✅ Проверка успешности:
```bash
# Компиляция без ошибок
npx tsc --noEmit

# Успешная сборка
npm run build

# Все тесты проходят
npm test
```

### 2. Проблемы с зависимостями

#### ❌ Проблема: Ошибки установки зависимостей
```bash
npm error code 1
npm error command failed
```

#### ✅ Решение:
```bash
# 1. Очистите кэш npm
npm cache clean --force

# 2. Удалите node_modules и package-lock.json
rm -rf node_modules package-lock.json

# 3. Переустановите зависимости
npm install

# 4. Если проблема с husky
npm config set ignore-scripts true
npm install
npm config set ignore-scripts false
```

### 3. Проблемы с базой данных

#### ❌ Проблема: Не удается подключиться к PostgreSQL
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

#### ✅ Решение:
```bash
# 1. Проверьте статус PostgreSQL
docker-compose ps postgres

# 2. Запустите базу данных
docker-compose up -d postgres

# 3. Проверьте подключение
docker-compose exec postgres psql -U postgres -d userservice -c "SELECT 1;"

# 4. Проверьте переменные окружения
echo $DATABASE_URL
```

#### ❌ Проблема: Ошибки миграций
```bash
Error: relation "users" does not exist
```

#### ✅ Решение:
```bash
# 1. Проверьте статус миграций
npm run migration:show

# 2. Примените миграции
npm run migration:run

# 3. Если нужно откатить
npm run migration:revert

# 4. Создайте новую миграцию при необходимости
npm run migration:generate -- -n FixUserTable
```

### 4. Проблемы с Redis

#### ❌ Проблема: Redis недоступен
```bash
Error: Redis connection to 127.0.0.1:6379 failed
```

#### ✅ Решение:
```bash
# 1. Проверьте статус Redis
docker-compose ps redis

# 2. Запустите Redis
docker-compose up -d redis

# 3. Проверьте подключение
docker-compose exec redis redis-cli ping

# 4. Очистите кэш при необходимости
docker-compose exec redis redis-cli FLUSHALL
```

### 5. Проблемы с OAuth провайдерами

#### ❌ Проблема: OAuth аутентификация не работает
```bash
Error: invalid_client
```

#### ✅ Решение:
```bash
# 1. Проверьте конфигурацию OAuth
curl -X GET http://localhost:3001/auth/oauth/vk

# 2. Проверьте переменные окружения
echo $VK_CLIENT_ID
echo $VK_CLIENT_SECRET

# 3. Тестируйте callback
curl -X POST http://localhost:3001/auth/oauth/vk/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code"}'

# 4. Проверьте логи
docker-compose logs user-service | grep oauth
```

### 6. Проблемы производительности

#### ❌ Проблема: Медленные запросы
```bash
Response time > 1000ms
```

#### ✅ Диагностика:
```bash
# 1. Проверьте метрики
curl http://localhost:3001/metrics | grep http_request_duration

# 2. Проверьте подключения к БД
curl http://localhost:3001/health/detailed

# 3. Мониторинг ресурсов
docker stats user-service

# 4. Анализ медленных запросов
docker-compose exec postgres psql -U postgres -d userservice \
  -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### ✅ Решения:
- Добавьте индексы для медленных запросов
- Увеличьте connection pool
- Настройте кэширование Redis
- Оптимизируйте N+1 запросы

### 7. Проблемы с тестами

#### ❌ Проблема: Тесты падают
```bash
FAIL src/application/services/user.service.spec.ts
```

#### ✅ Решение:
```bash
# 1. Запустите конкретный тест
npm test -- --testPathPattern="user.service.spec.ts"

# 2. Запустите с подробным выводом
npm test -- --verbose

# 3. Очистите кэш Jest
npm test -- --clearCache

# 4. Проверьте покрытие
npm run test:cov
```

### 8. Проблемы с Docker

#### ❌ Проблема: Контейнер не запускается
```bash
Error: Container exited with code 1
```

#### ✅ Решение:
```bash
# 1. Проверьте логи
docker-compose logs user-service

# 2. Пересоберите образ
docker-compose build --no-cache user-service

# 3. Проверьте переменные окружения
docker-compose config

# 4. Запустите в интерактивном режиме
docker-compose run --rm user-service sh
```

## 🔍 Диагностические команды

### Проверка состояния системы
```bash
# Общее состояние
curl http://localhost:3001/health

# Детальная проверка
curl http://localhost:3001/health/detailed

# Метрики Prometheus
curl http://localhost:3001/metrics

# Статус интеграций
curl http://localhost:3001/integration-monitoring/health
```

### Проверка логов
```bash
# Логи приложения
docker-compose logs -f user-service

# Логи базы данных
docker-compose logs -f postgres

# Логи Redis
docker-compose logs -f redis

# Системные логи (в Kubernetes)
kubectl logs -f deployment/user-service
```

### Проверка производительности
```bash
# Использование ресурсов
docker stats

# Активные соединения
netstat -an | grep :3001

# Процессы Node.js
ps aux | grep node

# Память и CPU
top -p $(pgrep -f user-service)
```

## 📊 Мониторинг и алерты

### Ключевые метрики для мониторинга
- **HTTP Response Time**: < 500ms для 95% запросов
- **Error Rate**: < 1% от общего количества запросов
- **Database Connections**: < 80% от максимального пула
- **Memory Usage**: < 85% от доступной памяти
- **CPU Usage**: < 80% от доступных ресурсов

### Настройка алертов
```yaml
# Prometheus Alert Rules
groups:
- name: user-service
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate in User Service"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time in User Service"
```

## 🆘 Экстренные процедуры

### Полный перезапуск сервиса
```bash
# Docker Compose
docker-compose down
docker-compose up -d

# Kubernetes
kubectl rollout restart deployment/user-service
kubectl rollout status deployment/user-service
```

### Откат к предыдущей версии
```bash
# Kubernetes
kubectl rollout undo deployment/user-service
kubectl rollout status deployment/user-service

# Docker
docker-compose down
docker-compose pull user-service:previous-tag
docker-compose up -d
```

### Восстановление из backup
```bash
# Восстановление базы данных
./scripts/backup-restore.sh restore-db backup-2025-09-01.sql

# Восстановление Redis
./scripts/backup-restore.sh restore-redis backup-2025-09-01.rdb

# Проверка целостности
./scripts/backup-restore.sh verify
```

## 📞 Контакты поддержки

### Уровни эскалации
1. **L1 Support**: Базовые проблемы, перезапуски
2. **L2 Support**: Конфигурация, интеграции
3. **L3 Support**: Архитектурные проблемы, разработка

### Каналы связи
- **Slack**: #user-service-support (24/7)
- **Email**: support@cryo-platform.ru
- **Phone**: +7 (xxx) xxx-xx-xx (критические проблемы)
- **GitHub Issues**: Для багов и feature requests

### SLA
- **Критические проблемы**: Ответ в течение 1 часа
- **Высокий приоритет**: Ответ в течение 4 часов
- **Средний приоритет**: Ответ в течение 24 часов
- **Низкий приоритет**: Ответ в течение 72 часов

---

**Последнее обновление:** 1 сентября 2025  
**Версия:** 2.0.0