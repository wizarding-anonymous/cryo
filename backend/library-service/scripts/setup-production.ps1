# Production setup script for Library Service (PowerShell)
# This script helps set up the production environment with proper security

param(
    [switch]$SkipSSL = $false,
    [switch]$SkipSecrets = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Library Service for Production" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

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

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Status "Docker is installed ✓"
} catch {
    Write-Error "Docker is not installed. Please install Docker Desktop first."
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Status "Docker Compose is installed ✓"
} catch {
    Write-Error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
}

# Create secrets directory if it doesn't exist
if (-not (Test-Path "secrets")) {
    New-Item -ItemType Directory -Path "secrets" | Out-Null
    Write-Status "Created secrets directory"
}

# Generate secure passwords if they don't exist
function Generate-Password {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).Replace("=", "").Replace("+", "").Replace("/", "").Substring(0, 32)
}

if (-not $SkipSecrets) {
    # Database password
    if (-not (Test-Path "secrets/database_password.txt")) {
        Generate-Password | Out-File -FilePath "secrets/database_password.txt" -Encoding UTF8 -NoNewline
        Write-Status "Generated database password"
    } else {
        Write-Warning "Database password already exists"
    }

    # JWT secret
    if (-not (Test-Path "secrets/jwt_secret.txt")) {
        Generate-Password | Out-File -FilePath "secrets/jwt_secret.txt" -Encoding UTF8 -NoNewline
        Write-Status "Generated JWT secret"
    } else {
        Write-Warning "JWT secret already exists"
    }

    # Redis password
    if (-not (Test-Path "secrets/redis_password.txt")) {
        Generate-Password | Out-File -FilePath "secrets/redis_password.txt" -Encoding UTF8 -NoNewline
        Write-Status "Generated Redis password"
    } else {
        Write-Warning "Redis password already exists"
    }

    Write-Status "Generated secure passwords"
}

# Create SSL directory if it doesn't exist
if (-not (Test-Path "config/ssl")) {
    New-Item -ItemType Directory -Path "config/ssl" -Force | Out-Null
    Write-Status "Created SSL directory"
}

# Generate self-signed SSL certificate for development/testing
if (-not $SkipSSL -and ((-not (Test-Path "config/ssl/cert.pem")) -or (-not (Test-Path "config/ssl/key.pem")))) {
    Write-Warning "Generating self-signed SSL certificate for testing"
    Write-Warning "Replace with proper SSL certificates in production!"
    
    try {
        # Try to use OpenSSL if available
        openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes -subj "/C=RU/ST=Moscow/L=Moscow/O=Gaming Platform/OU=Library Service/CN=localhost"
        Write-Status "Generated self-signed SSL certificate using OpenSSL"
    } catch {
        # Fallback to PowerShell method
        Write-Warning "OpenSSL not found, using PowerShell to generate certificate"
        
        $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -KeyLength 4096 -NotAfter (Get-Date).AddDays(365)
        
        # Export certificate
        $certPath = "config/ssl/cert.pem"
        $keyPath = "config/ssl/key.pem"
        
        # Export as PEM (this is a simplified approach)
        $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        $certPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($certBytes, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----"
        $certPem | Out-File -FilePath $certPath -Encoding ASCII
        
        Write-Status "Generated self-signed SSL certificate using PowerShell"
        Write-Warning "Private key export requires manual steps in Windows. Consider using OpenSSL."
    }
} else {
    Write-Warning "SSL certificates already exist or skipped"
}

# Create environment file for production
if (-not (Test-Path ".env.production")) {
    $envContent = @"
# Production Environment Configuration
NODE_ENV=production

# Database Configuration
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_NAME=library_service
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
DATABASE_SSL=true

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_TTL=600

# Service URLs (Update these with your actual service URLs)
GAMES_CATALOG_SERVICE_URL=https://game-catalog.yourdomain.com
USER_SERVICE_URL=https://user-service.yourdomain.com
PAYMENT_SERVICE_URL=https://payment-service.yourdomain.com

# Application Configuration
LOG_LEVEL=info
PROMETHEUS_ENABLED=true
HEALTH_CHECK_TIMEOUT=3000

# APM Configuration
APM_ENABLED=true
APM_SERVICE_NAME=library-service
APM_ENVIRONMENT=production

# Security Configuration
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@
    $envContent | Out-File -FilePath ".env.production" -Encoding UTF8
    Write-Status "Created production environment file"
} else {
    Write-Warning "Production environment file already exists"
}

# Build production image
Write-Status "Building production Docker image..."
try {
    docker build --target production -t library-service:prod .
    Write-Status "Production image built successfully ✓"
} catch {
    Write-Error "Failed to build production image"
    exit 1
}

# Test the production setup
Write-Status "Testing production setup..."
try {
    docker-compose -f docker-compose.prod.yml config | Out-Null
    Write-Status "Production docker-compose configuration is valid ✓"
} catch {
    Write-Error "Production docker-compose configuration has errors"
    exit 1
}

Write-Host ""
Write-Host "🎉 Production setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update service URLs in .env.production" -ForegroundColor White
Write-Host "2. Replace self-signed SSL certificates with proper ones" -ForegroundColor White
Write-Host "3. Review and adjust resource limits in docker-compose.prod.yml" -ForegroundColor White
Write-Host "4. Set up monitoring and logging infrastructure" -ForegroundColor White
Write-Host "5. Configure backup strategies for data volumes" -ForegroundColor White
Write-Host ""
Write-Host "To start the production environment:" -ForegroundColor Cyan
Write-Host "docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor White
Write-Host ""
Write-Host "To monitor the services:" -ForegroundColor Cyan
Write-Host "docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor White
Write-Host ""
Write-Warning "Remember to keep your secrets secure and never commit them to version control!"