# Gate 3: Operational Stability - 72-Hour Monitoring Guide

**Status**: ⏳ IN PROGRESS (Started: June 22, 2026)

**Objective**: Prove Decision Engine is stable under real workload

**Timeline**: 72 hours continuous monitoring (ends: June 25, 2026 at same time)

**Nature**: WARNING ONLY (metrics can degrade, not blocking deployment)

---

## Quick Start

```bash
# 1. Start monitoring (run in background)
node scripts/gate3-monitor.js > gate3-monitor.log 2>&1 &

# 2. Check current metrics
curl https://bella-spa-erp.vercel.app/api/decision-engine/health | jq '.decisionEngine'

# 3. View monitoring log
tail -f gate3-monitor.log

# 4. Stop monitoring after 72 hours
pkill -f gate3-monitor.js
```

---

## 7 Mandatory Metrics

### 3.1 Queue Health 📊

**Metric**: Audit Queue Depth  
**Threshold**: `auditQueueDepth < 100` at all times (except during failure tests)  
**Current Status**: ⬜ MONITORING

**Query**:
```bash
curl -s https://bella-spa-erp.vercel.app/api/decision-engine/health | jq '.auditQueue.pending'
```

**Expected**: 0-10 under normal load

**Alert If**: Queue depth > 100 for > 10 consecutive minutes (indicates audit lag)

**What It Means**:
- **0-10**: ✅ Healthy - audit keeping pace with decisions
- **10-50**: ⚠️ Warning - audit slightly behind, queue building
- **50-100**: 🔶 Degraded - audit lagging, investigate cause
- **>100**: 🚨 Critical - audit severely lagging, may need scaling

**Common Causes**:
- Audit database slow queries
- Network latency to database
- Insufficient processing interval

**Mitigation**:
- Reduce `processingIntervalMs` (currently 100ms → try 50ms)
- Scale audit database
- Add database indexes on `decision_id`, `decision_timestamp`

---

### 3.2 Retry Rate 🔄

**Metric**: Percentage of audit logs requiring retry  
**Threshold**: `retryRate < 5%`  
**Current Status**: ⬜ MONITORING

**Query (SQL)**:
```sql
-- Run every hour
SELECT 
  COUNT(*) FILTER (WHERE retry_count > 0) as retried,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retry_count > 0) / COUNT(*), 2) as retry_rate_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Expected**: 0-2%

**Alert If**: Retry rate > 5% for > 1 hour (indicates audit instability)

**What It Means**:
- **0-2%**: ✅ Healthy - rare transient failures
- **2-5%**: ⚠️ Warning - increased audit failures, watch closely
- **5-10%**: 🔶 Degraded - significant audit issues
- **>10%**: 🚨 Critical - systemic audit failure

**Common Causes**:
- Database connection pool exhaustion
- Network instability
- Database maintenance windows
- Lock contention on audit table

**Mitigation**:
- Increase database connection pool size
- Add database read replicas
- Optimize audit INSERT query
- Consider batching audit writes

---

### 3.3 Dead Letter Queue Rate ☠️

**Metric**: Percentage of audit logs that failed all retries  
**Threshold**: `dlqRate < 1%`  
**Current Status**: ⬜ MONITORING

**Query (SQL)**:
```sql
-- Run every hour
SELECT 
  (SELECT COUNT(*) FROM audit_dlq WHERE created_at > NOW() - INTERVAL '1 hour') as dlq_count,
  (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour') as total_decisions,
  ROUND(100.0 * (SELECT COUNT(*) FROM audit_dlq WHERE created_at > NOW() - INTERVAL '1 hour') / 
               (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour'), 4) as dlq_rate_pct;
```

**Or via health endpoint**:
```bash
curl -s https://bella-spa-erp.vercel.app/api/decision-engine/health | jq '.auditQueue.deadLetters'
```

**Expected**: 0

**Alert If**: DLQ rate > 1% for > 1 hour (indicates unrecoverable audit failures)

**What It Means**:
- **0%**: ✅ Healthy - all audits eventually succeed
- **0-0.5%**: ⚠️ Warning - rare unrecoverable failures
- **0.5-1%**: 🔶 Degraded - multiple unrecoverable failures
- **>1%**: 🚨 Critical - systemic unrecoverable failures

**Common Causes**:
- Data format errors (schema mismatch)
- Database constraints violated (e.g., duplicate keys)
- Permanent network issues
- Database in read-only mode

**Mitigation**:
- Review DLQ items manually: `SELECT * FROM audit_dlq LIMIT 10;`
- Fix schema issues or data validation
- Retry DLQ items after fixes
- Clear DLQ if items are corrupted beyond repair

---

### 3.4 Decision Error Rate ❌

**Metric**: Percentage of decisions that fail to execute  
**Threshold**: `errorRate < 0.1%` (999 successes per 1000 requests)  
**Current Status**: ⬜ MONITORING

**Query (SQL)**:
```sql
-- Run every hour
SELECT 
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 4) as error_rate_pct
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

**Expected**: 0%

**Alert If**: Error rate > 0.1% for > 1 hour

**What It Means**:
- **0%**: ✅ Healthy - all decisions execute successfully
- **0-0.05%**: ⚠️ Warning - rare decision failures
- **0.05-0.1%**: 🔶 Degraded - increased decision failures
- **>0.1%**: 🚨 Critical - systemic decision failures

**Common Causes**:
- Policy code bugs
- Missing data in context
- Database read failures (fetching employee data)
- Network timeouts to external services

**Mitigation**:
- Review error logs: `SELECT * FROM decision_audit_log WHERE status = 'error' ORDER BY decision_timestamp DESC LIMIT 10;`
- Fix policy bugs
- Add defensive null checks
- Improve error handling in integrations

---

### 3.5 Latency (p95, p99) ⚡

**Metrics**:
- **p95 latency**: 95% of decisions complete within X ms
- **p99 latency**: 99% of decisions complete within X ms

**Thresholds**:
- `p95 < 200ms`
- `p99 < 500ms`

**Current Status**: ⬜ MONITORING

**Query (SQL)**:
```sql
-- Run every 15 minutes
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99,
  MAX(execution_time_ms) as max,
  COUNT(*) as sample_size
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '15 minutes';
```

**Expected**:
- p50: 50-100ms
- p95: 100-150ms
- p99: 150-300ms

**Alert If**: p95 > 200ms OR p99 > 500ms for > 15 minutes

**What It Means**:
- **p95 < 150ms**: ✅ Healthy - fast decisions
- **p95 150-200ms**: ⚠️ Warning - slight slowdown
- **p95 200-500ms**: 🔶 Degraded - significant slowdown
- **p95 > 500ms**: 🚨 Critical - very slow decisions

**Common Causes**:
- Database slow queries (check `pg_stat_statements`)
- Network latency spikes
- CPU throttling (serverless cold starts)
- External API timeouts

**Mitigation**:
- Optimize database queries (add indexes)
- Cache frequently accessed data
- Pre-warm serverless functions
- Add request timeouts
- Consider caching policy results for identical contexts

---

### 3.6 Circuit Breaker State 🔌

**Metric**: Circuit breaker should remain CLOSED under normal conditions  
**Threshold**: `circuitState = "CLOSED"` for > 95% of time  
**Current Status**: ⬜ MONITORING

**Query**:
```bash
curl -s https://bella-spa-erp.vercel.app/api/decision-engine/health | jq -r '.auditQueue.circuitBreaker'
```

**Expected**: `CLOSED`

**Alert If**: Uptime < 95% over 72 hours (indicates frequent audit failures)

**States**:
- **CLOSED**: ✅ Normal operation, audit writes succeeding
- **OPEN**: 🚨 Circuit tripped, audit writes blocked (queuing only)
- **HALF_OPEN**: ⚡ Testing recovery, allowing 1 request through

**What It Means**:
- **95-100% CLOSED**: ✅ Healthy - audit infrastructure stable
- **90-95% CLOSED**: ⚠️ Warning - occasional audit issues
- **80-90% CLOSED**: 🔶 Degraded - frequent audit failures
- **<80% CLOSED**: 🚨 Critical - systemic audit instability

**Common Causes**:
- Database connection failures
- Database overload (CPU/memory)
- Network partition
- Database maintenance

**Mitigation**:
- Scale audit database vertically
- Add database read replicas
- Increase circuit breaker threshold (currently 5 failures → try 10)
- Reduce circuit breaker timeout (currently 10s → try 5s)

**Manual Reset**:
```bash
# If circuit is stuck OPEN, manually reset via health endpoint
curl -X POST https://bella-spa-erp.vercel.app/api/decision-engine/audit/reset-circuit
```

---

### 3.7 Resource Usage 💾

**Metrics**:
- Memory usage
- CPU usage (if measurable)
- Database connection pool

**Thresholds**:
- Memory < 512MB (assuming 1GB limit)
- CPU < 50% average
- DB connections < 80% of pool size (e.g., < 16 if pool size is 20)

**Current Status**: ⬜ MONITORING

**Query (Vercel/Memory)**:
```bash
# Check Vercel function memory usage (if available in logs)
vercel logs --follow | grep "Memory"

# Or check via health endpoint (if implemented)
curl -s https://bella-spa-erp.vercel.app/api/decision-engine/health | jq '.resources'
```

**Query (Database Connections)**:
```sql
-- Run every 5 minutes
SELECT 
  count(*) as active_connections,
  max_conn.setting::int as max_connections,
  ROUND(100.0 * count(*) / max_conn.setting::int, 1) as usage_pct
FROM pg_stat_activity,
     (SELECT setting FROM pg_settings WHERE name = 'max_connections') max_conn
WHERE datname = 'postgres' AND state = 'active'
GROUP BY max_conn.setting;
```

**Expected**:
- Memory: 100-300MB
- CPU: 10-30% average
- DB connections: 2-10 active

**Alert If**:
- Memory > 512MB for > 30 minutes
- CPU > 50% for > 30 minutes
- DB connections > 80% of pool for > 10 minutes

**What It Means**:
- **Memory growing**: Possible memory leak in queue
- **High CPU**: Inefficient policy logic or hot loop
- **High DB connections**: Connection pool exhaustion

**Mitigation**:
- Memory: Review queue max size, check for unbounded arrays
- CPU: Profile policy code, optimize hot paths
- DB: Increase pool size or reduce connection lifetime

---

## Monitoring Dashboard (SQL Queries)

### Real-Time Health Check
```sql
-- Run every 5 minutes
SELECT 
  NOW() as check_time,
  
  -- Queue metrics
  (SELECT COUNT(*) FROM audit_queue WHERE status = 'pending') as queue_pending,
  (SELECT COUNT(*) FROM audit_queue WHERE status = 'processing') as queue_processing,
  (SELECT COUNT(*) FROM audit_queue WHERE status = 'failed') as queue_failed,
  (SELECT COUNT(*) FROM audit_dlq) as dlq_size,
  
  -- Decision metrics (last hour)
  (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour') as decisions_last_hour,
  (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour' AND status = 'error') as errors_last_hour,
  
  -- Latency (last hour)
  (SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour') as p95_latency,
  (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour') as p99_latency,
  
  -- Retry metrics
  (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour' AND retry_count > 0) as retried_audits,
  ROUND(100.0 * (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour' AND retry_count > 0) / 
               (SELECT COUNT(*) FROM decision_audit_log WHERE decision_timestamp > NOW() - INTERVAL '1 hour'), 2) as retry_rate_pct;
```

### Hourly Summary Report
```sql
-- Run every hour, save to CSV for trend analysis
SELECT 
  date_trunc('hour', decision_timestamp) as hour,
  
  COUNT(*) as total_decisions,
  COUNT(*) FILTER (WHERE status = 'success') as successes,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate_pct,
  
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY execution_time_ms) as p50_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_latency,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99_latency,
  MAX(execution_time_ms) as max_latency,
  
  COUNT(*) FILTER (WHERE retry_count > 0) as retried_audits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retry_count > 0) / COUNT(*), 2) as retry_rate_pct
  
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '72 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## Alert Configuration

### Slack/Email Alert Script (Pseudo-code)
```javascript
// Run every 5 minutes via cron
const health = await fetch('/api/decision-engine/health').then(r => r.json());

// Alert 1: Queue depth
if (health.auditQueue.pending > 100) {
  alert('🚨 Gate 3: Queue depth exceeded 100', {
    current: health.auditQueue.pending,
    threshold: 100,
    severity: 'warning'
  });
}

// Alert 2: Circuit breaker open
if (health.auditQueue.circuitBreaker === 'OPEN') {
  alert('🚨 Gate 3: Circuit breaker OPEN', {
    state: 'OPEN',
    severity: 'critical'
  });
}

// Alert 3: DLQ growing
if (health.auditQueue.deadLetters > 10) {
  alert('⚠️ Gate 3: Dead letter queue growing', {
    current: health.auditQueue.deadLetters,
    threshold: 10,
    severity: 'warning'
  });
}

// Alert 4: Error rate (requires SQL query)
const errorRate = await querySQL('SELECT ... FROM decision_audit_log ...');
if (errorRate > 0.1) {
  alert('🚨 Gate 3: Decision error rate exceeded 0.1%', {
    current: errorRate,
    threshold: 0.1,
    severity: 'critical'
  });
}
```

---

## 72-Hour Checklist

### Day 1 (Hours 0-24)
- [x] Start monitoring script
- [ ] Verify all 7 metrics collecting data
- [ ] Check health endpoint every 6 hours
- [ ] Review first 24-hour summary report
- [ ] Document any alerts fired

### Day 2 (Hours 24-48)
- [ ] Check for metric trends (improving/degrading)
- [ ] Verify queue drain working correctly
- [ ] Review retry rate stability
- [ ] Check circuit breaker uptime
- [ ] Document any anomalies

### Day 3 (Hours 48-72)
- [ ] Generate final 72-hour report
- [ ] Calculate metric averages and p99s
- [ ] Check all 7 thresholds met
- [ ] Document Gate 3 completion status
- [ ] Decide: PASS (with warnings) or investigate

---

## Gate 3 Completion Criteria

**Status**: ⬜ NOT STARTED (End time: TBD)

**Pass Criteria** (WARNING ONLY):
- ✅ All 7 metrics tracked for full 72 hours
- ⚠️ Thresholds may be exceeded (warnings logged, not blocking)
- ✅ No rollback triggers fired
- ✅ System remained operational throughout

**Expected Outcome**:
- Gate 3 will likely have **warnings** (this is normal for first production deployment)
- Warnings guide optimization in Sprint 2
- Gate 3 does NOT block Gate 4 or production rollout

**Report Generation**:
After 72 hours, run:
```bash
node scripts/gate3-generate-report.js > docs/decision-engine/GATE3_COMPLETION_REPORT.md
```

---

## Next Steps After Gate 3

1. **If Gate 3 PASSES (with warnings)**:
   - Proceed to Gate 4 (Data Quality - observational)
   - Continue collecting 500-1000 decisions
   - Use warnings to prioritize Sprint 2 optimizations

2. **If multiple CRITICAL alerts**:
   - Investigate root causes
   - May extend monitoring to 96 hours
   - Consider infrastructure scaling before Gate 4

3. **Either way**:
   - Gate 3 is NOT blocking
   - Focus shifts to Gate 4 (data quality checks)
   - Operations Console (Sprint 2) will address warnings

---

**Philosophy Reminder**:

> Gate 3 is about **learning** the system's operational behavior, not perfecting it.  
> Warnings are expected. Catastrophic failures are not.

**Started**: June 22, 2026  
**Ends**: June 25, 2026 (same time)  
**Status**: ⏳ MONITORING IN PROGRESS
