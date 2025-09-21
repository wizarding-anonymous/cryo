# Setup script for all microservices on Windows (PowerShell)
# This script initializes the development environment

param(
    [switch]$SkipDependencies,
    [switch]$SkipBuild,
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\setup.ps1 [OPTIONS]"
    Write-Host "Options:"
    Write-Host "  -SkipDependencies    Skip installing dependencies"
    Write-Host "  -SkipBuild          Skip building Docker images"
    Write-Host "  -Help               Show this help message"
    exit 0
}

Write-Host "🚀 Setting up microservices development environment..." -ForegroundColor Green

# Function to write colored output
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
    $dockerVersion = docker --version
    Write-Status "Docker found: $dockerVersion"
} catch {
    Write-Error "Docker is not installed. Please install Docker Desktop first."
    exit 1
}

# Check if Docker Compose is installed
try {
    $composeVersion = docker-compose --version
    Write-Status "Docker Compose found: $composeVersion"
} catch {
    Write-Error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Status "Node.js found: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Check if Go is installed
$goInstalled = $false
try {
    $goVersion = go version
    Write-Status "Go found: $goVersion"
    $goInstalled = $true
} catch {
    Write-Warning "Go is not installed. Download service will not work properly."
}

if (-not $SkipDependencies) {
    Write-Status "Installing dependencies for all Node.js services..."

    # List of Node.js services
    $nodeServices = @(
        "api-gateway",
        "user-service", 
        "game-catalog-service",
        "library-service",
        "review-service",
        "payment-service",
        "notification-service",
        "social-service",
        "achievement-service",
        "security-service"
    )

    # Install dependencies for each Node.js service
    foreach ($service in $nodeServices) {
        if (Test-Path $service) {
            Write-Status "Installing dependencies for $service..."
            Push-Location $service
            try {
                npm install --legacy-peer-deps
                Write-Status "Dependencies installed for $service"
            } catch {
                Write-Error "Failed to install dependencies for $service"
            }
            Pop-Location
        } else {
            Write-Warning "Service directory $service not found, skipping..."
        }
    }

    # Install Go dependencies for download service
    if ($goInstalled -and (Test-Path "download-service")) {
        Write-Status "Installing dependencies for download-service..."
        Push-Location "download-service"
        try {
            go mod download
            Write-Status "Dependencies installed for download-service"
        } catch {
            Write-Error "Failed to install dependencies for download-service"
        }
        Pop-Location
    }
}

# Create necessary directories
Write-Status "Creating necessary directories..."
$directories = @(
    "monitoring\grafana\dashboards",
    "monitoring\grafana\datasources",
    "logging",
    "nginx",
    "k8s",
    "scripts\backup",
    "scripts\deploy"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Status "Created directory: $dir"
    }
}

# Copy example environment files
Write-Status "Setting up environment files..."
$nodeServices = @(
    "api-gateway",
    "user-service", 
    "game-catalog-service",
    "library-service",
    "review-service",
    "payment-service",
    "notification-service",
    "social-service",
    "achievement-service",
    "security-service"
)

foreach ($service in $nodeServices) {
    if (Test-Path $service) {
        $envExample = Join-Path $service ".env.example"
        $envFile = Join-Path $service ".env"
        
        if ((Test-Path $envExample) -and (-not (Test-Path $envFile))) {
            Copy-Item $envExample $envFile
            Write-Status "Created .env file for $service"
        }
    }
}

# Setup download service environment
if (Test-Path "download-service") {
    $envExample = "download-service\.env.example"
    $envFile = "download-service\.env"
    
    if ((Test-Path $envExample) -and (-not (Test-Path $envFile))) {
        Copy-Item $envExample $envFile
        Write-Status "Created .env file for download-service"
    }
}

# Build Docker images
if (-not $SkipBuild) {
    Write-Status "Building Docker images..."
    try {
        docker-compose build
        Write-Status "Docker images built successfully"
    } catch {
        Write-Error "Failed to build Docker images"
        exit 1
    }
}

Write-Host ""
Write-Status "✅ Setup completed successfully!"
Write-Host ""
Write-Status "Next steps:"
Write-Status "1. Review and update .env files in each service directory"
Write-Status "2. Run 'docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d' to start development environment"
Write-Status "3. Run '.\scripts\health-check.ps1' to verify all services are running"
Write-Host ""
Write-Status "Available URLs:"
Write-Status "- API Gateway: http://localhost:3000"
Write-Status "- Prometheus: http://localhost:9090"
Write-Status "- Grafana: http://localhost:3100 (admin/admin)"
Write-Status "- Kibana: http://localhost:5601"
Write-Status "- PgAdmin (dev): http://localhost:5050 (admin@admin.com/admin)"
Write-Status "- Redis Commander (dev): http://localhost:8081"
Write-Host ""
Write-Status "Useful commands:"
Write-Status "- Start dev environment: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d"
Write-Status "- Start prod environment: docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
Write-Status "- View logs: docker-compose logs -f"
Write-Status "- Stop services: docker-compose down"
Write-Status "- Health check: .\scripts\health-check.ps1"