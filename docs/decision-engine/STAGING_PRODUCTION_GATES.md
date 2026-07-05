# Decision Engine - Staging Production Gates

**Purpose**: Kỷ luật validation trước khi mở rộng từ staging sang production

**Philosophy**: "Staging is NOT a preview environment. It's an evidence-gathering phase."

---

## Gate 1: Functional Validation ✅

**Objective**: Verify all core features work end-to-end with real database

**Timeline**: Complete within **first 2 hours** of staging deployment

**Mandatory Checks** (ALL must pass):

### 1.1 Leave Approval - Success Path ✅
```bash
# Setup: Employee with 12 days balance, 5-day request
POST /api/leave-requests/req-001/decide
{
  "approverId": "manager-001",
  "approverRole": "manager",
  "tenantId": "staging-tenant"
}
```

**Expected**:
```json
{
  "success": true,
  "approved": true,
  "reason": "All approval criteria met",
  "decisionId": "dec-xxx",
  "metadata": {
    "confidence": 0.95,
    "executionTimeMs": 120
  }
}
```

**Verify**:
- [x] HTTP 200 response
- [x] `approved: true`
- [x] `decisionId` returned
- [x] `confidence > 0.9`
- [x] `executionTimeMs < 500ms`

---

### 1.2 Leave Rejection - Business Rule ✅
```bash
# Setup: Employee with 3 days balance, 5-day request
POST /api/leave-requests/req-002/decide
```

**Expected**:
```json
{
  "success": true,
  "approved": false,
  "reason": "Insufficient leave balance (3 days available, 5 days requested)",
  "metadata": {
    "confidence": 1.0,
    "ruleFired": "check-leave-balance"
  }
}
```

**Verify**:
- [x] HTTP 200 response
- [x] `approved: false`
- [x] Rejection reason mentions balance
- [x] `confidence = 1.0` (deterministic rule)

---

### 1.3 Audit Record Persisted ✅
```bash
GET /api/decision-engine/audit?decisionType=leave-request-approval&limit=5
```

**Expected**:
```json
{
  "decisions": [
    {
      "id": "dec-xxx",
      "decision_type": "leave-request-approval",
      "approved": true,
      "confidence": 0.95,
      "execution_time_ms": 120,
      "rules_evaluated": ["check-leave-balance", "check-duration", "check-blackout"],
      "decision_timestamp": "2026-06-22T10:30:00Z",
      "engine_version": "1.0.0",
      "policy_version": "leave-policy@1.0.0"
    }
  ]
}
```

**Verify**:
- [x] Audit record exists in database
- [x] All metadata fields populated
- [x] `rules_evaluated` array not empty
- [x] Timestamp within last 5 minutes
- [x] **NEW**: `engine_version` and `policy_version` present

---

### 1.4 Replay Works ✅
```bash
POST /api/decision-engine/replay/dec-xxx
```

**Expected**:
```json
{
  "original": {
    "decisionId": "dec-xxx",
    "approved": true,
    "confidence": 0.95
  },
  "replayed": {
    "approved": true,
    "confidence": 0.95
  },
  "match": true,
  "differences": []
}
```

**Verify**:
- [x] Replay result matches original
- [x] `match: true` (deterministic)
- [x] `differences` array empty
- [x] Execution completes < 200ms

---

### 1.5 Trace Viewer Accessible ✅
```bash
GET /api/decision-engine/trace/trace-xxx
```

**Expected**:
```json
{
  "traceId": "trace-xxx",
  "decisions": [
    {
      "decisionId": "dec-xxx",
      "startTime": "2026-06-22T10:30:00.000Z",
      "endTime": "2026-06-22T10:30:00.120Z",
      "rules": [
        {
          "ruleId": "check-leave-balance",
          "startOffset": 10,
          "duration": 30,
          "result": "PASS"
        }
      ]
    }
  ]
}
```

**Verify**:
- [x] Trace data returned
- [x] Rule execution timeline present
- [x] Timing data accurate
- [x] UI renders waterfall chart

---

### 1.6 Health Endpoint Operational ✅
```bash
GET /api/decision-engine/health
```

**Expected**:
```json
{
  "status": "healthy",
  "timestamp": "2026-06-22T10:30:00Z",
  "decisionEngine": {
    "uptime": "2h15m",
    "version": "1.0.0",
    "policyVersion": "leave-policy@1.0.0",
    "auditQueueDepth": 0,
    "retryRate": 0.02,
    "dlqRate": 0.0,
    "circuitState": "CLOSED"
  }
}
```

**Verify**:
- [x] HTTP 200 response
- [x] `status: "healthy"`
- [x] `circuitState: "CLOSED"`
- [x] `auditQueueDepth < 10`
- [x] `dlqRate < 0.01`

---

## Gate 2: Failure Injection Testing 💥

**Objective**: Prove resilience architecture works under failure conditions

**Timeline**: Complete within **24 hours** of Gate 1 passing

**Mandatory Scenarios** (ALL must pass):

### 2.1 Audit Database Down ✅ (CRITICAL)
**Simulation**: Stop audit database connection OR block audit table access

**Test**:
```bash
# While audit DB is down, make 5 leave approval decisions
for i in {1..5}; do
  curl -X POST /api/leave-requests/req-$i/decide
done
```

**Expected Behavior**:
- ✅ **ALL 5 decisions return HTTP 200**
- ✅ **ALL 5 decisions have `approved` result (true/false)**
- ✅ **ZERO business logic failures**
- ✅ Audit logs queued in memory
- ✅ Circuit breaker opens after threshold failures
- ✅ Queue shows pending items in health endpoint

**Verify**:
```bash
GET /api/decision-engine/health
# Expected: circuitState = "OPEN", auditQueueDepth > 0
```

**Recovery**:
- Restore audit database
- Wait 10 seconds (circuit breaker timeout)
- Verify queue drains
- Verify circuit breaker returns to CLOSED

**CRITICAL ASSERTION**: "Business decisions NEVER block on audit failures."

---

### 2.2 Audit Insert Timeout ✅
**Simulation**: Configure database to delay INSERT on `decision_audit_log` table (5+ seconds)

**Test**:
```bash
POST /api/leave-requests/req-timeout/decide
```

**Expected Behavior**:
- ✅ Decision returns in < 1 second (does NOT wait for audit)
- ✅ Audit queued for async retry
- ✅ Retry logic attempts 3 times with backoff
- ✅ After 3 failures → Dead Letter Queue

**Verify**:
```bash
GET /api/decision-engine/health
# Expected: retryRate increases, dlqRate increases if timeouts persist
```

---

### 2.3 Memory Queue Full ✅
**Simulation**: Fill audit queue with 1000+ pending items

**Test**:
```bash
# Generate 1000 decisions rapidly while audit is slow/down
for i in {1..1000}; do
  curl -X POST /api/leave-requests/req-$i/decide &
done
wait
```

**Expected Behavior**:
- ✅ Queue implements max capacity (e.g., 10,000 items)
- ✅ Oldest items moved to DLQ when capacity exceeded
- ✅ Health endpoint shows `auditQueueDepth = 10000`
- ✅ **Business decisions still succeed**

**Verify**:
```bash
GET /api/decision-engine/health
# Expected: auditQueueDepth at max, dlqRate > 0, circuitState = OPEN
```

---

### 2.4 Network Partition ✅
**Simulation**: Block network between app server and audit database for 30 seconds

**Test**:
```bash
# During partition, make 10 decisions
for i in {1..10}; do
  curl -X POST /api/leave-requests/req-net-$i/decide
done
```

**Expected Behavior**:
- ✅ **ALL 10 decisions succeed**
- ✅ Audit logs queued locally
- ✅ Circuit breaker opens
- ✅ After network restore: queue drains, circuit closes

**Recovery Verification**:
```bash
# After network restored, verify all 10 audit logs eventually persisted
SELECT COUNT(*) FROM decision_audit_log WHERE decision_id LIKE 'dec-net-%';
# Expected: 10
```

---

### 2.5 Policy Execution Exception ✅
**Simulation**: Inject buggy rule that throws exception

**Test**:
```bash
# Temporarily deploy policy with rule:
# throw new Error('Simulated policy bug');

POST /api/leave-requests/req-error/decide
```

**Expected Behavior**:
- ✅ Decision returns HTTP 200 (not 500)
- ✅ `approved: false`
- ✅ `reason` mentions "Policy execution error"
- ✅ Error logged but NOT propagated to caller
- ✅ Audit log records exception details

**Verify**:
```bash
GET /api/decision-engine/audit/dec-error
# Expected: audit.metadata.error contains stack trace
```

---

## Gate 3: Operational Stability 📊

**Objective**: Prove system is stable under real workload

**Timeline**: Monitor for **72 hours** after Gate 2 passes

**Mandatory Metrics** (ALL thresholds must hold):

### 3.1 Queue Health ✅
**Metric**: Audit Queue Depth

**Threshold**: `auditQueueDepth < 100` at all times (except during failure injection)

**Monitoring**:
```bash
# Poll every 5 minutes for 72 hours
while true; do
  curl -s /api/decision-engine/health | jq '.decisionEngine.auditQueueDepth'
  sleep 300
done
```

**Alert If**: Queue depth > 100 for > 10 minutes (indicates audit lag)

---

### 3.2 Retry Rate ✅
**Metric**: Percentage of audit logs requiring retry

**Threshold**: `retryRate < 5%` (indicates stable audit database)

**Formula**:
```
retryRate = (retriedCount / totalCount) * 100
```

**Monitoring**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE retry_count > 0) as retried,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retry_count > 0) / COUNT(*), 2) as retry_rate_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Alert If**: Retry rate > 5% for > 1 hour (indicates audit instability)

---

### 3.3 Dead Letter Queue Rate ✅
**Metric**: Percentage of audit logs that failed all retries

**Threshold**: `dlqRate < 1%` (indicates rare unrecoverable failures)

**Monitoring**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE audit_status = 'dead_letter') as dlq,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE audit_status = 'dead_letter') / COUNT(*), 2) as dlq_rate_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Alert If**: DLQ rate > 1% for > 1 hour (indicates systemic audit failure)

---

### 3.4 Decision Error Rate ✅
**Metric**: Percentage of decisions that fail to execute

**Threshold**: `errorRate < 0.1%` (999 success per 1000 requests)

**Monitoring**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE output->>'error' IS NOT NULL) as errors,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE output->>'error' IS NOT NULL) / COUNT(*), 2) as error_rate_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Alert If**: Error rate > 0.1% for > 1 hour

---

### 3.5 Latency (p95, p99) ✅
**Metrics**: 
- p95 latency: 95% of decisions complete within X ms
- p99 latency: 99% of decisions complete within X ms

**Thresholds**:
- `p95 < 200ms`
- `p99 < 500ms`

**Monitoring**:
```sql
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99,
  MAX(execution_time_ms) as max
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Alert If**: p95 > 200ms OR p99 > 500ms for > 15 minutes

---

### 3.6 Circuit Breaker State ✅
**Metric**: Circuit breaker should remain CLOSED under normal conditions

**Threshold**: `circuitState = "CLOSED"` for > 95% of time

**Monitoring**:
```bash
# Log circuit state every minute
while true; do
  curl -s /api/decision-engine/health | jq -r '.decisionEngine.circuitState' >> circuit_state.log
  sleep 60
done
```

**Analysis**:
```bash
# After 72 hours, calculate uptime percentage
total_checks=$(wc -l < circuit_state.log)
closed_count=$(grep -c "CLOSED" circuit_state.log)
uptime_pct=$(echo "scale=2; $closed_count * 100 / $total_checks" | bc)
echo "Circuit Breaker Uptime: $uptime_pct%"
```

**Alert If**: Uptime < 95% (indicates frequent audit failures)

---

### 3.7 Resource Usage ✅
**Metrics**:
- Memory usage
- CPU usage
- Database connection pool

**Thresholds**:
- Memory < 512MB (assuming 1GB limit)
- CPU < 50% average
- DB connections < 80% of pool size

**Monitoring** (Vercel/Railway/Docker):
```bash
# Memory
curl /api/debug/memory

# CPU (if available)
docker stats bella-erp-app --no-stream

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'bella_erp';"
```

**Alert If**: Any metric exceeds threshold for > 30 minutes

---

## Gate 4: Data Quality Validation 📋

**Objective**: Ensure audit data is complete and usable for analytics

**Timeline**: After **500+ decisions** collected (Week 1-2)

**Mandatory Checks**:

### 4.1 Audit Completeness ✅
**All required fields populated:**

```sql
SELECT 
  COUNT(*) FILTER (WHERE decision_id IS NULL) as missing_id,
  COUNT(*) FILTER (WHERE decision_type IS NULL) as missing_type,
  COUNT(*) FILTER (WHERE engine_version IS NULL) as missing_engine_version,
  COUNT(*) FILTER (WHERE policy_version IS NULL) as missing_policy_version,
  COUNT(*) FILTER (WHERE rules_evaluated IS NULL OR rules_evaluated = '[]'::jsonb) as missing_rules,
  COUNT(*) as total
FROM decision_audit_log;
```

**Expected**: ALL counts = 0 (no missing data)

---

### 4.2 Rule Coverage ✅
**Every policy rule triggered at least once:**

```sql
WITH rules_hit AS (
  SELECT DISTINCT jsonb_array_elements_text(rules_evaluated) as rule_id
  FROM decision_audit_log
)
SELECT * FROM rules_hit;
```

**Expected**: All 8 leave approval rules appear:
- `check-leave-balance`
- `check-maximum-duration`
- `check-manager-approval`
- `check-blackout-period-tet`
- `check-blackout-period-high-season`
- `auto-approve-sick-leave`
- `check-consecutive-leave-limit`
- `check-advance-notice`

**Alert If**: Any rule has 0 hits (indicates dead rule or insufficient test coverage)

---

### 4.3 Replay Determinism ✅
**Replayed decisions match original:**

```bash
# Replay random sample of 50 decisions
psql -t -c "SELECT decision_id FROM decision_audit_log ORDER BY RANDOM() LIMIT 50;" | while read id; do
  curl -s POST /api/decision-engine/replay/$id | jq '.match'
done | grep -c "false"
```

**Expected**: Count = 0 (all replays match)

**Alert If**: Any replay mismatch (indicates non-deterministic logic)

---

### 4.4 Trace Completeness ✅
**Every decision has corresponding trace:**

```sql
SELECT 
  COUNT(*) as total_decisions,
  COUNT(DISTINCT correlation_id) as total_traces,
  COUNT(*) - COUNT(DISTINCT correlation_id) as missing_traces
FROM decision_audit_log;
```

**Expected**: `missing_traces = 0`

---

## Go / No-Go Decision Matrix

### Gate 1: Functional (2 hours) → **BLOCKING**
| Check | Required | Actual | Status |
|-------|----------|--------|--------|
| Leave approval works | ✅ | ⬜ | ⏳ |
| Audit persisted | ✅ | ⬜ | ⏳ |
| Replay works | ✅ | ⬜ | ⏳ |
| Trace viewer works | ✅ | ⬜ | ⏳ |
| Health endpoint healthy | ✅ | ⬜ | ⏳ |

**Decision**: If ANY check fails → **NO-GO**, fix and re-test

---

### Gate 2: Failure Injection (24 hours) → **BLOCKING**
| Scenario | Required | Actual | Status |
|----------|----------|--------|--------|
| Decisions succeed when audit DB down | ✅ | ⬜ | ⏳ |
| Audit timeouts handled | ✅ | ⬜ | ⏳ |
| Queue capacity enforced | ✅ | ⬜ | ⏳ |
| Network partition handled | ✅ | ⬜ | ⏳ |
| Policy exceptions caught | ✅ | ⬜ | ⏳ |

**Decision**: If ANY scenario fails → **NO-GO**, diagnose root cause

---

### Gate 3: Operational (72 hours) → **WARNING ONLY**
| Metric | Threshold | Actual | Status |
|--------|-----------|--------|--------|
| Queue depth | < 100 | ⬜ | ⏳ |
| Retry rate | < 5% | ⬜ | ⏳ |
| DLQ rate | < 1% | ⬜ | ⏳ |
| Error rate | < 0.1% | ⬜ | ⏳ |
| p95 latency | < 200ms | ⬜ | ⏳ |
| p99 latency | < 500ms | ⬜ | ⏳ |
| Circuit uptime | > 95% | ⬜ | ⏳ |

**Decision**: If metrics degrade → **INVESTIGATE**, may continue with caution

---

### Gate 4: Data Quality (Week 1-2) → **OBSERVATIONAL**
| Check | Threshold | Actual | Status |
|-------|-----------|--------|--------|
| Audit completeness | 100% | ⬜ | ⏳ |
| Rule coverage | 8/8 rules | ⬜ | ⏳ |
| Replay determinism | 100% match | ⬜ | ⏳ |
| Trace completeness | 100% | ⬜ | ⏳ |

**Decision**: If quality issues found → **NOTE FOR SPRINT 2**, not blocking

---

## Rollback Triggers 🚨

**Immediate Rollback If**:
1. **Business Logic Blocked**: Any decision fails due to audit failure (violates resilience guarantee)
2. **Data Loss**: DLQ rate > 10% (indicates systemic audit failure)
3. **Cascading Failures**: Circuit breaker stuck OPEN for > 1 hour
4. **Performance Degradation**: p95 latency > 1 second for > 30 minutes
5. **Memory Leak**: Memory usage grows unbounded (> 1GB and increasing)

**Rollback Procedure**:
```bash
# 1. Disable feature flag
UPDATE tenant_settings SET settings = settings - 'decision_engine_enabled' WHERE tenant_id = 'staging-tenant';

# 2. Verify decisions no longer routed to engine
curl /api/leave-requests/test/decide
# Should return legacy approval logic result

# 3. Preserve audit data for analysis
pg_dump -t decision_audit_log > rollback_audit_backup.sql

# 4. Document incident
# - What triggered rollback?
# - How many decisions affected?
# - What was root cause?
# - What is mitigation plan?
```

---

## Success Criteria Summary

**Staging PASSES if**:
- ✅ Gate 1 (Functional): 6/6 checks passed
- ✅ Gate 2 (Failure Injection): 5/5 scenarios passed
- ⚠️ Gate 3 (Operational): 7/7 metrics within threshold (warnings acceptable)
- ℹ️ Gate 4 (Data Quality): 4/4 checks passed (observational)

**Production Rollout APPROVED if**:
- Staging passed for 1-2 weeks
- 500-1000 decisions collected
- Zero rollback triggers fired
- Rule coverage > 80%
- Operational team trained on health endpoint

---

**Final Philosophy Check**:
> "Staging không phải là môi trường xem trước. Đây là giai đoạn thu thập bằng chứng."

If you can't prove it with data from staging, don't ship it to production.
