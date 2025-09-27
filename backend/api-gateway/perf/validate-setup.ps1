#!/usr/bin/env pwsh
# Validation script for MVP Performance Testing Setup

$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Test-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

Write-ColorOutput "=== API Gateway Performance Testing Setup Validation ===" $Blue

$ValidationResults = @()

# 1. Check if Artillery is installed
Write-ColorOutput "`nChecking Artillery installation..." $Yellow
if (Test-Command "artillery") {
    $artilleryVersion = artillery --version 2>$null
    Write-ColorOutput "✓ Artillery is installed: $artilleryVersion" $Green
    $ValidationResults += @{ Check = "Artillery Installation"; Status = "PASS" }
} else {
    Write-ColorOutput "✗ Artillery is not installed or not in PATH" $Red
    Write-ColorOutput "  Install with: npm install -g artillery" $Yellow
    $ValidationResults += @{ Check = "Artillery Installation"; Status = "FAIL" }
}

# 2. Check if Node.js is available
Write-ColorOutput "`nChecking Node.js..." $Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-ColorOutput "✓ Node.js is available: $nodeVersion" $Green
    $ValidationResults += @{ Check = "Node.js"; Status = "PASS" }
} else {
    Write-ColorOutput "✗ Node.js is not installed or not in PATH" $Red
    $ValidationResults += @{ Check = "Node.js"; Status = "FAIL" }
}

# 3. Check if npm is available
Write-ColorOutput "`nChecking npm..." $Yellow
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-ColorOutput "✓ npm is available: $npmVersion" $Green
    $ValidationResults += @{ Check = "npm"; Status = "PASS" }
} else {
    Write-ColorOutput "✗ npm is not installed or not in PATH" $Red
    $ValidationResults += @{ Check = "npm"; Status = "FAIL" }
}

# 4. Check performance test files
Write-ColorOutput "`nChecking performance test files..." $Yellow
$requiredFiles = @(
    "perf/smoke.yml",
    "perf/load.yml", 
    "perf/stress.yml",
    "perf/mvp-load.yml",
    "perf/stability.yml",
    "perf/run-mvp-tests.ps1"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-ColorOutput "✓ $file exists" $Green
    } else {
        Write-ColorOutput "✗ $file is missing" $Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    $ValidationResults += @{ Check = "Performance Test Files"; Status = "PASS" }
} else {
    $ValidationResults += @{ Check = "Performance Test Files"; Status = "FAIL" }
}

# 5. Check package.json scripts
Write-ColorOutput "`nChecking package.json scripts..." $Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $requiredScripts = @("perf:mvp", "perf:stability", "perf:mvp-all", "perf:mvp-quick")
    
    $missingScripts = @()
    foreach ($script in $requiredScripts) {
        if ($packageJson.scripts.$script) {
            Write-ColorOutput "✓ Script '$script' is defined" $Green
        } else {
            Write-ColorOutput "✗ Script '$script' is missing" $Red
            $missingScripts += $script
        }
    }
    
    if ($missingScripts.Count -eq 0) {
        $ValidationResults += @{ Check = "Package.json Scripts"; Status = "PASS" }
    } else {
        $ValidationResults += @{ Check = "Package.json Scripts"; Status = "FAIL" }
    }
} else {
    Write-ColorOutput "✗ package.json not found" $Red
    $ValidationResults += @{ Check = "Package.json Scripts"; Status = "FAIL" }
}

# 6. Create results directory if it doesn't exist
Write-ColorOutput "`nChecking results directory..." $Yellow
if (-not (Test-Path "perf/results")) {
    New-Item -ItemType Directory -Path "perf/results" -Force | Out-Null
    Write-ColorOutput "✓ Created perf/results directory" $Green
} else {
    Write-ColorOutput "✓ perf/results directory exists" $Green
}
$ValidationResults += @{ Check = "Results Directory"; Status = "PASS" }

# 7. Test basic Artillery functionality
Write-ColorOutput "`nTesting Artillery basic functionality..." $Yellow
try {
    $testOutput = artillery quick --count 1 --num 1 http://httpbin.org/get 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Artillery basic test successful" $Green
        $ValidationResults += @{ Check = "Artillery Functionality"; Status = "PASS" }
    } else {
        Write-ColorOutput "✗ Artillery basic test failed" $Red
        $ValidationResults += @{ Check = "Artillery Functionality"; Status = "FAIL" }
    }
} catch {
    Write-ColorOutput "✗ Artillery basic test failed: $($_.Exception.Message)" $Red
    $ValidationResults += @{ Check = "Artillery Functionality"; Status = "FAIL" }
}

# Summary
Write-ColorOutput "`n=== Validation Summary ===" $Blue
$passedChecks = ($ValidationResults | Where-Object { $_.Status -eq "PASS" }).Count
$totalChecks = $ValidationResults.Count

foreach ($result in $ValidationResults) {
    $color = if ($result.Status -eq "PASS") { $Green } else { $Red }
    $symbol = if ($result.Status -eq "PASS") { "✓" } else { "✗" }
    Write-ColorOutput "$symbol $($result.Check): $($result.Status)" $color
}

Write-ColorOutput "`nValidation Results: $passedChecks/$totalChecks checks passed" $Yellow

if ($passedChecks -eq $totalChecks) {
    Write-ColorOutput "`n🎉 All validation checks passed!" $Green
    Write-ColorOutput "Your performance testing setup is ready for MVP testing." $Green
    Write-ColorOutput "`nNext steps:" $Blue
    Write-ColorOutput "1. Start your API Gateway: npm run start:dev" $Yellow
    Write-ColorOutput "2. Run MVP performance tests: npm run perf:mvp-quick" $Yellow
} else {
    Write-ColorOutput "`n⚠️  Some validation checks failed." $Red
    Write-ColorOutput "Please address the issues above before running performance tests." $Red
}

Write-ColorOutput "`nFor help, see: perf/README.md" $Blue