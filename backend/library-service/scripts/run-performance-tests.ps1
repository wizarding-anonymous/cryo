# Performance Testing Script for Library Service
# This script runs comprehensive performance tests including load tests, database stress tests, and benchmarks

param(
    [string]$TestType = "all",
    [string]$BaseUrl = "http://localhost:3000/api",
    [string]$JwtToken = "",
    [string]$RequireAuth = "false",
    [string]$TestDuration = "5m",
    [int]$MaxVUs = 1000
)

# Configuration
$ResultsDir = "./performance-results"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "=== Library Service Performance Testing Suite ===" -ForegroundColor Blue
Write-Host "Base URL: $BaseUrl" -ForegroundColor Blue
Write-Host "Test Duration: $TestDuration" -ForegroundColor Blue
Write-Host "Max Virtual Users: $MaxVUs" -ForegroundColor Blue
Write-Host ""

# Create results directory
if (!(Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# Function to check if k6 is installed
function Test-K6Installation {
    try {
        $null = Get-Command k6 -ErrorAction Stop
        Write-Host "✓ k6 is installed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Error: k6 is not installed. Please install k6 first." -ForegroundColor Red
        Write-Host "Visit: https://k6.io/docs/getting-started/installation/"
        return $false
    }
}

# Function to check if service is running
function Test-ServiceHealth {
    Write-Host "Checking if Library Service is running..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Library Service is running" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "Error: Library Service is not responding at $BaseUrl" -ForegroundColor Red
        Write-Host "Please start the service first."
        return $false
    }
    return $false
}

# Function to run basic load test
function Invoke-BasicLoadTest {
    Write-Host "Running Basic Load Test..." -ForegroundColor Yellow
    
    $env:BASE_URL = $BaseUrl
    $env:JWT_TOKEN = $JwtToken
    $env:REQUIRE_AUTH = $RequireAuth
    
    k6 run `
        --out "json=$ResultsDir/basic_load_test_$Timestamp.json" `
        --summary-export="$ResultsDir/basic_load_test_summary_$Timestamp.json" `
        ./load-tests/k6-script.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Basic Load Test completed" -ForegroundColor Green
    } else {
        Write-Host "✗ Basic Load Test failed" -ForegroundColor Red
    }
}

# Function to run comprehensive performance test suite
function Invoke-PerformanceSuite {
    Write-Host "Running Comprehensive Performance Test Suite..." -ForegroundColor Yellow
    
    $scenarios = @("large_library_load", "search_performance", "ownership_checks", "mixed_workload")
    
    foreach ($scenario in $scenarios) {
        Write-Host "Running scenario: $scenario" -ForegroundColor Blue
        
        $env:BASE_URL = $BaseUrl
        $env:JWT_TOKEN = $JwtToken
        $env:REQUIRE_AUTH = $RequireAuth
        $env:K6_SCENARIO_NAME = $scenario
        
        k6 run `
            --out "json=$ResultsDir/performance_suite_${scenario}_$Timestamp.json" `
            --summary-export="$ResultsDir/performance_suite_${scenario}_summary_$Timestamp.json" `
            ./load-tests/performance-test-suite.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Scenario $scenario completed" -ForegroundColor Green
        } else {
            Write-Host "✗ Scenario $scenario failed" -ForegroundColor Red
        }
        
        Start-Sleep -Seconds 10  # Cool down between tests
    }
}

# Function to run database stress tests
function Invoke-DatabaseStressTests {
    Write-Host "Running Database Stress Tests..." -ForegroundColor Yellow
    
    $dbScenarios = @("connection_pool_stress", "complex_queries", "concurrent_writes", "large_dataset_pagination")
    
    foreach ($scenario in $dbScenarios) {
        Write-Host "Running DB scenario: $scenario" -ForegroundColor Blue
        
        $env:BASE_URL = $BaseUrl
        $env:JWT_TOKEN = $JwtToken
        $env:K6_SCENARIO_NAME = $scenario
        
        k6 run `
            --out "json=$ResultsDir/db_stress_${scenario}_$Timestamp.json" `
            --summary-export="$ResultsDir/db_stress_${scenario}_summary_$Timestamp.json" `
            ./load-tests/database-stress-test.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ DB Scenario $scenario completed" -ForegroundColor Green
        } else {
            Write-Host "✗ DB Scenario $scenario failed" -ForegroundColor Red
        }
        
        Start-Sleep -Seconds 15  # Longer cool down for database tests
    }
}

# Function to run Jest performance tests
function Invoke-JestPerformanceTests {
    Write-Host "Running Jest Performance Tests..." -ForegroundColor Yellow
    
    # Set test environment variables
    $env:NODE_ENV = "test"
    $env:DATABASE_HOST = "localhost"
    $env:DATABASE_PORT = "5432"
    $env:DATABASE_NAME = "library_service_test"
    $env:REDIS_HOST = "localhost"
    $env:REDIS_PORT = "6379"
    
    # Run performance e2e tests
    npm run test:e2e -- --testNamePattern="Performance E2E" --verbose --detectOpenHandles
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Jest Performance Tests completed" -ForegroundColor Green
    } else {
        Write-Host "✗ Jest Performance Tests failed" -ForegroundColor Red
    }
}

# Function to generate performance report
function New-PerformanceReport {
    Write-Host "Generating Performance Report..." -ForegroundColor Yellow
    
    $ReportFile = "$ResultsDir/performance_report_$Timestamp.md"
    
    $reportContent = @"
# Library Service Performance Test Report

**Test Date:** $(Get-Date)
**Base URL:** $BaseUrl
**Test Duration:** $TestDuration
**Max Virtual Users:** $MaxVUs

## Test Results Summary

### Basic Load Test
- Results: ``basic_load_test_$Timestamp.json``
- Summary: ``basic_load_test_summary_$Timestamp.json``

### Performance Test Suite
- **large_library_load**: ``performance_suite_large_library_load_$Timestamp.json``
- **search_performance**: ``performance_suite_search_performance_$Timestamp.json``
- **ownership_checks**: ``performance_suite_ownership_checks_$Timestamp.json``
- **mixed_workload**: ``performance_suite_mixed_workload_$Timestamp.json``

### Database Stress Tests
- **connection_pool_stress**: ``db_stress_connection_pool_stress_$Timestamp.json``
- **complex_queries**: ``db_stress_complex_queries_$Timestamp.json``
- **concurrent_writes**: ``db_stress_concurrent_writes_$Timestamp.json``
- **large_dataset_pagination**: ``db_stress_large_dataset_pagination_$Timestamp.json``

## Performance Requirements Verification

### Response Time Requirements (from spec)
- Library load: < 200ms (95th percentile)
- Search operations: < 500ms (90th percentile)
- Ownership checks: < 100ms (95th percentile)

### Throughput Requirements
- Support 1000+ concurrent users
- Error rate < 1%

## Recommendations

Based on the test results, review the following:

1. **Database Optimization**
   - Check slow query logs
   - Verify index usage
   - Monitor connection pool utilization

2. **Caching Strategy**
   - Review cache hit rates
   - Optimize TTL values
   - Consider cache warming strategies

3. **Application Performance**
   - Profile memory usage
   - Check for memory leaks
   - Optimize critical code paths

## Files Generated

All test result files are stored in: ``$ResultsDir/``

"@

    $reportContent | Out-File -FilePath $ReportFile -Encoding UTF8
    Write-Host "✓ Performance Report generated: $ReportFile" -ForegroundColor Green
}

# Function to cleanup old results
function Remove-OldResults {
    Write-Host "Cleaning up old test results (keeping last 10)..." -ForegroundColor Yellow
    
    # Keep only the 10 most recent result files
    $jsonFiles = Get-ChildItem -Path $ResultsDir -Filter "*.json" | Sort-Object LastWriteTime -Descending
    if ($jsonFiles.Count -gt 20) {
        $jsonFiles | Select-Object -Skip 20 | Remove-Item -Force
    }
    
    $mdFiles = Get-ChildItem -Path $ResultsDir -Filter "*.md" | Sort-Object LastWriteTime -Descending
    if ($mdFiles.Count -gt 10) {
        $mdFiles | Select-Object -Skip 10 | Remove-Item -Force
    }
    
    Write-Host "✓ Cleanup completed" -ForegroundColor Green
}

# Main execution
function Main {
    Write-Host "Starting Performance Test Suite..." -ForegroundColor Blue
    
    # Pre-flight checks
    if (!(Test-K6Installation)) {
        exit 1
    }
    
    if (!(Test-ServiceHealth)) {
        exit 1
    }
    
    # Cleanup old results
    Remove-OldResults
    
    # Run tests based on arguments
    switch ($TestType.ToLower()) {
        "basic" {
            Invoke-BasicLoadTest
        }
        "suite" {
            Invoke-PerformanceSuite
        }
        "database" {
            Invoke-DatabaseStressTests
        }
        "jest" {
            Invoke-JestPerformanceTests
        }
        "all" {
            Invoke-BasicLoadTest
            Invoke-PerformanceSuite
            Invoke-DatabaseStressTests
            Invoke-JestPerformanceTests
        }
        default {
            Write-Host "Usage: .\run-performance-tests.ps1 -TestType [basic|suite|database|jest|all]" -ForegroundColor Red
            exit 1
        }
    }
    
    # Generate report
    New-PerformanceReport
    
    Write-Host "=== Performance Testing Completed ===" -ForegroundColor Green
    Write-Host "Results saved in: $ResultsDir" -ForegroundColor Green
}

# Run main function
Main