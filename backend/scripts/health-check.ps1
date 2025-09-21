# Health Check Script for Microservices Infrastructure
# Tests connectivity to all infrastructure services

Write-Host "=== Infrastructure Health Check ===" -ForegroundColor Green
Write-Host ""

$services = @(
    @{Name="Redis"; Host="localhost"; Port=6379; Type="Redis"},
    @{Name="User DB"; Host="localhost"; Port=5432; Type="PostgreSQL"},
    @{Name="Catalog DB"; Host="localhost"; Port=5433; Type="PostgreSQL"},
    @{Name="Library DB"; Host="localhost"; Port=5434; Type="PostgreSQL"},
    @{Name="Review DB"; Host="localhost"; Port=5435; Type="PostgreSQL"},
    @{Name="Payment DB"; Host="localhost"; Port=5436; Type="PostgreSQL"},
    @{Name="Notification DB"; Host="localhost"; Port=5437; Type="PostgreSQL"},
    @{Name="Social DB"; Host="localhost"; Port=5438; Type="PostgreSQL"},
    @{Name="Achievement DB"; Host="localhost"; Port=5439; Type="PostgreSQL"},
    @{Name="Security DB"; Host="localhost"; Port=5440; Type="PostgreSQL"},
    @{Name="Download DB"; Host="localhost"; Port=5441; Type="PostgreSQL"},
    @{Name="Prometheus"; Host="localhost"; Port=9090; Type="HTTP"},
    @{Name="Grafana"; Host="localhost"; Port=3100; Type="HTTP"}
)

$allHealthy = $true

foreach ($service in $services) {
    Write-Host "Testing $($service.Name)..." -NoNewline
    
    try {
        if ($service.Type -eq "HTTP") {
            $response = Invoke-WebRequest -Uri "http://$($service.Host):$($service.Port)" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host " ✓ HEALTHY" -ForegroundColor Green
            } else {
                Write-Host " ✗ UNHEALTHY (Status: $($response.StatusCode))" -ForegroundColor Red
                $allHealthy = $false
            }
        } else {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.ConnectAsync($service.Host, $service.Port).Wait(5000)
            if ($tcpClient.Connected) {
                Write-Host " ✓ HEALTHY" -ForegroundColor Green
                $tcpClient.Close()
            } else {
                Write-Host " ✗ UNHEALTHY (Connection failed)" -ForegroundColor Red
                $allHealthy = $false
            }
        }
    } catch {
        Write-Host " ✗ UNHEALTHY ($($_.Exception.Message))" -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host ""
if ($allHealthy) {
    Write-Host "=== ALL SERVICES HEALTHY ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== SOME SERVICES UNHEALTHY ===" -ForegroundColor Red
    exit 1
}