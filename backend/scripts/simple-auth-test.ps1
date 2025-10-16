# Simple Auth Service Test Script
Write-Host "Testing Auth Service deployment..." -ForegroundColor Cyan

# Wait for service to be ready
Write-Host "Waiting for Auth Service to be ready..." -ForegroundColor Yellow
$maxAttempts = 12
$attempt = 1
$serviceReady = $false

while ($attempt -le $maxAttempts -and -not $serviceReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $serviceReady = $true
            Write-Host "Auth Service is ready! (attempt ${attempt})" -ForegroundColor Green
        }
    } catch {
        Write-Host "Attempt ${attempt}/${maxAttempts}: Service not ready yet..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        $attempt++
    }
}

if (-not $serviceReady) {
    Write-Host "Auth Service failed to become ready after ${maxAttempts} attempts" -ForegroundColor Red
    exit 1
}

# Test basic connectivity
Write-Host "Testing basic connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Health endpoint: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "Health endpoint: FAILED - $_" -ForegroundColor Red
}

# Test readiness endpoint
Write-Host "Testing readiness endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health/ready" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Readiness endpoint: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "Readiness endpoint: FAILED - $_" -ForegroundColor Red
}

# Test API documentation
Write-Host "Testing API documentation..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/docs" -TimeoutSec 10 -UseBasicParsing
    Write-Host "API docs: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "API docs: FAILED - $_" -ForegroundColor Red
}

# Test auth endpoints (should return validation errors)
Write-Host "Testing auth endpoints..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" -Method POST -ContentType "application/json" -Body "{}" -UseBasicParsing
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "Register endpoint: OK (returns 400 for invalid data)" -ForegroundColor Green
    } else {
        Write-Host "Register endpoint: Unexpected error - $_" -ForegroundColor Red
    }
}

# Test metrics endpoint
Write-Host "Testing metrics endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/metrics" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Metrics endpoint: OK (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "Metrics endpoint: FAILED - $_" -ForegroundColor Red
}

Write-Host "Auth Service basic test completed!" -ForegroundColor Cyan