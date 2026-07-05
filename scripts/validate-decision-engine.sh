#!/bin/bash

# Decision Engine Validation Script
# Runs all tests required for pre-deployment validation

set -e  # Exit on error

echo "=========================================="
echo "Decision Engine Validation Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "----------------------------------------"
    echo "Running: $test_name"
    echo "----------------------------------------"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# Phase 0: Resilience Tests
echo "=========================================="
echo "PHASE 0: RESILIENCE VALIDATION"
echo "=========================================="
echo ""

run_test "Retry Queue Tests" \
    "npm test -- resilience.test.ts --testNamePattern='retry' --silent"

run_test "Circuit Breaker Tests" \
    "npm test -- resilience.test.ts --testNamePattern='circuit' --silent"

run_test "CRITICAL: Graceful Degradation" \
    "npm test -- resilience.test.ts --testNamePattern='CRITICAL' --silent"

# Phase 1: Leave Approval Tests
echo "=========================================="
echo "PHASE 1: LEAVE APPROVAL VALIDATION"
echo "=========================================="
echo ""

run_test "Leave Approval Policy Rules" \
    "npm test -- leave-decision-integration.test.ts --silent"

# Performance Tests
echo "=========================================="
echo "PERFORMANCE VALIDATION"
echo "=========================================="
echo ""

run_test "Benchmark Tests" \
    "npm test -- benchmark.test.ts --runInBand --silent"

# All Resilience Tests (Full Suite)
echo "=========================================="
echo "FULL RESILIENCE TEST SUITE"
echo "=========================================="
echo ""

run_test "All Resilience Tests" \
    "npm test -- resilience.test.ts --silent"

# Summary
echo "=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✅ ALL TESTS PASSED"
    echo "=========================================="
    echo ""
    echo "🎉 Code ready for staging deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy to staging"
    echo "2. Run smoke tests"
    echo "3. Enable for internal team"
    echo "4. Monitor for 1-2 weeks"
    echo "=========================================="
    echo -e "${NC}"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "❌ VALIDATION FAILED"
    echo "=========================================="
    echo ""
    echo "Please fix failing tests before deployment."
    echo "Review logs above for details."
    echo "=========================================="
    echo -e "${NC}"
    exit 1
fi
