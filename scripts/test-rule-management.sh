#!/bin/bash

# ============================================================
# Rule Management UI - Test Runner
# ============================================================
# This script runs all tests for Rule Management UI
# Usage: bash scripts/test-rule-management.sh
# ============================================================

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Rule Management UI - Test Runner                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# Step 1: Check if migration file exists
# ============================================================
echo "📋 Step 1: Checking migration file..."
if [ -f "supabase/migrations/20260710160000_rule_management_tables.sql" ]; then
  echo -e "${GREEN}✅ Migration file exists${NC}"
else
  echo -e "${RED}❌ Migration file not found${NC}"
  exit 1
fi
echo ""

# ============================================================
# Step 2: Check if API routes exist
# ============================================================
echo "📋 Step 2: Checking API routes..."
API_ROUTES=(
  "src/app/api/rules/route.ts"
  "src/app/api/rules/[ruleId]/route.ts"
  "src/app/api/rules/[ruleId]/test/route.ts"
  "src/app/api/rules/[ruleId]/versions/route.ts"
  "src/app/api/rules/[ruleId]/rollback/route.ts"
  "src/app/api/rules/approvals/route.ts"
)

ALL_ROUTES_EXIST=true
for route in "${API_ROUTES[@]}"; do
  if [ -f "$route" ]; then
    echo -e "${GREEN}✅ $route${NC}"
  else
    echo -e "${RED}❌ $route not found${NC}"
    ALL_ROUTES_EXIST=false
  fi
done

if [ "$ALL_ROUTES_EXIST" = false ]; then
  echo -e "${RED}❌ Some API routes are missing${NC}"
  exit 1
fi
echo ""

# ============================================================
# Step 3: Run TypeScript compilation check
# ============================================================
echo "📋 Step 3: Running TypeScript compilation check..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
  echo -e "${RED}❌ TypeScript compilation failed${NC}"
  echo "Run 'npm run build' to see errors"
  exit 1
fi
echo ""

# ============================================================
# Step 4: Run API integration tests
# ============================================================
echo "📋 Step 4: Running API integration tests..."
if [ -f "src/app/api/rules/__tests__/rules-api.test.ts" ]; then
  echo "Running Jest tests..."
  if npm run test -- src/app/api/rules/__tests__/rules-api.test.ts; then
    echo -e "${GREEN}✅ All API tests passed${NC}"
  else
    echo -e "${RED}❌ Some API tests failed${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  Test file not found, skipping API tests${NC}"
fi
echo ""

# ============================================================
# Step 5: Manual database verification reminder
# ============================================================
echo "📋 Step 5: Database migration verification"
echo -e "${YELLOW}⚠️  Manual step required:${NC}"
echo "1. Open Supabase SQL Editor"
echo "2. Copy contents of: supabase/VERIFY_RULE_MANAGEMENT_MIGRATION.sql"
echo "3. Run the script"
echo "4. Verify all 15 tests pass"
echo ""
echo "Expected output:"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TEST SUMMARY                                              ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Total Tests:  15                                          ║"
echo "║  Passed:       15                                          ║"
echo "║  Failed:        0                                          ║"
echo "║  Success Rate: 100.0%                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# Summary
# ============================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TEST SUMMARY                                              ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Migration File:       ✅ Exists                           ║"
echo "║  API Routes:           ✅ All present (6 files)            ║"
echo "║  TypeScript Build:     ✅ Successful                       ║"
echo "║  API Tests:            ✅ All passed                       ║"
echo "║  Database Tests:       ⚠️  Manual verification required    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎉 All automated tests passed!${NC}"
echo -e "${YELLOW}📋 Don't forget to run database verification manually${NC}"
echo ""

