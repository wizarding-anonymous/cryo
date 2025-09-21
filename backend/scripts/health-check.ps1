# Health check script for all microservices on Windows (PowerShell)
# This script checks the health of all services and reports their status

param(
    [int]$Timeout = 10,
    [int]$RetryCount = 3,
    [int]$RetryDelay = 2,
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\health-check.ps1 [OPTIONS]"
    Write-Host "Options:"
    Write-Host "  -Timeout SECONDS       Connection timeout (default: $Timeout)"
    Write-Host "  -RetryCount COUNT      Number of retries (default: $RetryCount)"
    Write-Host "  -RetryDelay SECONDS    Delay between retries (default: $RetryDelay)"
    Write-Host "  -Help                  Show this help message"
    exit 0
}

# Function to write colored output
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Blue
}

# Function to check HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Service,
        [int]$Port,
        [string]$Endpoint = "/health"
    )
    
    for ($i = 1; $i -le $RetryCount; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port$Endpoint" -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {
            if ($i -lt $RetryCount) {
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }
    
    return $false
}

# Function to check TCP port
function Test-TcpPort {
    param(
        [string]$Service,
        [int]$Port
    )
    
    for ($i = 1; $i -le $RetryCount; $i++) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ReceiveTimeout = $Timeout * 1000
            $tcpClient.SendTimeout = $Timeout * 1000
            $tcpClient.Connect("localhost", $Port)
            $tcpClient.Close()
            return $true
        } catch {
            if ($i -lt $RetryCount) {
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }
    
    return $false
}

# Function to check Docker container
function Test-Container {
    param([string]$ContainerName)
    
    try {
        $containers = docker ps --format "table {{.Names}}" | Select-String -Pattern "^$ContainerName$"
        if ($containers) {
            # Check if container has health check
            $healthStatus = docker inspect --format='{{.State.Health.Status}}' $ContainerName 2>$null
            
            switch ($healthStatus) {
                "healthy" { return 0 }
                "unhealthy" { return 2 }
                "starting" { return 3 }
                default {
                    # No health check, check if running
                    $isRunning = docker inspect --format='{{.State.Running}}' $ContainerName 2>$null
                    if ($isRunning -eq "true") {
                        return 0
                    } else {
                        return 1
                    }
                }
            }
        } else {
            return 1
        }
    } catch {
        return 1
    }
}

# Main health check function
function Start-HealthCheck {
    Write-Header "Microservices Health Check"
    
    $totalServices = 0
    $healthyServices = 0
    $unhealthyServices = 0
    $startingServices = 0
    
    # Service definitions
    $services = @{
        "api-gateway" = 3000
        "user-service" = 3001
        "game-catalog-service" = 3002
        "library-service" = 3003
        "review-service" = 3004
        "payment-service" = 3005
        "notification-service" = 3006
        "social-service" = 3007
        "achievement-service" = 3008
        "security-service" = 3009
        "download-service" = 3010
    }
    
    $infrastructure = @{
        "postgres-user-db" = 5432
        "postgres-catalog-db" = 5433
        "postgres-library-db" = 5434
        "postgres-review-db" = 5435
        "postgres-payment-db" = 5436
        "postgres-notification-db" = 5437
        "postgres-social-db" = 5438
        "postgres-achievement-db" = 5439
        "postgres-security-db" = 5440
        "postgres-download-db" = 5441
        "redis-cache" = 6379
        "prometheus" = 9090
        "grafana" = 3100
        "elasticsearch" = 9200
        "kibana" = 5601
    }
    
    # Check microservices
    Write-Header "Microservices Status"
    
    foreach ($service in $services.GetEnumerator()) {
        $serviceName = $service.Key
        $port = $service.Value
        $totalServices++
        
        $containerStatus = Test-Container $serviceName
        
        Write-Host ("{0,-25}" -f $serviceName) -NoNewline
        
        switch ($containerStatus) {
            0 {
                # Container is running, check HTTP endpoint
                if (Test-HttpEndpoint $serviceName $port) {
                    Write-Success "Healthy (HTTP OK)"
                    $healthyServices++
                } else {
                    Write-Error "Unhealthy (HTTP Failed)"
                    $unhealthyServices++
                }
            }
            2 {
                Write-Error "Unhealthy (Container Unhealthy)"
                $unhealthyServices++
            }
            3 {
                Write-Warning "Starting (Container Starting)"
                $startingServices++
            }
            default {
                Write-Error "Down (Container Not Running)"
                $unhealthyServices++
            }
        }
    }
    
    # Check infrastructure services
    Write-Header "Infrastructure Status"
    
    foreach ($service in $infrastructure.GetEnumerator()) {
        $serviceName = $service.Key
        $port = $service.Value
        $totalServices++
        
        $containerStatus = Test-Container $serviceName
        
        Write-Host ("{0,-25}" -f $serviceName) -NoNewline
        
        switch ($containerStatus) {
            0 {
                # Container is running, check port
                if (Test-TcpPort $serviceName $port) {
                    Write-Success "Healthy (Port Open)"
                    $healthyServices++
                } else {
                    Write-Error "Unhealthy (Port Closed)"
                    $unhealthyServices++
                }
            }
            2 {
                Write-Error "Unhealthy (Container Unhealthy)"
                $unhealthyServices++
            }
            3 {
                Write-Warning "Starting (Container Starting)"
                $startingServices++
            }
            default {
                Write-Error "Down (Container Not Running)"
                $unhealthyServices++
            }
        }
    }
    
    # Summary
    Write-Header "Health Check Summary"
    
    Write-Host "Total Services: $totalServices"
    Write-Success "Healthy: $healthyServices"
    
    if ($startingServices -gt 0) {
        Write-Warning "Starting: $startingServices"
    }
    
    if ($unhealthyServices -gt 0) {
        Write-Error "Unhealthy: $unhealthyServices"
    }
    
    # Overall status
    if ($unhealthyServices -eq 0 -and $startingServices -eq 0) {
        Write-Success "All services are healthy!"
        return 0
    } elseif ($unhealthyServices -eq 0) {
        Write-Warning "Some services are still starting..."
        return 1
    } else {
        Write-Error "Some services are unhealthy!"
        Write-Host ""
        Write-Info "Troubleshooting tips:"
        Write-Info "1. Check Docker containers: docker-compose ps"
        Write-Info "2. Check service logs: docker-compose logs [service-name]"
        Write-Info "3. Restart services: docker-compose restart"
        Write-Info "4. Rebuild services: docker-compose build"
        return 2
    }
}

# Check if Docker is available
try {
    docker --version | Out-Null
} catch {
    Write-Error "Docker is not available. Please make sure Docker is installed and running."
    exit 1
}

# Run main function
$exitCode = Start-HealthCheck
exit $exitCode