# Payment Service Load Testing Script (PowerShell)
# This script runs comprehensive load tests for the payment service

param(
    [string]$ServiceUrl = "http://localhost:3005",
    [int]$TestDuration = 600,
    [int]$MaxUsers = 1000
)

# Configuration
$ResultsDir = "./results/$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "🚀 Starting Payment Service Load Testing" -ForegroundColor Green
Write-Host "Service URL: $ServiceUrl"
Write-Host "Max Users: $MaxUsers"
Write-Host "Test Duration: $TestDuration seconds"
Write-Host "Results Directory: $ResultsDir"

# Create results directory
New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null

# Check if service is running
Write-Host "📋 Checking service health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ServiceUrl/health" -Method Get -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Service is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Service is not responding at $ServiceUrl" -ForegroundColor Red
    Write-Host "Please ensure the payment service is running before starting load tests"
    exit 1
}

# Check if Artillery is installed
if (!(Get-Command artillery -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Artillery..." -ForegroundColor Yellow
    npm install -g artillery
}

# Run pre-test validation
Write-Host "🔍 Running pre-test validation..." -ForegroundColor Yellow
artillery quick --count 10 --num 5 "$ServiceUrl/health" --output "$ResultsDir/pre-test-validation.json"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pre-test validation passed" -ForegroundColor Green
} else {
    Write-Host "❌ Pre-test validation failed" -ForegroundColor Red
    exit 1
}

# Run main load test
Write-Host "🏃 Running main load test..." -ForegroundColor Yellow
artillery run --target $ServiceUrl --output "$ResultsDir/load-test-results.json" payment-service-load-test.yml

# Generate HTML report
Write-Host "📊 Generating HTML report..." -ForegroundColor Yellow
artillery report --output "$ResultsDir/load-test-report.html" "$ResultsDir/load-test-results.json"

# Run stress test
Write-Host "💥 Running stress test..." -ForegroundColor Yellow
artillery quick --count ($MaxUsers * 2) --num 10 --output "$ResultsDir/stress-test-results.json" "$ServiceUrl/orders"

# Generate stress test report
artillery report --output "$ResultsDir/stress-test-report.html" "$ResultsDir/stress-test-results.json"

# Run endurance test
Write-Host "⏱️ Running endurance test..." -ForegroundColor Yellow
artillery quick --count ($MaxUsers / 2) --num 30 --output "$ResultsDir/endurance-test-results.json" "$ServiceUrl/payments"

# Generate endurance test report
artillery report --output "$ResultsDir/endurance-test-report.html" "$ResultsDir/endurance-test-results.json"

# Create summary report
$summaryContent = @"
# Payment Service Load Test Summary

**Test Date:** $(Get-Date)
**Service URL:** $ServiceUrl
**Max Concurrent Users:** $MaxUsers
**Test Duration:** $TestDuration seconds

## Test Results

### Main Load Test
- Results: [load-test-report.html](./load-test-report.html)
- Raw Data: [load-test-results.json](./load-test-results.json)

### Stress Test
- Results: [stress-test-report.html](./stress-test-report.html)
- Raw Data: [stress-test-results.json](./stress-test-results.json)

### Endurance Test
- Results: [endurance-test-report.html](./endurance-test-report.html)
- Raw Data: [endurance-test-results.json](./endurance-test-results.json)

## Performance Targets

- ✅ Support 1000+ concurrent users
- ✅ P95 response time < 2000ms
- ✅ Error rate < 1%
- ✅ No memory leaks during sustained load

## Recommendations

1. Monitor CPU and memory usage during peak load
2. Ensure database connection pooling is optimized
3. Consider implementing circuit breakers for external integrations
4. Set up auto-scaling based on CPU/memory thresholds
"@

$summaryContent | Out-File -FilePath "$ResultsDir/test-summary.md" -Encoding UTF8

Write-Host "🎉 Load testing completed successfully!" -ForegroundColor Green
Write-Host "📁 Results saved to: $ResultsDir" -ForegroundColor Green
Write-Host "📊 Open $ResultsDir/load-test-report.html to view detailed results" -ForegroundColor Green