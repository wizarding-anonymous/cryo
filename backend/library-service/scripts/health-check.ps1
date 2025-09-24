# Health check script for Library Service (PowerShell)
# This script performs comprehensive health checks on all services

param(
    [string]$Url = "http://localhost:3000",
    [int]$Timeout = 30,
    [int]$Retries = 3,
    [int]$Delay = 5,
    [switch]$Help
)

if ($Help) {
    Write-Host "Library Service Health Check Script"
    Write-Host "Usage: .\health-check.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Url URL        Library Service URL (default: http://localhost:3000)"
    Write-Host "  -Timeout SEC    Request timeout in seconds (default: 30)"
    Write-Host "  -Retries NUM    Number of retries (default: 3)"
    Write-Host "  -Delay SEC      Delay between retries (default: 5)"
    Write-Host "  -Help           Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\health-check.ps1                                    # Basic health check"
    Write-Host "  .\health-check.ps1 -Url http://localhost:3000         # Custom URL"
    Write-Host "  .\health-check.ps1 -Timeout 60 -Retries 5 -Delay 10  # Custom timeout and retries"
    exit 0
}

function Write-Status {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[i] $Message" -ForegroundColor Blue
}

# Function to check HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [string]$Description
    )
    
    Write-Info "Checking $Description..."
    
    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec $Timeout -UseBasicParsing
            if ($response.StatusCode -eq $ExpectedStatus) {
                Write-Status "$Description is healthy (HTTP $($response.StatusCode))"
                return $true
            } else {
                Write-Warning "$Description returned HTTP $($response.StatusCode) (expected $ExpectedStatus)"
            }
        } catch {
            Write-Warning "$Description is not responding (attempt $i/$Retries): $($_.Exception.Message)"
        }
        
        if ($i -lt $Retries) {
            Start-Sleep -Seconds $Delay
        }
    }
    
    Write-Error "$Description failed health check"
    return $false
}

# Function to check Docker container
function Test-DockerContainer {
    param(
        [string]$ContainerName,
        [string]$Description
    )
    
    Write-Info "Checking $Description container..."
    
    try {
        $containers = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String $ContainerName
        if ($containers -and $containers -match "Up") {
            Write-Status "$Description container is running"
            return $true
        } else {
            Write-Error "$Description container is not running"
            return $false
        }
    } catch {
        Write-Error "Failed to check $Description container: $($_.Exception.Message)"
        return $false
    }
}

# Function to check database connectivity
function Test-Database {
    Write-Info "Checking database connectivity..."
    
    try {
        $result = docker-compose exec -T postgres pg_isready -U postgres -d library_service 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Database is accessible"
            return $true
        } else {
            Write-Error "Database is not accessible"
            return $false
        }
    } catch {
        Write-Error "Failed to check database: $($_.Exception.Message)"
        return $false
    }
}

# Function to check Redis connectivity
function Test-Redis {
    Write-Info "Checking Redis connectivity..."
    
    try {
        $result = docker-compose exec -T redis redis-cli ping 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Redis is accessible"
            return $true
        } else {
            Write-Error "Redis is not accessible"
            return $false
        }
    } catch {
        Write-Error "Failed to check Redis: $($_.Exception.Message)"
        return $false
    }
}

# Function to check service dependencies
function Test-Dependencies {
    Write-Info "Checking service dependencies..."
    
    $depsHealthy = $true
    
    # Check database
    if (-not (Test-Database)) {
        $depsHealthy = $false
    }
    
    # Check Redis
    if (-not (Test-Redis)) {
        $depsHealthy = $false
    }
    
    if ($depsHealthy) {
        Write-Status "All dependencies are healthy"
        return $true
    } else {
        Write-Error "Some dependencies are unhealthy"
        return $false
    }
}

# Function to perform comprehensive health check
function Start-ComprehensiveHealthCheck {
    $allHealthy = $true
    
    Write-Host "🏥 Library Service Health Check" -ForegroundColor Green
    Write-Host "===============================" -ForegroundColor Green
    Write-Host ""
    
    # Check Docker containers
    if (-not (Test-DockerContainer "library-service" "Library Service")) {
        $allHealthy = $false
    }
    
    if (-not (Test-DockerContainer "postgres" "PostgreSQL")) {
        $allHealthy = $false
    }
    
    if (-not (Test-DockerContainer "redis" "Redis")) {
        $allHealthy = $false
    }
    
    Write-Host ""
    
    # Check service dependencies
    if (-not (Test-Dependencies)) {
        $allHealthy = $false
    }
    
    Write-Host ""
    
    # Check HTTP endpoints
    if (-not (Test-HttpEndpoint "$Url/health" 200 "Library Service health endpoint")) {
        $allHealthy = $false
    }
    
    if (-not (Test-HttpEndpoint "$Url/health/detailed" 200 "Library Service detailed health")) {
        $allHealthy = $false
    }
    
    # Check metrics endpoint (may not be enabled in development)
    try {
        if (Test-HttpEndpoint "$Url/metrics" 200 "Prometheus metrics endpoint") {
            Write-Status "Metrics endpoint is available"
        }
    } catch {
        Write-Warning "Metrics endpoint is not available (may be disabled in development)"
    }
    
    Write-Host ""
    
    # Check mock services if they exist
    try {
        $mockContainers = docker ps --format "table {{.Names}}"
        
        if ($mockContainers -match "game-catalog-mock") {
            Test-HttpEndpoint "http://localhost:3001/mockserver/status" 200 "Game Catalog Mock" | Out-Null
        }
        
        if ($mockContainers -match "user-service-mock") {
            Test-HttpEndpoint "http://localhost:3002/mockserver/status" 200 "User Service Mock" | Out-Null
        }
        
        if ($mockContainers -match "payment-service-mock") {
            Test-HttpEndpoint "http://localhost:3003/mockserver/status" 200 "Payment Service Mock" | Out-Null
        }
    } catch {
        Write-Warning "Could not check mock services"
    }
    
    Write-Host ""
    Write-Host "===============================" -ForegroundColor Green
    
    if ($allHealthy) {
        Write-Status "All health checks passed! 🎉"
        Write-Host ""
        Write-Host "Service Information:" -ForegroundColor Cyan
        Write-Host "- Library Service: $Url" -ForegroundColor White
        Write-Host "- Health Check: $Url/health" -ForegroundColor White
        Write-Host "- API Documentation: $Url/api" -ForegroundColor White
        
        try {
            Invoke-WebRequest -Uri "$Url/metrics" -TimeoutSec 5 -UseBasicParsing | Out-Null
            Write-Host "- Metrics: $Url/metrics" -ForegroundColor White
        } catch {
            # Metrics endpoint not available
        }
        
        return $true
    } else {
        Write-Error "Some health checks failed! ❌"
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Cyan
        Write-Host "1. Check container logs: docker-compose logs -f" -ForegroundColor White
        Write-Host "2. Restart services: docker-compose restart" -ForegroundColor White
        Write-Host "3. Rebuild containers: docker-compose up --build" -ForegroundColor White
        return $false
    }
}

# Run comprehensive health check
$success = Start-ComprehensiveHealthCheck

if (-not $success) {
    exit 1
}