# Deployment Runbook - Critical Fixes & Partner Portal

## 🎯 Deployment Overview

**Deployment:** Critical Security Fixes + Partner Portal  
**Estimated Time:** 5-10 minutes  
**Risk Level:** Medium (RLS changes affect authentication)  
**Rollback Time:** 2 minutes

### What's Being Deployed

1. **RLS Security Fix** - Fix infinite recursion in user_roles policies
2. **Partner Portal** - Enable partner registration system

---

## ✅ Pre-Deployment Checklist

### Required Access
- [ ] Supabase Dashboard access (Project Owner/Admin)
- [ ] Access to production database
- [ ] Backup access (in case rollback needed)

### Environment Verification
```sql
-- Verify you're in correct project
SELECT current_database(), current_user;
```

Expected: `postgres`, `postgres` (or your DB name)

### Backup Current State
```sql
-- Backup user_roles policies
SELECT 
  policyname,
  cmd,
  qual::text AS using_clause,
  with_check::text AS with_check_clause
FROM pg_policies
WHERE tablename = 'user_roles';
```

**Save output to:** `backups/user_roles_policies_pre_deploy_$(date +%Y%m%d_%H%M%S).txt`

---

## 🚀 Deployment Steps

### Step 1: Open SQL Editor
1. Go to Supabase Dashboard
2. Select project
3. Click "SQL Editor" in left sidebar
4. Click "New Query"

### Step 2: Deploy Script
1. Open file: `scripts/deploy-critical-fixes.sql`
2. Copy entire content
3. Paste into SQL Editor
4. Click "Run" (or press Ctrl+Enter)

### Step 3: Monitor Output
Watch for these messages:

```
✓ Dropped: Admins can view all roles
✓ Created: Authenticated users can view all roles
✓ Created: Only service role can modify roles
✅ RLS Fix deployed successfully!

✓ Created enum: partner_application_status
✓ Created tables and indexes
✓ Created RLS policies
✓ Created RPC functions
✅ DEPLOYMENT COMPLETED SUCCESSFULLY
```

### Step 4: Verify Deployment
```sql
-- Check policies count
SELECT COUNT(*) AS policy_count 
FROM pg_policies 
WHERE tablename = 'user_roles';
-- Expected: >= 2

-- Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_name IN ('partner_applications', 'partner_application_logs')
ORDER BY table_name;
-- Expected: 2 tables

-- Check RPC functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('add_partner_document', 'remove_partner_document')
ORDER BY routine_name;
-- Expected: 2 functions
```

---

## 🧪 Post-Deployment Testing

### Test 1: Admin Login (RLS Fix Verification)
```bash
# Test admin user login
curl -X POST https://your-project.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "test123"
  }'
```

**Expected:** Status 200, JWT token returned (no infinite recursion error)

### Test 2: User Roles Query
```sql
-- As authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "test-user-id"}';

SELECT * FROM user_roles LIMIT 5;
```

**Expected:** Rows returned, no "infinite recursion" error

### Test 3: Role Modification (Should Fail)
```sql
-- Try to insert (should be blocked)
INSERT INTO user_roles (user_id, role_name) 
VALUES ('test-id', 'admin');
```

**Expected:** `ERROR: new row violates row-level security policy`

### Test 4: Partner Registration
1. Go to `https://your-domain.com/partner/register`
2. Fill form with test data
3. Click "Submit"

**Expected:** 
- Application created successfully
- Verification email sent
- Record appears in `partner_applications` table

### Test 5: Partner Portal Admin
1. Login as admin
2. Go to `/admin/partner-applications`
3. View applications list

**Expected:**
- Page loads without errors
- Test application visible
- Actions (approve/reject) available

---

## 📊 Health Checks

Run these queries 5 minutes after deployment:

```sql
-- 1. Check for errors in logs
SELECT 
  COUNT(*) AS error_count,
  error_message
FROM pg_stat_database_conflicts
WHERE datname = current_database()
GROUP BY error_message
ORDER BY error_count DESC;
-- Expected: 0 errors

-- 2. Check authentication success rate
SELECT 
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE status = 200) AS successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 200) / COUNT(*), 2) AS success_rate_pct
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Expected: success_rate_pct > 95%

-- 3. Check query performance
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%user_roles%'
  AND calls > 0
ORDER BY mean_exec_time DESC
LIMIT 5;
-- Expected: mean_exec_time < 50ms

-- 4. Check partner applications
SELECT 
  status,
  COUNT(*) AS count
FROM partner_applications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
-- Expected: At least 1 test application if manual test was run
```

---

## 🔴 Rollback Procedure

If issues occur, rollback immediately:

### Rollback Step 1: Restore RLS Policies
```sql
-- Drop new policies
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Only service role can modify roles" ON user_roles;

-- Restore simpler temporary policy
CREATE POLICY "Temporary allow all authenticated"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR true);
-- Note: This is permissive but stable (no recursion)
```

### Rollback Step 2: Disable Partner Portal (Optional)
```sql
-- Disable RLS to prevent access
ALTER TABLE partner_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs DISABLE ROW LEVEL SECURITY;

-- Or drop tables (nuclear option)
-- DROP TABLE IF EXISTS partner_application_logs CASCADE;
-- DROP TABLE IF EXISTS partner_applications CASCADE;
```

### Rollback Step 3: Verify
```sql
-- Test admin login again
SELECT * FROM user_roles WHERE user_id = auth.uid();
-- Should work without infinite recursion
```

### Rollback Time
**Target:** < 2 minutes from decision to rollback

---

## 📋 Post-Deployment Checklist

- [ ] All SQL statements executed successfully
- [ ] Verification queries passed
- [ ] Test 1: Admin login works
- [ ] Test 2: User roles query works
- [ ] Test 3: Role modification blocked
- [ ] Test 4: Partner registration works
- [ ] Test 5: Partner portal admin accessible
- [ ] Health checks: No errors in last 5 minutes
- [ ] Health checks: Auth success rate > 95%
- [ ] Health checks: Query performance < 50ms
- [ ] Monitoring: No alerts triggered
- [ ] Team notified in Slack/Discord
- [ ] Deployment documented in production log

---

## 🚨 Troubleshooting

### Issue: "infinite recursion detected in policy"
**Cause:** RLS fix not applied correctly  
**Solution:** Verify policies with:
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_roles';
```
Should show "Authenticated users can view all roles" policy

### Issue: Admin cannot login
**Cause:** Policy too restrictive or wrong policy  
**Solution:** 
1. Check policy using clause
2. Apply rollback procedure
3. Re-deploy with corrected script

### Issue: Partner registration returns 500 error
**Cause:** Missing tables or RPC functions  
**Solution:**
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'partner%';

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%partner%';
```

### Issue: "relation does not exist"
**Cause:** Script partially executed  
**Solution:** Re-run deployment script (idempotent)

---

## 📞 Escalation Path

1. **Level 1:** Check this runbook troubleshooting section
2. **Level 2:** Check Supabase logs in Dashboard
3. **Level 3:** Execute rollback procedure
4. **Level 4:** Contact DevOps team
5. **Level 5:** Supabase support (for platform issues)

---

## 📝 Deployment Log Template

```
Deployment Date: [YYYY-MM-DD HH:MM:SS]
Deployed By: [NAME]
Environment: Production / Staging
Script Version: deploy-critical-fixes.sql

Pre-Deployment:
- [ ] Backup completed
- [ ] Verification queries passed

Deployment:
- [ ] Script executed at: [HH:MM:SS]
- [ ] Duration: [X minutes]
- [ ] Errors: [None / Details]

Post-Deployment:
- [ ] All tests passed
- [ ] Health checks: [PASS/FAIL]
- [ ] Rollback needed: [No/Yes - Reason]

Status: ✅ Success / ⚠️ Partial / ❌ Failed
Notes: [Any observations or issues]

Next Deployment: [Date/Time]
```

---

## 🔗 Related Documents

- **Deployment Script:** `scripts/deploy-critical-fixes.sql`
- **RLS Fix Guide:** `docs/deployment/RLS_FIX_DEPLOYMENT_GUIDE.md`
- **Partner Portal Docs:** `docs/portal/DEPLOYMENT_CHECKLIST.md`
- **Architecture Review:** `docs/real-estate/CHIEF_ARCHITECT_REVIEW.md`
- **Monitoring Setup:** `docs/deployment/MONITORING_SETUP.md` (next task)

---

**Last Updated:** 2026-08-02  
**Version:** 1.0  
**Owner:** DevOps Team
