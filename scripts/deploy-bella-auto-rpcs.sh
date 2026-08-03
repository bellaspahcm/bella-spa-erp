#!/bin/bash

# ============================================================================
# Bella Auto RPC Deployment Script
# Deploys Phase 11-15 RPCs and refreshes PostgREST schema cache
# ============================================================================

set -e

echo "🚀 Bella Auto RPC Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install via:"
    echo "   npm install -g supabase"
    exit 1
fi

# Step 1: Verify migrations
echo "📦 Step 1: Verifying migrations..."
echo ""

MIGRATIONS=(
    "20260803310000_bella_auto_phase11_business_rollback.sql"
    "20260803320000_bella_auto_phase12_temporal_history.sql"
    "20260804000000_bella_auto_phase13_rule_engine.sql"
    "20260804100000_bella_auto_phase14_marketplace.sql"
    "20260804110000_bella_auto_phase15_rollup_analytics.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "supabase/migrations/$migration" ]; then
        echo "  ✓ $migration"
    else
        echo "  ✗ $migration NOT FOUND"
        exit 1
    fi
done

echo ""
echo "✅ All 5 phase migrations found"
echo ""

# Step 2: Push migrations to Supabase
echo "📤 Step 2: Pushing migrations to Supabase..."
echo ""

supabase db push --linked

echo ""
echo "✅ Migrations pushed"
echo ""

# Step 3: Refresh schema cache
echo "🔄 Step 3: Refreshing PostgREST schema cache..."
echo ""

# Get database URL from environment
source .env.local

psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';" || echo "⚠️  Could not refresh cache via SQL (may need manual refresh in dashboard)"

echo ""
echo "✅ Schema cache refresh requested"
echo ""

# Step 4: Verify RPCs deployed
echo "🔍 Step 4: Verifying RPCs..."
echo ""

RPCS=(
    "execute_business_rollback"
    "get_temporal_vehicle_inventory"
    "evaluate_rules_for_entity"
    "get_rollup_analytics"
)

for rpc in "${RPCS[@]}"; do
    if psql "$SUPABASE_DB_URL" -t -c "SELECT 1 FROM pg_proc WHERE proname = '$rpc'" | grep -q 1; then
        echo "  ✓ $rpc()"
    else
        echo "  ✗ $rpc() NOT FOUND"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Wait 30 seconds for PostgREST to reload"
echo "2. Run: npx tsx scripts/seed-bella-auto-stress-test.ts"
echo "3. Run: npx tsx scripts/test-bella-auto-perf.ts"
echo ""
