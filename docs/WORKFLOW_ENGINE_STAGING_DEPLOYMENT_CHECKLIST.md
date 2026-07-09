# Workflow Engine - Staging Deployment Checklist

**Date**: 2026-07-09  
**Status**: 🚀 **IN PROGRESS**  
**Environment**: Staging  
**Estimated Time**: 2-3 hours

---

## Pre-Deployment Checklist

### ✅ Code Ready
- [x] Build passing (npm run build - 18.5s)
- [x] All imports fixed
- [x] Git committed and pushed
- [x] 11 files created (~3,040 lines)

### ✅ Documentation Ready
- [x] Production Deployment Guide
- [x] Deployment Completion Report
- [x] Database migration script
- [x] Verification script

---

## Step-by-Step Deployment

### 📋 Step 1: Prepare Staging Environment

**Duration**: 10 minutes

**Tasks**:
1. Get Supabase staging project reference
2. Prepare environment variables
3. Review migration script

**Commands**:
```bash
# Check Supabase CLI installed
npx supabase --version

# Login to Supabase (if needed)
npx supabase login

# List projects
npx supabase projects list
```

**Expected Output**:
```
PROJECT REF         │ NAME            │ ORGANIZATION ID │ REGION
────────────────────┼─────────────────┼─────────────────┼─────────
xyzabcdefghijklm   │ bella-staging   │ ...             │ ap-southeast-1
```

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🗄️ Step 2: Apply Database Migration

**Duration**: 5 minutes

**Tasks**:
1. Review migration script
2. Push migration to staging database
3. Verify tables created

**Commands**:
```bash
# Review migration (optional)
cat supabase/migrations/20260709120000_workflow_engine_foundation.sql

# Push to staging
npx supabase db push --project-ref STAGING_PROJECT_REF

# Alternative: Apply via Supabase Dashboard SQL Editor
# Copy migration script → Paste in SQL Editor → Run
```

**Expected Output**:
```
Applying migration 20260709120000_workflow_engine_foundation.sql...
✓ Migration applied successfully
```

**Verification**:
```sql
-- Run in Supabase SQL Editor (Staging)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('workflow_executions', 'workflow_step_executions');
```

**Expected Result**: 2 rows (both tables exist)

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🔍 Step 3: Verify Database Schema

**Duration**: 5 minutes

**Tasks**:
1. Run verification script
2. Check tables, indexes, RLS, triggers
3. Confirm all checks pass

**Commands**:
```bash
# Copy verification script to clipboard
cat supabase/migrations/VERIFY_WORKFLOW_TABLES.sql

# Run in Supabase SQL Editor (Staging)
# Paste script → Execute
```

**Expected Results**:
1. ✅ 2 tables exist (workflow_executions, workflow_step_executions)
2. ✅ 13 columns each
3. ✅ 8 indexes created
4. ✅ RLS enabled on both tables
5. ✅ 4 policies created
6. ✅ 2 triggers created
7. ✅ 2 RPC functions created

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### ⚙️ Step 4: Set Environment Variables

**Duration**: 5 minutes

**Where**: Vercel Dashboard → Project Settings → Environment Variables

**Variables to Add**:
```bash
# Workflow Engine Feature Flags
FEATURE_WORKFLOW_ENGINE=true
FEATURE_WF_BOOKING_FULFILLMENT=true

# Optional: Logging and Metrics
WORKFLOW_ENGINE_ENABLE_LOGGING=true
WORKFLOW_ENGINE_ENABLE_METRICS=true
```

**Important**:
- Set for **Preview** environment (staging)
- NOT Production (yet)

**Verification**:
```bash
# After deployment, test via API
curl https://staging.bella-erp.com/api/workflows \
  -H "Authorization: Bearer TOKEN"

# Should NOT return "Workflow Engine is disabled" error
```

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🚢 Step 5: Deploy Code to Staging

**Duration**: 10 minutes

**Option A: Vercel CLI** (Recommended)
```bash
# Deploy to preview (staging)
vercel

# Or deploy to production preview
vercel --prod

# Follow prompts
```

**Option B: Git Push** (Automatic)
```bash
# Already done - code pushed to main branch
# Vercel auto-deploys on push

# Check deployment status
vercel ls
```

**Expected Output**:
```
✓ Deployment ready
  https://bella-spa-erp-abc123.vercel.app
```

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🧪 Step 6: Test API Endpoints

**Duration**: 20 minutes

#### Test 6.1: Health Check
```bash
# Get auth token first
# Login to staging app → Get JWT from localStorage

export STAGING_URL="https://staging.bella-erp.com"
export AUTH_TOKEN="your-jwt-token"

# Test workflow list endpoint
curl $STAGING_URL/api/workflows \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected**: `200 OK` with empty array `{"success": true, "data": []}`

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### Test 6.2: Execute Workflow (Mock)
```bash
# Create test booking first (if needed)
# Then execute workflow

curl -X POST $STAGING_URL/api/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "booking-to-fulfillment-v1",
    "tenantId": "YOUR_TENANT_ID",
    "data": {
      "bookingId": "TEST_BOOKING_ID"
    }
  }'
```

**Expected**: `200 OK` with execution result

**Possible Errors**:
1. `"Workflow Engine is disabled"` → Check feature flags
2. `"Booking not found"` → Need to create test booking first
3. `"Unauthorized"` → Check auth token

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### Test 6.3: Get Execution Details
```bash
# Use execution ID from Step 6.2
export EXECUTION_ID="execution-uuid-from-above"

curl $STAGING_URL/api/workflows/$EXECUTION_ID \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected**: `200 OK` with full execution details including steps

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🔍 Step 7: Verify Database Records

**Duration**: 10 minutes

**Tasks**:
1. Check workflow_executions table
2. Check workflow_step_executions table
3. Verify data integrity

**Queries**:
```sql
-- 1. List all workflow executions
SELECT 
  id,
  workflow_id,
  workflow_version,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) AS duration_seconds
FROM workflow_executions
ORDER BY started_at DESC
LIMIT 10;

-- 2. Get execution details with steps
SELECT * FROM get_workflow_execution_detail('EXECUTION_ID');

-- 3. Count by status
SELECT 
  status,
  COUNT(*) AS count
FROM workflow_executions
GROUP BY status;

-- 4. Check step executions
SELECT 
  step_name,
  status,
  execution_time_ms,
  retry_count
FROM workflow_step_executions
WHERE workflow_execution_id = 'EXECUTION_ID'
ORDER BY step_index;
```

**Expected Results**:
1. ✅ Execution record created in `workflow_executions`
2. ✅ Step records created in `workflow_step_executions`
3. ✅ Status matches API response
4. ✅ Timestamps populated correctly

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 📊 Step 8: Test Complete Workflow Flow

**Duration**: 30 minutes

**Scenario**: Create booking → Execute workflow → Verify results

#### 8.1: Create Test Booking
```bash
curl -X POST $STAGING_URL/api/bookings \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "TEST_CUSTOMER_ID",
    "totalAmount": 3500000,
    "serviceType": "spa",
    "scheduledDate": "2026-07-15",
    "services": [
      {
        "productId": "PRODUCT_ID",
        "quantity": 1
      }
    ]
  }'
```

**Save**: `bookingId` from response

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### 8.2: Execute Workflow
```bash
curl -X POST $STAGING_URL/api/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "booking-to-fulfillment-v1",
    "tenantId": "YOUR_TENANT_ID",
    "data": {
      "bookingId": "BOOKING_ID_FROM_8.1"
    }
  }'
```

**Save**: `executionId` from response

**Expected Steps**:
1. ✅ `check-auto-approval` - completed
2. ✅ `approval-branch` - completed
3. ✅ `reserve-inventory` - completed (or skipped if rejected)
4. ✅ `assign-ktv` - completed (or skipped)
5. ✅ `send-notifications` - completed (or skipped)
6. ✅ `finalize-booking` - completed (or skipped)
7. ✅ `notify-pending-approval` - completed (if rejected)

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### 8.3: Verify Side Effects
```sql
-- Check booking status updated
SELECT 
  id,
  status,
  assigned_ktv_id,
  confirmed_at
FROM bookings
WHERE id = 'BOOKING_ID';

-- Check inventory reservation (if created)
SELECT *
FROM inventory_reservations
WHERE booking_id = 'BOOKING_ID';
```

**Expected**:
1. ✅ Booking status = 'confirmed' (if approved) or 'pending_approval' (if rejected)
2. ✅ KTV assigned (if approved)
3. ✅ Inventory reserved (if approved)

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 🚨 Step 9: Test Error Scenarios

**Duration**: 20 minutes

#### 9.1: Test with Invalid Booking ID
```bash
curl -X POST $STAGING_URL/api/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "booking-to-fulfillment-v1",
    "tenantId": "YOUR_TENANT_ID",
    "data": {
      "bookingId": "INVALID_ID"
    }
  }'
```

**Expected**: `404 Not Found` or `500 Internal Server Error` with clear error message

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### 9.2: Test with Disabled Feature Flag
```bash
# Temporarily disable feature flag in Vercel
# FEATURE_WF_BOOKING_FULFILLMENT=false

curl -X POST $STAGING_URL/api/workflows/execute \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "booking-to-fulfillment-v1",
    "tenantId": "YOUR_TENANT_ID",
    "data": {
      "bookingId": "VALID_BOOKING_ID"
    }
  }'
```

**Expected**: `503 Service Unavailable` with message "Booking fulfillment workflow is disabled"

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

#### 9.3: Test Cancel Workflow
```bash
curl -X DELETE $STAGING_URL/api/workflows/EXECUTION_ID \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test cancellation"
  }'
```

**Expected**: `200 OK` with success message

**Verify**:
```sql
SELECT status, error_message
FROM workflow_executions
WHERE id = 'EXECUTION_ID';
-- status should be 'cancelled'
```

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

### 📝 Step 10: Document Findings

**Duration**: 15 minutes

**Create**: `STAGING_DEPLOYMENT_REPORT.md`

**Include**:
1. Deployment date and time
2. All test results (pass/fail)
3. Issues found (if any)
4. Performance metrics (execution time)
5. Screenshots (optional)
6. Recommendations for production

**Status**: [ ] TODO → [ ] IN PROGRESS → [ ] DONE

---

## Post-Deployment Checklist

### Monitoring
- [ ] Check logs for errors (Vercel Logs or Supabase Logs)
- [ ] Monitor execution time (should be < 2s for simple workflows)
- [ ] Track success rate (should be > 95%)

### Documentation
- [ ] Update deployment guide with actual steps taken
- [ ] Note any deviations from plan
- [ ] Document issues and resolutions

### Communication
- [ ] Notify team of staging deployment
- [ ] Share staging URL and test credentials
- [ ] Request feedback from stakeholders

---

## Rollback Plan

**If Critical Issues Found**:

1. **Disable Feature Flags** (< 1 minute)
   ```bash
   # In Vercel Dashboard
   FEATURE_WORKFLOW_ENGINE=false
   FEATURE_WF_BOOKING_FULFILLMENT=false
   ```

2. **Verify Workflows Disabled**
   ```bash
   curl $STAGING_URL/api/workflows \
     -H "Authorization: Bearer $AUTH_TOKEN"
   # Should return: "Workflow Engine is disabled"
   ```

3. **Rollback Database** (if needed)
   ```sql
   -- Drop tables (only if critical issue)
   DROP TABLE workflow_step_executions CASCADE;
   DROP TABLE workflow_executions CASCADE;
   ```

4. **Document Issue**
   - What went wrong?
   - Root cause?
   - Steps to reproduce?
   - Fix required?

---

## Success Criteria

### ✅ Deployment Successful If:
- [ ] Database migration applied successfully
- [ ] All verification checks pass
- [ ] Feature flags enabled
- [ ] Code deployed to staging
- [ ] API endpoints return 200 OK
- [ ] Test workflow executes successfully
- [ ] Database records created correctly
- [ ] No critical errors in logs

### 📊 Performance Targets:
- [ ] Execution time < 2s (P95)
- [ ] API response time < 500ms
- [ ] Database queries < 100ms
- [ ] Success rate > 95%

### 🐛 Known Issues:
- [ ] None (or list issues found)

---

## Next Steps After Staging

**If Successful** (all checks pass):
1. Monitor for 24-48 hours
2. Get stakeholder approval
3. Plan production pilot (1 tenant, 10-20 bookings)
4. Schedule production deployment

**If Issues Found**:
1. Document all issues
2. Fix in development
3. Re-test locally
4. Re-deploy to staging
5. Repeat until stable

---

**Deployment Status**: 🚀 **IN PROGRESS**  
**Last Updated**: 2026-07-09  
**Next Update**: After Step 10 completion
