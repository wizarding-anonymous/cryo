# PowerShell script for deploying User Service to staging environment
# Скрипт для развертывания User Service в staging окружении

param(
    [switch]$SkipBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$SkipValidation = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 РАЗВЕРТЫВАНИЕ USER SERVICE В STAGING ОКРУЖЕНИИ" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

# Проверка Docker
Write-Host "`n🐳 Проверка Docker..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker и Docker Compose доступны" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker или Docker Compose не установлены" -ForegroundColor Red
    exit 1
}

# Переход в корневую директорию backend
Set-Location -Path ".."

# Остановка существующих staging контейнеров
Write-Host "`n🛑 Остановка существующих staging контейнеров..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.staging.yml down -v --remove-orphans
    Write-Host "✅ Staging контейнеры остановлены" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Ошибка остановки контейнеров (возможно, они не запущены)" -ForegroundColor Yellow
}

# Сборка образов (если не пропущена)
if (-not $SkipBuild) {
    Write-Host "`n🔨 Сборка Docker образов..." -ForegroundColor Yellow
    try {
        # Сборка User Service
        docker-compose -f docker-compose.staging.yml build user-service
        
        # Сборка зависимых сервисов
        docker-compose -f docker-compose.staging.yml build auth-service-staging
        docker-compose -f docker-compose.staging.yml build game-catalog-service-staging
        docker-compose -f docker-compose.staging.yml build payment-service-staging
        docker-compose -f docker-compose.staging.yml build security-service-staging
        
        Write-Host "✅ Docker образы собраны успешно" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ошибка сборки Docker образов: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n⏭️ Сборка пропущена (--SkipBuild)" -ForegroundColor Yellow
}

# Запуск инфраструктуры (базы данных, Redis)
Write-Host "`n🗄️ Запуск инфраструктуры..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.staging.yml up -d postgres-user-staging postgres-auth-staging postgres-catalog-staging postgres-payment-staging postgres-security-staging redis-staging
    Write-Host "✅ Инфраструктура запущена" -ForegroundColor Green
    
    # Ожидание готовности баз данных
    Write-Host "⏳ Ожидание готовности баз данных (30 секунд)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
} catch {
    Write-Host "❌ Ошибка запуска инфраструктуры: $_" -ForegroundColor Red
    exit 1
}

# Запуск миграций User Service
Write-Host "`n📊 Выполнение миграций User Service..." -ForegroundColor Yellow
Set-Location -Path "user-service"
try {
    # Установка зависимостей (если нужно)
    if (-not (Test-Path "node_modules")) {
        Write-Host "📦 Установка зависимостей..." -ForegroundColor Yellow
        npm ci --legacy-peer-deps
    }
    
    # Выполнение миграций
    $env:NODE_ENV = "staging"
    npm run migration:run
    Write-Host "✅ Миграции выполнены успешно" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка выполнения миграций: $_" -ForegroundColor Red
    Set-Location -Path ".."
    exit 1
}
Set-Location -Path ".."

# Запуск всех сервисов
Write-Host "`n🚀 Запуск всех сервисов..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.staging.yml up -d
    Write-Host "✅ Все сервисы запущены" -ForegroundColor Green
    
    # Ожидание готовности сервисов
    Write-Host "⏳ Ожидание готовности сервисов (60 секунд)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60
} catch {
    Write-Host "❌ Ошибка запуска сервисов: $_" -ForegroundColor Red
    exit 1
}

# Проверка статуса контейнеров
Write-Host "`n📋 Проверка статуса контейнеров..." -ForegroundColor Yellow
docker-compose -f docker-compose.staging.yml ps

# Проверка health checks
Write-Host "`n🏥 Проверка health checks..." -ForegroundColor Yellow
$maxAttempts = 12
$attempt = 0

do {
    $attempt++
    Write-Host "Попытка $attempt/$maxAttempts..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3002/api/health/live" -TimeoutSec 10
        if ($response) {
            Write-Host "✅ User Service отвечает на health check" -ForegroundColor Green
            break
        }
    } catch {
        if ($attempt -eq $maxAttempts) {
            Write-Host "❌ User Service не отвечает на health check после $maxAttempts попыток" -ForegroundColor Red
            Write-Host "📋 Логи User Service:" -ForegroundColor Yellow
            docker-compose -f docker-compose.staging.yml logs --tail=50 user-service
            exit 1
        }
        Start-Sleep -Seconds 10
    }
} while ($attempt -lt $maxAttempts)

# Запуск тестов (если не пропущены)
if (-not $SkipTests) {
    Write-Host "`n🧪 Запуск integration тестов..." -ForegroundColor Yellow
    Set-Location -Path "user-service"
    try {
        $env:NODE_ENV = "test"
        $env:USER_SERVICE_URL = "http://localhost:3002"
        npm run test:integration
        Write-Host "✅ Integration тесты прошли успешно" -ForegroundColor Green
    } catch {
        Write-Host "❌ Integration тесты провалены: $_" -ForegroundColor Red
        if (-not $Force) {
            Set-Location -Path ".."
            exit 1
        } else {
            Write-Host "⚠️ Продолжение несмотря на провал тестов (--Force)" -ForegroundColor Yellow
        }
    }
    Set-Location -Path ".."
} else {
    Write-Host "`n⏭️ Тесты пропущены (--SkipTests)" -ForegroundColor Yellow
}

# Валидация staging окружения (если не пропущена)
if (-not $SkipValidation) {
    Write-Host "`n✅ Запуск валидации staging окружения..." -ForegroundColor Yellow
    Set-Location -Path "user-service"
    try {
        $env:USER_SERVICE_URL = "http://localhost:3002"
        npx ts-node -r tsconfig-paths/register scripts/validate-staging.ts
        Write-Host "✅ Валидация staging окружения прошла успешно" -ForegroundColor Green
    } catch {
        Write-Host "❌ Валидация staging окружения провалена: $_" -ForegroundColor Red
        if (-not $Force) {
            Set-Location -Path ".."
            exit 1
        } else {
            Write-Host "⚠️ Продолжение несмотря на провал валидации (--Force)" -ForegroundColor Yellow
        }
    }
    Set-Location -Path ".."
} else {
    Write-Host "`n⏭️ Валидация пропущена (--SkipValidation)" -ForegroundColor Yellow
}

# Запуск мониторинга
Write-Host "`n📊 Запуск мониторинга..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.staging.yml up -d prometheus-staging grafana-staging
    Write-Host "✅ Мониторинг запущен" -ForegroundColor Green
    Write-Host "📊 Prometheus: http://localhost:9090" -ForegroundColor Cyan
    Write-Host "📈 Grafana: http://localhost:3100 (admin/staging_admin)" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️ Ошибка запуска мониторинга: $_" -ForegroundColor Yellow
}

# Финальная информация
Write-Host "`n🎉 STAGING РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

Write-Host "`n📋 Доступные сервисы:" -ForegroundColor Cyan
Write-Host "🔐 User Service: http://localhost:3002/api" -ForegroundColor White
Write-Host "📚 API Docs: http://localhost:3002/api/api-docs" -ForegroundColor White
Write-Host "🏥 Health Check: http://localhost:3002/api/health" -ForegroundColor White
Write-Host "📊 Metrics: http://localhost:3002/metrics" -ForegroundColor White
Write-Host "🔐 Auth Service: http://localhost:3001" -ForegroundColor White
Write-Host "🎮 Game Catalog: http://localhost:3003" -ForegroundColor White
Write-Host "💳 Payment Service: http://localhost:3006" -ForegroundColor White
Write-Host "🛡️ Security Service: http://localhost:3010" -ForegroundColor White

Write-Host "`n🗄️ Инфраструктура:" -ForegroundColor Cyan
Write-Host "🐘 PostgreSQL User: localhost:5433" -ForegroundColor White
Write-Host "🐘 PostgreSQL Auth: localhost:5432" -ForegroundColor White
Write-Host "🔴 Redis: localhost:6379" -ForegroundColor White
Write-Host "📊 Prometheus: http://localhost:9090" -ForegroundColor White
Write-Host "📈 Grafana: http://localhost:3100" -ForegroundColor White

Write-Host "`n🔧 Полезные команды:" -ForegroundColor Cyan
Write-Host "📋 Статус: docker-compose -f docker-compose.staging.yml ps" -ForegroundColor White
Write-Host "📜 Логи: docker-compose -f docker-compose.staging.yml logs -f user-service" -ForegroundColor White
Write-Host "🛑 Остановка: docker-compose -f docker-compose.staging.yml down" -ForegroundColor White
Write-Host "🔄 Перезапуск: docker-compose -f docker-compose.staging.yml restart user-service" -ForegroundColor White

Write-Host "`n✅ User Service готов к валидации и тестированию в staging окружении!" -ForegroundColor Green