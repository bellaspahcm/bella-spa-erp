# Progressive Rollout Strategy: Phase A Platform-of-Platforms

**Feature:** `phase_a_platform_of_platforms`  
**Start Date:** 2026-08-07  
**Strategy:** 4-Stage Progressive Rollout (10% → 25% → 50% → 100%)

---

## 🎯 Rollout Objectives

1. **Zero Production Incidents**: No critical bugs reach high-risk tenants
2. **Performance Validation**: Event Bus latency <50ms, API response <200ms
3. **User Acceptance**: No regression in user workflows
4. **Constitution Compliance**: Maintain Law 5 (Event-Driven) across all tenants

---

## 📊 Tenant Risk Categorization

### Risk Factors:
- **Patient Volume**: Daily admissions, bed occupancy
- **User Activity**: Active nurses, doctors per shift
- **Transaction Rate**: Medications/hour, vitals records/hour
- **Business Criticality**: ICU, OR vs. Outpatient clinics

### Risk Categories:
- 🟢 **Low Risk**: <50 beds, <100 users, dev/staging environments
- 🟡 **Medium Risk**: 50-200 beds, 100-500 users, general wards
- 🔴 **High Risk**: >200 beds, >500 users, ICU/OR/ED departments

---

## 🚀 4-Stage Rollout Plan

### Stage 1: 10% Low-Risk Tenants (Days 1-2)

**Target:**
- 10% of total hospital tenants
- Only 🟢 Low-risk category
- Exclude ICU, OR, ED departments

**Success Criteria:**
- ✅ Zero critical errors (HTTP 5xx)
- ✅ Event Bus publish latency <50ms (p95)
- ✅ API response time <200ms (p95)
- ✅ No user-reported bugs in 48 hours
- ✅ All 3 event flows working (Bed→Billing, Med→Timeline, Vitals→AI)

**Monitoring Period:** 48 hours

**Rollback Triggers:**
- ❌ Any HTTP 500 error from Event Bus
- ❌ Event loss detected (published but not received)
- ❌ API latency >500ms (p95)
- ❌ User workflow regression reported

**Rollback Procedure:**
```sql
-- Disable feature flag for Stage 1 tenants
UPDATE feature_flags
SET enabled = false
WHERE flag_key = 'phase_a_platform_of_platforms'
  AND tenant_id IN (SELECT tenant_id FROM rollout_stage_1_tenants);
```

---

### Stage 2: 25% Tenants (Days 3-4)

**Target:**
- Add 🟡 Medium-risk tenants
- Total: 25% of all tenants
- Include general wards, outpatient clinics

**Success Criteria:**
- ✅ Stage 1 success criteria maintained
- ✅ No performance degradation vs. Stage 1
- ✅ Event Bus handles 5x traffic volume
- ✅ Cross-engine events working across all tenant types

**Monitoring Period:** 48 hours

**Rollback Triggers:**
- ❌ Stage 1 rollback triggers
- ❌ Performance degradation >20% vs. Stage 1
- ❌ Event Bus memory leak detected

**Rollback Procedure:**
```sql
-- Rollback Stage 2 only (keep Stage 1)
UPDATE feature_flags
SET enabled = false
WHERE flag_key = 'phase_a_platform_of_platforms'
  AND tenant_id IN (SELECT tenant_id FROM rollout_stage_2_tenants);
```

---

### Stage 3: 50% Tenants (Days 5-7)

**Target:**
- Add more 🟡 Medium-risk + some 🔴 High-risk
- Total: 50% of all tenants
- Include some ICU departments (pilot)

**Success Criteria:**
- ✅ Stage 2 success criteria maintained
- ✅ Event Bus handles 10x original traffic
- ✅ High-risk pilot tenants stable
- ✅ Memory usage <500MB per Node.js instance

**Monitoring Period:** 72 hours (extended for high-risk validation)

**Rollback Triggers:**
- ❌ Stage 2 rollback triggers
- ❌ Memory leak: >1GB per instance
- ❌ High-risk tenant critical incident

**Rollback Procedure:**
```sql
-- Rollback Stage 3 only (keep Stage 1+2)
UPDATE feature_flags
SET enabled = false
WHERE flag_key = 'phase_a_platform_of_platforms'
  AND tenant_id IN (SELECT tenant_id FROM rollout_stage_3_tenants);
```

---

### Stage 4: 100% Tenants (Day 8+)

**Target:**
- All remaining tenants
- All 🔴 High-risk departments (ICU, OR, ED)
- Full production rollout

**Success Criteria:**
- ✅ Stage 3 success criteria maintained
- ✅ All tenants migrated successfully
- ✅ Feature flag can be removed (architecture is default)

**Monitoring Period:** 7 days post-rollout

**Rollback Triggers:**
- ❌ Stage 3 rollback triggers
- ❌ Widespread tenant complaints
- ❌ Constitution Law 5 violation detected

**Rollback Procedure:**
```sql
-- Full rollback to legacy architecture
UPDATE feature_flags
SET enabled = false
WHERE flag_key = 'phase_a_platform_of_platforms';

-- Incident report required
INSERT INTO incident_reports (severity, title, description)
VALUES ('critical', 'Phase A Rollback', 'Full rollback executed due to: [REASON]');
```

---

## 📈 Monitoring Metrics

### 1. Error Rate (per stage)
```
Target: <0.01% (1 error per 10,000 requests)
Alert: >0.1%
Critical: >1%
```

**Queries:**
```sql
-- Error rate by tenant cohort
SELECT 
  stage,
  COUNT(*) FILTER (WHERE status >= 400) * 100.0 / COUNT(*) AS error_rate_pct
FROM api_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY stage;
```

### 2. Event Bus Latency (publish to deliver)
```
Target: <50ms (p95)
Alert: >100ms (p95)
Critical: >200ms (p95)
```

**Queries:**
```sql
-- Event Bus latency per stage
SELECT 
  stage,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
FROM event_bus_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY stage;
```

### 3. API Response Time (end-to-end)
```
Target: <200ms (p95)
Alert: >400ms (p95)
Critical: >1000ms (p95)
```

**Queries:**
```sql
-- API response time by endpoint
SELECT 
  endpoint,
  stage,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_ms
FROM api_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY endpoint, stage
ORDER BY p95_ms DESC
LIMIT 10;
```

### 4. Event Loss Rate
```
Target: 0% (zero loss)
Alert: >0.001%
Critical: >0.01%
```

**Detection:**
```typescript
// Compare published vs. received events
const publishedCount = await getPublishedEventCount(tenantId, timeRange);
const receivedCount = await getReceivedEventCount(tenantId, timeRange);
const lossRate = ((publishedCount - receivedCount) / publishedCount) * 100;

if (lossRate > 0.01) {
  await triggerCriticalAlert('Event loss detected', { tenantId, lossRate });
}
```

### 5. Memory Usage (Node.js instances)
```
Target: <500MB per instance
Alert: >800MB per instance
Critical: >1GB per instance
```

### 6. User-Reported Bugs
```
Target: 0 critical bugs
Alert: 1+ medium bugs
Critical: 1+ critical bugs
```

---

## 🔍 Monitoring Tools

### 1. Real-Time Dashboard
- **Grafana**: Event Bus metrics, API latency
- **Supabase Logs**: Database query performance
- **Sentry**: JavaScript errors, unhandled exceptions

### 2. Automated Alerts
- **PagerDuty**: Critical errors, rollback triggers
- **Slack**: Stage completion, warning-level metrics
- **Email**: Daily rollout status reports

### 3. Manual Checks (per stage)
- [ ] Load 3 hospital pages (beds, vitals, MAR)
- [ ] Allocate bed → Verify billing charge created
- [ ] Record medication → Verify timeline entry
- [ ] Record critical vitals → Verify AI alert triggered
- [ ] Check Event Bus logs for errors
- [ ] Review Sentry for new exception types

---

## 🔄 Rollback Decision Matrix

| Severity | Condition | Action | Timeline |
|----------|-----------|--------|----------|
| 🟢 Minor | 1-2 non-critical bugs | Monitor, fix in next release | Continue rollout |
| 🟡 Medium | >0.1% error rate OR >400ms latency | Pause rollout, investigate | Fix within 24h |
| 🔴 Critical | Event loss OR HTTP 500 OR >1% error rate | **IMMEDIATE ROLLBACK** | <15 minutes |

---

## 📋 Stage Checklist Template

### Pre-Stage:
- [ ] Identify target tenants (run categorization query)
- [ ] Notify tenant admins (email 24h advance)
- [ ] Set up monitoring alerts for this stage
- [ ] Verify rollback procedure tested

### During Stage:
- [ ] Enable feature flag for target tenants
- [ ] Monitor metrics every 4 hours (first 24h)
- [ ] Run manual smoke tests
- [ ] Review Sentry errors
- [ ] Check user feedback channels

### Post-Stage:
- [ ] Verify all success criteria met
- [ ] Document any incidents/learnings
- [ ] Update rollout status in ROADMAP
- [ ] Plan next stage target tenants

---

## 📞 Incident Response

### On-Call Engineer:
- **Primary**: [TBD]
- **Secondary**: [TBD]
- **Escalation**: CTO

### Communication Plan:
1. **Critical Incident** (<15min):
   - Execute rollback immediately
   - Notify CTO + Product Lead
   - Post in #incidents Slack channel

2. **Medium Incident** (<1 hour):
   - Pause rollout
   - Investigate root cause
   - Decide: Fix forward or rollback

3. **Post-Incident**:
   - Write incident report (5 Whys analysis)
   - Update rollout strategy if needed
   - Share learnings with team

---

## 🎓 Success Definition

Phase A rollout is **SUCCESSFUL** when:

1. ✅ 100% of hospital tenants enabled
2. ✅ All 3 event flows stable in production
3. ✅ Zero critical incidents during rollout
4. ✅ Performance metrics within targets (7 days post-100%)
5. ✅ User acceptance: No workflow regressions reported
6. ✅ Feature flag can be removed (Phase A becomes default architecture)

---

## 📝 Rollout Timeline

```
Day 1-2:  Stage 1 (10% low-risk)    → Monitor 48h
Day 3-4:  Stage 2 (25% + medium)    → Monitor 48h
Day 5-7:  Stage 3 (50% + high pilot) → Monitor 72h
Day 8+:   Stage 4 (100% all)        → Monitor 7 days
Day 15:   Post-rollout review       → Mark complete
```

**Expected Completion:** 2026-08-22 (15 days from start)

---

## 🔗 Related Documents

- [Phase 0 Deployment Complete](./PHASE_0_DEPLOYMENT_COMPLETE.md)
- [Manual Deploy Feature Flags](./MANUAL_DEPLOY_FEATURE_FLAGS.md)
- [ROADMAP 2026-2027](../ROADMAP_2026-2027.md)
- [Constitution Document](../platform/CONSTITUTION.md)

---

**Version:** 1.0  
**Author:** Platform Team  
**Last Updated:** 2026-08-07
