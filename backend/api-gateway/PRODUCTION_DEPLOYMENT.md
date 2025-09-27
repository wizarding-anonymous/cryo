# API Gateway - Production Deployment Guide

## Обзор

Этот документ описывает процесс развертывания API Gateway в production среде с полной готовностью к работе в российской игровой платформе.

## Предварительные требования

### Системные требования
- Node.js 20+ LTS
- Redis 6.0+
- Docker 20.10+ (для контейнеризации)
- Kubernetes 1.24+ (для оркестрации)

### Переменные окружения

#### Обязательные переменные
```bash
NODE_ENV=production
PORT=3001

# Redis
REDIS_HOST=redis-cache
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Микросервисы
SERVICE_USER_BASE_URL=http://user-service:3001
SERVICE_GAME_CATALOG_BASE_URL=http://game-catalog-service:3002
SERVICE_PAYMENT_BASE_URL=http://payment-service:3005
SERVICE_LIBRARY_BASE_URL=http://library-service:3003
SERVICE_NOTIFICATION_BASE_URL=http://notification-service:3006
SERVICE_REVIEW_BASE_URL=http://review-service:3004
SERVICE_ACHIEVEMENT_BASE_URL=http://achievement-service:3008
SERVICE_SECURITY_BASE_URL=http://security-service:3009
SERVICE_SOCIAL_BASE_URL=http://social-service:3007
SERVICE_DOWNLOAD_BASE_URL=http://download-service:3010
```

#### Рекомендуемые переменные
```bash
# Производительность
NODE_OPTIONS="--max-old-space-size=768 --enable-source-maps"
UV_THREADPOOL_SIZE=16

# Безопасность
CORS_ORIGIN=https://cryo-gaming.ru,https://www.cryo-gaming.ru
RATE_LIMIT_MAX_REQUESTS=1000

# Логирование
LOG_LEVEL=warn
```

## Процесс развертывания

### 1. Подготовка образа Docker

```bash
# Сборка production образа
docker build -t api-gateway:latest .

# Проверка образа
docker run --rm api-gateway:latest node --version
```

### 2. Проверка готовности

```bash
# Запуск проверки готовности (PowerShell)
.\scripts\start-production.ps1 -ValidateOnly

# Или bash
./scripts/start-production.sh --validate-only
```

### 3. Развертывание в Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: api-gateway:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-cache"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/readiness
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "768Mi"
            cpu: "500m"
```

### 4. Настройка мониторинга

#### Health Checks
- **Liveness**: `GET /api/health` - базовая проверка работоспособности
- **Readiness**: `GET /api/health/readiness` - комплексная проверка готовности
- **Services**: `GET /api/health/services` - состояние микросервисов

#### Метрики
- **Prometheus**: `GET /api/metrics` - метрики в формате Prometheus
- **Custom**: Встроенные метрики производительности и ошибок

### 5. Проверка развертывания

```bash
# Проверка базового здоровья
curl http://your-gateway/api/health

# Комплексная проверка готовности
curl http://your-gateway/api/health/readiness

# Проверка микросервисов
curl http://your-gateway/api/health/services

# Использование PowerShell скрипта
.\scripts\health-check.ps1 -Endpoint "http://your-gateway" -Detailed -Readiness
```

## Мониторинг и алертинг

### Ключевые метрики для мониторинга

1. **Доступность**
   - Uptime API Gateway
   - Response time < 200ms
   - Error rate < 1%

2. **Производительность**
   - Requests per second
   - Memory usage < 80%
   - CPU usage < 70%

3. **Микросервисы**
   - Health status всех сервисов
   - Circuit breaker состояние
   - Rate limiting эффективность

### Алерты

```yaml
# Пример Prometheus алертов
groups:
- name: api-gateway
  rules:
  - alert: APIGatewayDown
    expr: up{job="api-gateway"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "API Gateway is down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
```

## Безопасность

### Настройки безопасности

1. **CORS**: Настроен только для доверенных доменов
2. **Rate Limiting**: 1000 запросов в минуту по умолчанию
3. **Security Headers**: Автоматически добавляются в production
4. **JWT Validation**: Строгая валидация токенов

### Рекомендации

- Используйте HTTPS в production
- Настройте WAF (Web Application Firewall)
- Регулярно обновляйте зависимости
- Мониторьте подозрительную активность

## Масштабирование

### Горизонтальное масштабирование

```yaml
# HPA для Kubernetes
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Вертикальное масштабирование

- **Memory**: Увеличьте `--max-old-space-size` при необходимости
- **CPU**: Настройте `UV_THREADPOOL_SIZE` для I/O операций
- **Redis**: Используйте Redis Cluster для высокой нагрузки

## Troubleshooting

### Частые проблемы

1. **Медленный отклик**
   - Проверьте состояние микросервисов
   - Проверьте Redis подключение
   - Мониторьте memory usage

2. **Ошибки подключения**
   - Проверьте network policies в Kubernetes
   - Валидируйте service discovery
   - Проверьте DNS resolution

3. **Memory leaks**
   - Мониторьте heap usage
   - Проверьте connection pooling
   - Анализируйте garbage collection

### Логи и диагностика

```bash
# Просмотр логов в Kubernetes
kubectl logs -f deployment/api-gateway

# Проверка метрик
curl http://your-gateway/api/metrics

# Детальная диагностика
.\scripts\health-check.ps1 -Detailed -Readiness
```

## Rollback план

### Быстрый откат

```bash
# Kubernetes rollback
kubectl rollout undo deployment/api-gateway

# Проверка статуса
kubectl rollout status deployment/api-gateway
```

### Проверка после отката

```bash
# Проверка здоровья
.\scripts\health-check.ps1 -Endpoint "http://your-gateway" -Detailed

# Проверка версии
curl http://your-gateway/api/health
```

## Поддержка

Для получения поддержки или сообщения о проблемах:

1. Проверьте логи приложения
2. Выполните health checks
3. Соберите метрики системы
4. Создайте issue с детальным описанием проблемы

---

**Важно**: Всегда тестируйте изменения в staging среде перед развертыванием в production.