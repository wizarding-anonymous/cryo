# =============================================================================
# Test Auth Service Deployment Script (PowerShell)
# Validates Auth Service deployment and integration
# =============================================================================

param(
    [string]$Environment = "staging",
    [string]$ComposeFile = "docker-compose.yml"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

Write-Host "🧪 Testing Auth Service deployment in $Environment environment" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

# Function to test HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Description,
        [int]$ExpectedStatus = 200,
        [int]$TimeoutSeconds = 30
    )
    
    Write-Host "🔍 Testing $Description..." -ForegroundColor $Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "✅ $Description: OK (Status: $($response.StatusCode))" -ForegroundColor $Green
            return $true
        }
        else {
            Write-Host "❌ $Description: Unexpected status $($response.StatusCode)" -ForegroundColor $Red
            return $false
        }
    }
    catch {
        Write-Host "❌ $Description: Failed - $_" -ForegroundColor $Red
        return $false
    }
}

# Function to test service connectivity
function Test-ServiceConnectivity {
    param([string]$ServiceName, [string]$Port)
    
    Write-Host "🔗 Testing $ServiceName connectivity..." -ForegroundColor $Yellow
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("localhost", $Port).Wait(5000)
        
        if ($tcpClient.Connected) {
            Write-Host "✅ $ServiceName connectivity: OK" -ForegroundColor $Green
            $tcpClient.Close()
            return $true
        }
        else {
            Write-Host "❌ $ServiceName connectivity: Failed" -ForegroundColor $Red
            return $false
        }
    }
    catch {
        Write-Host "❌ $ServiceName connectivity: Failed - $_" -ForegroundColor $Red
        return $false
    }
}

# Function to wait for service to be ready
function Wait-ForService {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$MaxAttempts = 30,
        [int]$IntervalSeconds = 10
    )
    
    Write-Host "⏳ Waiting for $ServiceName to be ready..." -ForegroundColor $Yellow
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName is ready (attempt $i/$MaxAttempts)" -ForegroundColor $Green
                return $true
            }
        }
        catch {
            Write-Host "⏳ Attempt $i/$MaxAttempts: $ServiceName not ready yet..." -ForegroundColor $Yellow
        }
        
        if ($i -lt $MaxAttempts) {
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
    
    Write-Host "❌ $ServiceName failed to become ready after $MaxAttempts attempts" -ForegroundColor $Red
    return $false
}

# Step 1: Check if Docker Compose is running
Write-Host "📋 Step 1: Checking Docker Compose status..." -ForegroundColor $Blue

try {
    $composeStatus = docker-compose -f $ComposeFile ps auth-service 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Auth Service is not running in Docker Compose" -ForegroundColor $Red
        Write-Host "💡 Starting Auth Service with Docker Compose..." -ForegroundColor $Yellow
        
        # Start Auth Service and its dependencies
        docker-compose -f $ComposeFile up -d postgres-auth redis auth-service
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to start Auth Service with Docker Compose" -ForegroundColor $Red
            exit 1
        }
        
        Write-Host "✅ Auth Service started with Docker Compose" -ForegroundColor $Green
    }
    else {
        Write-Host "✅ Auth Service is running in Docker Compose" -ForegroundColor $Green
    }
}
catch {
    Write-Host "❌ Error checking Docker Compose status: $_" -ForegroundColor $Red
    exit 1
}

# Step 2: Wait for Auth Service to be ready
Write-Host "`n⏳ Step 2: Waiting for Auth Service to be ready..." -ForegroundColor $Blue

if (-not (Wait-ForService "http://localhost:3001/health" "Auth Service")) {
    Write-Host "❌ Auth Service failed to start properly" -ForegroundColor $Red
    
    # Show logs for debugging
    Write-Host "`n📋 Auth Service logs:" -ForegroundColor $Yellow
    docker-compose -f $ComposeFile logs --tail=50 auth-service
    
    exit 1
}

# Step 3: Test Auth Service health endpoints
Write-Host "`n🏥 Step 3: Testing Auth Service health endpoints..." -ForegroundColor $Blue

$healthTests = @(
    @{ Url = "http://localhost:3001/health"; Description = "Basic health check" },
    @{ Url = "http://localhost:3001/health/ready"; Description = "Readiness check" },
    @{ Url = "http://localhost:3001/health/live"; Description = "Liveness check" }
)

$healthTestsPassed = 0
foreach ($test in $healthTests) {
    if (Test-HttpEndpoint -Url $test.Url -Description $test.Description) {
        $healthTestsPassed++
    }
}

if ($healthTestsPassed -eq $healthTests.Count) {
    Write-Host "✅ All health checks passed" -ForegroundColor $Green
}
else {
    Write-Host "⚠️  Some health checks failed ($healthTestsPassed/$($healthTests.Count) passed)" -ForegroundColor $Yellow
}

# Step 4: Test Auth Service API endpoints
Write-Host "`n🔌 Step 4: Testing Auth Service API endpoints..." -ForegroundColor $Blue

$apiTests = @(
    @{ Url = "http://localhost:3001/api/auth/health"; Description = "Auth API health" },
    @{ Url = "http://localhost:3001/api/metrics"; Description = "Metrics endpoint" }
)

$apiTestsPassed = 0
foreach ($test in $apiTests) {
    if (Test-HttpEndpoint -Url $test.Url -Description $test.Description) {
        $apiTestsPassed++
    }
}

# Step 5: Test database connectivity
Write-Host "`n🗄️  Step 5: Testing database connectivity..." -ForegroundColor $Blue

$dbConnectivityPassed = Test-ServiceConnectivity "PostgreSQL (Auth DB)" "5432"

# Step 6: Test Redis connectivity
Write-Host "`n🔴 Step 6: Testing Redis connectivity..." -ForegroundColor $Blue

$redisConnectivityPassed = Test-ServiceConnectivity "Redis" "6379"

# Step 7: Test integration with other services
Write-Host "`n🔗 Step 7: Testing integration with other services..." -ForegroundColor $Blue

# Check if User Service is running
$userServiceRunning = Test-ServiceConnectivity "User Service" "3002"
if ($userServiceRunning) {
    $userServiceHealthy = Test-HttpEndpoint "http://localhost:3002/health" "User Service health"
}
else {
    Write-Host "⚠️  User Service is not running - skipping integration test" -ForegroundColor $Yellow
    $userServiceHealthy = $false
}

# Check if Security Service is running
$securityServiceRunning = Test-ServiceConnectivity "Security Service" "3010"
if ($securityServiceRunning) {
    $securityServiceHealthy = Test-HttpEndpoint "http://localhost:3010/health" "Security Service health"
}
else {
    Write-Host "⚠️  Security Service is not running - skipping integration test" -ForegroundColor $Yellow
    $securityServiceHealthy = $false
}

# Step 8: Test Auth Service functionality (basic)
Write-Host "`n🔐 Step 8: Testing Auth Service functionality..." -ForegroundColor $Blue

# Test registration endpoint (should return validation error for empty body)
$registrationTest = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" -Method POST -ContentType "application/json" -Body "{}" -UseBasicParsing
}
catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Registration endpoint validation: OK (returns 400 for invalid data)" -ForegroundColor $Green
        $registrationTest = $true
    }
    else {
        Write-Host "❌ Registration endpoint: Unexpected error - $_" -ForegroundColor $Red
    }
}

# Test login endpoint (should return validation error for empty body)
$loginTest = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body "{}" -UseBasicParsing
}
catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Login endpoint validation: OK (returns 400 for invalid data)" -ForegroundColor $Green
        $loginTest = $true
    }
    else {
        Write-Host "❌ Login endpoint: Unexpected error - $_" -ForegroundColor $Red
    }
}

# Step 9: Generate test report
Write-Host "`n📊 Step 9: Test Results Summary" -ForegroundColor $Blue
Write-Host "==================================================" -ForegroundColor $Blue

$totalTests = 0
$passedTests = 0

# Health checks
$totalTests += $healthTests.Count
$passedTests += $healthTestsPassed
Write-Host "Health Checks: $healthTestsPassed/$($healthTests.Count) passed" -ForegroundColor $(if ($healthTestsPassed -eq $healthTests.Count) { $Green } else { $Yellow })

# API endpoints
$totalTests += $apiTests.Count
$passedTests += $apiTestsPassed
Write-Host "API Endpoints: $apiTestsPassed/$($apiTests.Count) passed" -ForegroundColor $(if ($apiTestsPassed -eq $apiTests.Count) { $Green } else { $Yellow })

# Database connectivity
$totalTests++
if ($dbConnectivityPassed) { $passedTests++ }
Write-Host "Database Connectivity: $(if ($dbConnectivityPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($dbConnectivityPassed) { $Green } else { $Red })

# Redis connectivity
$totalTests++
if ($redisConnectivityPassed) { $passedTests++ }
Write-Host "Redis Connectivity: $(if ($redisConnectivityPassed) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($redisConnectivityPassed) { $Green } else { $Red })

# Service integration
if ($userServiceRunning) {
    $totalTests++
    if ($userServiceHealthy) { $passedTests++ }
    Write-Host "User Service Integration: $(if ($userServiceHealthy) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($userServiceHealthy) { $Green } else { $Red })
}

if ($securityServiceRunning) {
    $totalTests++
    if ($securityServiceHealthy) { $passedTests++ }
    Write-Host "Security Service Integration: $(if ($securityServiceHealthy) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($securityServiceHealthy) { $Green } else { $Red })
}

# Functionality tests
$totalTests += 2
if ($registrationTest) { $passedTests++ }
if ($loginTest) { $passedTests++ }
Write-Host "Registration Endpoint: $(if ($registrationTest) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($registrationTest) { $Green } else { $Red })
Write-Host "Login Endpoint: $(if ($loginTest) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($loginTest) { $Green } else { $Red })

Write-Host "`n==================================================" -ForegroundColor $Blue
Write-Host "Overall Result: $passedTests/$totalTests tests passed" -ForegroundColor $(if ($passedTests -eq $totalTests) { $Green } elseif ($passedTests -gt ($totalTests * 0.8)) { $Yellow } else { $Red })

if ($passedTests -eq $totalTests) {
    Write-Host "🎉 All tests passed! Auth Service is ready for staging." -ForegroundColor $Green
    exit 0
}
elseif ($passedTests -gt ($totalTests * 0.8)) {
    Write-Host "⚠️  Most tests passed. Auth Service is functional but some issues need attention." -ForegroundColor $Yellow
    exit 0
}
else {
    Write-Host "❌ Multiple tests failed. Auth Service deployment needs investigation." -ForegroundColor $Red
    exit 1
}