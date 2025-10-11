# Auth Service Setup Script (PowerShell)
# This script sets up the Auth Service for development or production

param(
    [string]$Mode = "development",
    [switch]$SkipDeps = $false
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if we're in the right directory
if (-not (Test-Path "package.json") -or -not (Test-Path "src")) {
    Write-Error "This script must be run from the auth-service directory"
    exit 1
}

# Check if backend directory exists
if (-not (Test-Path "../docker-compose.yml")) {
    Write-Error "Backend docker-compose.yml not found. Make sure you're in the correct directory structure."
    exit 1
}

Write-Status "Setting up Auth Service in $Mode mode..."

# Install dependencies
if (-not $SkipDeps) {
    Write-Status "Installing dependencies..."
    npm ci
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed"
    } else {
        Write-Error "Failed to install dependencies"
        exit 1
    }
} else {
    Write-Warning "Skipping dependency installation"
}

# Setup environment file
if (-not (Test-Path ".env")) {
    Write-Status "Creating .env file from template..."
    Copy-Item ".env.example" ".env"
    Write-Success "Environment file created"
    Write-Warning "Please review and update .env file with your configuration"
} else {
    Write-Warning ".env file already exists, skipping creation"
}

# Setup based on mode
switch ($Mode.ToLower()) {
    { $_ -in "development", "dev" } {
        Write-Status "Setting up development environment..."
        
        # Start database services
        Write-Status "Starting database services..."
        Set-Location ".."
        docker-compose up -d postgres-auth redis
        Set-Location "auth-service"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start database services"
            exit 1
        }
        
        # Wait for database to be ready
        Write-Status "Waiting for database to be ready..."
        Start-Sleep -Seconds 10
        
        # Initialize database
        Write-Status "Initializing database..."
        npm run db:init
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Development setup complete!"
            Write-Status "You can now run: npm run start:dev"
        } else {
            Write-Error "Database initialization failed"
            exit 1
        }
    }
    
    { $_ -in "docker", "docker-dev" } {
        Write-Status "Setting up Docker development environment..."
        
        Set-Location ".."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres-auth redis
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start services"
            exit 1
        }
        
        Write-Status "Waiting for services to be ready..."
        Start-Sleep -Seconds 15
        
        # Build and start auth service
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker development setup complete!"
            Write-Status "Auth Service is running at http://localhost:3001"
        } else {
            Write-Error "Failed to start Auth Service"
            exit 1
        }
    }
    
    { $_ -in "production", "prod" } {
        Write-Status "Setting up production environment..."
        
        # Build the application
        Write-Status "Building application..."
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed"
            exit 1
        }
        
        Set-Location ".."
        
        # Start production services
        Write-Status "Starting production services..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres-auth redis auth-service
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Production setup complete!"
            Write-Status "Auth Service is running at http://localhost:3001"
        } else {
            Write-Error "Failed to start production services"
            exit 1
        }
    }
    
    "test" {
        Write-Status "Setting up test environment..."
        
        # Start test database
        Set-Location ".."
        docker-compose up -d postgres-auth redis
        Set-Location "auth-service"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start test services"
            exit 1
        }
        
        # Wait for database
        Start-Sleep -Seconds 10
        
        # Initialize test database
        npm run db:init
        
        # Run tests
        Write-Status "Running tests..."
        npm run test
        npm run test:e2e
        
        Write-Success "Test setup and execution complete!"
    }
    
    default {
        Write-Error "Unknown mode: $Mode"
        Write-Status "Available modes: development, docker, production, test"
        exit 1
    }
}

# Health check
Write-Status "Performing health check..."
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Success "Auth Service is healthy and responding!"
    } else {
        Write-Warning "Health check returned status: $($response.StatusCode)"
    }
} catch {
    Write-Warning "Health check failed. Service might still be starting up."
    Write-Status "You can check the status with: docker-compose logs auth-service"
}

Write-Success "Auth Service setup completed successfully!"

# Show useful commands
Write-Host ""
Write-Status "Useful commands:"
Write-Host "  View logs:           docker-compose logs -f auth-service"
Write-Host "  Check health:        Invoke-WebRequest http://localhost:3001/api/health"
Write-Host "  Database status:     npm run db:status"
Write-Host "  Stop services:       docker-compose down"
Write-Host "  Restart service:     docker-compose restart auth-service"