#!/bin/bash
# Gate 4 Data Quality Monitor
# Run daily to track data quality metrics
# Usage: ./scripts/gate4-monitor.sh

set -e

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/bella_erp}"
OUTPUT_DIR="./gate4_reports"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/gate4_report_$TIMESTAMP.json"

echo "🔍 Running Gate 4 Data Quality Checks..."

# Run validation query
psql "$DB_URL" -t -c "
WITH 
  completeness AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE decision_id IS NOT NULL 
        AND decision_type IS NOT NULL 
        AND engine_version IS NOT NULL 
        AND policy_version IS NOT NULL 
        AND rules_evaluated IS NOT NULL 
        AND correlation_id IS NOT NULL) as complete
    FROM decision_audit_log
    WHERE decision_timestamp > NOW() - INTERVAL '7 days'
      AND engine_version IS NOT NULL
  ),
  rule_coverage AS (
    SELECT COUNT(DISTINCT jsonb_array_elements_text(rules_evaluated)) as unique_rules
    FROM decision_audit_log
    WHERE engine_version IS NOT NULL
  ),
  trace_coverage AS (
    SELECT 
      COUNT(*) as total,
      COUNT(correlation_id) as with_trace
    FROM decision_audit_log
    WHERE engine_version IS NOT NULL
  )
SELECT 
  jsonb_pretty(jsonb_build_object(
    'timestamp', NOW(),
    'gate4_status', CASE 
      WHEN c.complete = c.total 
        AND rc.unique_rules >= 6 
        AND tc.with_trace = tc.total 
      THEN 'PASS'
      ELSE 'INVESTIGATE'
    END,
    'total_decisions', c.total,
    'audit_completeness_pct', ROUND(100.0 * c.complete / c.total, 2),
    'rule_coverage_count', rc.unique_rules,
    'rule_coverage_target', 8,
    'trace_coverage_pct', ROUND(100.0 * tc.with_trace / tc.total, 2),
    'checks', jsonb_build_object(
      'audit_completeness', c.complete = c.total,
      'rule_coverage', rc.unique_rules >= 6,
      'trace_completeness', tc.with_trace = tc.total
    )
  ))
FROM completeness c, rule_coverage rc, trace_coverage tc;
" > "$REPORT_FILE"

echo "📊 Report saved: $REPORT_FILE"

# Display summary
STATUS=$(jq -r '.gate4_status' "$REPORT_FILE")
TOTAL=$(jq -r '.total_decisions' "$REPORT_FILE")

if [ "$STATUS" = "PASS" ]; then
  echo "✅ Gate 4: PASS ($TOTAL decisions analyzed)"
else
  echo "⚠️ Gate 4: INVESTIGATE ($TOTAL decisions analyzed)"
  jq '.checks' "$REPORT_FILE"
fi
