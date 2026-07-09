# Workflow Engine - Staging Deployment Quickstart

**Start Time**: [YOUR TIME]  
**Estimated Duration**: 2-3 hours  
**Status**: 🚀 Ready to Deploy

---

## 📋 TL;DR - Quick Steps

```bash
# 1. Apply database migration
npx supabase db push --project-ref YOUR_STAGING_PROJECT_REF

# 2. Verify in Supabase SQL Editor
# Run: supabase/migrations/VERIFY_WORKFLOW_TABLES.sql

# 3. Set environment variables in Vercel
FEATURE_WORKFLOW_ENGINE=true
FEATURE_WF_BOOKING_FULFILLMENT=true

# 4. Deploy code
vercel

# 5. Test APIs
bash scripts/test-workflow-api.sh
```

---

## 🎯 What You Need Before Starting

### Required Information
- [ ] **Supabase Staging Project Ref**: `_____________________`
- [ ] **Vercel Project Name**: `_____________________`
- [ ] **Staging URL**: `https://____________________`
- [ ] **Test Tenant ID**: `_____________________`
- [ ] **Auth Token** (JWT): Get from staging app after login

### Required Access
- [ ] Supabase Dashboard access (staging project)
- [ ] Vercel Dashboard access (project settings)
- [ ] Staging app login credentials

### Tools Installed
- [ ] Supabase CLI: `npx supabase --version`
- [ ] Vercel CLI (optional): `vercel --version`
- [ ] curl or Postman for API testing
- [ ] jq for JSON parsing (optional): `jq --version`

---

## 🚀 Step-by-Step Deployment

### Step 1: Apply Database Migration (5 min)

**Option A: Supabase CLI** (Recommended)
```bash
npx supabase db push --project-ref YOUR_STAGING_PROJECT_REF
```

**Option B: SQL Editor** (Manual)
1. Open Supabase Dashboard → SQL Editor
2. Copy content from `supabase/migrations/20260709120000_workflow_engine_foundation.sql`
3. Paste and run

**Expected**: ✅ "Migration applied successfully"

---

### Step 2: Verify Database (5 min)

1. Open Supabase Dashboard → SQL Editor
2. Copy content from `supabase/migrations/VERIFY_WORKFLOW_TABLES.sql`
3. Run all queries

**Expected Results**:
```
✅ 2 tables exist (workflow_executions, workflow_step_executions)
✅ 13 columns each
✅ 8 indexes
✅ RLS enabled
✅ 4 policies
✅ 2 triggers
✅ 2 RPC functions
```

**If any check fails**: STOP and debug before continuing.

---

### Step 3: Set Environment Variables (5 min)

1. Open Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following for **Preview** environment:

```
Name: FEATURE_WORKFLOW_ENGINE
Value: true
Environment: Preview

Name: FEATURE_WF_BOOKING_FULFILLMENT
Value: true
Environment: Preview

Name: WORKFLOW_ENGINE_ENABLE_LOGGING
Value: true
Environment: Preview

Name: WORKFLOW_ENGINE_ENABLE_METRICS
Value: true
Environment: Preview
```

3. Click "Save"

**Important**: DON'T add to Production yet!

---

### Step 4: Deploy Code (10 min)

**Option A: Automatic** (Already done if you pushed to GitHub)
- Vercel auto-deploys on push to main branch
- Check deployment status in Vercel Dashboard

**Option B: Manual**
```bash
vercel

# Follow prompts
# Should deploy to preview URL
```

**Get Deployment URL**: Save it for testing
Example: `https://bella-spa-erp-abc123.vercel.app`

---

### Step 5: Test API Endpoints (20 min)

#### Get Auth Token
1. Open staging app in browser
2. Login with test account
3. Open Developer Tools → Console
4. Run: `localStorage.getItem('token')` or similar
5. Copy JWT token

#### Run Test Script
```bash
bash scripts/test-workflow-api.sh

# Provide:
# - Staging URL
# - Auth Token
# - Tenant ID
```

#### Manual Testing (Alternative)

**Test 1: List Workflows**
```bash
export STAGING_URL="https://your-staging-url.vercel.app"
export AUTH_TOKEN="your-jwt-token"

curl $STAGING_URL/api/workflows \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected**: `{"success": true, "data": [], "meta": {...}}`

**Test 2: Execute Workflow** (need valid booking)
```bash
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

**Expected**: `{"success": true, "data": {"executionId": "...", "status": "completed", ...}}`

---

### Step 6: Verify Database Records (10 min)

1. Open Supabase Dashboard → SQL Editor
2. Run queries:

```sql
-- List executions
SELECT 
  id,
  workflow_id,
  status,
  started_at,
  completed_at
FROM workflow_executions
ORDER BY started_at DESC
LIMIT 10;

-- Check steps
SELECT 
  step_name,
  status,
  execution_time_ms
FROM workflow_step_executions
WHERE workflow_execution_id = 'YOUR_EXECUTION_ID'
ORDER BY step_index;
```

**Expected**:
- ✅ Execution record created
- ✅ Step records created (5-7 steps depending on approval)
- ✅ Timestamps populated
- ✅ Status correct

---

## ✅ Success Checklist

After completing all steps, verify:

- [ ] Database migration applied
- [ ] All verification checks pass
- [ ] Environment variables set
- [ ] Code deployed to staging
- [ ] API endpoint `/api/workflows` returns 200
- [ ] Can list workflows (even if empty)
- [ ] Test workflow execution successful (if booking available)
- [ ] Database records created
- [ ] No errors in Vercel logs
- [ ] No errors in Supabase logs

---

## 🐛 Troubleshooting

### Issue: "Workflow Engine is disabled"
**Cause**: Feature flag not set or not deployed

**Solution**:
1. Check Vercel environment variables
2. Redeploy: `vercel --prod` or push to GitHub
3. Wait for deployment to finish (~2 min)
4. Test again

---

### Issue: "Module not found: @/lib/supabase-client"
**Cause**: Import path wrong (already fixed in latest code)

**Solution**:
1. Verify you pulled latest code: `git pull origin main`
2. Check commit: Should be `90ec2f73` or later
3. Redeploy

---

### Issue: "Booking not found"
**Cause**: No test booking created yet

**Solution**:
1. Create test booking via UI or API
2. Save booking ID
3. Use in workflow execution

---

### Issue: "Unauthorized"
**Cause**: Auth token expired or invalid

**Solution**:
1. Login to staging app again
2. Get fresh JWT token
3. Test again

---

### Issue: Database migration fails
**Cause**: Tables might already exist or permissions issue

**Solution**:
```sql
-- Check if tables exist
SELECT tablename 
FROM pg_tables 
WHERE tablename IN ('workflow_executions', 'workflow_step_executions');

-- If exist and you want to recreate (CAREFUL!)
DROP TABLE workflow_step_executions CASCADE;
DROP TABLE workflow_executions CASCADE;

-- Then re-run migration
```

---

## 📊 Performance Targets

Monitor these metrics after deployment:

| Metric | Target | How to Check |
|--------|--------|--------------|
| Execution Time | < 2s (P95) | Check `completed_at - started_at` in DB |
| API Response Time | < 500ms | Check Vercel logs |
| Success Rate | > 95% | Count completed vs failed in DB |
| Database Queries | < 100ms | Check Supabase performance tab |

---

## 📝 Document Your Deployment

After completing deployment, update checklist:

File: `docs/WORKFLOW_ENGINE_STAGING_DEPLOYMENT_CHECKLIST.md`

Mark each step as:
- [ ] TODO
- [x] DONE (with timestamp)
- [ ] BLOCKED (with reason)

Add notes on:
- Any issues encountered
- How you resolved them
- Actual execution times
- Performance metrics

---

## 🎉 What's Next?

**If Successful**:
1. ✅ Update deployment checklist
2. ✅ Document findings in `STAGING_DEPLOYMENT_REPORT.md`
3. ✅ Monitor for 24-48 hours
4. ✅ Get stakeholder feedback
5. ✅ Plan production pilot

**If Issues Found**:
1. Document all issues
2. Create bug tickets
3. Fix in development
4. Re-test locally (`npm run build`)
5. Re-deploy to staging
6. Repeat until stable

---

## 🚨 Emergency Rollback

If critical issues found:

```bash
# 1. Disable feature flags in Vercel (< 1 min)
FEATURE_WORKFLOW_ENGINE=false
FEATURE_WF_BOOKING_FULFILLMENT=false

# 2. Redeploy
vercel --prod

# 3. Verify disabled
curl $STAGING_URL/api/workflows -H "Authorization: Bearer $TOKEN"
# Should return: "Workflow Engine is disabled"
```

---

**Ready to deploy?** Let's go! 🚀

**Questions?** Check full checklist: `docs/WORKFLOW_ENGINE_STAGING_DEPLOYMENT_CHECKLIST.md`
