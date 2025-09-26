# Deployment Instructions - Notification Service MVP

## Overview

Данный документ содержит пошаговые инструкции по развертыванию Notification Service в production среде. Сервис поддерживает развертывание через Docker Compose и Kubernetes.

## 📋 Быстрый старт

### Минимальные требования
- Docker 20.10+ и Docker Compose 2.0+
- PostgreSQL 14+ и Redis 6+
- Российский email провайдер (Mail.ru или Yandex)

### Быстрое развертывание с Docker Compose

```bash
# 1. Клонирование и переход в директорию
git clone <repository-url>
cd backend/notification-service

# 2. Настройка переменных окружения
cp .env.example .env.production
# Отредактируйте .env.production с вашими значениями

# 3. Запуск production версии
docker-compose -f docker-compose.prod.yml up -d

# 4. Проверка работоспособности
curl http://localhost:3000/health
```

## 🔧 Детальная настройка

### 1. Подготовка переменных окружения

Создайте файл `.env.production` на основе `.env.example`:

```bash
# Основные настройки
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# База данных PostgreSQL
DB_HOST=postgresql-service
DB_PORT=5432
DB_USERNAME=notification_user
DB_PASSWORD=your_secure_password
DB_DATABASE=notification_db
DB_SSL=true
DB_SYNCHRONIZE=false

# Redis для кеширования
REDIS_HOST=redis-service
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
USE_REDIS_CACHE=true

# JWT аутентификация
JWT_SECRET=your_very_secure_jwt_secret_minimum_32_characters

# Email провайдер (Mail.ru или Yandex)
EMAIL_PROVIDER=mailru
EMAIL_API_KEY=your_email_api_key
EMAIL_FROM=noreply@yourgameplatform.ru

# CORS настройки
CORS_ORIGIN=https://yourgameplatform.ru,https://api.yourgameplatform.ru

# Интеграция с другими сервисами
USER_SERVICE_URL=http://user-service:3000
PAYMENT_SERVICE_URL=http://payment-service:3000
SOCIAL_SERVICE_URL=http://social-service:3000
ACHIEVEMENT_SERVICE_URL=http://achievement-service:3000
```

### 2. Настройка базы данных

```bash
# Создание базы данных и пользователя
psql -h your-postgres-host -U postgres -c "
CREATE DATABASE notification_db;
CREATE USER notification_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE notification_db TO notification_user;
"

# Выполнение миграций (после запуска сервиса)
docker-compose -f docker-compose.prod.yml exec notification-service npm run migration:run
```

## 🐳 Docker развертывание

### Сборка production образа

```bash
# Автоматическая сборка
npm run docker:prod:build

# Или ручная сборка
docker build --target production -t notification-service:latest .
```

### Запуск с Docker Compose

```bash
# Запуск всех сервисов
docker-compose -f docker-compose.prod.yml up -d

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f notification-service

# Остановка
docker-compose -f docker-compose.prod.yml down
```

## ☸️ Kubernetes развертывание

### Подготовка кластера

```bash
# Проверка подключения
kubectl cluster-info

# Создание namespace
kubectl create namespace notification-service
```

### Настройка секретов

```bash
# Создание секретов из .env файла
kubectl create secret generic notification-service-secrets \
  --from-env-file=.env.production \
  -n notification-service
```

### Автоматическое развертывание

```bash
# Использование скрипта развертывания
npm run k8s:deploy

# Или с кастомными параметрами
cd k8s
NAMESPACE=notification-service IMAGE_TAG=v1.0.0 ./deploy-production.sh
```

### Ручное развертывание

```bash
cd k8s

# Применение манифестов
kubectl apply -f serviceaccount.yaml -n notification-service
kubectl apply -f secrets.yaml -n notification-service
kubectl apply -f configmap.yaml -n notification-service
kubectl apply -f service.yaml -n notification-service
kubectl apply -f deployment.yaml -n notification-service
kubectl apply -f horizontalpodautoscaler.yaml -n notification-service

# Проверка развертывания
kubectl rollout status deployment/notification-service-deployment -n notification-service
```

## 🔍 Проверка развертывания

### Health checks

```bash
# Базовая проверка здоровья
curl http://localhost:3000/health

# Детальная проверка готовности
curl http://localhost:3000/health/ready

# Проверка живости
curl http://localhost:3000/health/live
```

### Функциональное тестирование

```bash
# Тест создания уведомления
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "userId": "test-user-id",
    "type": "SYSTEM",
    "title": "Тестовое уведомление",
    "message": "Проверка работы сервиса",
    "priority": "MEDIUM"
  }'

# Получение уведомлений пользователя
curl http://localhost:3000/notifications/user/test-user-id \
  -H "Authorization: Bearer your_jwt_token"
```

## 📊 Мониторинг

### Метрики приложения

```bash
# Prometheus метрики
curl http://localhost:3000/metrics

# Статистика приложения
curl http://localhost:3000/health/stats
```

### Kubernetes мониторинг

```bash
# Статус подов
kubectl get pods -l app=notification-service -n notification-service

# Использование ресурсов
kubectl top pods -l app=notification-service -n notification-service

# Логи
kubectl logs -f deployment/notification-service-deployment -n notification-service
```

## 🚨 Устранение неполадок

### Частые проблемы

#### Сервис не запускается
```bash
# Проверка логов
docker-compose -f docker-compose.prod.yml logs notification-service

# Или в Kubernetes
kubectl logs deployment/notification-service-deployment -n notification-service

# Проверка переменных окружения
docker-compose -f docker-compose.prod.yml exec notification-service env | grep -E "(DB_|REDIS_|EMAIL_)"
```

#### Проблемы с базой данных
```bash
# Проверка подключения к PostgreSQL
docker-compose -f docker-compose.prod.yml exec notification-service nc -zv postgresql-service 5432

# Проверка миграций
docker-compose -f docker-compose.prod.yml exec notification-service npm run typeorm migration:show
```

#### Проблемы с Redis
```bash
# Проверка подключения к Redis
docker-compose -f docker-compose.prod.yml exec notification-service nc -zv redis-service 6379

# Проверка кеша
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Отладка

```bash
# Включение debug логирования
# В .env.production установите LOG_LEVEL=debug

# Подключение к контейнеру
docker-compose -f docker-compose.prod.yml exec notification-service /bin/sh

# Или в Kubernetes
kubectl exec -it deployment/notification-service-deployment -n notification-service -- /bin/sh
```

## 🔄 Обновление сервиса

### Docker Compose

```bash
# Пересборка образа
npm run docker:prod:build

# Обновление сервиса
docker-compose -f docker-compose.prod.yml up -d --force-recreate notification-service
```

### Kubernetes

```bash
# Обновление образа
kubectl set image deployment/notification-service-deployment \
  notification-service=notification-service:new-tag \
  -n notification-service

# Откат к предыдущей версии
kubectl rollout undo deployment/notification-service-deployment -n notification-service
```

## 📋 Чеклист развертывания

Используйте [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) для проверки готовности к production.

### Основные пункты:
- [ ] Переменные окружения настроены
- [ ] Секреты заменены на production значения
- [ ] База данных и Redis доступны
- [ ] Email провайдер настроен
- [ ] Health checks проходят
- [ ] Мониторинг настроен
- [ ] Логирование работает

## 📚 Дополнительная документация

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md) - детальное руководство
- [Production Checklist](./PRODUCTION_CHECKLIST.md) - чеклист готовности
- [API Documentation](./API_DOCUMENTATION.md) - документация API
- [Integration Guide](./INTEGRATION_GUIDE.md) - интеграция с другими сервисами

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Убедитесь в доступности зависимостей (PostgreSQL, Redis)
3. Проверьте конфигурацию переменных окружения
4. Обратитесь к troubleshooting секции в [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
5. Создайте issue в репозитории проекта