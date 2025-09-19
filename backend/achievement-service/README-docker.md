# Achievement Service - Docker Setup

Этот документ описывает настройку и использование Docker для Achievement Service.

## Структура файлов

```
├── Dockerfile                 # Основной Dockerfile с multi-stage build
├── .dockerignore             # Исключения для Docker build
├── docker-compose.yml        # Development/staging окружение
├── docker-compose.prod.yml   # Production окружение
├── .env.development          # Development переменные
├── .env.production           # Production переменные
├── .env.test                 # Test переменные
├── k8s/                      # Kubernetes конфигурации
│   ├── deployment.yaml       # Deployment и Service
│   └── configmap.yaml        # ConfigMap
└── scripts/
    ├── docker-build.sh       # Build script (Linux/Mac)
    ├── docker-build.ps1      # Build script (Windows)
    └── init-db.sql           # Database initialization
```

## Быстрый старт

### 1. Development окружение

```bash
# Сборка образа для разработки
npm run docker:build:dev

# Запуск всех сервисов
npm run docker:up

# Просмотр логов
npm run docker:logs

# Остановка сервисов
npm run docker:down
```

### 2. Production окружение

```bash
# Сборка production образа
npm run docker:build:prod

# Запуск production окружения
npm run docker:up:prod

# Остановка production окружения
npm run docker:down:prod
```

## Переменные окружения

### Development (.env.development)
- `NODE_ENV=development`
- `DATABASE_SYNCHRONIZE=true` - автосинхронизация схемы
- `DATABASE_LOGGING=true` - подробное логирование
- `LOG_LEVEL=debug` - детальные логи

### Production (.env.production)
- `NODE_ENV=production`
- `DATABASE_SYNCHRONIZE=false` - только миграции
- `DATABASE_LOGGING=false` - минимальное логирование
- `LOG_LEVEL=info` - информационные логи

### Test (.env.test)
- `NODE_ENV=test`
- Отдельные порты для изоляции тестов
- Быстрые настройки кеша

## Health Checks

Сервис предоставляет несколько endpoints для мониторинга:

- `GET /api/v1/health` - общий health check
- `GET /api/v1/health/ready` - readiness probe (для Kubernetes)
- `GET /api/v1/health/live` - liveness probe (для Kubernetes)

## Kubernetes Deployment

### 1. Применение конфигураций

```bash
# Применить ConfigMap
kubectl apply -f k8s/configmap.yaml

# Применить Deployment и Service
kubectl apply -f k8s/deployment.yaml
```

### 2. Проверка статуса

```bash
# Проверить pods
kubectl get pods -l app=achievement-service

# Проверить service
kubectl get svc achievement-service

# Просмотр логов
kubectl logs -l app=achievement-service -f
```

### 3. Health Checks в Kubernetes

Kubernetes использует следующие probes:

- **Liveness Probe**: `/api/v1/health/live` - проверяет жизнеспособность
- **Readiness Probe**: `/api/v1/health/ready` - проверяет готовность к трафику
- **Startup Probe**: `/api/v1/health` - проверяет успешный запуск

## Мониторинг и логирование

### Docker Compose

```bash
# Просмотр логов всех сервисов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f achievement-service

# Мониторинг ресурсов
docker stats
```

### Kubernetes

```bash
# Логи всех pods
kubectl logs -l app=achievement-service -f

# Мониторинг ресурсов
kubectl top pods -l app=achievement-service
```

## Безопасность

### 1. Пользователь в контейнере
- Контейнер запускается от пользователя `nestjs` (UID 1001)
- Не используется root пользователь

### 2. Секреты
- Пароли и ключи хранятся в Kubernetes Secrets
- Environment variables не содержат чувствительных данных в открытом виде

### 3. Сетевая безопасность
- Контейнеры изолированы в отдельной сети
- Открыты только необходимые порты

## Оптимизация

### 1. Multi-stage build
- Отдельные стадии для dependencies, build и runtime
- Минимальный размер финального образа

### 2. Кеширование слоев
- Оптимальный порядок COPY команд
- Использование .dockerignore

### 3. Ресурсы
- Настроены лимиты памяти и CPU
- Health checks с разумными таймаутами

## Troubleshooting

### 1. Проблемы с подключением к БД

```bash
# Проверить статус PostgreSQL
docker-compose exec postgres pg_isready -U achievement_user

# Проверить логи БД
docker-compose logs postgres
```

### 2. Проблемы с Redis

```bash
# Проверить подключение к Redis
docker-compose exec redis redis-cli ping

# Проверить логи Redis
docker-compose logs redis
```

### 3. Проблемы с приложением

```bash
# Проверить health endpoint
curl http://localhost:3003/api/v1/health

# Проверить логи приложения
docker-compose logs achievement-service
```

## Команды для разработки

```bash
# Пересборка только приложения
docker-compose build achievement-service

# Запуск с пересборкой
docker-compose up --build

# Очистка неиспользуемых образов
docker system prune

# Очистка volumes (ОСТОРОЖНО!)
docker-compose down -v
```