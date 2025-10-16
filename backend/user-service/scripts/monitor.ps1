# User Service Monitoring and Debug Script (PowerShell)
# Provides various monitoring and debugging utilities

param(
    [Parameter(Position=0)]
    [ValidateSet("health", "metrics", "logs", "stats", "database", "redis", "diagnostics", "test", "help")]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [int]$Lines = 50,
    
    [Parameter(Position=2)]
    [bool]$Follow = $false
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Magenta = "Magenta"
$Cyan = "Cyan"

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
    Write-Host "[MONITOR] $Message" -ForegroundColor $Magenta
}

function Write-Metric {
    param([string]$Message)
    Write-Host "[METRIC] $Message" -ForegroundColor $Cyan
}

# Function to check service health
function Test-ServiceHealth {
    Write-Header "Service Health Check"
    
    # User Service
    Write-Status "Checking User Service..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $healthData = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
            $status = if ($healthData.status) { $healthData.status } else { "unknown" }
            Write-Success "User Service: $status"
        } else {
            Write-Error "User Service: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error "User Service: Not responding"
    }
    
    # PostgreSQL
    Write-Status "Checking PostgreSQL..."
    Set-Location "../"
    try {
        $result = docker-compose exec -T postgres-user pg_isready -U user_service -d user_db 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PostgreSQL: Ready"
        } else {
            Write-Error "PostgreSQL: Not ready"
        }
    } catch {
        Write-Error "PostgreSQL: Check failed"
    }
    
    # Redis
    Write-Status "Checking Redis..."
    try {
        $result = docker-compose exec -T redis redis-cli -a redis_password ping 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Redis: Ready"
        } else {
            Write-Error "Redis: Not ready"
        }
    } catch {
        Write-Error "Redis: Check failed"
    }
    
    Set-Location "user-service/"
}

# Function to show metrics
function Show-Metrics {
    Write-Header "Service Metrics"
    
    Write-Status "Fetching Prometheus metrics..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/metrics" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            $metrics = $response.Content -split "`n"
            
            Write-Host ""
            Write-Metric "HTTP Requests:"
            $metrics | Where-Object { $_ -match "http_requests_total" } | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
            
            Write-Host ""
            Write-Metric "Response Times:"
            $metrics | Where-Object { $_ -match "http_request_duration" } | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
            
            Write-Host ""
            Write-Metric "User Service Specific:"
            $metrics | Where-Object { $_ -match "user_service" } | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
            
            Write-Host ""
            Write-Metric "Cache Metrics:"
            $metrics | Where-Object { $_ -match "cache" } | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
            
            Write-Host ""
            Write-Metric "Database Metrics:"
            $metrics | Where-Object { $_ -match "database" } | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
        }
    } catch {
        Write-Error "Could not fetch metrics from User Service: $($_.Exception.Message)"
    }
}

# Function to show logs
function Show-Logs {
    param(
        [int]$Lines = 50,
        [bool]$Follow = $false
    )
    
    Write-Header "Service Logs (last $Lines lines)"
    
    Set-Location "../"
    try {
        if ($Follow) {
            Write-Status "Following logs (Ctrl+C to stop)..."
            docker-compose logs -f --tail=$Lines user-service
        } else {
            docker-compose logs --tail=$Lines user-service
        }
    } catch {
        Write-Error "Could not fetch logs: $($_.Exception.Message)"
    }
    Set-Location "user-service/"
}

# Function to show container stats
function Show-Stats {
    Write-Header "Container Statistics"
    
    Set-Location "../"
    Write-Status "Docker container stats:"
    try {
        docker stats --no-stream user-service postgres-user redis 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Some containers may not be running"
        }
    } catch {
        Write-Warning "Could not fetch container stats"
    }
    
    Write-Host ""
    Write-Status "Container details:"
    try {
        docker-compose ps user-service postgres-user redis
    } catch {
        Write-Warning "Could not fetch container details"
    }
    Set-Location "user-service/"
}

# Function to show database info
function Show-DatabaseInfo {
    Write-Header "Database Information"
    
    Set-Location "../"
    Write-Status "Database connections:"
    try {
        $query = @"
SELECT 
    datname,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted
FROM pg_stat_database 
WHERE datname = 'user_db';
"@
        docker-compose exec -T postgres-user psql -U user_service -d user_db -c $query 2>$null
    } catch {
        Write-Error "Could not fetch database stats"
    }
    
    Write-Host ""
    Write-Status "Recent migrations:"
    try {
        docker-compose exec -T postgres-user psql -U user_service -d user_db -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;" 2>$null
    } catch {
        Write-Warning "Could not fetch migration history"
    }
    
    Set-Location "user-service/"
}

# Function to show Redis info
function Show-RedisInfo {
    Write-Header "Redis Information"
    
    Set-Location "../"
    Write-Status "Redis info:"
    try {
        $redisInfo = docker-compose exec -T redis redis-cli -a redis_password info server 2>$null
        if ($LASTEXITCODE -eq 0) {
            $redisInfo -split "`n" | Where-Object { $_ -match "(redis_version|uptime_in_seconds|connected_clients|used_memory_human|keyspace_hits|keyspace_misses)" } | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Error "Could not fetch Redis info"
        }
    } catch {
        Write-Error "Could not connect to Redis"
    }
    
    Write-Host ""
    Write-Status "Redis keyspace:"
    try {
        docker-compose exec -T redis redis-cli -a redis_password info keyspace 2>$null
    } catch {
        Write-Warning "No keyspace data"
    }
    
    Write-Host ""
    Write-Status "User Service keys (sample):"
    try {
        $keys = docker-compose exec -T redis redis-cli -a redis_password --scan --pattern "user-service:*" 2>$null
        if ($keys) {
            $keys -split "`n" | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Warning "No user-service keys found"
        }
    } catch {
        Write-Warning "Could not scan Redis keys"
    }
    
    Set-Location "user-service/"
}

# Function to run diagnostics
function Invoke-Diagnostics {
    Write-Header "Running Full Diagnostics"
    
    Test-ServiceHealth
    Write-Host ""
    Show-Stats
    Write-Host ""
    Show-DatabaseInfo
    Write-Host ""
    Show-RedisInfo
    Write-Host ""
    Show-Metrics
}

# Function to test endpoints
function Test-Endpoints {
    Write-Header "Testing API Endpoints"
    
    $BaseUrl = "http://localhost:3002"
    
    # Health check
    Write-Status "Testing health endpoint..."
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $healthData = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
            $status = if ($healthData.status) { $healthData.status } else { "unknown" }
            Write-Success "GET /health: $status"
        } else {
            Write-Error "GET /health: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error "GET /health: Failed"
    }
    
    # Metrics
    Write-Status "Testing metrics endpoint..."
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/metrics" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $lineCount = ($response.Content -split "`n").Count
            Write-Success "GET /metrics: $lineCount lines"
        } else {
            Write-Error "GET /metrics: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Error "GET /metrics: Failed"
    }
    
    # API documentation
    Write-Status "Testing API docs..."
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/api" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Success "GET /api: Available"
        } else {
            Write-Warning "GET /api: HTTP $($response.StatusCode)"
        }
    } catch {
        Write-Warning "GET /api: Not available"
    }
    
    # Test user endpoints
    Write-Status "Testing user endpoints..."
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/users/550e8400-e29b-41d4-a716-446655440000" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 404) {
            Write-Success "GET /users/:id: Properly returns 404 for non-existent user"
        } elseif ($response.StatusCode -eq 200) {
            Write-Success "GET /users/:id: Returns 200 (user exists)"
        } else {
            Write-Warning "GET /users/:id: Unexpected status code $($response.StatusCode)"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 404) {
            Write-Success "GET /users/:id: Properly returns 404 for non-existent user"
        } else {
            Write-Warning "GET /users/:id: Exception occurred"
        }
    }
}

# Function to show help
function Show-Help {
    Write-Host @"
User Service Monitoring and Debug Script (PowerShell)

Usage: .\monitor.ps1 <command> [options]

Commands:
  health              Check service health
  metrics             Show Prometheus metrics
  logs [lines] [follow]  Show logs (default: 50 lines, follow: false)
  stats               Show container statistics
  database            Show database information
  redis               Show Redis information
  diagnostics         Run full diagnostics
  test                Test API endpoints
  help                Show this help message

Examples:
  .\monitor.ps1 health
  .\monitor.ps1 logs 100
  .\monitor.ps1 logs 50 $true    # Follow logs
  .\monitor.ps1 diagnostics
  .\monitor.ps1 test
"@
}

# Main script logic
switch ($Command) {
    "health" { Test-ServiceHealth }
    "metrics" { Show-Metrics }
    "logs" { Show-Logs -Lines $Lines -Follow $Follow }
    "stats" { Show-Stats }
    "database" { Show-DatabaseInfo }
    "redis" { Show-RedisInfo }
    "diagnostics" { Invoke-Diagnostics }
    "test" { Test-Endpoints }
    default { Show-Help }
}