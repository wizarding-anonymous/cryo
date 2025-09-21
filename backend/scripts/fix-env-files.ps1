# Script to fix .env files for all microservices
# Fixes common configuration issues found during infrastructure audit

Write-Host "=== Fixing .env files for all microservices ===" -ForegroundColor Green
Write-Host ""

# Define service mappings
$services = @{
    "game-catalog-service" = @{
        "postgres_host" = "postgres-catalog-db"
        "postgres_user" = "catalog_service"
        "postgres_password" = "catalog_password"
        "postgres_db" = "catalog_db"
    }
    "library-service" = @{
        "postgres_host" = "postgres-library-db"
        "postgres_user" = "library_service"
        "postgres_password" = "library_password"
        "postgres_db" = "library_db"
    }
    "review-service" = @{
        "postgres_host" = "postgres-review-db"
        "postgres_user" = "review_service"
        "postgres_password" = "review_password"
        "postgres_db" = "review_db"
    }
    "payment-service" = @{
        "postgres_host" = "postgres-payment-db"
        "postgres_user" = "payment_service"
        "postgres_password" = "payment_password"
        "postgres_db" = "payment_db"
    }
    "notification-service" = @{
        "postgres_host" = "postgres-notification-db"
        "postgres_user" = "notification_service"
        "postgres_password" = "notification_password"
        "postgres_db" = "notification_db"
    }
    "social-service" = @{
        "postgres_host" = "postgres-social-db"
        "postgres_user" = "social_service"
        "postgres_password" = "social_password"
        "postgres_db" = "social_db"
    }
    "achievement-service" = @{
        "postgres_host" = "postgres-achievement-db"
        "postgres_user" = "achievement_service"
        "postgres_password" = "achievement_password"
        "postgres_db" = "achievement_db"
    }
    "security-service" = @{
        "postgres_host" = "postgres-security-db"
        "postgres_user" = "security_service"
        "postgres_password" = "security_password"
        "postgres_db" = "security_db"
    }
    "download-service" = @{
        "postgres_host" = "postgres-download-db"
        "postgres_user" = "download_service"
        "postgres_password" = "download_password"
        "postgres_db" = "download_db"
    }
    "api-gateway" = @{
        "postgres_host" = "postgres-user-db"
        "postgres_user" = "user_service"
        "postgres_password" = "user_password"
        "postgres_db" = "user_db"
    }
}

$fixedCount = 0
$errorCount = 0

foreach ($service in $services.Keys) {
    $envFile = "./$service/.env"
    
    Write-Host "Processing $service..." -NoNewline
    
    if (Test-Path $envFile) {
        try {
            $content = Get-Content $envFile -Raw
            $config = $services[$service]
            
            # Fix PostgreSQL host
            $content = $content -replace "POSTGRES_HOST=postgres\b", "POSTGRES_HOST=$($config.postgres_host)"
            $content = $content -replace "POSTGRES_HOST=localhost", "POSTGRES_HOST=$($config.postgres_host)"
            
            # Fix PostgreSQL credentials
            $content = $content -replace "POSTGRES_USER=.*", "POSTGRES_USER=$($config.postgres_user)"
            $content = $content -replace "POSTGRES_PASSWORD=.*", "POSTGRES_PASSWORD=$($config.postgres_password)"
            $content = $content -replace "POSTGRES_DB=.*", "POSTGRES_DB=$($config.postgres_db)"
            
            # Fix Redis host and password
            $content = $content -replace "REDIS_HOST=redis\b", "REDIS_HOST=redis-cache"
            $content = $content -replace "REDIS_HOST=localhost", "REDIS_HOST=redis-cache"
            $content = $content -replace "REDIS_PASSWORD=\s*$", "REDIS_PASSWORD=redis_password"
            $content = $content -replace "REDIS_PASSWORD=$", "REDIS_PASSWORD=redis_password"
            
            # Write back to file
            Set-Content -Path $envFile -Value $content -NoNewline
            
            Write-Host " FIXED" -ForegroundColor Green
            $fixedCount++
        }
        catch {
            Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    else {
        Write-Host " NOT FOUND" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Green
Write-Host "Fixed: $fixedCount services" -ForegroundColor Green
Write-Host "Errors: $errorCount services" -ForegroundColor Red
Write-Host ""

if ($fixedCount -gt 0) {
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Review the changes in each .env file"
    Write-Host "2. Rebuild and restart services"
    Write-Host "3. Check logs"
    Write-Host "4. Test health endpoints"
}