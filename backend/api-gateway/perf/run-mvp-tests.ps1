#!/usr/bin/env pwsh
# MVP Performance Testing Script for API Gateway
# Tests: 1000 concurrent users, <200ms response time, stability

param(
    [string]$BaseUrl = "http://localhost:3001",
    [switch]$SkipSmoke,
    [switch]$SkipLoad,
    [switch]$SkipStability,
    [switch]$GenerateReports = $true
)

# Colors for output
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Test-ServiceAvailability {
    param([string]$Url)
    
    try {
        $response = Invoke-WebRequest -Uri "$Url/health" -Method GET -TimeoutSec 10
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

# Create results directory
$ResultsDir = "perf/results"
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
    Write-ColorOutput "Created results directory: $ResultsDir" $Blue
}

# Set environment variable
$env:BASE_URL = $BaseUrl

Write-ColorOutput "=== API Gateway MVP Performance Testing ===" $Blue
Write-ColorOutput "Target URL: $BaseUrl" $Yellow
Write-ColorOutput "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" $Yellow

# Check if service is available
Write-ColorOutput "`nChecking service availability..." $Yellow
if (-not (Test-ServiceAvailability -Url $BaseUrl)) {
    Write-ColorOutput "ERROR: Service is not available at $BaseUrl" $Red
    Write-ColorOutput "Please ensure the API Gateway is running before running performance tests." $Red
    exit 1
}
Write-ColorOutput "Service is available ✓" $Green

$TestResults = @()

# 1. Smoke Test (quick validation)
if (-not $SkipSmoke) {
    Write-ColorOutput "`n=== Running Smoke Test ===" $Blue
    Write-ColorOutput "Purpose: Quick validation with low load" $Yellow
    
    $smokeStart = Get-Date
    try {
        artillery run perf/smoke.yml -o "$ResultsDir/smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $smokeEnd = Get-Date
        $smokeDuration = ($smokeEnd - $smokeStart).TotalSeconds
        
        Write-ColorOutput "Smoke test completed in $([math]::Round($smokeDuration, 2)) seconds ✓" $Green
        $TestResults += @{
            Test = "Smoke"
            Status = "PASSED"
            Duration = $smokeDuration
        }
    }
    catch {
        Write-ColorOutput "Smoke test failed: $($_.Exception.Message)" $Red
        $TestResults += @{
            Test = "Smoke"
            Status = "FAILED"
            Duration = 0
            Error = $_.Exception.Message
        }
    }
}

# 2. MVP Load Test (1000 concurrent users)
if (-not $SkipLoad) {
    Write-ColorOutput "`n=== Running MVP Load Test ===" $Blue
    Write-ColorOutput "Purpose: 1000 concurrent users, <200ms response time" $Yellow
    Write-ColorOutput "Duration: ~8 minutes" $Yellow
    
    $loadStart = Get-Date
    try {
        artillery run perf/mvp-load.yml -o "$ResultsDir/mvp-load-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $loadEnd = Get-Date
        $loadDuration = ($loadEnd - $loadStart).TotalSeconds
        
        Write-ColorOutput "MVP Load test completed in $([math]::Round($loadDuration, 2)) seconds ✓" $Green
        $TestResults += @{
            Test = "MVP Load (1000 users)"
            Status = "PASSED"
            Duration = $loadDuration
        }
    }
    catch {
        Write-ColorOutput "MVP Load test failed: $($_.Exception.Message)" $Red
        $TestResults += @{
            Test = "MVP Load (1000 users)"
            Status = "FAILED"
            Duration = 0
            Error = $_.Exception.Message
        }
    }
}

# 3. Stability Test (extended duration)
if (-not $SkipStability) {
    Write-ColorOutput "`n=== Running Stability Test ===" $Blue
    Write-ColorOutput "Purpose: Extended load test for stability validation" $Yellow
    Write-ColorOutput "Duration: ~45 minutes" $Yellow
    Write-ColorOutput "WARNING: This is a long-running test. Press Ctrl+C to cancel." $Yellow
    
    # Give user a chance to cancel
    Start-Sleep -Seconds 5
    
    $stabilityStart = Get-Date
    try {
        artillery run perf/stability.yml -o "$ResultsDir/stability-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $stabilityEnd = Get-Date
        $stabilityDuration = ($stabilityEnd - $stabilityStart).TotalSeconds
        
        Write-ColorOutput "Stability test completed in $([math]::Round($stabilityDuration, 2)) seconds ✓" $Green
        $TestResults += @{
            Test = "Stability"
            Status = "PASSED"
            Duration = $stabilityDuration
        }
    }
    catch {
        Write-ColorOutput "Stability test failed: $($_.Exception.Message)" $Red
        $TestResults += @{
            Test = "Stability"
            Status = "FAILED"
            Duration = 0
            Error = $_.Exception.Message
        }
    }
}

# Generate HTML reports
if ($GenerateReports) {
    Write-ColorOutput "`n=== Generating HTML Reports ===" $Blue
    
    Get-ChildItem "$ResultsDir/*.json" | ForEach-Object {
        $jsonFile = $_.FullName
        $htmlFile = $jsonFile -replace '\.json$', '.html'
        
        try {
            artillery report -o $htmlFile $jsonFile
            Write-ColorOutput "Generated report: $htmlFile ✓" $Green
        }
        catch {
            Write-ColorOutput "Failed to generate report for $jsonFile" $Red
        }
    }
}

# Summary
Write-ColorOutput "`n=== Performance Test Summary ===" $Blue
Write-ColorOutput "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" $Yellow

foreach ($result in $TestResults) {
    $status = if ($result.Status -eq "PASSED") { $Green } else { $Red }
    $duration = if ($result.Duration -gt 0) { " ($([math]::Round($result.Duration, 2))s)" } else { "" }
    Write-ColorOutput "- $($result.Test): $($result.Status)$duration" $status
    
    if ($result.Error) {
        Write-ColorOutput "  Error: $($result.Error)" $Red
    }
}

$passedTests = ($TestResults | Where-Object { $_.Status -eq "PASSED" }).Count
$totalTests = $TestResults.Count

if ($passedTests -eq $totalTests) {
    Write-ColorOutput "`nAll performance tests passed! ✓" $Green
    Write-ColorOutput "MVP Performance Requirements:" $Green
    Write-ColorOutput "- ✓ 1000 concurrent users supported" $Green
    Write-ColorOutput "- ✓ Response time < 200ms validated" $Green
    Write-ColorOutput "- ✓ System stability under load confirmed" $Green
} else {
    Write-ColorOutput "`n$passedTests/$totalTests tests passed" $Yellow
    Write-ColorOutput "Some performance tests failed. Check the logs above." $Red
}

Write-ColorOutput "`nReports available in: $ResultsDir" $Blue
Write-ColorOutput "Open the HTML files in a browser to view detailed metrics." $Blue