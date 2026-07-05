# Sprint 1A - Production Validation

**Status**: 🔄 In Progress  
**Priority**: **CRITICAL** - Must complete before Sprint 2  
**Philosophy**: "Enterprise software isn't done when code merges, but when it runs reliably with real data."

---

## Why Sprint 1A Exists

Sprint 1 delivered **code**. Sprint 1A delivers **confidence**.

Before building observability dashboards (Sprint 2) or integrating more features, we must validate that the foundation is **production-ready**.

**Key Questions Sprint 1A Answers:**
- ✅ Does audit logging slow down decisions?
- ✅ Can the system handle production load?
- ✅ Are there memory leaks?
- ✅ Does graceful degradation work?
- ✅ Can Ops monitor system health?

---

## Acceptance Criteria

### Performance
- ✅ **Audit overhead < 10%** of execution time
- ✅ **Throughput > 500 decisions/second**
- ✅ **P95 latency < 10ms** for simple decisions
- ✅ **P99 latency < 50ms** for complex decisions

### Reliability
- ✅ **No memory leaks** after 10,000 decisions
- ✅ **Graceful degradation** when audit DB unavailable
- ✅ **100 concurrent decisions** complete in < 1 second
- ✅ **Zero silent failures** (errors logged, not swallowed)

### Observability
- ✅ **Health check endpoint** returns accurate metrics
- ✅ **Trace coverage > 95%** of decisions
- ✅ **Error rate < 1%** in production
- ✅ **Storage growth tracked** and retention planned

---

## Tasks

### Task 1: Run Database Migration ✅
**Status**: Ready to execute  
**File**: `supabase/migrations/20260701000000_decision_engine_audit_log.sql`

```bash
# Apply migration
supabase db push

# Verify tables created
supabase db inspect

# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'decision_audit_log';
```

**Validation**:
- ✅ `decision_audit_log` table exists
- ✅ `policy_versions` table exists
- ✅ Indexes created (GIN on JSONB, composite on tenant_id + created_at)
- ✅ RLS policies active
- ✅ Helper functions available (get_decisions_by_trace, etc.)

---

### Task 2: Benchmark Tests ✅
**Status**: Implemented  
**File**: `src/lib/decision-engine/__tests__/benchmark.test.ts`

**Run benchmarks**:
```bash
# Run all benchmarks
npm test -- benchmark.test.ts --runInBand

# Run with garbage collection tracking
node --expose-gc node_modules/.bin/jest benchmark.test.ts --runInBand
```

**5 Benchmark Tests**:
1. ✅ **Audit Overhead** - Measures difference between with/without audit
2. ✅ **Throughput** - Decisions per second
3. ✅ **Memory Usage** - Checks for leaks after 10K decisions
4. ✅ **Concurrent Load** - 100 concurrent decisions
5. ✅ **Complex Decisions** - Multi-rule policy performance

**Expected Results**:
```
📊 Benchmark Results:
   Without Audit: 4.3ms per decision
   With Audit:    4.9ms per decision
   Overhead:      6.98%
   ✅ PASS: Audit overhead (6.98%) < 10%

   Throughput:    687 decisions/second
   ✅ PASS: Throughput > 500/s

   Memory increase: 12.3 MB (after 10,000 decisions)
   ✅ PASS: No memory leak detected

   100 concurrent decisions: 847ms
   ✅ PASS: < 1000ms

   Complex decisions: 7.2ms average
   ✅ PASS: < 10ms
```

**If benchmarks fail:**
- Overhead > 10% → Investigate fire-and-forget implementation
- Throughput < 500 → Check for synchronous blocking
- Memory leak → Check for event listeners not cleaned up
- Concurrent failures → Check for Promise handling issues

---

### Task 3: Health Check Endpoint ✅
**Status**: Implemented  
**File**: `src/app/api/decision-engine/health/route.ts`

**Test health endpoint**:
```bash
curl http://localhost:3000/api/decision-engine/health | jq
```

**Expected Response**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-06-22T10:00:00.000Z",
  
  "audit": {
    "enabled": true,
    "canWrite": true,
    "lastWrite": "2026-06-22T09:59:58.123Z",
    "avgWriteMs": 1.2
  },

  "metrics": {
    "totalDecisions": 21538,
    "successRate": 99.97,
    "errorRate": 0.03,
    "avgExecutionMs": 3.8,
    "p95ExecutionMs": 7,
    "p99ExecutionMs": 12
  },

  "storage": {
    "totalRecords": 21538,
    "sizeEstimate": "42.19 MB",
    "oldestRecord": "2026-06-20T00:00:00.000Z",
    "retentionDays": 2
  },

  "tracing": {
    "coverage": 99.8,
    "totalTraces": 1247,
    "avgDecisionsPerTrace": 17.2
  },

  "failures": {
    "last1Hour": 2,
    "lastError": "Policy version not found",
    "errorTypes": [
      { "type": "leave-approval", "count": 1 },
      { "type": "discount-approval", "count": 1 }
    ]
  },

  "lastActivities": {
    "lastDecision": "dec_abc123",
    "lastReplay": null,
    "lastTrace": "2026-06-22T09:58:00.000Z"
  }
}
```

**Monitoring Integration**:
```bash
# Add to Prometheus scraper config
- job_name: 'decision-engine'
  metrics_path: '/api/decision-engine/health'
  static_configs:
    - targets: ['bella-erp.com']
```

**Alert Rules**:
```yaml
# Ops team should be alerted if:
- audit.canWrite == false (audit logger broken)
- metrics.errorRate > 1.0 (> 1% errors)
- failures.last1Hour > 100 (spike in failures)
- storage.sizeEstimate > 10 GB (retention needed)
```

---

### Task 4: Retry & Fallback Strategy ⏳
**Status**: To implement  
**Goal**: Ensure audit failures don't break business decisions

**Current Implementation**:
```typescript
// DecisionAuditLogger.ts (Sprint 1)
try {
  const { error } = await this.supabase.from('decision_audit_log').insert(payload);
  if (error) {
    console.error('Failed to persist decision to audit log:', error);
    // ⚠️ No retry, just logs error
  }
} catch (err) {
  console.error('Failed to persist decision to audit log:', err);
  // ⚠️ No retry, just logs error
}
```

**Sprint 1A Enhancement** (with exponential backoff):
```typescript
async logToAuditTrail(context: DecisionContext, result: DecisionResult) {
  const maxRetries = 3;
  const baseDelay = 100; // ms

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { error } = await this.supabase
        .from('decision_audit_log')
        .insert(payload);

      if (!error) {
        return; // Success!
      }

      // If last attempt, log and give up
      if (attempt === maxRetries - 1) {
        console.error('Failed to persist audit log after retries:', error);
        this.emitMetric('audit_failure', { error: error.message });
        return;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (err) {
      console.error(`Audit log attempt ${attempt + 1} failed:`, err);
      if (attempt === maxRetries - 1) {
        this.emitMetric('audit_failure', { error: String(err) });
      }
    }
  }
}
```

**Chaos Test**:
```typescript
// Test that decisions succeed even when audit DB is down
it('should allow decisions when audit logger fails', async () => {
  // Simulate DB failure
  mockSupabase.from().insert.mockRejectedValue(new Error('DB unavailable'));

  const result = await engine.evaluate(context);

  // Decision should still succeed
  expect(result.approved).toBe(true);
  
  // But audit should log failure metric
  expect(mockMetrics).toHaveBeenCalledWith('audit_failure', expect.any(Object));
});
```

---

### Task 5: Load Test ⏳
**Status**: To implement  
**Tool**: [k6](https://k6.io/) or [Artillery](https://artillery.io/)

**Load Test Scenarios**:

**Scenario 1: Steady Load**
```javascript
// load-test/steady-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<10'],  // 95% requests < 10ms
    http_req_failed: ['rate<0.01'],   // < 1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    decisionType: 'leave-approval',
    input: { employeeId: 'emp-123', days: 5 },
    tenantId: 'test-tenant',
  });

  const res = http.post('http://localhost:3000/api/decision-engine/evaluate', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'execution time < 10ms': (r) => r.json('metadata.executionTimeMs') < 10,
  });

  sleep(1);
}
```

**Scenario 2: Spike Load**
```javascript
// Simulate sudden traffic spike
export let options = {
  stages: [
    { duration: '1m', target: 50 },    // Normal load
    { duration: '30s', target: 500 },  // Spike!
    { duration: '1m', target: 50 },    // Back to normal
  ],
};
```

**Run load tests**:
```bash
k6 run load-test/steady-load.js
k6 run load-test/spike-load.js
```

---

### Task 6: Memory Leak Check ⏳
**Status**: Partially covered by benchmarks  
**Tool**: [clinic.js](https://clinicjs.org/) or [heapdump](https://www.npmjs.com/package/heapdump)

**Deep Memory Profiling**:
```bash
# Install clinic.js
npm install -g clinic

# Profile memory during load test
clinic doctor -- node server.js

# Generate heap snapshots
clinic heapprofiler -- node server.js
```

**Manual Heap Snapshot**:
```typescript
// Add to health endpoint (dev only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/heap-snapshot', () => {
    const v8 = require('v8');
    const fs = require('fs');
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const snapshot = v8.writeHeapSnapshot(filename);
    return { snapshot };
  });
}
```

**Analyze with Chrome DevTools**:
1. Take snapshot before load test
2. Run 10,000 decisions
3. Force GC: `global.gc()`
4. Take snapshot after
5. Compare in Chrome DevTools → Memory → Heap Snapshot

---

### Task 7: Retention Strategy ⏳
**Status**: Planning  
**Goal**: Prevent `decision_audit_log` from growing indefinitely

**Retention Policy Options**:

**Option A: Time-based Retention (Recommended)**
```sql
-- Delete decisions older than 90 days
DELETE FROM decision_audit_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Run nightly via cron job
-- crontab: 0 2 * * * psql -c "DELETE FROM decision_audit_log WHERE created_at < NOW() - INTERVAL '90 days'"
```

**Option B: Table Partitioning (Scalable)**
```sql
-- Partition by month
CREATE TABLE decision_audit_log_2026_06 PARTITION OF decision_audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE decision_audit_log_2026_07 PARTITION OF decision_audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Drop old partitions
DROP TABLE decision_audit_log_2026_03; -- Q1 data
```

**Option C: Archive to Cold Storage**
```sql
-- Archive to separate table
INSERT INTO decision_audit_log_archive
SELECT * FROM decision_audit_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Then delete from hot table
DELETE FROM decision_audit_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Recommended Retention**:
- **Hot storage** (PostgreSQL): 90 days
- **Warm storage** (Archive table): 1 year
- **Cold storage** (S3/Glacier): 7 years (compliance)

**Estimated Storage Growth**:
```
1,000 decisions/day × 2 KB/decision × 90 days = 180 MB
10,000 decisions/day × 2 KB/decision × 90 days = 1.8 GB
100,000 decisions/day × 2 KB/decision × 90 days = 18 GB
```

**Monitoring**:
```sql
-- Check storage usage
SELECT 
  pg_size_pretty(pg_total_relation_size('decision_audit_log')) as total_size,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM decision_audit_log;
```

---

## Validation Checklist

Before proceeding to Sprint 1B (Real Integration), verify:

### Performance ✅
- [ ] Benchmark tests pass (overhead < 10%)
- [ ] Load tests pass (P95 < 10ms, error rate < 1%)
- [ ] No memory leaks detected

### Reliability ✅
- [ ] Retry strategy implemented and tested
- [ ] Graceful degradation verified (decisions succeed when audit fails)
- [ ] Concurrent load handled (100+ concurrent requests)

### Observability ✅
- [ ] Health endpoint returns accurate metrics
- [ ] Prometheus/monitoring integrated
- [ ] Alert rules configured

### Operations ✅
- [ ] Migration applied to production
- [ ] Retention strategy documented
- [ ] Backup strategy verified
- [ ] Rollback plan ready

---

## Timeline

**Estimated Duration**: 1-2 days

**Day 1 (Morning)**:
- Task 1: Run migration (30 min)
- Task 2: Run benchmarks (30 min)
- Task 3: Test health endpoint (30 min)

**Day 1 (Afternoon)**:
- Task 4: Implement retry strategy (2 hours)
- Task 5: Load testing (2 hours)

**Day 2 (Morning)**:
- Task 6: Memory profiling (2 hours)
- Task 7: Retention planning (1 hour)

**Day 2 (Afternoon)**:
- Final validation and documentation (2 hours)
- Go/No-Go decision for Sprint 1B

---

## Success Metrics

### Green Light (Proceed to Sprint 1B) ✅
- All benchmarks pass
- Load tests show < 1% error rate
- Health endpoint returns `status: "healthy"`
- No memory leaks detected
- Retry strategy validated

### Yellow Light (Fix issues first) ⚠️
- Benchmarks show overhead 10-15% (acceptable but needs monitoring)
- Load tests show 1-3% error rate (investigate but not blocking)
- Minor memory growth detected (< 100MB after 10K decisions)

### Red Light (Do not proceed) 🚫
- Overhead > 15% (audit logger is too slow)
- Error rate > 5% (reliability issues)
- Memory leak detected (> 100MB growth)
- Graceful degradation broken (decisions fail when audit fails)

---

## Next Steps

After Sprint 1A completion:

✅ **Sprint 1B - Real Integration** (2-3 days)
- Integrate Leave Approval with Decision Engine
- Integrate Discount Approval with Decision Engine
- Collect real audit data for 3-5 days

✅ **Sprint 2 - Observability Dashboard** (1-2 days)
- Build on real data collected in Sprint 1B
- Metrics, heatmaps, trends based on actual usage

---

## Document Version
**Version**: 1.0  
**Last Updated**: June 22, 2026  
**Status**: Sprint 1A In Progress 🔄
