#!/bin/bash

# Bash script for deploying User Service to staging environment
# Скрипт для развертывания User Service в staging окружении

set -e

# Параметры
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_VALIDATION=false
FORCE=false

# Обработка аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Неизвестный параметр: $1"
            echo "Использование: $0 [--skip-build] [--skip-tests] [--skip-validation] [--force]"
            exit 1
            ;;
    esac
done

echo "🚀 РАЗВЕРТЫВАНИЕ USER SERVICE В STAGING ОКРУЖЕНИИ"
echo "============================================================"

# Проверка Docker
echo ""
echo "🐳 Проверка Docker..."
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker или Docker Compose не установлены"
    exit 1
fi
echo "✅ Docker и Docker Compose доступны"

# Переход в корневую директорию backend
cd ..

# Остановка существующих staging контейнеров
echo ""
echo "🛑 Остановка существующих staging контейнеров..."
docker-compose -f docker-compose.staging.yml down -v --remove-orphans || echo "⚠️ Ошибка остановки контейнеров (возможно, они не запущены)"
echo "✅ Staging контейнеры остановлены"

# Сборка образов (если не пропущена)
if [ "$SKIP_BUILD" = false ]; then
    echo ""
    echo "🔨 Сборка Docker образов..."
    
    # Сборка User Service
    docker-compose -f docker-compose.staging.yml build user-service
    
    # Сборка зависимых сервисов
    docker-compose -f docker-compose.staging.yml build auth-service-staging
    docker-compose -f docker-compose.staging.yml build game-catalog-service-staging
    docker-compose -f docker-compose.staging.yml build payment-service-staging
    docker-compose -f docker-compose.staging.yml build security-service-staging
    
    echo "✅ Docker образы собраны успешно"
else
    echo ""
    echo "⏭️ Сборка пропущена (--skip-build)"
fi

# Запуск инфраструктуры (базы данных, Redis)
echo ""
echo "🗄️ Запуск инфраструктуры..."
docker-compose -f docker-compose.staging.yml up -d \
    postgres-user-staging \
    postgres-auth-staging \
    postgres-catalog-staging \
    postgres-payment-staging \
    postgres-security-staging \
    redis-staging

echo "✅ Инфраструктура запущена"

# Ожидание готовности баз данных
echo "⏳ Ожидание готовности баз данных (30 секунд)..."
sleep 30

# Запуск миграций User Service
echo ""
echo "📊 Выполнение миграций User Service..."
cd user-service

# Установка зависимостей (если нужно)
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm ci --legacy-peer-deps
fi

# Выполнение миграций
export NODE_ENV=staging
npm run migration:run
echo "✅ Миграции выполнены успешно"

cd ..

# Запуск всех сервисов
echo ""
echo "🚀 Запуск всех сервисов..."
docker-compose -f docker-compose.staging.yml up -d
echo "✅ Все сервисы запущены"

# Ожидание готовности сервисов
echo "⏳ Ожидание готовности сервисов (60 секунд)..."
sleep 60

# Проверка статуса контейнеров
echo ""
echo "📋 Проверка статуса контейнеров..."
docker-compose -f docker-compose.staging.yml ps

# Проверка health checks
echo ""
echo "🏥 Проверка health checks..."
MAX_ATTEMPTS=12
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "Попытка $ATTEMPT/$MAX_ATTEMPTS..."
    
    if curl -f -s http://localhost:3002/api/health/live > /dev/null 2>&1; then
        echo "✅ User Service отвечает на health check"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "❌ User Service не отвечает на health check после $MAX_ATTEMPTS попыток"
        echo "📋 Логи User Service:"
        docker-compose -f docker-compose.staging.yml logs --tail=50 user-service
        exit 1
    fi
    
    sleep 10
done

# Запуск тестов (если не пропущены)
if [ "$SKIP_TESTS" = false ]; then
    echo ""
    echo "🧪 Запуск integration тестов..."
    cd user-service
    
    export NODE_ENV=test
    export USER_SERVICE_URL=http://localhost:3002
    
    if npm run test:integration; then
        echo "✅ Integration тесты прошли успешно"
    else
        echo "❌ Integration тесты провалены"
        if [ "$FORCE" = false ]; then
            cd ..
            exit 1
        else
            echo "⚠️ Продолжение несмотря на провал тестов (--force)"
        fi
    fi
    
    cd ..
else
    echo ""
    echo "⏭️ Тесты пропущены (--skip-tests)"
fi

# Валидация staging окружения (если не пропущена)
if [ "$SKIP_VALIDATION" = false ]; then
    echo ""
    echo "✅ Запуск валидации staging окружения..."
    cd user-service
    
    export USER_SERVICE_URL=http://localhost:3002
    
    if npx ts-node -r tsconfig-paths/register scripts/validate-staging.ts; then
        echo "✅ Валидация staging окружения прошла успешно"
    else
        echo "❌ Валидация staging окружения провалена"
        if [ "$FORCE" = false ]; then
            cd ..
            exit 1
        else
            echo "⚠️ Продолжение несмотря на провал валидации (--force)"
        fi
    fi
    
    cd ..
else
    echo ""
    echo "⏭️ Валидация пропущена (--skip-validation)"
fi

# Запуск мониторинга
echo ""
echo "📊 Запуск мониторинга..."
if docker-compose -f docker-compose.staging.yml up -d prometheus-staging grafana-staging; then
    echo "✅ Мониторинг запущен"
    echo "📊 Prometheus: http://localhost:9090"
    echo "📈 Grafana: http://localhost:3100 (admin/staging_admin)"
else
    echo "⚠️ Ошибка запуска мониторинга"
fi

# Финальная информация
echo ""
echo "🎉 STAGING РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!"
echo "============================================================"

echo ""
echo "📋 Доступные сервисы:"
echo "🔐 User Service: http://localhost:3002/api"
echo "📚 API Docs: http://localhost:3002/api/api-docs"
echo "🏥 Health Check: http://localhost:3002/api/health"
echo "📊 Metrics: http://localhost:3002/metrics"
echo "🔐 Auth Service: http://localhost:3001"
echo "🎮 Game Catalog: http://localhost:3003"
echo "💳 Payment Service: http://localhost:3006"
echo "🛡️ Security Service: http://localhost:3010"

echo ""
echo "🗄️ Инфраструктура:"
echo "🐘 PostgreSQL User: localhost:5433"
echo "🐘 PostgreSQL Auth: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo "📊 Prometheus: http://localhost:9090"
echo "📈 Grafana: http://localhost:3100"

echo ""
echo "🔧 Полезные команды:"
echo "📋 Статус: docker-compose -f docker-compose.staging.yml ps"
echo "📜 Логи: docker-compose -f docker-compose.staging.yml logs -f user-service"
echo "🛑 Остановка: docker-compose -f docker-compose.staging.yml down"
echo "🔄 Перезапуск: docker-compose -f docker-compose.staging.yml restart user-service"

echo ""
echo "✅ User Service готов к валидации и тестированию в staging окружении!"