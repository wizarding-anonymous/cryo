# Production Deployment Guide - Notification Service

Это руководство описывает процесс развертывания Notification Service в production среде с использованием Docker и Kubernetes.

## 📋 Содержание

- [Требования](#требования)
- [Подготовка к развертыванию](#подготовка-к-развертыванию)
- [Docker развертывание](#docker-развертывание)
- [Kubernetes развертывание](#kubernetes-развертывание)
- [Мониторинг и логирование](#мониторинг-и-логирование)
- [Безопасность](#безопасность)
- [Устранение неполадок](#устранение-неполадок)

## 🔧 Требования

### Системные требования
- **CPU**: минимум 2 ядра, рекомендуется 4+ ядер
- **RAM**: минимум 2GB, рекомендуется 4GB+
- **Диск**: минимум 10GB свободного места
- **Сеть**: стабильное интернет-соединение

### Программное обеспечение
- Docker 20.10+
- Docker Compose 2.0+
- Kubernetes 1.20+ (для K8s развертывания)
- kubectl (для K8s развертывания)

### Внешние зависимости
- PostgreSQL 14+
- Redis 6+
- Российский email провайдер (Mail.ru, Yandex)

## 🚀 Подготовка к развертыванию

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd backend/notification-service
```

### 2. Настройка переменных окружения
```bash
# Скопируйте и настройте production конфигурацию
cp .env.example .env.production

# Отредактируйте .env.production с вашими значениями
nano .env.production
```

### 3. Настройка секретов
Убедитесь, что следующие секреты настроены:
- `JWT_SECRET` - сильный JWT секрет (минимум 32 символа)
- `DB_PASSWORD` - пароль базы данных
- `REDIS_PASSWORD` - пароль Redis (если используется)
- `EMAIL_API_KEY` - API ключ email провайдера

## 🐳 Docker развертывание

### Быстрое развертывание с Docker Compose

```bash
# Сборка и запуск production версии
docker-compose -f docker-compose.prod.yml up -d

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f notification-service
```

### Ручная сборка Docker образа

```bash
# Сборка production образа
./scripts/build-production.sh

# Или вручную
docker build --target production -t notification-service:latest .

# Запуск контейнера
docker run -d \
  --name notification-service \
  -p 3000:3000 \
  --env-file .env.production \
  notification-service:latest
```

### Проверка работоспособности

```bash
# Health check
curl http://localhost:3000/health

# API документация (только в dev режиме)
curl http://localhost:3000/api
```

## ☸️ Kubernetes развертывание

### Подготовка Kubernetes кластера

```bash
# Проверка подключения к кластеру
kubectl cluster-info

# Создание namespace (если нужно)
kubectl create namespace notification-service
```

### Настройка секретов

```bash
# Создание секретов из файла
kubectl create secret generic notification-service-secrets \
  --from-env-file=.env.production \
  -n notification-service

# Или применение YAML файла (предварительно закодировав секреты в base64)
kubectl apply -f k8s/secrets.yaml -n notification-service
```

### Развертывание с помощью скрипта

```bash
# Автоматическое развертывание
cd k8s
./deploy-production.sh

# С кастомными параметрами
NAMESPACE=notification-service IMAGE_TAG=v1.0.0 ./deploy-production.sh
```

### Ручное развертывание

```bash
cd k8s

# Применение манифестов в правильном порядке
kubectl apply -f serviceaccount.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f service.yaml
kubectl apply -f poddisruptionbudget.yaml
kubectl apply -f deployment.yaml
kubectl apply -f horizontalpodautoscaler.yaml

# Проверка статуса развертывания
kubectl rollout status deployment/notification-service-deployment
```

### Проверка развертывания

```bash
# Проверка подов
kubectl get pods -l app=notification-service

# Проверка сервисов
kubectl get services -l app=notification-service

# Просмотр логов
kubectl logs -f deployment/notification-service-deployment

# Port forwarding для тестирования
kubectl port-forward service/notification-service 3000:3000
curl http://localhost:3000/health
```

## 📊 Мониторинг и логирование

### Настройка мониторинга

```bash
# Применение мониторинга (требует Prometheus Operator)
kubectl apply -f k8s/monitoring.yaml
```

### Просмотр метрик

```bash
# Метрики приложения
curl http://localhost:3000/metrics

# Метрики Kubernetes
kubectl top pods -l app=notification-service
kubectl top nodes
```

### Логирование

Логи в production режиме выводятся в JSON формате для лучшей интеграции с системами логирования:

```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": "NotificationService",
  "message": "Notification sent successfully",
  "service": "notification-service"
}
```

### Настройка централизованного логирования

```bash
# Пример с Fluentd
kubectl apply -f https://raw.githubusercontent.com/fluent/fluentd-kubernetes-daemonset/master/fluentd-daemonset-elasticsearch-rbac.yaml
```

## 🔒 Безопасность

### Сетевая безопасность

```bash
# Применение Network Policies (пример)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: notification-service-netpol
spec:
  podSelector:
    matchLabels:
      app: notification-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
EOF
```

### Сканирование уязвимостей

```bash
# Сканирование Docker образа
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image notification-service:latest

# Сканирование Kubernetes манифестов
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
```

### Обновления безопасности

```bash
# Регулярное обновление базового образа
docker pull node:20-alpine
docker build --no-cache -t notification-service:latest .

# Обновление зависимостей
npm audit fix
npm update
```

## 🔧 Масштабирование

### Горизонтальное масштабирование

```bash
# Ручное масштабирование
kubectl scale deployment notification-service-deployment --replicas=5

# Автоматическое масштабирование уже настроено через HPA
kubectl get hpa notification-service-hpa
```

### Вертикальное масштабирование

```bash
# Обновление ресурсов
kubectl patch deployment notification-service-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"notification-service","resources":{"requests":{"memory":"512Mi","cpu":"500m"},"limits":{"memory":"1Gi","cpu":"1000m"}}}]}}}}'
```

## 🚨 Устранение неполадок

### Общие проблемы

#### Проблема: Под не запускается
```bash
# Проверка событий
kubectl describe pod <pod-name>

# Проверка логов
kubectl logs <pod-name> --previous

# Проверка ресурсов
kubectl top pod <pod-name>
```

#### Проблема: Health check не проходит
```bash
# Проверка health endpoint
kubectl exec -it <pod-name> -- curl localhost:3000/health

# Проверка подключения к БД
kubectl exec -it <pod-name> -- nc -zv postgresql-service 5432
```

#### Проблема: Высокое потребление памяти
```bash
# Анализ использования памяти
kubectl exec -it <pod-name> -- node -e "console.log(process.memoryUsage())"

# Проверка метрик
kubectl top pod <pod-name>
```

### Отладка

```bash
# Включение debug логирования
kubectl set env deployment/notification-service-deployment LOG_LEVEL=debug

# Подключение к контейнеру
kubectl exec -it <pod-name> -- /bin/sh

# Проверка конфигурации
kubectl exec -it <pod-name> -- env | grep -E "(DB_|REDIS_|EMAIL_)"
```

### Резервное копирование и восстановление

```bash
# Резервное копирование конфигурации
kubectl get configmap notification-service-config -o yaml > backup-configmap.yaml
kubectl get secret notification-service-secrets -o yaml > backup-secrets.yaml

# Восстановление
kubectl apply -f backup-configmap.yaml
kubectl apply -f backup-secrets.yaml
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Убедитесь в доступности внешних зависимостей
3. Проверьте конфигурацию переменных окружения
4. Обратитесь к документации API
5. Создайте issue в репозитории проекта

## 📚 Дополнительные ресурсы

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [NestJS Production Guide](https://docs.nestjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)