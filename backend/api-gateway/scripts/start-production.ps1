# Production startup script for API Gateway (PowerShell)
# This script ensures proper production environment setup

param(
    [switch]$ValidateOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting API Gateway in Production Mode..." -ForegroundColor Green

# Check if we're running in production
if ($env:NODE_ENV -ne "production") {
    Write-Host "❌ NODE_ENV is not set to 'production'. Current value: $($env:NODE_ENV)" -ForegroundColor Red
    exit 1
}

# Validate required environment variables
$RequiredVars = @(
    "REDIS_HOST",
    "SERVICE_USER_BASE_URL",
    "SERVICE_GAME_CATALOG_BASE_URL",
    "SERVICE_PAYMENT_BASE_URL",
    "SERVICE_LIBRARY_BASE_URL",
    "SERVICE_NOTIFICATION_BASE_URL"
)

Write-Host "🔍 Validating environment variables..." -ForegroundColor Yellow
foreach ($var in $RequiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "❌ Required environment variable $var is not set" -ForegroundColor Red
        exit 1
    }
}

# Create logs directory if it doesn't exist
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Set Node.js production optimizations
if ([string]::IsNullOrEmpty($env:NODE_OPTIONS)) {
    $env:NODE_OPTIONS = "--max-old-space-size=768 --enable-source-maps"
}
if ([string]::IsNullOrEmpty($env:UV_THREADPOOL_SIZE)) {
    $env:UV_THREADPOOL_SIZE = "16"
}

Write-Host "✅ Production validation complete" -ForegroundColor Green

if ($ValidateOnly) {
    Write-Host "🔧 Validation-only mode complete" -ForegroundColor Cyan
    exit 0
}

Write-Host "🌟 Starting API Gateway..." -ForegroundColor Green

# Start the application
try {
    & node dist/main.js
} catch {
    Write-Host "❌ Application failed to start: $_" -ForegroundColor Red
    exit 1
}