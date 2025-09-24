# Test script with database setup (PowerShell)
# This script starts test databases and runs all tests

param(
    [switch]$Coverage = $false,
    [switch]$E2E = $false,
    [switch]$Unit = $false,
    [switch]$All = $false,
    [switch]$SkipCleanup = $false
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to cleanup test environment
function Stop-TestEnvironment {
    Write-Status "Stopping test environment..."
    try {
        docker-compose -f docker-compose.test.yml down -v
        Write-Status "Test environment stopped"
    } catch {
        Write-Warning "Failed to stop test environment: $($_.Exception.Message)"
    }
}

# Function to start test environment
function Start-TestEnvironment {
    Write-Status "Starting test environment..."
    try {
        docker-compose -f docker-compose.test.yml up -d --wait
        Write-Status "Test environment started"
        return $true
    } catch {
        Write-Error "Failed to start test environment: $($_.Exception.Message)"
        return $false
    }
}

# Function to wait for services
function Wait-ForServices {
    Write-Status "Waiting for services to be ready..."
    
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        try {
            # Check if PostgreSQL is ready
            $pgResult = docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres -d library_service_test
            
            # Check if Redis is ready
            $redisResult = docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping
            
            if ($LASTEXITCODE -eq 0) {
                Write-Status "All services are ready"
                return $true
            }
        } catch {
            # Services not ready yet
        }
        
        $attempt++
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    }
    
    Write-Error "Services did not become ready in time"
    return $false
}

# Function to run unit tests
function Invoke-UnitTests {
    Write-Status "Running unit tests..."
    try {
        if ($Coverage) {
            npm run test:cov
        } else {
            npm run test
        }
        Write-Status "Unit tests completed successfully"
        return $true
    } catch {
        Write-Error "Unit tests failed: $($_.Exception.Message)"
        return $false
    }
}

# Function to run e2e tests
function Invoke-E2ETests {
    Write-Status "Running e2e tests..."
    
    # Set test environment variables
    $env:NODE_ENV = "test"
    $env:DATABASE_HOST = "localhost"
    $env:DATABASE_PORT = "5433"
    $env:DATABASE_USERNAME = "postgres"
    $env:DATABASE_PASSWORD = "test_password"
    $env:DATABASE_NAME = "library_service_test"
    $env:DATABASE_SYNCHRONIZE = "true"
    $env:DATABASE_LOGGING = "false"
    $env:REDIS_HOST = "localhost"
    $env:REDIS_PORT = "6380"
    $env:REDIS_TTL = "300"
    $env:JWT_SECRET = "test-secret-key"
    $env:GAMES_CATALOG_SERVICE_URL = "http://localhost:3011"
    $env:USER_SERVICE_URL = "http://localhost:3012"
    $env:PAYMENT_SERVICE_URL = "http://localhost:3013"
    $env:LOG_LEVEL = "error"
    $env:PROMETHEUS_ENABLED = "false"
    
    try {
        if ($Coverage) {
            npm run test:e2e:cov
        } else {
            npm run test:e2e
        }
        Write-Status "E2E tests completed successfully"
        return $true
    } catch {
        Write-Error "E2E tests failed: $($_.Exception.Message)"
        return $false
    }
}

# Main execution
try {
    Write-Host "🧪 Library Service Test Runner" -ForegroundColor Green
    Write-Host "==============================" -ForegroundColor Green
    Write-Host ""
    
    $testsPassed = $true
    
    # Determine which tests to run
    if (-not ($Unit -or $E2E -or $All)) {
        $All = $true  # Default to running all tests
    }
    
    # Run unit tests (don't need database)
    if ($Unit -or $All) {
        if (-not (Invoke-UnitTests)) {
            $testsPassed = $false
        }
        Write-Host ""
    }
    
    # Run e2e tests (need database)
    if ($E2E -or $All) {
        # Start test environment
        if (-not (Start-TestEnvironment)) {
            exit 1
        }
        
        # Wait for services to be ready
        if (-not (Wait-ForServices)) {
            Stop-TestEnvironment
            exit 1
        }
        
        # Run e2e tests
        if (-not (Invoke-E2ETests)) {
            $testsPassed = $false
        }
        
        # Cleanup unless skipped
        if (-not $SkipCleanup) {
            Stop-TestEnvironment
        }
    }
    
    Write-Host ""
    Write-Host "==============================" -ForegroundColor Green
    
    if ($testsPassed) {
        Write-Status "All tests passed! 🎉"
        exit 0
    } else {
        Write-Error "Some tests failed! ❌"
        exit 1
    }
    
} catch {
    Write-Error "Test execution failed: $($_.Exception.Message)"
    
    # Cleanup on error
    if (-not $SkipCleanup) {
        Stop-TestEnvironment
    }
    
    exit 1
}