# Health check script for API Gateway (PowerShell)
# This script performs comprehensive health checks for production deployment

param(
    [string]$Endpoint = "http://localhost:3000",
    [int]$Timeout = 30,
    [switch]$Detailed = $false,
    [switch]$Readiness = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🏥 API Gateway Health Check" -ForegroundColor Green
Write-Host "Endpoint: $Endpoint" -ForegroundColor Cyan
Write-Host "Timeout: ${Timeout}s" -ForegroundColor Cyan

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSeconds = 10
    )
    
    try {
        Write-Host "Checking $Name..." -ForegroundColor Yellow
        
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds
        
        if ($response) {
            Write-Host "✅ $Name: OK" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ $Name: No response" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ $Name: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-DetailedHealth {
    param([string]$BaseUrl)
    
    Write-Host "`n📊 Detailed Health Checks:" -ForegroundColor Cyan
    
    $checks = @(
        @{ Url = "$BaseUrl/api/health"; Name = "Gateway Health" },
        @{ Url = "$BaseUrl/api/health/services"; Name = "Services Health" },
        @{ Url = "$BaseUrl/api/metrics"; Name = "Metrics Endpoint" }
    )
    
    $results = @()
    foreach ($check in $checks) {
        $result = Test-Endpoint -Url $check.Url -Name $check.Name -TimeoutSeconds $Timeout
        $results += $result
    }
    
    return $results
}

function Test-ReadinessChecks {
    param([string]$BaseUrl)
    
    Write-Host "`n🔍 Production Readiness Checks:" -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/health/readiness" -Method Get -TimeoutSec $Timeout
        
        Write-Host "Readiness Check Results:" -ForegroundColor Yellow
        foreach ($check in $response) {
            $statusColor = switch ($check.status) {
                "healthy" { "Green" }
                "degraded" { "Yellow" }
                "unhealthy" { "Red" }
                default { "Gray" }
            }
            
            $statusIcon = switch ($check.status) {
                "healthy" { "✅" }
                "degraded" { "⚠️" }
                "unhealthy" { "❌" }
                default { "❓" }
            }
            
            Write-Host "$statusIcon $($check.name): $($check.message)" -ForegroundColor $statusColor
            
            if ($check.details -and $Detailed) {
                Write-Host "   Details: $($check.details | ConvertTo-Json -Compress)" -ForegroundColor Gray
            }
        }
        
        $unhealthyChecks = $response | Where-Object { $_.status -eq "unhealthy" }
        return $unhealthyChecks.Count -eq 0
        
    } catch {
        Write-Host "❌ Readiness checks failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main health check execution
$startTime = Get-Date

try {
    # Basic health check
    $basicHealth = Test-Endpoint -Url "$Endpoint/api/health" -Name "Basic Health" -TimeoutSeconds $Timeout
    
    if (-not $basicHealth) {
        Write-Host "`n❌ Basic health check failed" -ForegroundColor Red
        exit 1
    }
    
    # Detailed checks if requested
    if ($Detailed) {
        $detailedResults = Test-DetailedHealth -BaseUrl $Endpoint
        $failedChecks = $detailedResults | Where-Object { $_ -eq $false }
        
        if ($failedChecks.Count -gt 0) {
            Write-Host "`n⚠️ Some detailed checks failed" -ForegroundColor Yellow
        }
    }
    
    # Readiness checks if requested
    if ($Readiness) {
        $readinessResult = Test-ReadinessChecks -BaseUrl $Endpoint
        
        if (-not $readinessResult) {
            Write-Host "`n❌ Production readiness checks failed" -ForegroundColor Red
            exit 1
        }
    }
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "`n✅ All health checks passed!" -ForegroundColor Green
    Write-Host "Duration: ${duration}s" -ForegroundColor Cyan
    
    exit 0
    
} catch {
    Write-Host "`n❌ Health check failed with error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}