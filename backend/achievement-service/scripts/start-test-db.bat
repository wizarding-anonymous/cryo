@echo off

echo Starting test database for achievement service...

REM Stop any existing containers
docker-compose -f docker-compose.test.yml down

REM Start the test database
docker-compose -f docker-compose.test.yml up -d

echo Waiting for database to be ready...

REM Wait for database to be ready (Windows version)
:wait_loop
docker exec achievement-service-test-db pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo Test database is ready!
echo PostgreSQL: localhost:5433
echo Redis: localhost:6380