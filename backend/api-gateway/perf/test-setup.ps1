#!/usr/bin/env pwsh
# Quick test to verify performance testing setup

$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

Write-ColorOutput "=== Testing Performance Setup ===" $Blue

# Create results directory if it doesn't exist
if (-not (Test-Path "perf/results")) {
    New-Item -ItemType Directory -Path "perf/results" -Force | Out-Null
}

Write-ColorOutput "`nRunning basic connectivity test..." $Yellow
Write-ColorOutput "This test uses httpbin.org to verify Artillery is working correctly." $Yellow

try {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    artillery run perf/test-basic.yml -o "perf/results/setup-test-$timestamp.json"
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Basic performance test completed successfully!" $Green
        
        # Generate HTML report
        artillery report -o "perf/results/setup-test-$timestamp.html" "perf/results/setup-test-$timestamp.json"
        Write-ColorOutput "✓ HTML report generated: perf/results/setup-test-$timestamp.html" $Green
        
        Write-ColorOutput "`n🎉 Performance testing setup is working correctly!" $Green
        Write-ColorOutput "`nYou can now run MVP performance tests:" $Blue
        Write-ColorOutput "1. Start API Gateway: npm run start:dev" $Yellow
        Write-ColorOutput "2. Run quick MVP test: npm run perf:mvp-quick" $Yellow
        Write-ColorOutput "3. Run full MVP test suite: npm run perf:mvp-all" $Yellow
    } else {
        Write-ColorOutput "✗ Basic performance test failed" $Red
        exit 1
    }
} catch {
    Write-ColorOutput "✗ Error running performance test: $($_.Exception.Message)" $Red
    exit 1
}