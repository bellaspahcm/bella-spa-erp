# Staging Deployment Plan

**Status**: 📋 Ready to Execute  
**Date**: June 22, 2026  
**Duration**: 1-2 weeks data collection  
**Goal**: Validate Decision Engine with real leave approval workflow

---

## Deployment Strategy: Canary Pattern

> **"One workflow, one environment, full monitoring"**

**What**:
- Deploy Decision Engine to **staging only**
- Enable **Leave Approval only** (not Discount, Booking, etc.)
- Monitor for **1-2 weeks**
- Collect **500-1000 decisions**

**Why**:
- Validate resilience with real load
- Collect audit data for Sprint 2 dashboard
- Test Time Machine with real replays
- Measure actual performance metrics
- Identify edge cases

---

## Pre-Deployment Checklist

### Code Freeze ✅
- [ ] All tests passing (26/26)
- [ ] Pre-deployment validation complete
- [ ] No pending critical bugs
- [ ] Documentation updated
- [ ] Rollback plan ready

### Infrastructure ✅
- [ ] Database migration ready
- [ ] Environment variables configured
- [ ] Health endpoint accessible
- [ ] Monitoring configured
- [ ] Alert rules defined

### Team Readiness ✅
- [ ] Ops team briefed
- [ ] Runbook shared
- [ ] On-call schedule defined
- [ ] Rollback procedure documented

---

## Deployment Steps

### Step 1: Database Migration (5 min)
```bash
# Connect to staging database
supabase link --project-ref staging-project-id

# Apply migration
supabase db push

# Verify tables created
supabase db inspect | grep decision_audit_log
supabase db inspect | grep policy_versions

# Verify indexes
psql staging -c "\d decision_audit_log"

# Expected: 
# - decision_audit_log table
# - policy_versions table
# - GIN indexes on JSONB columns
# - Composite indexes on tenant_id + created_at
```

**Validation**:
```bash
# Query test
psql staging -c "SELECT COUNT(*) FROM decision_audit_log;"
# Expected: 0 (empty table)
```

---

### Step 2: Deploy Application (10 min)
```bash
# Build production bundle
npm run build

# Deploy to staging (Vercel/Docker/K8s)
# Method depends on infrastructure

# Verify deployment
curl https://staging.bella.com/api/health
# Expected: 200 OK

# Verify health endpoint
curl https://staging.bella.com/api/decision-engine/health | jq
# Expected: status="healthy"
```

---

### Step 3: Smoke Tests (15 min)

**Test 1: Health Check**
```bash
curl https://staging.bella.com/api/decision-engine/health | jq '{
  status: .status,
  circuit: .circuitBreaker.state,
  queue: .auditQueue.pending
}'

# Expected:
# {
#   "status": "healthy",
#   "circuit": "CLOSED",
#   "queue": 0
# }
```

**Test 2: Create Test Leave Request**
```bash
# Create via staging UI or API
POST https://staging.bella.com/api/leave-requests
{
  "employee_id": "test-emp-001",
  "leave_type": "annual",
  "start_date": "2026-07-15",
  "end_date": "2026-07-19",
  "days": 5,
  "reason": "Test leave"
}
```

**Test 3: Approve via Decision Engine**
```bash
curl -X POST https://staging.bella.com/api/leave-requests/req-test-001/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer STAGING_TOKEN" \
  -d '{"action": "approve"}' | jq

# Expected:
# {
#   "success": true,
#   "approved": true,
#   "reason": "All approval criteria met",
#   "decisionId": "dec_...",
#   "metadata": {
#     "confidence": 0.95,
#     "executionTimeMs": 42
#   }
# }
```

**Test 4: Verify Audit Log**
```bash
curl https://staging.bella.com/api/decision-engine/audit?decisionType=leave-request-approval | jq

# Expected: 1 decision logged
```

**Test 5: Chaos Test (Optional)**
```bash
# Temporarily kill audit DB connection
# Make decision - should still succeed
# Verify circuit opens
# Restore connection
# Verify circuit closes
```

---

### Step 4: Enable for Real Users (Gradual)

**Phase 4A: Internal Testing (Day 1-2)**
- Enable for **internal team only** (5-10 people)
- Process ~10-20 leave requests per day
- Monitor closely

**Phase 4B: Limited Rollout (Day 3-5)**
- Enable for **1 tenant** (pilot spa)
- Process ~50-100 requests
- Gather feedback

**Phase 4C: Full Staging (Day 6-14)**
- Enable for **all staging tenants**
- Process ~500-1000 requests
- Collect production-like data

---

## Monitoring Plan

### Daily Health Checks

**Morning Check (9:00 AM)**:
```bash
#!/bin/bash
# morning-check.sh

echo "=== Decision Engine Health Check ==="
curl -s https://staging.bella.com/api/decision-engine/health | jq '{
  status: .status,
  uptime: .decisionEngine.uptime,
  circuit: .circuitBreaker.state,
  queuePending: .auditQueue.pending,
  queueDLQ: .auditQueue.deadLetters,
  totalDecisions: .metrics.totalDecisions,
  successRate: .metrics.successRate,
  errorRate: .metrics.errorRate,
  avgExecutionMs: .metrics.avgExecutionMs,
  p95ExecutionMs: .metrics.p95ExecutionMs
}'
```

**Expected Output**:
```json
{
  "status": "healthy",
  "uptime": 86400,
  "circuit": "CLOSED",
  "queuePending": 0,
  "queueDLQ": 0,
  "totalDecisions": 47,
  "successRate": 100,
  "errorRate": 0,
  "avgExecutionMs": 4.2,
  "p95ExecutionMs": 7
}
```

---

### Real-Time Alerts

**Slack/Email Alerts**:
```yaml
# Alert rules (Prometheus/Datadog/CloudWatch)

- alert: DecisionEngineCircuitOpen
  expr: decision_engine_circuit_state == 1  # 1 = OPEN
  for: 5m
  severity: critical
  message: "Decision Engine circuit breaker OPEN"

- alert: DecisionEngineHighErrorRate
  expr: decision_engine_error_rate > 1.0  # > 1%
  for: 10m
  severity: warning
  message: "Decision Engine error rate: {{ $value }}%"

- alert: DecisionEngineQueueBacklog
  expr: decision_engine_queue_pending > 1000
  for: 5m
  severity: warning
  message: "Decision Engine queue backlog: {{ $value }}"

- alert: DecisionEngineDLQGrowing
  expr: decision_engine_dlq_size > 10
  for: 15m
  severity: warning
  message: "Decision Engine DLQ size: {{ $value }}"
```

---

### Weekly Report

**Every Monday Morning**:
```bash
# Generate weekly report
curl https://staging.bella.com/api/decision-engine/health | jq > weekly-report.json

# Key metrics to review:
# - Total decisions this week
# - Success rate trend
# - Error rate trend
# - Average execution time
# - P95/P99 latency
# - Circuit breaker uptime
# - Queue/DLQ statistics
```

**Sample Report**:
```
Decision Engine Weekly Report (June 15-22, 2026)

Total Decisions: 687
Success Rate: 99.7%
Error Rate: 0.3%
Average Execution: 4.5ms
P95 Latency: 8ms
P99 Latency: 15ms

Circuit Breaker Uptime: 100%
Queue Pending (Avg): 0
DLQ Items: 0

Top Rules Matched:
1. Default Approve: 520 (75.7%)
2. Sick Leave Auto: 98 (14.3%)
3. Leave Balance Check: 42 (6.1%)
4. Tet Blackout: 15 (2.2%)
5. Manager Approval: 12 (1.7%)

Status: ✅ HEALTHY
```

---

## Success Criteria (After 1 Week)

### Quantitative Metrics ✅
- [ ] 500+ decisions processed
- [ ] Success rate > 99%
- [ ] Error rate < 1%
- [ ] Circuit breaker CLOSED 100% of time
- [ ] Average execution < 10ms
- [ ] P95 latency < 10ms
- [ ] P99 latency < 50ms
- [ ] Queue pending < 100 (avg)
- [ ] DLQ size = 0

### Qualitative Feedback ✅
- [ ] No user complaints about slowness
- [ ] Decision reasons clear to managers
- [ ] No data integrity issues
- [ ] Ops team confident in monitoring
- [ ] No unexpected behaviors

### Data Quality ✅
- [ ] All decisions in audit log
- [ ] Correlation IDs working
- [ ] Time Machine replay tested
- [ ] Trace viewer validated
- [ ] Rule coverage measured

---

## Rollback Plan

### Trigger Conditions

🚨 **IMMEDIATE ROLLBACK** if:
- Circuit breaker stuck OPEN > 10 minutes
- Error rate > 5%
- User workflows blocked
- Data corruption detected
- System downtime

### Rollback Steps

**Step 1: Disable Decision Engine (2 min)**
```typescript
// src/services/leave/leave-decision-service.ts

// Comment out Decision Engine call
// const decision = await this.engine.evaluate(context);

// Revert to hardcoded logic
const approved = employee.leaveBalance >= request.days 
  && request.days <= 30
  && (request.days <= 5 || approverRole === 'manager');

return {
  success: true,
  approved,
  reason: approved ? 'Approved' : 'Rejected',
};
```

**Step 2: Deploy Rollback (5 min)**
```bash
# Revert to previous version
git revert HEAD
npm run build
# Deploy
```

**Step 3: Verify Rollback (5 min)**
```bash
# Test leave approval
curl -X POST https://staging.bella.com/api/leave-requests/req-001/decide \
  -d '{"action": "approve"}'

# Should work without Decision Engine
```

**Step 4: Incident Report (30 min)**
```markdown
# Incident Report

Date: 2026-06-22
Duration: 15 minutes
Severity: P1
Impact: Leave approvals blocked

Root Cause: [TBD]
Resolution: Rolled back to hardcoded logic

Action Items:
- [ ] Fix root cause
- [ ] Add more tests
- [ ] Update monitoring
- [ ] Re-deploy when ready
```

---

## Post-Deployment Activities

### Week 1: Active Monitoring
- Daily health checks
- Real-time alert monitoring
- User feedback collection
- Performance analysis

### Week 2: Data Analysis
- Rule coverage analysis
- Confidence distribution
- Execution time patterns
- Error analysis
- Replay validation

### Week 3: Reporting
- Generate comprehensive report
- Share with stakeholders
- Decision: Proceed to Sprint 2 or iterate

---

## Next Steps After Success

If all success criteria met:

1. ✅ **Code Merge** - Merge to main branch
2. ✅ **Production Deployment** - Deploy to production (gradual)
3. ✅ **Sprint 2 Kickoff** - Build Observability Dashboard
4. ✅ **Time Machine Validation** - Replay 1000 decisions
5. ✅ **Documentation** - Update with production insights

---

**Document Version**: 1.0  
**Last Updated**: June 22, 2026  
**Status**: Ready to Deploy 📋
