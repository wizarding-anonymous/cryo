@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting Security Service Test Suite

REM Start test infrastructure
echo 🐳 Starting test infrastructure (PostgreSQL + Redis)...
docker-compose -f docker-compose.test.yml up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak > nul

REM Check if PostgreSQL is ready
echo 🔍 Checking PostgreSQL connection...
:wait_postgres
docker exec security-postgres-test pg_isready -U postgres > nul 2>&1
if errorlevel 1 (
    echo Waiting for PostgreSQL...
    timeout /t 2 /nobreak > nul
    goto wait_postgres
)

REM Check if Redis is ready
echo 🔍 Checking Redis connection...
:wait_redis
docker exec security-redis-test redis-cli ping > nul 2>&1
if errorlevel 1 (
    echo Waiting for Redis...
    timeout /t 2 /nobreak > nul
    goto wait_redis
)

echo ✅ Test infrastructure is ready!

REM Set environment variables for tests
set NODE_ENV=test
set DB_HOST=localhost
set DB_PORT=5436
set DB_USER=postgres
set DB_PASSWORD=postgres
set DB_NAME=security_service_test
set REDIS_HOST=localhost
set REDIS_PORT=6382

REM Run different test suites based on argument
set TEST_SUITE=%1
if "%TEST_SUITE%"=="" set TEST_SUITE=all

if "%TEST_SUITE%"=="unit" (
    echo 🧪 Running unit tests...
    call npm run test
) else if "%TEST_SUITE%"=="integration" (
    echo 🔗 Running integration tests...
    call npm run test:integration
) else if "%TEST_SUITE%"=="e2e" (
    echo 🌐 Running e2e tests...
    call npm run test:e2e
) else if "%TEST_SUITE%"=="performance" (
    echo ⚡ Running performance tests...
    call npm run test:performance
) else if "%TEST_SUITE%"=="error-handling" (
    echo 🚨 Running error handling tests...
    call npm run test:error-handling
) else if "%TEST_SUITE%"=="all" (
    echo 🎯 Running all tests...
    echo 📋 1/5 Unit tests...
    call npm run test
    echo 📋 2/5 Integration tests...
    call npm run test:integration
    echo 📋 3/5 E2E tests...
    call npm run test:e2e
    echo 📋 4/5 Performance tests...
    call npm run test:performance
    echo 📋 5/5 Error handling tests...
    call npm run test:error-handling
) else (
    echo ❌ Unknown test suite: %TEST_SUITE%
    echo Available options: unit, integration, e2e, performance, error-handling, all
    goto cleanup
)

echo ✅ Test suite completed successfully!

:cleanup
echo 🧹 Cleaning up test infrastructure...
docker-compose -f docker-compose.test.yml down -v

endlocal