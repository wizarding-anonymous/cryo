@echo off
REM Setup script for all microservices on Windows
REM This script initializes the development environment

echo 🚀 Setting up microservices development environment...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker first.
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose first.
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo [INFO] Installing dependencies for all Node.js services...

REM List of Node.js services
set NODE_SERVICES=api-gateway user-service game-catalog-service library-service review-service payment-service notification-service social-service achievement-service security-service

for %%s in (%NODE_SERVICES%) do (
    if exist "%%s" (
        echo [INFO] Installing dependencies for %%s...
        cd "%%s"
        npm install --legacy-peer-deps
        cd ..
    ) else (
        echo [WARNING] Service directory %%s not found, skipping...
    )
)

REM Install Go dependencies for download service
go version >nul 2>&1
if %errorlevel% equ 0 (
    if exist "download-service" (
        echo [INFO] Installing dependencies for download-service...
        cd download-service
        go mod download
        cd ..
    )
) else (
    echo [WARNING] Go is not installed. Download service will not work properly.
)

REM Create necessary directories
echo [INFO] Creating necessary directories...
if not exist "monitoring\grafana\dashboards" mkdir "monitoring\grafana\dashboards"
if not exist "monitoring\grafana\datasources" mkdir "monitoring\grafana\datasources"
if not exist "logging" mkdir "logging"
if not exist "nginx" mkdir "nginx"
if not exist "k8s" mkdir "k8s"
if not exist "scripts\backup" mkdir "scripts\backup"
if not exist "scripts\deploy" mkdir "scripts\deploy"

REM Copy example environment files
echo [INFO] Setting up environment files...
for %%s in (%NODE_SERVICES%) do (
    if exist "%%s" (
        if exist "%%s\.env.example" (
            if not exist "%%s\.env" (
                copy "%%s\.env.example" "%%s\.env" >nul
                echo [INFO] Created .env file for %%s
            )
        )
    )
)

REM Setup download service environment
if exist "download-service" (
    if exist "download-service\.env.example" (
        if not exist "download-service\.env" (
            copy "download-service\.env.example" "download-service\.env" >nul
            echo [INFO] Created .env file for download-service
        )
    )
)

REM Build Docker images
echo [INFO] Building Docker images...
docker-compose build

echo [INFO] ✅ Setup completed successfully!
echo.
echo [INFO] Next steps:
echo [INFO] 1. Review and update .env files in each service directory
echo [INFO] 2. Run 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d' to start development environment
echo [INFO] 3. Run health check script to verify all services are running
echo.
echo [INFO] Available URLs:
echo [INFO] - API Gateway: http://localhost:3000
echo [INFO] - Prometheus: http://localhost:9090
echo [INFO] - Grafana: http://localhost:3100 (admin/admin)
echo [INFO] - Kibana: http://localhost:5601
echo [INFO] - PgAdmin (dev): http://localhost:5050 (admin@admin.com/admin)
echo [INFO] - Redis Commander (dev): http://localhost:8081

pause