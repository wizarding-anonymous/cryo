# Simple Health Check Script
Write-Host "=== Infrastructure Health Check ===" -ForegroundColor Green

# Test Redis
Write-Host "Testing Redis..." -NoNewline
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.ConnectAsync("localhost", 6379).Wait(3000)
    if ($tcpClient.Connected) {
        Write-Host " ✓ HEALTHY" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
}

# Test PostgreSQL databases
$dbPorts = @(5432, 5433, 5434, 5435, 5436, 5437, 5438, 5439, 5440, 5441)
$dbNames = @("User", "Catalog", "Library", "Review", "Payment", "Notification", "Social", "Achievement", "Security", "Download")

for ($i = 0; $i -lt $dbPorts.Length; $i++) {
    Write-Host "Testing $($dbNames[$i]) DB..." -NoNewline
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ConnectAsync("localhost", $dbPorts[$i]).Wait(3000)
        if ($tcpClient.Connected) {
            Write-Host " ✓ HEALTHY" -ForegroundColor Green
            $tcpClient.Close()
        } else {
            Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
        }
    } catch {
        Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
    }
}

# Test Prometheus
Write-Host "Testing Prometheus..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9090" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host " ✓ HEALTHY" -ForegroundColor Green
} catch {
    Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
}

# Test Grafana
Write-Host "Testing Grafana..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3100" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host " ✓ HEALTHY" -ForegroundColor Green
} catch {
    Write-Host " ✗ UNHEALTHY" -ForegroundColor Red
}

Write-Host ""
Write-Host "Health check completed!" -ForegroundColor Green