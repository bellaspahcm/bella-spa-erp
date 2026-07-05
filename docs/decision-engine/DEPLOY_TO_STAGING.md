# Deploy Decision Engine to Staging - Quick Reference

**Date**: June 22, 2026  
**Status**: ✅ READY

---

## Pre-Flight Checklist

- [x] Phase 0 resilience tests passed (9/9)
- [x] Critical bug fixed (`await createClient()`)
- [x] Version metadata enforced
- [x] API contract frozen (v1.0.0)
- [x] Production gates documented
- [x] Rollback procedure ready

---

## Step 1: Database Migration

```bash
# Connect to staging database
export STAGING_DB_URL="postgresql://user:pass@staging-db.supabase.co:5432/bella_erp"

# Apply migration
supabase db push --db-url=$STAGING_DB_URL

# Verify tables created
psql $STAGING_DB_URL <<EOF
\d decision_audit_log
\d policy_versions
EOF
```

**Expected Output**:
```
Table "public.decision_audit_log"
 Column               | Type                     
----------------------+--------------------------
 id                   | uuid                     
 decision_id          | text                     
 decision_type        | text                     
 provider             | text                     
 execution_time_ms    | integer                  
 status               | text                     
 version_snapshot     | jsonb                    
 ...
```

---

## Step 2: Deploy Application

```bash
# Ensure you're on main branch with latest changes
git status
git pull origin main

# Deploy to staging (example: Vercel)
vercel deploy --prod --env staging

# Or Railway
railway up --environment staging

# Or manual
npm run build
pm2 restart bella-erp-staging
```

**Verify Deployment**:
```bash
# Check health endpoint
curl https://staging.bella-erp.com/api/decision-engine/health | jq

# Expected:
# {
#   "status": "healthy",
#   "decisionEngine": {
#     "version": "1.0.0",
#     "circuitState": "CLOSED",
#     "auditQueueDepth": 0
#   }
# }
```

---

## Step 3: Enable Feature Flag

```bash
# Connect to staging database
psql $STAGING_DB_URL

# Enable Decision Engine for staging tenant
UPDATE tenant_settings 
SET settings = settings || '{"decision_engine_enabled": true}'::jsonb
WHERE tenant_id = 'staging-tenant-001';

# Verify
SELECT tenant_id, settings->>'decision_engine_enabled' 
FROM tenant_settings 
WHERE tenant_id = 'staging-tenant-001';
```

---

## Step 4: Smoke Test

```bash
# Test leave approval decision
curl -X POST https://staging.bella-erp.com/api/leave-requests/test-001/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -d '{
    "approverId": "mgr-001",
    "approverRole": "manager",
    "tenantId": "staging-tenant-001"
  }' | jq

# Expected: HTTP 200 with decision result
```

**Verify Audit Log**:
```bash
# Check audit trail
curl https://staging.bella-erp.com/api/decision-engine/audit?limit=1 \
  -H "Authorization: Bearer $STAGING_TOKEN" | jq

# Verify version metadata present:
# {
#   "decisions": [{
#     "engineVersion": "1.0.0",
#     "policyVersion": "leave-policy@1.0.0"
#   }]
# }
```

---

## Step 5: Run Gate 1 (Functional Validation)

### Scenario 1: Approve with Sufficient Balance
```bash
# Setup: Create employee with 12 days balance, 5-day leave request
# Then approve:
curl -X POST https://staging.bella-erp.com/api/leave-requests/{id}/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -d '{
    "approverId": "mgr-001",
    "approverRole": "manager",
    "tenantId": "staging-tenant-001"
  }' | jq

# Expected: { "approved": true, "confidence": 0.95 }
```

### Scenario 2: Reject - Insufficient Balance
```bash
# Setup: Employee with 3 days balance, 5-day request
# Expected: { "approved": false, "reason": "Insufficient leave balance" }
```

### Scenario 3: Reject - Excessive Duration
```bash
# Setup: 45-day request (max 30 days)
# Expected: { "approved": false, "reason": "exceeds maximum allowed" }
```

### Scenario 4: Reject - Manager Approval Required
```bash
# Setup: 7-day request, approver role="staff"
# Expected: { "approved": false, "requiresEscalation": true }
```

### Scenario 5: Reject - Blackout Period
```bash
# Setup: Start date during Tet 2026 (Jan 25-Feb 2)
# Expected: { "approved": false, "blackoutPeriod": "tet-2026" }
```

### Scenario 6: Auto-Approve - Sick Leave
```bash
# Setup: Sick leave, 2 days
# Expected: { "approved": true, "autoApproved": true }
```

**Pass Criteria**: 6/6 scenarios work correctly ✅

---

## Step 6: Monitor Health

```bash
# Poll health endpoint every 30 seconds
while true; do
  echo "=== $(date) ==="
  curl -s https://staging.bella-erp.com/api/decision-engine/health | jq '.decisionEngine | {
    circuitState,
    auditQueueDepth,
    retryRate,
    dlqRate
  }'
  sleep 30
done
```

**Expected Output**:
```json
{
  "circuitState": "CLOSED",
  "auditQueueDepth": 0,
  "retryRate": 0.01,
  "dlqRate": 0
}
```

**Alert If**:
- `circuitState` != "CLOSED"
- `auditQueueDepth` > 100
- `retryRate` > 0.05
- `dlqRate` > 0.01

---

## Step 7: Validate Audit Data

```bash
# Query audit logs
psql $STAGING_DB_URL <<EOF
SELECT 
  decision_id,
  decision_type,
  status,
  version_snapshot->>'engineVersion' as engine_version,
  version_snapshot->'policyVersions'->>'leave-policy' as policy_version,
  execution_time_ms,
  decision_timestamp
FROM decision_audit_log
ORDER BY decision_timestamp DESC
LIMIT 10;
EOF
```

**Verify**:
- [x] `engine_version` = "1.0.0"
- [x] `policy_version` = "leave-policy@1.0.0" (or similar)
- [x] All required fields populated

---

## Rollback Procedure (If Needed)

### Immediate Rollback
```bash
# 1. Disable feature flag
psql $STAGING_DB_URL <<EOF
UPDATE tenant_settings 
SET settings = settings - 'decision_engine_enabled'
WHERE tenant_id = 'staging-tenant-001';
EOF

# 2. Verify fallback to legacy logic
curl -X POST https://staging.bella-erp.com/api/leave-requests/test/decide \
  -H "Authorization: Bearer $STAGING_TOKEN" | jq

# Should return legacy approval response (no decisionId)

# 3. Preserve audit data
pg_dump -t decision_audit_log $STAGING_DB_URL > \
  rollback-$(date +%Y%m%d-%H%M%S).sql

# 4. Document incident
echo "Rollback at $(date)" >> docs/incidents/staging-rollback.log
```

### When to Rollback
1. Business logic blocked (decisions fail due to audit)
2. DLQ rate > 10% (audit failing repeatedly)
3. Circuit breaker stuck OPEN > 1 hour
4. p95 latency > 1 second for > 30 minutes
5. Critical bug discovered

---

## Post-Deployment Monitoring

### Day 1 Checklist
- [ ] All Gate 1 scenarios passed
- [ ] Audit logs contain version metadata
- [ ] Health endpoint shows healthy state
- [ ] No errors in application logs

### Week 1 Goals
- [ ] Collect 200+ decisions
- [ ] Run Gate 2 (failure injection)
- [ ] Monitor operational metrics (Gate 3)
- [ ] Check rule coverage

### Week 2 Goals
- [ ] Hit 500+ decision target
- [ ] Validate data quality (Gate 4)
- [ ] Prepare Sprint 2 with real data

---

## Analytics Queries

### Decision Volume
```sql
SELECT 
  DATE(decision_timestamp) as date,
  COUNT(*) as decisions,
  COUNT(*) FILTER (WHERE status = 'success') as success,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  AVG(confidence_score) as avg_confidence,
  AVG(execution_time_ms) as avg_latency_ms
FROM decision_audit_log
WHERE decision_type = 'leave-request-approval'
GROUP BY date
ORDER BY date DESC;
```

### Rule Hit Distribution
```sql
SELECT 
  jsonb_array_elements_text(policies_executed) as rule_id,
  COUNT(*) as hits,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM decision_audit_log
WHERE decision_type = 'leave-request-approval'
GROUP BY rule_id
ORDER BY hits DESC;
```

### Latency Percentiles
```sql
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99,
  MAX(execution_time_ms) as max
FROM decision_audit_log
WHERE decision_timestamp > NOW() - INTERVAL '1 hour';
```

---

## Troubleshooting

### Issue: Health endpoint returns 500
**Cause**: Database connection issue  
**Fix**: Check `STAGING_DB_URL` environment variable

### Issue: Decisions fail with "supabase.from is not a function"
**Cause**: Bug not fixed OR deployment didn't pick up latest code  
**Fix**: 
```bash
git log -1 --oneline src/services/leave/leave-decision-service.ts
# Should show: "fix: add await to createClient()"
```

### Issue: Audit logs missing version_snapshot
**Cause**: Old code deployed  
**Fix**: Redeploy with latest ResilientDecisionAuditLogger.ts

### Issue: Circuit breaker stuck OPEN
**Cause**: Audit database down OR network issue  
**Check**:
```bash
psql $STAGING_DB_URL -c "SELECT 1;"
```

---

## Success Metrics

### After 24 Hours
- [ ] Gate 1 passed (6/6 functional checks)
- [ ] Gate 2 passed (5/5 chaos scenarios)
- [ ] 10+ real decisions collected
- [ ] Zero rollback triggers

### After 1 Week
- [ ] 200+ decisions collected
- [ ] Gate 3 metrics within threshold
- [ ] Rule coverage > 50%
- [ ] No critical incidents

### After 2 Weeks
- [ ] 500+ decisions collected
- [ ] Gate 4 data quality checks passed
- [ ] Ready for Sprint 2 (dashboard with real data)

---

## Contact & Support

**Staging Issues**:
- Engineering Lead: [email]
- On-Call: [phone]
- Slack: #decision-engine-staging

**Escalation**:
- Immediate rollback authority: Engineering Lead
- Incident response: Create ticket in #decision-engine-staging

---

## Next Steps After Validation

1. **Analyze Data** (Week 2):
   - Run all analytics queries
   - Generate rule coverage report
   - Identify dead rules
   - Check replay determinism

2. **Plan Sprint 2** (Week 3):
   - Design dashboard based on REAL data patterns
   - Prioritize features based on actual usage
   - Define KPIs from operational metrics

3. **Production Rollout** (Week 4+):
   - Only after staging validates successfully
   - Gradual rollout: 1 tenant → 10 tenants → all
   - Monitor same metrics as staging

---

**Deployment Status**: Ready to execute ✅

**Time to Complete**: 2-3 hours (Steps 1-6)

**Validation Period**: 1-2 weeks (Steps 7+)

**Philosophy**: "Deploy to learn, not to launch. Gather evidence, then decide."
