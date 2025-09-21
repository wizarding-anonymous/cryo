@echo off
REM Health check script for all microservices on Windows
REM This script checks the health of all services and reports their status

setlocal enabledelayedexpansion

echo.
echo === Microservices Health Check ===
echo.

REM Configuration
set TIMEOUT=10

REM Service definitions with ports
set "SERVICES=api-gateway:3000 user-service:3001 game-catalog-service:3002 library-service:3003 review-service:3004 payment-service:3005 notification-service:3006 social-service:3007 achievement-service:3008 security-service:3009 download-service:3010"

set "INFRASTRUCTURE=redis:6379 prometheus:9090 grafana:3100 elasticsearch:9200 kibana:5601"

set total_services=0
set healthy_services=0
set unhealthy_services=0

echo === Microservices Status ===
echo.

REM Check microservices
for %%s in (%SERVICES%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%s") do (
        set /a total_services+=1
        set service_name=%%a
        set service_port=%%b
        
        REM Check if container is running
        docker ps --format "table {{.Names}}" | findstr /r "^!service_name!$" >nul 2>&1
        if !errorlevel! equ 0 (
            REM Container is running, check HTTP endpoint
            curl -f -s --connect-timeout %TIMEOUT% "http://localhost:!service_port!/health" >nul 2>&1
            if !errorlevel! equ 0 (
                echo ✓ !service_name! - Healthy (HTTP OK)
                set /a healthy_services+=1
            ) else (
                echo ✗ !service_name! - Unhealthy (HTTP Failed)
                set /a unhealthy_services+=1
            )
        ) else (
            echo ✗ !service_name! - Down (Container Not Running)
            set /a unhealthy_services+=1
        )
    )
)

echo.
echo === Infrastructure Status ===
echo.

REM Check infrastructure services
for %%s in (%INFRASTRUCTURE%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%s") do (
        set /a total_services+=1
        set service_name=%%a
        set service_port=%%b
        
        REM Check if container is running
        docker ps --format "table {{.Names}}" | findstr /r "^!service_name!$" >nul 2>&1
        if !errorlevel! equ 0 (
            REM Container is running, check port
            netstat -an | findstr ":!service_port!" >nul 2>&1
            if !errorlevel! equ 0 (
                echo ✓ !service_name! - Healthy (Port Open)
                set /a healthy_services+=1
            ) else (
                echo ✗ !service_name! - Unhealthy (Port Closed)
                set /a unhealthy_services+=1
            )
        ) else (
            echo ✗ !service_name! - Down (Container Not Running)
            set /a unhealthy_services+=1
        )
    )
)

REM Check PostgreSQL databases
echo.
echo === Database Status ===
echo.

set "DATABASES=postgres-user:5432 postgres-catalog:5433 postgres-library:5434 postgres-review:5435 postgres-payment:5436 postgres-notification:5437 postgres-social:5438 postgres-achievement:5439 postgres-security:5440 postgres-download:5441"

for %%d in (%DATABASES%) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%d") do (
        set /a total_services+=1
        set db_name=%%a
        set db_port=%%b
        
        REM Check if container is running
        docker ps --format "table {{.Names}}" | findstr /r "^!db_name!-db$" >nul 2>&1
        if !errorlevel! equ 0 (
            REM Container is running, check port
            netstat -an | findstr ":!db_port!" >nul 2>&1
            if !errorlevel! equ 0 (
                echo ✓ !db_name! - Healthy (Port Open)
                set /a healthy_services+=1
            ) else (
                echo ✗ !db_name! - Unhealthy (Port Closed)
                set /a unhealthy_services+=1
            )
        ) else (
            echo ✗ !db_name! - Down (Container Not Running)
            set /a unhealthy_services+=1
        )
    )
)

echo.
echo === Health Check Summary ===
echo.
echo Total Services: !total_services!
echo ✓ Healthy: !healthy_services!
echo ✗ Unhealthy: !unhealthy_services!

if !unhealthy_services! equ 0 (
    echo.
    echo ✅ All services are healthy!
    exit /b 0
) else (
    echo.
    echo ❌ Some services are unhealthy!
    echo.
    echo Troubleshooting tips:
    echo 1. Check Docker containers: docker-compose ps
    echo 2. Check service logs: docker-compose logs [service-name]
    echo 3. Restart services: docker-compose restart
    echo 4. Rebuild services: docker-compose build
    exit /b 1
)

pause