# PowerShell script to run tests with PostgreSQL database

Write-Host "🚀 Starting test database..." -ForegroundColor Green
docker-compose -f docker-compose.test.yml up -d

Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if database is ready
Write-Host "🔍 Checking database connection..." -ForegroundColor Blue
do {
    $result = docker exec library-service-postgres-test pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Database is not ready yet, waiting..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
} while ($LASTEXITCODE -ne 0)

Write-Host "✅ Database is ready!" -ForegroundColor Green

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Blue
$testType = $args[0]

switch ($testType) {
    "e2e" {
        npm run test:e2e
    }
    "unit" {
        npm run test
    }
    "coverage" {
        npm run test:cov
    }
    default {
        Write-Host "Running all tests..." -ForegroundColor Blue
        npm run test
        if ($LASTEXITCODE -eq 0) {
            npm run test:e2e
        }
    }
}

# Capture test exit code
$testExitCode = $LASTEXITCODE

# Cleanup
Write-Host "🧹 Cleaning up test database..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down

# Exit with test result
if ($testExitCode -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Tests failed!" -ForegroundColor Red
}

exit $testExitCode