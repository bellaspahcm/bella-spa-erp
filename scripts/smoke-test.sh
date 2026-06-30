#!/bin/bash
# Smoke Test Runner for Commission System Tasks 18-19
# Usage: npm run smoke:test (or bash scripts/smoke-test.sh)

echo "🔧 Loading environment variables from .env.local..."
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local not found"
  exit 1
fi

# Export environment variables
set -a
source .env.local
set +a

echo "✅ Environment loaded"
echo ""

echo "🚀 Running smoke tests..."
npx tsx scripts/smoke-test-position-tier-hire-date.ts
