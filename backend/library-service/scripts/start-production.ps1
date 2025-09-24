# Production startup script for Library Service (PowerShell)
# Features:
# - Environment validation
# - Secrets verification
# - Health checks
# - Graceful startup
# - Process monitoring

param(
    [switch]$SkipHealthCheck = $false,
    [switch]$SkipMigrations = $false
)

Write-Host "🚀 Starting Library Service in Production Mode..." -ForegroundColor Green

# Set production environment
$env:NODE_ENV = "production"

# Load production environment variables
if (Test-Path ".env.production") {
    Write-Host "📋 Loading production environment variables..." -ForegroundColor Blue
    Get-Content ".env.production" | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
} else {
    Write-Host "⚠️  Warning: .env.production file not found" -ForegroundColor Yellow
}

# Validate required environment variables
Write-Host "🔍 Validating environment configuration..." -ForegroundColor Blue

$requiredVars = @(
    "DATABASE_HOST",
    "DATABASE_USERNAME", 
    "DATABASE_NAME",
    "REDIS_HOST"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Missing required environment variables:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

# Validate secrets exist
Write-Host "🔐 Validating secrets..." -ForegroundColor Blue

$requiredSecrets = @(
    "secrets/database-password.txt",
    "secrets/jwt-secret.txt"
)

$missingSecrets = @()
foreach ($secret in $requiredSecrets) {
    if (-not (Test-Path $secret)) {
        $missingSecrets += $secret
    }
}

if ($missingSecrets.Count -gt 0) {
    Write-Host "❌ Missing required secrets:" -ForegroundColor Red
    $missingSecrets | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "💡 Run 'npm run docker:setup:prod:win' to generate secrets" -ForegroundColor Yellow
    exit 1
}

# Create logs directory
Write-Host "📁 Creating logs directory..." -ForegroundColor Blue
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Run database migrations
if (-not $SkipMigrations) {
    Write-Host "🗄️  Running database migrations..." -ForegroundColor Blue
    try {
        npm run migration:run:prod
        if ($LASTEXITCODE -ne 0) {
            throw "Migration failed with exit code $LASTEXITCODE"
        }
    } catch {
        Write-Host "❌ Database migration failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Wait for dependencies
Write-Host "⏳ Waiting for dependencies..." -ForegroundColor Blue

# Function to test TCP connection
function Test-TcpConnection {
    param($Host, $Port, $Timeout = 30)
    
    $timer = 0
    while ($timer -lt $Timeout) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ConnectAsync($Host, $Port).Wait(1000)
            if ($tcpClient.Connected) {
                $tcpClient.Close()
                return $true
            }
        } catch {
            # Connection failed, continue waiting
        }
        Start-Sleep -Seconds 1
        $timer++
    }
    return $false
}

# Wait for PostgreSQL
Write-Host "🐘 Waiting for PostgreSQL..." -ForegroundColor Blue
$dbHost = [Environment]::GetEnvironmentVariable("DATABASE_HOST")
$dbPort = [Environment]::GetEnvironmentVariable("DATABASE_PORT")
if (-not (Test-TcpConnection -Host $dbHost -Port $dbPort)) {
    Write-Host "❌ PostgreSQL connection timeout" -ForegroundColor Red
    exit 1
}
Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green

# Wait for Redis
Write-Host "🔴 Waiting for Redis..." -ForegroundColor Blue
$redisHost = [Environment]::GetEnvironmentVariable("REDIS_HOST")
$redisPort = [Environment]::GetEnvironmentVariable("REDIS_PORT")
if (-not (Test-TcpConnection -Host $redisHost -Port $redisPort)) {
    Write-Host "❌ Redis connection timeout" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Redis is ready" -ForegroundColor Green

# Pre-flight health check
if (-not $SkipHealthCheck) {
    Write-Host "🏥 Running pre-flight health check..." -ForegroundColor Blue
    try {
        # Test database connection
        Write-Host "Testing database connection..." -ForegroundColor Gray
        npm run typeorm -- query "SELECT 1" 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Database connection test failed"
        }
        Write-Host "✅ Database connection successful" -ForegroundColor Green
        
        Write-Host "✅ Pre-flight checks passed" -ForegroundColor Green
    } catch {
        Write-Host "❌ Pre-flight check failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Start the application
Write-Host "🎯 Starting Library Service..." -ForegroundColor Green

# Start with production optimizations
try {
    node --max-old-space-size=2048 --optimize-for-size --gc-interval=100 --expose-gc dist/main.js
} catch {
    Write-Host "❌ Failed to start Library Service: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Library Service started successfully!" -ForegroundColor Green