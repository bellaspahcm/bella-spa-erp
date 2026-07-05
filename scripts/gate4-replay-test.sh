#!/bin/bash
# Gate 4: Replay Determinism Test
# Tests 50 random decisions to verify replay produces identical results
# Usage: ./scripts/gate4-replay-test.sh

set -e

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/bella_erp}"
API_BASE="${API_BASE:-https://bella-spa-erp.vercel.app}"

MISMATCH_COUNT=0
TOTAL_COUNT=0
MISMATCHES_FILE="./gate4_reports/replay_mismatches_$(date +%Y%m%d_%H%M%S).txt"

mkdir -p ./gate4_reports

echo "🔄 Testing replay determinism on 50 random decisions..."
echo "Base URL: $API_BASE"
echo ""

# Get 50 random decision IDs
DECISION_IDS=$(psql "$DB_URL" -t -c "
  SELECT decision_id 
  FROM decision_audit_log 
  WHERE engine_version IS NOT NULL
  ORDER BY RANDOM() 
  LIMIT 50;
" | tr -d ' ')

if [ -z "$DECISION_IDS" ]; then
  echo "❌ No decisions found in database with engine_version"
  exit 1
fi

# Test each decision
while IFS= read -r decision_id; do
  if [ -z "$decision_id" ]; then continue; fi
  
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  
  # Call replay endpoint
  RESULT=$(curl -s "$API_BASE/api/decision-engine/replay/$decision_id")
  
  # Check if match=true
  MATCH=$(echo "$RESULT" | jq -r '.match // "error"')
  
  if [ "$MATCH" = "error" ]; then
    echo "⚠️  Error replaying: $decision_id"
    echo "$decision_id | ERROR | $RESULT" >> "$MISMATCHES_FILE"
    MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
  elif [ "$MATCH" != "true" ]; then
    echo "❌ Mismatch: $decision_id"
    echo "$decision_id | MISMATCH | $RESULT" >> "$MISMATCHES_FILE"
    MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
  else
    echo "✅ Match: $decision_id"
  fi
  
  # Progress indicator
  if [ $((TOTAL_COUNT % 10)) -eq 0 ]; then
    echo "   Progress: $TOTAL_COUNT/50 decisions tested"
  fi
done <<< "$DECISION_IDS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Replay Determinism Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total tested: $TOTAL_COUNT"
echo "Matches: $((TOTAL_COUNT - MISMATCH_COUNT))"
echo "Mismatches: $MISMATCH_COUNT"

if [ $TOTAL_COUNT -gt 0 ]; then
  DETERMINISM_RATE=$(echo "scale=2; 100 * ($TOTAL_COUNT - $MISMATCH_COUNT) / $TOTAL_COUNT" | bc)
  echo "Determinism rate: $DETERMINISM_RATE%"
else
  echo "Determinism rate: N/A"
fi

echo ""

if [ $MISMATCH_COUNT -eq 0 ]; then
  echo "✅ PASS: All replays match original decisions"
  echo "Gate 4 Check 4.3: Replay Determinism ✅"
  rm -f "$MISMATCHES_FILE"
  exit 0
else
  echo "⚠️ INVESTIGATE: $MISMATCH_COUNT replays did not match"
  echo "Mismatch details saved to: $MISMATCHES_FILE"
  echo ""
  echo "Common causes:"
  echo "  1. Non-deterministic logic (random numbers, timestamps)"
  echo "  2. Policy version changed since original decision"
  echo "  3. Database state changed (employee balance updated)"
  echo ""
  echo "Next steps:"
  echo "  - Review mismatches in $MISMATCHES_FILE"
  echo "  - Check for non-deterministic code in policy"
  echo "  - Ensure replay uses same policy version"
  echo "  - Document findings for Sprint 2"
  exit 1
fi
