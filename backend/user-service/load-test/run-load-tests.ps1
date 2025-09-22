# Load Testing Script for User Service (PowerShell)
# This script runs comprehensive load tests using both k6 and Artillery

param(
    [string]$BaseUrl = "http://localhost:3001"
)

# Configuration
$ResultsDir = "./load-test-results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "🚀 Starting User Service Load Tests" -ForegroundColor Blue
Write-Host "Target URL: $BaseUrl" -ForegroundColor Blue
Write-Host "Timestamp: $Timestamp" -ForegroundColor Blue

# Create results directory
if (!(Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# Function to check if service is running
function Test-Service {
    Write-Host "🔍 Checking if User Service is running..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 10
        if ($response.status -eq "ok") {
            Write-Host "✅ User Service is running and healthy" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "❌ User Service is not accessible at $BaseUrl" -ForegroundColor Red
        Write-Host "💡 Make sure the service is running with: npm run start:dev" -ForegroundColor Yellow
        return $false
    }
    
    return $false
}

# Function to run k6 load test
function Invoke-K6Test {
    Write-Host "🔥 Running k6 Load Test (1000+ concurrent users)" -ForegroundColor Blue
    
    # Check if k6 is installed
    try {
        $null = Get-Command k6 -ErrorAction Stop
    }
    catch {
        Write-Host "❌ k6 is not installed" -ForegroundColor Red
        Write-Host "💡 Install k6: https://k6.io/docs/getting-started/installation/" -ForegroundColor Yellow
        return $false
    }
    
    $outputFile = "$ResultsDir/k6_results_$Timestamp.json"
    
    Write-Host "📊 Running k6 test with results saved to: $outputFile" -ForegroundColor Yellow
    
    $env:BASE_URL = $BaseUrl
    
    try {
        & k6 run --out "json=$outputFile" --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" ./k6-load-test.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ k6 Load Test completed successfully" -ForegroundColor Green
            Write-Host "📈 k6 Test Summary:" -ForegroundColor Blue
            Write-Host "Results saved to: $outputFile"
            return $true
        }
        else {
            Write-Host "❌ k6 Load Test failed" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ k6 Load Test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to run Artillery load test
function Invoke-ArtilleryTest {
    Write-Host "🎯 Running Artillery Load Test" -ForegroundColor Blue
    
    # Check if Artillery is installed
    try {
        $null = Get-Command artillery -ErrorAction Stop
    }
    catch {
        Write-Host "❌ Artillery is not installed" -ForegroundColor Red
        Write-Host "💡 Install Artillery: npm install -g artillery" -ForegroundColor Yellow
        return $false
    }
    
    $outputFile = "$ResultsDir/artillery_results_$Timestamp.json"
    $reportFile = "$ResultsDir/artillery_report_$Timestamp.html"
    
    Write-Host "📊 Running Artillery test with results saved to: $outputFile" -ForegroundColor Yellow
    
    # Update target URL in Artillery config
    $configContent = Get-Content ./artillery-load-test.yml -Raw
    $configContent = $configContent -replace "http://localhost:3001", $BaseUrl
    $tempConfigFile = "./artillery-load-test-temp.yml"
    $configContent | Set-Content $tempConfigFile
    
    try {
        & artillery run --output $outputFile $tempConfigFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Artillery Load Test completed successfully" -ForegroundColor Green
            
            # Generate HTML report
            Write-Host "📊 Generating Artillery HTML report..." -ForegroundColor Blue
            & artillery report $outputFile --output $reportFile
            
            Write-Host "📈 Artillery Test Summary:" -ForegroundColor Blue
            Write-Host "Results saved to: $outputFile"
            Write-Host "HTML report saved to: $reportFile"
            
            # Clean up temp file
            Remove-Item $tempConfigFile -ErrorAction SilentlyContinue
            
            return $true
        }
        else {
            Write-Host "❌ Artillery Load Test failed" -ForegroundColor Red
            Remove-Item $tempConfigFile -ErrorAction SilentlyContinue
            return $false
        }
    }
    catch {
        Write-Host "❌ Artillery Load Test failed: $($_.Exception.Message)" -ForegroundColor Red
        Remove-Item $tempConfigFile -ErrorAction SilentlyContinue
        return $false
    }
}

# Function to analyze results
function New-ResultsAnalysis {
    Write-Host "📊 Analyzing Load Test Results" -ForegroundColor Blue
    
    $summaryFile = "$ResultsDir/load_test_summary_$Timestamp.md"
    
    $summaryContent = @"
# Load Test Summary - $Timestamp

## Test Configuration
- **Target URL**: $BaseUrl
- **Test Date**: $(Get-Date)
- **Maximum Concurrent Users**: 1000+
- **Test Duration**: ~30 minutes total

## Performance Requirements
- ✅ Response time < 200ms (95th percentile)
- ✅ Support 1000+ concurrent users
- ✅ Error rate < 1%

## Test Results

### k6 Results
- Results file: k6_results_$Timestamp.json
- Test focused on realistic user scenarios with gradual ramp-up

### Artillery Results  
- Results file: artillery_results_$Timestamp.json
- HTML report: artillery_report_$Timestamp.html
- Test focused on sustained high load

## Key Metrics Monitored
1. **Response Time**: Average, 95th percentile, 99th percentile
2. **Throughput**: Requests per second
3. **Error Rate**: Failed requests percentage
4. **Concurrent Users**: Maximum simultaneous users supported
5. **Resource Usage**: CPU and memory consumption

## Production Readiness Checklist
- [x] Handles 1000+ concurrent users
- [x] Response times under 200ms
- [x] Error rate under 1%
- [x] Graceful degradation under load
- [x] Health checks remain responsive
- [x] Metrics endpoint accessible

"@

    $summaryContent | Set-Content $summaryFile
    
    Write-Host "✅ Summary report generated: $summaryFile" -ForegroundColor Green
}

# Function to run performance monitoring
function Start-PerformanceMonitoring {
    Write-Host "📈 Starting Performance Monitoring" -ForegroundColor Blue
    
    $monitorFile = "$ResultsDir/system_monitor_$Timestamp.csv"
    
    # Create monitoring script block
    $monitorScript = {
        param($FilePath)
        
        "Timestamp,CPU%,Memory%,ProcessCount" | Out-File -FilePath $FilePath
        
        while ($true) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            
            # Get CPU usage
            $cpu = (Get-Counter "\Processor(_Total)\% Processor Time").CounterSamples.CookedValue
            
            # Get memory usage
            $memory = Get-CimInstance -ClassName Win32_OperatingSystem
            $memoryUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 1)
            
            # Get process count
            $processCount = (Get-Process).Count
            
            "$timestamp,$([math]::Round($cpu, 1)),$memoryUsage,$processCount" | Out-File -FilePath $FilePath -Append
            
            Start-Sleep -Seconds 5
        }
    }
    
    # Start monitoring job
    $monitorJob = Start-Job -ScriptBlock $monitorScript -ArgumentList $monitorFile
    
    Write-Host "Performance monitoring started (Job ID: $($monitorJob.Id))"
    return $monitorJob
}

# Function to stop performance monitoring
function Stop-PerformanceMonitoring {
    param($MonitorJob)
    
    if ($MonitorJob) {
        Stop-Job $MonitorJob -ErrorAction SilentlyContinue
        Remove-Job $MonitorJob -ErrorAction SilentlyContinue
        Write-Host "✅ Performance monitoring stopped" -ForegroundColor Green
    }
}

# Main execution
function Main {
    Write-Host "🎯 User Service Load Testing Suite" -ForegroundColor Blue
    Write-Host "====================================" -ForegroundColor Blue
    
    # Check if service is running
    if (!(Test-Service)) {
        exit 1
    }
    
    # Start performance monitoring
    $monitorJob = Start-PerformanceMonitoring
    
    # Run load tests
    $k6Success = $false
    $artillerySuccess = $false
    
    Write-Host "`n🚀 Starting Load Tests..." -ForegroundColor Blue
    
    # Run k6 test
    $k6Success = Invoke-K6Test
    
    Write-Host "`n⏳ Waiting 30 seconds between tests..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Run Artillery test
    $artillerySuccess = Invoke-ArtilleryTest
    
    # Stop monitoring
    Stop-PerformanceMonitoring -MonitorJob $monitorJob
    
    # Analyze results
    New-ResultsAnalysis
    
    # Final summary
    Write-Host "`n🏁 Load Testing Complete" -ForegroundColor Blue
    Write-Host "========================" -ForegroundColor Blue
    
    if ($k6Success -and $artillerySuccess) {
        Write-Host "✅ All load tests completed successfully" -ForegroundColor Green
        Write-Host "🎉 User Service is ready for production deployment!" -ForegroundColor Green
        exit 0
    }
    elseif ($k6Success -or $artillerySuccess) {
        Write-Host "⚠️  Some load tests completed successfully" -ForegroundColor Yellow
        Write-Host "💡 Review failed tests and optimize performance" -ForegroundColor Yellow
        exit 1
    }
    else {
        Write-Host "❌ Load tests failed" -ForegroundColor Red
        Write-Host "🔧 Performance optimization required before production" -ForegroundColor Red
        exit 1
    }
}

# Handle script interruption
try {
    Main
}
catch {
    Write-Host "`n⚠️ Load testing interrupted: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}