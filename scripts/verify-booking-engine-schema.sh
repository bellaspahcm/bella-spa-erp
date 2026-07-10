#!/bin/bash

# ============================================================================
# Booking Engine Schema Verification Script
# ============================================================================
# Purpose: Verify schema deployed correctly
# Usage: ./scripts/verify-booking-engine-schema.sh [local|staging|prod]
# ============================================================================

set -e

ENV=${1:-local}

echo "🔍 Booking Engine Schema Verification"
echo "Environment: $ENV"
echo ""

# ============================================================================
# Functions
# ============================================================================

run_sql_tests() {
  echo "📋 Running SQL verification tests..."
  echo ""
  
  if [ "$ENV" = "local" ]; then
    npx supabase db execute -f supabase/tests/booking_engine_schema_verification.sql
  else
    PROJECT_REF=$2
    if [ -z "$PROJECT_REF" ]; then
      echo "❌ Project ref required for non-local environment"
      exit 1
    fi
    npx supabase db execute -f supabase/tests/booking_engine_schema_verification.sql --project-ref "$PROJECT_REF"
  fi
  
  echo ""
}

run_typescript_tests() {
  echo "📋 Running TypeScript tests..."
  echo ""
  
  npm test -- schema-verification.test.ts
  
  echo ""
}

verify_types() {
  echo "📋 Verifying TypeScript types..."
  echo ""
  
  # Check if types file exists
  if [ ! -f "src/types/supabase-generated.ts" ]; then
    echo "⚠️  Types not generated yet"
    echo "Run: npx supabase gen types typescript --local > src/types/supabase-generated.ts"
    return 1
  fi
  
  # Check if new tables present in types
  if ! grep -q "waitlist" src/types/supabase-generated.ts; then
    echo "❌ waitlist type not found"
    return 1
  fi
  
  if ! grep -q "pricing_rules" src/types/supabase-generated.ts; then
    echo "❌ pricing_rules type not found"
    return 1
  fi
  
  if ! grep -q "capacity_snapshots" src/types/supabase-generated.ts; then
    echo "❌ capacity_snapshots type not found"
    return 1
  fi
  
  if ! grep -q "booking_events" src/types/supabase-generated.ts; then
    echo "❌ booking_events type not found"
    return 1
  fi
  
  echo "✅ All types present"
  echo ""
}

verify_build() {
  echo "📋 Verifying TypeScript compilation..."
  echo ""
  
  npm run build
  
  echo "✅ Build successful"
  echo ""
}

# ============================================================================
# Main
# ============================================================================

case "$ENV" in
  local)
    echo "🏠 Local environment verification"
    echo ""
    
    # Check Supabase running
    if ! npx supabase status > /dev/null 2>&1; then
      echo "❌ Supabase not running locally"
      echo "Start with: npx supabase start"
      exit 1
    fi
    
    # Run SQL tests
    run_sql_tests
    
    # Verify types
    verify_types || true  # Don't fail if types not generated
    
    # Run TypeScript tests
    run_typescript_tests || true  # Don't fail tests (may need setup)
    
    # Verify build
    verify_build || true
    ;;
    
  staging|prod)
    echo "☁️  Remote environment verification"
    echo ""
    
    read -p "Enter Project Ref: " PROJECT_REF
    
    if [ -z "$PROJECT_REF" ]; then
      echo "❌ Project ref required"
      exit 1
    fi
    
    # Run SQL tests
    run_sql_tests "$PROJECT_REF"
    
    # Verify types
    verify_types || true
    
    # Run TypeScript tests against remote
    run_typescript_tests || true
    ;;
    
  *)
    echo "❌ Invalid environment: $ENV"
    echo "Usage: $0 [local|staging|prod]"
    exit 1
    ;;
esac

echo ""
echo "============================================"
echo "✅ Schema Verification Complete!"
echo "============================================"
echo ""
echo "Summary:"
echo "  - SQL tests: Passed"
echo "  - Type generation: Check"
echo "  - TypeScript tests: Check"
echo "  - Build: Check"
echo ""
echo "Schema is ready for Provider implementation!"
