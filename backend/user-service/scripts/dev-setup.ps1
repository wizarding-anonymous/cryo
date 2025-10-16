# User Service Development Setup Script (PowerShell)
# This script sets up the development environment for User Service on Windows

param(
    [switch]$SkipDependencies,
    [switch]$Force,
    [switch]$Full,
    [switch]$WithAuth,
    [switch]$WithMonitoring,
    [switch]$WithLogging,
    [switch]$SkipMigration,
    [switch]$Help
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Header {
    param([string]$Message)
    Write-Host "[SETUP] $Message" -ForegroundColor Magenta
}

function Write-Command {
    param([string]$Message)
    Write-Host "[CMD] $Message" -ForegroundColor Cyan
}

# Show help if requested
if ($Help) {
    Write-Host @"
User Service Development Setup Script (PowerShell)

Usage: .\dev-setup.ps1 [options]

Options:
  -Full                Start all microservices (full development environment)
  -WithAuth           Include Auth Service in setup
  -WithMonitoring     Include Prometheus and Grafana
  -WithLogging        Include ELK stack for logging
  -SkipDependencies   Skip npm dependency installation
  -SkipMigration      Skip database migration
  -Force              Force overwrite existing files
  -Help               Show this help message

Examples:
  .\dev-setup.ps1                          # Minimal setup
  .\dev-setup.ps1 -Full                    # Full microservices environment
  .\dev-setup.ps1 -WithAuth                # User Service + Auth Service
  .\dev-setup.ps1 -WithMonitoring          # User Service + monitoring stack
"@
    exit 0
}

# Determine setup mode
$SetupMode = if ($Full) { "full" } else { "minimal" }

Write-Header "Development Environment Setup - Mode: $SetupMode"
Write-Status "🚀 Setting up User Service development environment..."

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker is not running. Please start Docker and try again."
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose --version | Out-Null
} catch {
    Write-Error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
}

Write-Status "Checking current directory..."
if (-not (Test-Path "package.json")) {
    Write-Error "This script must be run from the user-service directory"
    exit 1
}

# Install dependencies
if (-not $SkipDependencies) {
    Write-Status "Installing Node.js dependencies..."
    npm ci --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        exit 1
    }
}

# Create environment file if it doesn't exist
if (-not (Test-Path ".env.docker") -or $Force) {
    Write-Status "Creating .env.docker file..."
    @"
# User Service Configuration
NODE_ENV=development
USER_SERVICE_PORT=3002
USER_SERVICE_HOST=0.0.0.0

# Database Configuration
DB_HOST=postgres-user
DB_PORT=5432
DB_USER=user_service
DB_PASSWORD=user_password
DB_NAME=user_db
DB_SSL_MODE=disable
DATABASE_URL=postgresql://user_service:user_password@postgres-user:5432/user_db

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL=redis://:redis_password@redis:6379

# JWT Configuration (for testing)
JWT_SECRET=dev-secret-key-change-in-production

# Logging
LOG_LEVEL=debug

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Security
API_KEY_HEADER=x-api-key
INTERNAL_API_KEY=dev-internal-api-key

# External Services (for development)
AUTH_SERVICE_URL=http://auth-service:3001
SECURITY_SERVICE_URL=http://security-service:3010
NOTIFICATION_SERVICE_URL=http://notification-service:3007
"@ | Out-File -FilePath ".env.docker" -Encoding UTF8
    Write-Success "Created .env.docker file"
} else {
    Write-Warning ".env.docker already exists, skipping creation (use -Force to overwrite)"
}

# Start Docker Compose services
Write-Status "Starting User Service and dependencies with Docker Compose..."
Set-Location "../"
docker-compose -f docker-compose.user-only.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start Docker Compose services"
    exit 1
}

Write-Status "Waiting for services to be ready..."
Start-Sleep -Seconds 30

# Check service health
Write-Status "Checking service health..."

# Check PostgreSQL
$pgReady = docker-compose -f docker-compose.user-only.yml exec -T postgres-user pg_isready -U user_service -d user_db 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "PostgreSQL is ready"
} else {
    Write-Error "PostgreSQL is not ready"
    exit 1
}

# Check Redis
$redisReady = docker-compose -f docker-compose.user-only.yml exec -T redis redis-cli -a redis_password ping 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Redis is ready"
} else {
    Write-Error "Redis is not ready"
    exit 1
}

# Check User Service
Write-Status "Waiting for User Service to be ready..."
$timeout = 60
$elapsed = 0
$userServiceReady = $false

while ($elapsed -lt $timeout -and -not $userServiceReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $userServiceReady = $true
            Write-Success "User Service is ready"
        }
    } catch {
        Write-Host "Waiting for User Service..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
}

if (-not $userServiceReady) {
    Write-Error "User Service is not responding after $timeout seconds"
    exit 1
}

# Run database migrations
Write-Status "Running database migrations..."
Set-Location "user-service/"
npm run migration:run
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Database migrations failed, but continuing..."
}

Write-Success "🎉 User Service development environment is ready!"
Write-Status "Services running:"
Write-Status "  - User Service: http://localhost:3002"
Write-Status "  - PostgreSQL: localhost:5433"
Write-Status "  - Redis: localhost:6379"
Write-Status ""
Write-Status "Useful commands:"
Write-Status "  - View logs: npm run docker:test:logs"
Write-Status "  - Stop services: npm run docker:test:down"
Write-Status "  - Restart User Service: npm run docker:test:restart"
Write-Status "  - Run tests: npm run test"
Write-Status "  - Run in development mode: npm run start:dev"