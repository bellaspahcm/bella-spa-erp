# Workflow Engine - Production Deployment Guide

**Version**: 1.0.0  
**Status**: 🚀 **PRODUCTION READY**  
**Last Updated**: 2026-07-09

---

## Overview

This guide covers deploying Workflow Engine to production environment, including:
1. Database migration
2. Environment configuration
3. Feature flag setup
4. API deployment
5. Monitoring setup
6. Testing procedures

---

## 1. Database Migration

### Step 1.1: Review Migration Script

Migration file: `supabase/migrations/20260709120000_workflow_engine_foundation.sql`

Creates 2 tables:
- `workflow_executions` - Workflow execution state
- `workflow_step_executions` - Step execution audit trail

Includes:
- ✅ Indexes for performance
- ✅ Row Level Security (RLS)
- ✅ Triggers for updated_at
- ✅ Helper RPC functions
- ✅ Comments for documentation

### Step 1.2: Apply Migration

**Local Development**:
```bash
# Reset local database (if needed)
npx supabase db reset

# Or apply specific migration
npx supabase migration up
```

**Staging Environment**:
```bash
# Push to staging
npx supabase db push --project-ref YOUR_STAGING_PROJECT_REF
```

**Production Environment**:
```bash
# Push to production (requires confirmation)
npx supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF
```

### Step 1.3: Verify Migration

Run verification script in Supabase SQL Editor:

File: `supabase/migrations/VERIFY_WORKFLOW_TABLES.sql`

Expected results:
- ✅ 2 tables created
- ✅ 8 indexes created
- ✅ RLS enabled on both tables
- ✅ 4 policies created
- ✅ 2 triggers created
- ✅ 2 helper functions created

---

## 2. Environment Configuration

### Step 2.1: Add Environment Variables

Add to `.env.local` (development) or Vercel/server environment (production):

```bash
# ============================================================
# Workflow Engine Configuration
# ============================================================

# Enable Workflow Engine Platform
FEATURE_WORKFLOW_ENGINE=true

# Enable specific workflows
FEATURE_WF_BOOKING_FULFILLMENT=true

# Supabase Configuration (required for StateManager)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Logging and Metrics
WORKFLOW_ENGINE_ENABLE_LOGGING=true
WORKFLOW_ENGINE_ENABLE_METRICS=true
```

### Step 2.2: Feature Flag Strategy

**Phase 1: Pilot (Week 1-2)**
```bash
FEATURE_WORKFLOW_ENGINE=true
FEATURE_WF_BOOKING_FULFILLMENT=true  # Enable for testing
```

**Phase 2: Gradual Rollout (Week 3-4)**
```bash
FEATURE_WORKFLOW_ENGINE=true
FEATURE_WF_BOOKING_FULFILLMENT=true  # Enable for 10% of tenants
```

**Phase 3: Full Production (Week 5+)**
```bash
FEATURE_WORKFLOW_ENGINE=true
FEATURE_WF_BOOKING_FULFILLMENT=true  # Enable for all tenants
```

---

## 3. API Endpoints

### Deployed APIs

**3.1. Execute Workflow**
```
POST /api/workflows/execute
```

Request:
```json
{
  "workflowId": "booking-to-fulfillment-v1",
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "data": {
    "bookingId": "booking-uuid"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "executionId": "execution-uuid",
    "status": "completed",
    "output": {
      "reservationId": "...",
      "assignedKtvId": "...",
      "bookingFinalized": true
    },
    "steps": [
      {
        "name": "check-auto-approval",
        "status": "completed",
        "executionTime": 45
      }
    ]
  }
}
```

**3.2. Get Workflow Execution**
```
GET /api/workflows/:executionId
```

Response:
```json
{
  "success": true,
  "data": {
    "execution_id": "...",
    "workflow_id": "booking-to-fulfillment-v1",
    "status": "completed",
    "steps": [...]
  }
}
```

**3.3. List Workflows**
```
GET /api/workflows?workflowId=booking-to-fulfillment-v1&status=completed&limit=50&offset=0
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "workflow_id": "booking-to-fulfillment-v1",
      "status": "completed",
      "execution_time_ms": 1234,
      "step_count": 5
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "count": 10
  }
}
```

**3.4. Cancel Workflow**
```
DELETE /api/workflows/:executionId
```

Request:
```json
{
  "reason": "User requested cancellation"
}
```

---

## 4. Testing Procedures

### Step 4.1: Local Testing

**Test 1: Execute Booking Fulfillment Workflow**

```bash
# Create a test booking first
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "totalAmount": 3500000,
    "serviceType": "spa",
    "scheduledDate": "2026-07-15"
  }'

# Execute workflow
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "workflowId": "booking-to-fulfillment-v1",
    "tenantId": "YOUR_TENANT_ID",
    "data": {
      "bookingId": "BOOKING_ID_FROM_ABOVE"
    }
  }'
```

**Test 2: Query Workflow Status**

```bash
curl http://localhost:3000/api/workflows/EXECUTION_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test 3: List Workflows**

```bash
curl http://localhost:3000/api/workflows?status=completed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 4.2: Database Verification

Check workflow executions in Supabase SQL Editor:

```sql
-- List all workflow executions
SELECT 
  id,
  workflow_id,
  workflow_version,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM workflow_executions
ORDER BY started_at DESC
LIMIT 10;

-- Get workflow with steps
SELECT * FROM get_workflow_execution_detail('EXECUTION_ID');

-- Count workflows by status
SELECT 
  status,
  COUNT(*) AS count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))) AS avg_duration_seconds
FROM workflow_executions
GROUP BY status;
```

### Step 4.3: Error Scenarios Testing

**Test: Workflow failure with compensation**

1. Modify inventory service to fail after reservation
2. Execute workflow
3. Verify compensation (reservation released)

**Test: Approval rejection path**

1. Create booking with high amount (> 5,000,000 VND)
2. Execute workflow
3. Verify "notify-pending-approval" step executed

---

## 5. Monitoring Setup

### Step 5.1: Key Metrics to Monitor

**Workflow Execution Metrics**:
- Total executions (per hour/day)
- Success rate (completed / total)
- Failure rate (failed / total)
- Average execution time
- P95/P99 execution time

**Step Execution Metrics**:
- Step failure rate (per step name)
- Average step execution time (per step name)
- Retry count distribution

**Database Metrics**:
- `workflow_executions` table size
- `workflow_step_executions` table size
- Query performance (RPC functions)

### Step 5.2: Alerts Configuration

**Critical Alerts** (PagerDuty/Slack):
- Workflow failure rate > 5% (5 minutes)
- Database connection failures
- API endpoint errors > 10% (5 minutes)

**Warning Alerts** (Email):
- Workflow execution time > 2 minutes (P95)
- Step retry rate > 20%
- Database table size > 10GB

### Step 5.3: Logging

All logs are prefixed with `[WorkflowEngine]`:

```
[WorkflowEngine] Initialized successfully
[WorkflowEngine] Starting workflow: booking-to-fulfillment-v1 {tenantId, correlationId}
[WorkflowEngine] Workflow completed: booking-to-fulfillment-v1 {status, executionTime, stepCount}
[WorkflowEngine] Workflow failed: booking-to-fulfillment-v1 {error, executionTime}
```

Search in logs:
```bash
# All workflow logs
grep "WorkflowEngine" logs.txt

# Failures only
grep "WorkflowEngine.*failed" logs.txt
```

---

## 6. Rollout Plan

### Phase 1: Pilot (Week 1-2)

**Scope**: 1 tenant, 10-20 bookings

**Steps**:
1. Deploy to staging
2. Test all 3 scenarios (approved, pending, failure)
3. Verify database state
4. Check logs and metrics
5. Get stakeholder approval

**Success Criteria**:
- ✅ 100% success rate
- ✅ No database errors
- ✅ Execution time < 2 seconds (P95)

### Phase 2: Gradual Rollout (Week 3-4)

**Scope**: 10% of tenants

**Steps**:
1. Enable feature flag for 10% tenants
2. Monitor for 3 days
3. If stable, increase to 25%
4. Monitor for 3 days
5. If stable, increase to 50%

**Success Criteria**:
- ✅ Failure rate < 1%
- ✅ No critical incidents
- ✅ Positive user feedback

### Phase 3: Full Production (Week 5+)

**Scope**: All tenants

**Steps**:
1. Enable for all tenants
2. Monitor for 1 week
3. Document lessons learned
4. Plan next workflow (Payroll Approval)

---

## 7. Troubleshooting

### Issue 1: "Workflow Engine not initialized"

**Cause**: Feature flag disabled or environment variables missing

**Solution**:
```bash
# Check feature flags
echo $FEATURE_WORKFLOW_ENGINE
echo $FEATURE_WF_BOOKING_FULFILLMENT

# Should be "true"
```

### Issue 2: "Failed to create workflow execution"

**Cause**: Database migration not applied or RLS blocking insert

**Solution**:
```sql
-- Check if tables exist
SELECT * FROM workflow_executions LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'workflow_executions';
```

### Issue 3: "No available KTV found"

**Cause**: Business logic error, not workflow error

**Solution**:
- Check KTV availability in `find_available_ktv` RPC
- Verify KTV schedule and workload

### Issue 4: Workflow stuck in "running" status

**Cause**: Step execution failed but not caught

**Solution**:
```sql
-- Check step executions
SELECT * FROM workflow_step_executions 
WHERE workflow_execution_id = 'EXECUTION_ID'
ORDER BY step_index;

-- Manually fail the workflow
UPDATE workflow_executions 
SET status = 'failed', 
    error_message = 'Manually failed - investigation needed',
    completed_at = NOW()
WHERE id = 'EXECUTION_ID';
```

---

## 8. Rollback Procedure

### If Critical Issue Found

**Step 1**: Disable feature flags immediately
```bash
# Set in Vercel/server environment
FEATURE_WORKFLOW_ENGINE=false
FEATURE_WF_BOOKING_FULFILLMENT=false
```

**Step 2**: Verify no workflows in "running" status
```sql
SELECT COUNT(*) FROM workflow_executions WHERE status = 'running';

-- If any, manually complete or fail them
UPDATE workflow_executions 
SET status = 'cancelled', 
    error_message = 'System rollback',
    completed_at = NOW()
WHERE status = 'running';
```

**Step 3**: Revert to legacy booking flow
- Legacy code still exists alongside workflow
- System falls back automatically when feature disabled

**Step 4**: Root cause analysis
- Review error logs
- Check database state
- Analyze failed executions
- Fix issues
- Re-test in staging
- Re-deploy when stable

**Rollback Time**: < 5 minutes (feature flag toggle)

---

## 9. Success Metrics

### Week 1-2 (Pilot)

- ✅ 0 critical errors
- ✅ 100% booking fulfillment success rate
- ✅ < 2s average execution time
- ✅ Full audit trail captured

### Month 1 (Production)

- ✅ > 1000 workflows executed
- ✅ > 95% success rate
- ✅ < 5 incidents
- ✅ Positive user feedback

### Quarter 1 (Maturity)

- ✅ 3+ workflows deployed (Booking, Payroll, Inventory)
- ✅ > 99% uptime
- ✅ < 1% failure rate
- ✅ Self-service workflow creation (Rule Management UI)

---

## 10. Next Steps

After successful production deployment:

1. **Deploy additional workflows**:
   - Payroll approval workflow
   - Inventory reorder workflow
   - Customer onboarding workflow

2. **Build monitoring dashboards**:
   - Grafana dashboard for workflow metrics
   - Real-time execution tracking
   - Performance analytics

3. **Rule Management UI** (Phase 2):
   - Visual workflow builder
   - Business user self-service
   - A/B testing support

4. **Advanced features**:
   - Workflow versioning
   - Distributed execution
   - Real-time progress streaming

---

## Conclusion

Workflow Engine is production-ready with:
- ✅ Full database schema deployed
- ✅ Production state manager (Supabase)
- ✅ API endpoints ready
- ✅ Feature flags configured
- ✅ Monitoring plan defined
- ✅ Rollback procedure documented

**Ready to deploy!** 🚀

---

**Document Status**: ✅ **COMPLETE**  
**Reviewed By**: AI Development Team  
**Approved By**: Pending CTO Review
