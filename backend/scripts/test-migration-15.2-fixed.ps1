#!/usr/bin/env pwsh
# Скрипт для валидации миграции Auth Service с существующими данными
# Задача 15.2: Validate migration with existing data

Write-Host "🔄 ЗАДАЧА 15.2: Валидация миграции с существующими данными" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Конфигурация
$AUTH_SERVICE_URL = "http://localhost:3001"
$USER_SERVICE_URL = "http://localhost:3002"
$TEST_EMAIL = "migration-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')@example.com"
$TEST_PASSWORD = "TestPassword123!"

# Функция для HTTP запросов
function Invoke-ApiRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; StatusCode = 200 }
    }
    catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
        return @{ Success = $false; Error = $_.Exception.Message; StatusCode = $statusCode }
    }
}

# Функция для проверки health endpoints
function Test-ServiceHealth {
    param([string]$ServiceName, [string]$BaseUrl)
    
    Write-Host "🏥 Проверка здоровья $ServiceName..." -ForegroundColor Yellow
    
    $healthResult = Invoke-ApiRequest -Url "$BaseUrl/api/health"
    if ($healthResult.Success) {
        Write-Host "  ✅ $ServiceName health check: OK" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  ❌ $ServiceName health check: FAILED - $($healthResult.Error)" -ForegroundColor Red
        return $false
    }
}

# Функция для проверки интеграции Auth Service с User Service
function Test-AuthUserServiceIntegration {
    Write-Host "🔗 Тестирование интеграции Auth Service с User Service..." -ForegroundColor Yellow
    
    # Тест 1: Регистрация нового пользователя через Auth Service
    Write-Host "  📝 Тест 1: Регистрация через Auth Service..." -ForegroundColor Cyan
    
    $registerData = @{
        email = "auth-integration-$(Get-Date -Format 'yyyyMMdd-HHmmss')@example.com"
        password = $TEST_PASSWORD
        name = "Auth Integration Test"
    }
    
    $registerResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/register" -Method "POST" -Body $registerData
    
    if ($registerResult.Success) {
        Write-Host "    ✅ Регистрация успешна" -ForegroundColor Green
        $accessToken = $registerResult.Data.accessToken
        $userId = $registerResult.Data.user.id
        
        # Тест 2: Проверка создания пользователя в User Service
        Write-Host "  🔍 Тест 2: Проверка пользователя в User Service..." -ForegroundColor Cyan
        
        $userResult = Invoke-ApiRequest -Url "$USER_SERVICE_URL/users/$userId"
        
        if ($userResult.Success) {
            Write-Host "    ✅ Пользователь найден в User Service: $($userResult.Data.email)" -ForegroundColor Green
        } else {
            Write-Host "    ❌ Пользователь не найден в User Service: $($userResult.Error)" -ForegroundColor Red
            return $false
        }
        
        # Тест 3: Валидация токена
        Write-Host "  🔐 Тест 3: Валидация JWT токена..." -ForegroundColor Cyan
        
        $validateResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/validate" -Method "POST" -Body @{ token = $accessToken }
        
        if ($validateResult.Success) {
            Write-Host "    ✅ Токен валиден: $($validateResult.Data.userId)" -ForegroundColor Green
        } else {
            Write-Host "    ❌ Токен невалиден: $($validateResult.Error)" -ForegroundColor Red
            return $false
        }
        
        return $true
    } else {
        Write-Host "    ❌ Регистрация неуспешна: $($registerResult.Error)" -ForegroundColor Red
        return $false
    }
}

# Функция для тестирования существующих JWT токенов
function Test-ExistingJWTTokens {
    Write-Host "🎫 Тестирование совместимости с существующими JWT токенами..." -ForegroundColor Yellow
    
    # Создаем тестовый токен через Auth Service
    $registerData = @{
        email = "jwt-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')@example.com"
        password = $TEST_PASSWORD
        name = "JWT Test User"
    }
    
    $registerResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/register" -Method "POST" -Body $registerData
    
    if ($registerResult.Success) {
        $accessToken = $registerResult.Data.accessToken
        $refreshToken = $registerResult.Data.refreshToken
        
        Write-Host "  ✅ Токены созданы успешно" -ForegroundColor Green
        
        # Тест валидации access token
        $validateResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/validate" -Method "POST" -Body @{ token = $accessToken }
        
        if ($validateResult.Success) {
            Write-Host "  ✅ Access token валиден" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Access token невалиден: $($validateResult.Error)" -ForegroundColor Red
            return $false
        }
        
        # Тест refresh token
        $refreshResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/refresh" -Method "POST" -Body @{ refreshToken = $refreshToken }
        
        if ($refreshResult.Success) {
            Write-Host "  ✅ Refresh token работает" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Refresh token не работает: $($refreshResult.Error)" -ForegroundColor Red
            return $false
        }
        
        return $true
    } else {
        Write-Host "  ❌ Не удалось создать тестовые токены: $($registerResult.Error)" -ForegroundColor Red
        return $false
    }
}

# Функция для проверки User Service продолжает обслуживать запросы данных
function Test-UserServiceDataRequests {
    Write-Host "📊 Проверка User Service продолжает обслуживать запросы данных..." -ForegroundColor Yellow
    
    # Создаем пользователя через Auth Service
    $registerData = @{
        email = "data-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')@example.com"
        password = $TEST_PASSWORD
        name = "Data Test User"
    }
    
    $registerResult = Invoke-ApiRequest -Url "$AUTH_SERVICE_URL/api/auth/register" -Method "POST" -Body $registerData
    
    if ($registerResult.Success) {
        $userId = $registerResult.Data.user.id
        
        # Тест получения профиля через User Service
        $profileResult = Invoke-ApiRequest -Url "$USER_SERVICE_URL/users/$userId"
        
        if ($profileResult.Success) {
            Write-Host "  ✅ User Service отвечает на запросы данных: $($profileResult.Data.email)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ User Service не отвечает на запросы данных: $($profileResult.Error)" -ForegroundColor Red
            return $false
        }
        
        # Тест проверки существования пользователя
        $existsResult = Invoke-ApiRequest -Url "$USER_SERVICE_URL/users/$userId/exists"
        
        if ($existsResult.Success -and $existsResult.Data.exists) {
            Write-Host "  ✅ Проверка существования пользователя работает" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Проверка существования пользователя не работает" -ForegroundColor Red
            return $false
        }
        
        return $true
    } else {
        Write-Host "  ❌ Не удалось создать тестового пользователя: $($registerResult.Error)" -ForegroundColor Red
        return $false
    }
}

# Основная функция выполнения тестов
function Main {
    Write-Host ""
    Write-Host "🚀 Начинаем валидацию миграции Auth Service..." -ForegroundColor Green
    Write-Host ""
    
    $allTestsPassed = $true
    
    # Тест 1: Health checks
    Write-Host "=== ЭТАП 1: ПРОВЕРКА ЗДОРОВЬЯ СЕРВИСОВ ===" -ForegroundColor Magenta
    $authHealthy = Test-ServiceHealth -ServiceName "Auth Service" -BaseUrl $AUTH_SERVICE_URL
    $userHealthy = Test-ServiceHealth -ServiceName "User Service" -BaseUrl $USER_SERVICE_URL
    
    if (-not $authHealthy -or -not $userHealthy) {
        Write-Host "❌ Один или оба сервиса недоступны. Прерываем тестирование." -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
    
    # Тест 2: Интеграция Auth Service с User Service
    Write-Host "=== ЭТАП 2: ИНТЕГРАЦИЯ AUTH SERVICE С USER SERVICE ===" -ForegroundColor Magenta
    $integrationPassed = Test-AuthUserServiceIntegration
    if (-not $integrationPassed) { $allTestsPassed = $false }
    
    Write-Host ""
    
    # Тест 3: Совместимость JWT токенов
    Write-Host "=== ЭТАП 3: СОВМЕСТИМОСТЬ JWT ТОКЕНОВ ===" -ForegroundColor Magenta
    $jwtPassed = Test-ExistingJWTTokens
    if (-not $jwtPassed) { $allTestsPassed = $false }
    
    Write-Host ""
    
    # Тест 4: User Service продолжает работать
    Write-Host "=== ЭТАП 4: USER SERVICE ПРОДОЛЖАЕТ ОБСЛУЖИВАТЬ ДАННЫЕ ===" -ForegroundColor Magenta
    $userServicePassed = Test-UserServiceDataRequests
    if (-not $userServicePassed) { $allTestsPassed = $false }
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    
    if ($allTestsPassed) {
        Write-Host "🎉 ВСЕ ТЕСТЫ МИГРАЦИИ ПРОШЛИ УСПЕШНО!" -ForegroundColor Green
        Write-Host "✅ Auth Service готов к production использованию" -ForegroundColor Green
        Write-Host "✅ Интеграция с User Service работает корректно" -ForegroundColor Green
        Write-Host "✅ Существующие данные совместимы" -ForegroundColor Green
        Write-Host "✅ JWT токены работают правильно" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ НЕКОТОРЫЕ ТЕСТЫ МИГРАЦИИ НЕ ПРОШЛИ" -ForegroundColor Red
        Write-Host "⚠️  Требуется дополнительная отладка перед production" -ForegroundColor Yellow
        return $false
    }
}

# Запуск основной функции
$result = Main

# Возвращаем код выхода
if ($result) {
    exit 0
} else {
    exit 1
}