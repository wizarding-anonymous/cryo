#!/usr/bin/env pwsh
# Direct connection test between Auth Service and User Service

Write-Host "TESTING DIRECT CONNECTION BETWEEN SERVICES" -ForegroundColor Cyan
Write-Host "=" * 60

# Test 1: Check if User Service is accessible from Auth Service
Write-Host "1. Testing User Service health from Auth Service container..."
$healthTest = docker exec auth-service curl -s -w "%{http_code}" http://user-service:3002/api/v1/health
Write-Host "   Response: $healthTest"

# Test 2: Test simple user creation with proper bcrypt hash
Write-Host "`n2. Testing user creation with proper bcrypt hash..."
$createTest = docker exec auth-service sh -c 'curl -s -X POST http://user-service:3002/api/users -H "Content-Type: application/json" -d "{\"email\":\"test-$(date +%s)@test.com\",\"password\":\"\$2b\$10\$jM3O17YSl5ubbzdLcvYWbuvurctGjgwmEdwFenMoUi7xwl5LNkpAe\",\"name\":\"Test User\"}" -w "%{http_code}"'
Write-Host "   Response: $createTest"

# Test 3: Check circuit breaker status
Write-Host "`n3. Checking circuit breaker status..."
$cbStatus = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing | ConvertFrom-Json
if ($cbStatus.data.info.circuitBreakers) {
    Write-Host "   Circuit Breakers found in health check"
} else {
    Write-Host "   No circuit breaker info in health check"
}

Write-Host "`nDirect connection test completed." -ForegroundColor Green