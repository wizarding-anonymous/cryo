# =============================================================================
# Start Auth Service and Dependencies for Staging
# =============================================================================

param(
    [switch]$Build = $false,
    [switch]$Logs = $false
)

Write-Host "Starting Auth Service and dependencies for staging..." -ForegroundColor Cyan

# Change to backend directory
Set-Location -Path (Split-Path $PSScriptRoot -Parent)

try {
    # Step 1: Start dependencies first
    Write-Host "Starting dependencies (PostgreSQL, Redis)..." -ForegroundColor Yellow
    
    if ($Build) {
        docker-compose up -d --build postgres-auth redis
    } else {
        docker-compose up -d postgres-auth redis
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start dependencies" -ForegroundColor Red
        exit 1
    }
    
    # Wait for dependencies to be ready
    Write-Host "⏳ Waiting for dependencies to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Step 2: Start Auth Service
    Write-Host "Starting Auth Service..." -ForegroundColor Yellow
    
    if ($Build) {
        docker-compose up -d --build auth-service
    } else {
        docker-compose up -d auth-service
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start Auth Service" -ForegroundColor Red
        exit 1
    }
    
    # Step 3: Wait for Auth Service to be ready
    Write-Host "Waiting for Auth Service to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
    # Step 4: Check service status
    Write-Host "Checking service status..." -ForegroundColor Yellow
    docker-compose ps postgres-auth redis auth-service
    
    # Step 5: Test health endpoint
    Write-Host "Testing Auth Service health..." -ForegroundColor Yellow
    
    $maxAttempts = 10
    $attempt = 1
    $healthOk = $false
    
    while ($attempt -le $maxAttempts -and -not $healthOk) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Auth Service is healthy!" -ForegroundColor Green
                $healthOk = $true
            }
        }
        catch {
            Write-Host "Attempt ${attempt}/${maxAttempts}: Auth Service not ready yet..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            $attempt++
        }
    }
    
    if (-not $healthOk) {
        Write-Host "❌ Auth Service health check failed after $maxAttempts attempts" -ForegroundColor Red
        Write-Host "Showing Auth Service logs:" -ForegroundColor Yellow
        docker-compose logs --tail=20 auth-service
        exit 1
    }
    
    # Step 6: Show service information
    Write-Host "`nAuth Service staging environment is ready!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Auth Service URL: http://localhost:3001" -ForegroundColor Cyan
    Write-Host "Health Check: http://localhost:3001/health" -ForegroundColor Cyan
    Write-Host "API Documentation: http://localhost:3001/api/docs" -ForegroundColor Cyan
    Write-Host "Metrics: http://localhost:3001/api/metrics" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Database (PostgreSQL): localhost:5432" -ForegroundColor Cyan
    Write-Host "Cache (Redis): localhost:6379" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "• View logs: docker-compose logs -f auth-service" -ForegroundColor White
    Write-Host "• Stop services: docker-compose down" -ForegroundColor White
    Write-Host "• Restart Auth Service: docker-compose restart auth-service" -ForegroundColor White
    Write-Host "• Run tests: .\scripts\test-auth-service-deployment.ps1" -ForegroundColor White
    
    if ($Logs) {
        Write-Host "`nShowing Auth Service logs..." -ForegroundColor Yellow
        docker-compose logs -f auth-service
    }
    
}
catch {
    Write-Host "Error starting Auth Service: $_" -ForegroundColor Red
    exit 1
}