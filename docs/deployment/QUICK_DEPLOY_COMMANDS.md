# Quick Deploy Commands - Phase 0

**Status:** ✅ Code pushed, database migration pending

---

## 🚀 Next Actions Required

### 1. Database Migration (5 minutes)

```bash
# Connect to production Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push feature_flags table migration
supabase db push

# Verify table created
supabase db execute "SELECT * FROM feature_flags LIMIT 1;"
```

**Expected Output:**
```
Applying migration 20260807000001_create_feature_flags_table.sql...
✓ Migration applied successfully
```

---

### 2. Verify Vercel Deployment (Auto)

Vercel should auto-deploy after git push. Check status:

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Check deployment status
vercel ls

# View logs of latest deployment
vercel logs
```

**Or via Dashboard:**
- Go to: https://vercel.com/[your-team]/bella-spa-erp/deployments
- Check latest deployment (commit a30ae136)
- Verify: "Ready" status with green checkmark

---

### 3. Enable Feature Flag for Pilot (10 minutes)

After deployment succeeds, enable new architecture for 1 test tenant:

```sql
-- Via Supabase SQL Editor (https://supabase.com/dashboard/project/[ref]/editor)

INSERT INTO feature_flags (
  key,
  name,
  description,
  enabled,
  rollout_strategy,
  rollout_config,
  metadata
) VALUES (
  'healthcare.new-engine-architecture',
  'Healthcare Platform-of-Platforms Architecture',
  'Phase 0: Bed, Nursing, Pharmacy engines with Contract Registry',
  true,
  'manual',
  jsonb_build_object(
    'enabledTenants', 
    jsonb_build_array('YOUR_TEST_TENANT_ID')  -- ← Replace with actual tenant ID
  ),
  jsonb_build_object(
    'deployedAt', NOW(),
    'phase', 'Phase 0',
    'constitutionCompliance', '91/100',
    'engines', jsonb_build_array('BedEngine', 'NursingEngine', 'PharmacyEngine')
  )
);
```

**Verify flag created:**
```sql
SELECT key, name, enabled, rollout_strategy, rollout_config
FROM feature_flags
WHERE key = 'healthcare.new-engine-architecture';
```

---

### 4. Smoke Test (15 minutes)

Login to pilot tenant and test 3 engines:

#### Test 1: Bed Engine
1. Navigate: `https://[your-domain]/dashboard/hospital/beds`
2. Click "Allocate Bed" for a patient
3. ✅ Expected: Bed allocated successfully, no console errors
4. Check Network tab: Look for `/api/healthcare/beds` calls

#### Test 2: Nursing Engine
1. Navigate: `https://[your-domain]/dashboard/hospital/nursing-vitals`
2. Record vital signs for a patient
3. ✅ Expected: Vitals saved, displayed in timeline
4. Check Network tab: Look for `/api/healthcare/vitals` calls

#### Test 3: Pharmacy Engine
1. Navigate: `https://[your-domain]/dashboard/hospital/mar`
2. Record medication administration (MAR)
3. ✅ Expected: MAR updated, medication history shows entry
4. Check Network tab: Look for `/api/healthcare/mar` calls

**All tests pass?** → Proceed to 48-hour monitoring  
**Any test fails?** → Check rollback section below

---

### 5. Monitor Logs (Continuous)

#### Vercel Logs (Real-time errors)
```bash
vercel logs --follow
```

#### Supabase Logs (Database queries)
```sql
-- Check feature flag queries
SELECT * FROM auth.audit_log_entries
WHERE entity_table = 'feature_flags'
ORDER BY created_at DESC
LIMIT 50;
```

#### Browser Console (Client-side)
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests
- Look for: `[BedEngine]`, `[NursingEngine]`, `[PharmacyEngine]` logs

---

## 🚨 Rollback Commands (If Issues Detected)

### Option 1: Disable Feature Flag (Fastest - 1 minute)
```sql
-- Soft rollback: Disable new architecture, keep code deployed
UPDATE feature_flags 
SET enabled = false 
WHERE key = 'healthcare.new-engine-architecture';
```
**Impact:** Users fall back to legacy services immediately  
**Downtime:** 0 minutes

---

### Option 2: Revert Git Commit (Fast - 5 minutes)
```bash
# Revert Phase 0 commit
git revert a30ae136

# Push revert
git push origin main

# Wait for Vercel auto-deploy (~3 minutes)
```
**Impact:** All Phase 0 code removed  
**Downtime:** ~3 minutes during redeploy

---

### Option 3: Vercel Instant Rollback (Medium - 10 minutes)
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment (before a30ae136)
vercel rollback [PREVIOUS_DEPLOYMENT_URL]
```
**Or via Dashboard:**
1. Go to: https://vercel.com/[your-team]/bella-spa-erp/deployments
2. Find deployment before a30ae136
3. Click "..." → "Promote to Production"

**Impact:** Full rollback to previous state  
**Downtime:** ~5 minutes

---

## 📊 Monitoring Queries

### Check Feature Flag Usage
```sql
-- How many times was flag queried today?
SELECT 
  COUNT(*) as query_count,
  COUNT(DISTINCT user_id) as unique_users
FROM logs.feature_flag_checks  -- If you have audit logging
WHERE flag_key = 'healthcare.new-engine-architecture'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

### Check Engine Error Rate
```sql
-- Count errors from new engines (if you have error tracking table)
SELECT 
  error_type,
  COUNT(*) as error_count
FROM error_logs
WHERE source IN ('BedEngine', 'NursingEngine', 'PharmacyEngine')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY error_count DESC;
```

### Check Performance
```sql
-- Average response time for engine operations (if you have metrics table)
SELECT 
  operation_name,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  COUNT(*) as operation_count
FROM performance_metrics
WHERE service IN ('BedEngine', 'NursingEngine', 'PharmacyEngine')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY operation_name
ORDER BY avg_duration_ms DESC;
```

---

## ✅ Deployment Completion Checklist

- [ ] Database migration applied (`feature_flags` table exists)
- [ ] Vercel deployment succeeded (commit a30ae136 live)
- [ ] Feature flag enabled for 1 pilot tenant
- [ ] Smoke tests passed (Bed, Nursing, Pharmacy engines work)
- [ ] No console errors on pilot tenant
- [ ] Monitoring started (48-hour watch)
- [ ] Rollback plan communicated to team
- [ ] Deployment documented in log (see PHASE_0_DEPLOYMENT_CHECKLIST.md)

**Status Update:** ✅ Phase 0 deployed successfully, monitoring in progress

**Next Review:** 48 hours from deployment start  
**Go/No-Go for 10% rollout:** After 1 week of stable operation

---

## 📞 Support

**Deployment Issues?**
- Check: `docs/deployment/PHASE_0_DEPLOYMENT_CHECKLIST.md`
- Logs: `vercel logs --follow`
- Rollback: See "Rollback Commands" section above

**Technical Questions?**
- Architecture: See `docs/architecture/ADR-010-Phase-0-Platform-Refactor.md`
- Engines: See `src/platform/healthcare/README.md`
- Feature Flags: See `src/platform/host/feature-flags/README.md`

---

**Last Updated:** 2026-08-07  
**Deployment Commit:** a30ae136  
**Constitution Compliance:** 91/100
