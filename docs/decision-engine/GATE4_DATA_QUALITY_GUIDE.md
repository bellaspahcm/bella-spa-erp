# Gate 4: Data Quality Validation 📋

**Objective:** Ensure audit data is complete and usable for analytics

**Timeline:** After **500+ decisions** collected (Week 1-2)

**Status:** 🟡 **OBSERVATIONAL** (not blocking, gather baseline data)

---

## Overview

Gate 4 validates that the decision engine produces **high-quality audit data** that can be used for:
- Policy debugging and optimization
- Business analytics and reporting
- Regulatory compliance audits
- Machine learning model training

Unlike Gates 1-2 (blocking), Gate 4 is **observational**. Issues found here are **noted for Sprint 2** but do not block production rollout.

---

## Prerequisites

- ✅ Gate 1 (Functional) passed
- ✅ Gate 2 (Failure Injection) passed
- ✅ Gate 3 (Operational Stability) monitoring started
- ✅ **Minimum 500 decisions** collected in `decision_audit_log` table

---

## 4 Mandatory Checks

### 4.1 Audit Completeness ✅

**Question:** Are all required audit fields populated?

**Query:**
```sql
-- Run in Supabase SQL Editor
SELECT 
  COUNT(*) FILTER (WHERE decision_id IS NULL) as missing_id,
  COUNT(*) FILTER (WHERE decision_type IS NULL) as missing_type,
  COUNT(*) FILTER (WHERE engine_version IS NULL) as missing_engine_version,
  COUNT(*) FILTER (WHERE policy_version IS NULL) as missing_policy_version,
  COUNT(*) FILTER (WHERE rules_evaluated IS NULL OR rules_evaluated = '[]'::jsonb) as missing_rules,
  COUNT(*) FILTER (WHERE correlation_id IS NULL) as missing_correlation_id,
  COUNT(*) FILTER (WHERE decision_timestamp IS NULL) as missing_timestamp,
  COUNT(*) FILTER (WHERE execution_time_ms IS NULL) as missing_execution_time,
  COUNT(*) as total_decisions
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '7 days';
```

**Expected Result:**
```
missing_id             | 0
missing_type           | 0
missing_engine_version | 0
missing_policy_version | 0
missing_rules          | 0
missing_correlation_id | 0
missing_timestamp      | 0
missing_execution_time | 0
total_decisions        | 500+
```

**Pass Criteria:** ALL missing counts = 0

**If Failed:**
- Identify which fields are missing
- Check if legacy decisions (pre-engine) are included (filter by `engine_version IS NOT NULL`)
- Review decision execution code to ensure all fields populated
- Document issue in Sprint 2 backlog

---

### 4.2 Rule Coverage ✅

**Question:** Has every policy rule been triggered at least once?

**Query:**
```sql
-- Extract all unique rules that have been evaluated
WITH rules_hit AS (
  SELECT DISTINCT jsonb_array_elements_text(rules_evaluated) as rule_id
  FROM decision_audit_log
  WHERE decision_timestamp > NOW() - INTERVAL '7 days'
    AND engine_version IS NOT NULL
)
SELECT 
  rule_id,
  COUNT(*) as hit_count
FROM (
  SELECT jsonb_array_elements_text(rules_evaluated) as rule_id
  FROM decision_audit_log
  WHERE decision_timestamp > NOW() - INTERVAL '7 days'
) rules
GROUP BY rule_id
ORDER BY hit_count DESC;
```

**Expected Rules (Leave Approval Policy):**
1. `check-leave-balance` - Verify employee has sufficient leave days
2. `check-maximum-duration` - Enforce max leave duration limits
3. `check-manager-approval` - Ensure manager approval for long leaves
4. `check-blackout-period-tet` - Block leave during Tet holiday
5. `check-blackout-period-high-season` - Block leave during peak business
6. `auto-approve-sick-leave` - Auto-approve sick leave with medical cert
7. `check-consecutive-leave-limit` - Limit consecutive leave days
8. `check-advance-notice` - Require advance notice for leave requests

**Pass Criteria:** All 8 rules appear with `hit_count > 0`

**Coverage Analysis:**
```sql
-- Calculate rule coverage percentage
WITH expected_rules AS (
  SELECT unnest(ARRAY[
    'check-leave-balance',
    'check-maximum-duration',
    'check-manager-approval',
    'check-blackout-period-tet',
    'check-blackout-period-high-season',
    'auto-approve-sick-leave',
    'check-consecutive-leave-limit',
    'check-advance-notice'
  ]) as rule_id
),
actual_rules AS (
  SELECT DISTINCT jsonb_array_elements_text(rules_evaluated) as rule_id
  FROM decision_audit_log
  WHERE engine_version IS NOT NULL
)
SELECT 
  COUNT(*) FILTER (WHERE actual.rule_id IS NOT NULL) as rules_hit,
  COUNT(*) as total_rules,
  ROUND(100.0 * COUNT(*) FILTER (WHERE actual.rule_id IS NOT NULL) / COUNT(*), 1) as coverage_pct
FROM expected_rules
LEFT JOIN actual_rules actual USING (rule_id);
```

**Target Coverage:** > 80%

**If Failed:**
- Identify which rules have 0 hits (dead code or insufficient test data)
- Generate test cases to trigger missing rules
- Consider if rule is actually reachable (may indicate logic bug)
- Document untriggered rules in Sprint 2 for removal or test data generation

---

### 4.3 Replay Determinism ✅

**Question:** Do replayed decisions produce identical results?

**Test Script:**
```bash
#!/bin/bash
# Save as: scripts/gate4-replay-test.sh

# Test 50 random decisions
MISMATCH_COUNT=0
TOTAL_COUNT=0

echo "Testing replay determinism on 50 random decisions..."

psql "$DATABASE_URL" -t -c "
  SELECT decision_id 
  FROM decision_audit_log 
  WHERE engine_version IS NOT NULL
  ORDER BY RANDOM() 
  LIMIT 50;
" | while read -r decision_id; do
  if [ -z "$decision_id" ]; then continue; fi
  
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  
  # Call replay endpoint
  RESULT=$(curl -s "https://bella-spa-erp.vercel.app/api/decision-engine/replay/$decision_id")
  
  # Check if match=true
  MATCH=$(echo "$RESULT" | jq -r '.match')
  
  if [ "$MATCH" != "true" ]; then
    echo "❌ Mismatch: $decision_id"
    MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
  fi
done

echo "Total tested: $TOTAL_COUNT"
echo "Mismatches: $MISMATCH_COUNT"
echo "Determinism rate: $(echo "scale=2; 100 * (1 - $MISMATCH_COUNT / $TOTAL_COUNT)" | bc)%"

if [ $MISMATCH_COUNT -eq 0 ]; then
  echo "✅ PASS: All replays match original"
  exit 0
else
  echo "⚠️ INVESTIGATE: $MISMATCH_COUNT replays did not match"
  exit 1
fi
```

**Pass Criteria:** 100% match (mismatch_count = 0)

**Common Mismatch Causes:**
1. **Non-deterministic logic:**
   - Random number generation
   - Current timestamp used in logic (should use `request_timestamp`)
   - External API calls with changing data

2. **Policy version changed:**
   - Replay uses current policy, original used old version
   - Solution: Store policy version in audit log, replay with same version

3. **Database state changed:**
   - Employee balance updated since original decision
   - Solution: Replay should use snapshot of state at original `decision_timestamp`

**SQL: Find Replay Mismatches:**
```sql
-- Identify decisions with non-deterministic outputs
SELECT 
  decision_id,
  decision_type,
  approved,
  confidence,
  metadata->'replay_mismatch_count' as mismatch_count
FROM decision_audit_log
WHERE metadata->'replay_mismatch_count' IS NOT NULL
  AND (metadata->>'replay_mismatch_count')::int > 0
ORDER BY decision_timestamp DESC
LIMIT 20;
```

**If Failed:**
- Review policy code for non-deterministic operations
- Ensure replay uses same policy version and input state
- Document mismatch patterns for Sprint 2 refactoring

---

### 4.4 Trace Completeness ✅

**Question:** Does every decision have a corresponding trace ID?

**Query:**
```sql
-- Check for missing traces
SELECT 
  COUNT(*) as total_decisions,
  COUNT(DISTINCT correlation_id) as total_traces,
  COUNT(*) - COUNT(correlation_id) as missing_traces,
  ROUND(100.0 * COUNT(correlation_id) / COUNT(*), 2) as trace_coverage_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '7 days'
  AND engine_version IS NOT NULL;
```

**Expected Result:**
```
total_decisions     | 500+
total_traces        | 500+
missing_traces      | 0
trace_coverage_pct  | 100.00
```

**Pass Criteria:** `missing_traces = 0` (100% coverage)

**Trace ID Purpose:**
- Groups related decisions in a single user flow
- Enables waterfall visualization in trace viewer
- Links decisions to originating HTTP request

**Example Trace Flow:**
```
correlation_id: trace-abc123
├─ Decision 1: Check leave balance (10ms)
├─ Decision 2: Approve leave request (120ms)
└─ Decision 3: Update leave balance (30ms)
```

**SQL: Find Decisions Without Traces:**
```sql
-- Identify orphaned decisions (no trace ID)
SELECT 
  decision_id,
  decision_type,
  decision_timestamp,
  metadata->'request_id' as request_id
FROM decision_audit_log
WHERE correlation_id IS NULL
  AND engine_version IS NOT NULL
ORDER BY decision_timestamp DESC
LIMIT 20;
```

**If Failed:**
- Check if trace ID is generated in request middleware
- Verify trace ID propagated through entire request lifecycle
- Ensure trace ID stored in audit log before commit
- Document gap for Sprint 2 instrumentation improvements

---

## Validation Summary Report

Run this query to generate a **Gate 4 Compliance Report**:

```sql
-- Gate 4: Data Quality Summary Report
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
  jsonb_build_object(
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
  ) as gate4_report
FROM completeness c, rule_coverage rc, trace_coverage tc;
```

**Example Output:**
```json
{
  "gate4_status": "PASS",
  "total_decisions": 523,
  "audit_completeness_pct": 100.00,
  "rule_coverage_count": 8,
  "rule_coverage_target": 8,
  "trace_coverage_pct": 100.00,
  "checks": {
    "audit_completeness": true,
    "rule_coverage": true,
    "trace_completeness": true
  }
}
```

---

## Timeline and Milestones

| Day | Activity | Expected Output |
|-----|----------|-----------------|
| **Day 1-3** | Collect decisions | Reach 100 decisions |
| **Day 4-7** | Continue collection | Reach 300 decisions |
| **Day 8-10** | First Gate 4 check | Run all 4 validation queries |
| **Day 11-14** | Continue collection | Reach 500+ decisions |
| **Day 15** | Final Gate 4 report | Generate compliance summary |

---

## Pass/Fail Criteria

### ✅ PASS Criteria (All must be true):
1. ✅ Audit Completeness: 100% (0 missing fields)
2. ✅ Rule Coverage: ≥ 6/8 rules triggered (75%)
3. ✅ Replay Determinism: 100% match rate
4. ✅ Trace Completeness: 100% (0 missing traces)

### ⚠️ INVESTIGATE Criteria (Any is true):
1. ⚠️ Audit Completeness: < 100%
2. ⚠️ Rule Coverage: < 6/8 rules
3. ⚠️ Replay Determinism: < 100%
4. ⚠️ Trace Completeness: < 100%

### Important Notes:
- **Gate 4 is OBSERVATIONAL** - failures do NOT block production rollout
- Issues found are **documented for Sprint 2** optimization
- Goal: Establish **baseline data quality** for future improvements

---

## Automated Monitoring Script

Create `scripts/gate4-monitor.sh`:

```bash
#!/bin/bash
# Gate 4 Data Quality Monitor
# Run daily to track data quality metrics

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
```

**Usage:**
```bash
chmod +x scripts/gate4-monitor.sh
./scripts/gate4-monitor.sh
```

---

## Next Steps After Gate 4

Once Gate 4 passes:

1. **Generate Final Report:**
   - Run all 4 validation queries
   - Save compliance summary
   - Document baseline metrics

2. **Review with Team:**
   - Share Gate 4 report with tech lead
   - Discuss any "INVESTIGATE" findings
   - Prioritize issues for Sprint 2

3. **Proceed to Production:**
   - Gate 4 findings do NOT block rollout
   - Update runbook with observed data quality
   - Set up ongoing monitoring dashboards

4. **Sprint 2 Planning:**
   - Address replay determinism issues
   - Improve rule coverage (trigger missing rules)
   - Add data quality tests to CI pipeline

---

## Related Documentation

- **Gate 1:** [GATE1_QUICK_START.md](./GATE1_QUICK_START.md) - Functional validation
- **Gate 2:** [GATE2_SETUP_COMPLETE.md](./GATE2_SETUP_COMPLETE.md) - Failure injection
- **Gate 3:** [GATE3_MONITORING_GUIDE.md](./GATE3_MONITORING_GUIDE.md) - Operational stability
- **Production Gates:** [STAGING_PRODUCTION_GATES.md](./STAGING_PRODUCTION_GATES.md) - Full gate definitions

---

**Last Updated:** July 5, 2026  
**Status:** Gate 4 ready to start (waiting for 500+ decisions)
