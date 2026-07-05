# Decision Engine Validation Script (PowerShell)
# Runs all tests required for pre-deployment validation

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Decision Engine Validation Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test counters
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

# Function to run test and track results
function Run-Test {
    param(
        [string]$TestName,
        [string]$TestCommand
    )
    
    Write-Host "----------------------------------------" -ForegroundColor White
    Write-Host "Running: $TestName" -ForegroundColor White
    Write-Host "----------------------------------------" -ForegroundColor White
    
    $script:TotalTests++
    
    try {
        Invoke-Expression $TestCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PASS: $TestName" -ForegroundColor Green
            $script:PassedTests++
        } else {
            Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
            $script:FailedTests++
        }
    } catch {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        $script:FailedTests++
    }
    
    Write-Host ""
}

# Phase 0: Resilience Tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PHASE 0: RESILIENCE VALIDATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Run-Test "Retry Queue Tests" `
    "npm test -- resilience.test.ts --testNamePattern='retry' --silent"

Run-Test "Circuit Breaker Tests" `
    "npm test -- resilience.test.ts --testNamePattern='circuit' --silent"

Run-Test "CRITICAL: Graceful Degradation" `
    "npm test -- resilience.test.ts --testNamePattern='CRITICAL' --silent"

# Phase 1: Leave Approval Tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PHASE 1: LEAVE APPROVAL VALIDATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Run-Test "Leave Approval Policy Rules" `
    "npm test -- leave-decision-integration.test.ts --silent"

# Performance Tests
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PERFORMANCE VALIDATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Run-Test "Benchmark Tests" `
    "npm test -- benchmark.test.ts --runInBand --silent"

# All Resilience Tests (Full Suite)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "FULL RESILIENCE TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Run-Test "All Resilience Tests" `
    "npm test -- resilience.test.ts --silent"

# Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests: $script:TotalTests"
Write-Host "Passed: $script:PassedTests" -ForegroundColor Green
Write-Host "Failed: $script:FailedTests" -ForegroundColor Red
Write-Host ""

if ($script:FailedTests -eq 0) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Code ready for staging deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Deploy to staging"
    Write-Host "2. Run smoke tests"
    Write-Host "3. Enable for internal team"
    Write-Host "4. Monitor for 1-2 weeks"
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "❌ VALIDATION FAILED" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix failing tests before deployment."
    Write-Host "Review logs above for details."
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
