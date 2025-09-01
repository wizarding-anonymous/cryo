@echo off
echo Starting User Service with Docker...

REM Stop any existing containers
echo Stopping existing containers...
docker-compose down

REM Remove old containers and volumes if needed
echo Cleaning up old containers...
docker-compose rm -f

REM Build and start services
echo Building and starting services...
docker-compose up --build -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 /nobreak > nul

REM Check service status
echo Checking service status...
docker-compose ps

echo User Service should be available at http://localhost:3001
echo API Documentation: http://localhost:3001/api-docs
echo.
echo To view logs: docker-compose logs -f user-service
echo To stop services: docker-compose down
pause