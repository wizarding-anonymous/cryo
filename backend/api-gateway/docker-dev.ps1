# Docker development script for API Gateway (PowerShell)
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "start", "stop", "restart", "health", "logs", "cleanup", "test", "help")]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [string]$Service
)

# Function to print colored output
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

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker and try again."
        exit 1
    }
}

# Function to build images
function Build-Images {
    Write-Status "Building Docker images..."
    docker-compose build --no-cache
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Images built successfully!"
    } else {
        Write-Error "Failed to build images"
        exit 1
    }
}

# Function to start services
function Start-Services {
    Write-Status "Starting development services..."
    docker-compose up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services started successfully!"
        
        # Wait for services to be healthy
        Write-Status "Waiting for services to be healthy..."
        Start-Sleep -Seconds 10
        
        # Check service health
        Test-Health
    } else {
        Write-Error "Failed to start services"
        exit 1
    }
}

# Function to stop services
function Stop-Services {
    Write-Status "Stopping development services..."
    docker-compose down
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services stopped successfully!"
    } else {
        Write-Error "Failed to stop services"
        exit 1
    }
}

# Function to restart services
function Restart-Services {
    Write-Status "Restarting development services..."
    docker-compose restart
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services restarted successfully!"
    } else {
        Write-Error "Failed to restart services"
        exit 1
    }
}

# Function to check service health
function Test-Health {
    Write-Status "Checking service health..."
    
    $services = @(
        @{name="api-gateway"; port=3001},
        @{name="user-service"; port=3000},
        @{name="game-catalog-service"; port=3002},
        @{name="payment-service"; port=3003},
        @{name="library-service"; port=3004},
        @{name="notification-service"; port=3005}
    )
    
    foreach ($service in $services) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$($service.port)/health" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Status "$($service.name) is healthy ✓"
            } else {
                Write-Warning "$($service.name) returned status code $($response.StatusCode)"
            }
        }
        catch {
            Write-Warning "$($service.name) is not responding on port $($service.port)"
        }
    }
    
    # Check Redis separately
    try {
        $redisTest = docker exec redis_gateway redis-cli ping 2>$null
        if ($redisTest -eq "PONG") {
            Write-Status "redis is healthy ✓"
        } else {
            Write-Warning "redis is not responding properly"
        }
    }
    catch {
        Write-Warning "redis is not accessible"
    }
}

# Function to view logs
function Show-Logs {
    param([string]$ServiceName)
    
    if ([string]::IsNullOrEmpty($ServiceName)) {
        Write-Status "Showing logs for all services..."
        docker-compose logs -f
    } else {
        Write-Status "Showing logs for $ServiceName..."
        docker-compose logs -f $ServiceName
    }
}

# Function to clean up
function Remove-Resources {
    Write-Status "Cleaning up Docker resources..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    Write-Status "Cleanup completed!"
}

# Function to run tests
function Invoke-Tests {
    Write-Status "Running tests in Docker container..."
    docker-compose exec api-gateway npm run test:e2e
}

# Function to show usage
function Show-Usage {
    Write-Host "Usage: .\docker-dev.ps1 -Command <command> [-Service <service>]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build     - Build Docker images"
    Write-Host "  start     - Start development services"
    Write-Host "  stop      - Stop development services"
    Write-Host "  restart   - Restart development services"
    Write-Host "  health    - Check service health"
    Write-Host "  logs      - View logs (optionally specify -Service parameter)"
    Write-Host "  cleanup   - Clean up Docker resources"
    Write-Host "  test      - Run tests in container"
    Write-Host "  help      - Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\docker-dev.ps1 -Command start"
    Write-Host "  .\docker-dev.ps1 -Command logs -Service api-gateway"
    Write-Host "  .\docker-dev.ps1 -Command health"
}

# Main script logic
switch ($Command) {
    "build" {
        Test-Docker
        Build-Images
    }
    "start" {
        Test-Docker
        Start-Services
    }
    "stop" {
        Test-Docker
        Stop-Services
    }
    "restart" {
        Test-Docker
        Restart-Services
    }
    "health" {
        Test-Health
    }
    "logs" {
        Show-Logs -ServiceName $Service
    }
    "cleanup" {
        Test-Docker
        Remove-Resources
    }
    "test" {
        Test-Docker
        Invoke-Tests
    }
    "help" {
        Show-Usage
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Usage
        exit 1
    }
}