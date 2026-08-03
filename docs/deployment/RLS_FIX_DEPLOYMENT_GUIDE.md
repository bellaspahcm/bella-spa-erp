# RLS Security Fix - Deployment Guide

## 🎯 Objective
Fix infinite recursion in `user_roles` RLS policies that causes authentication failures and tenant isolation leaks.

## ⚠️ Problem Summary

### Current Issue
```
ERROR: infinite recursion detected in policy for relation "user_roles"
```

**Root Cause:**
1. Policy "Admins can view all roles" checks if user is admin
2. To check admin status, it queries `user_roles` table
3. Querying `user_roles` triggers the same policy again
4. Result: Infinite loop → Query fails

**Security Impact:**
- Admins cannot view user roles
- Tenant isolation may leak (nhân viên công ty A có thể thấy công ty B)
- Partner portal registration failures

## ✅ Solution

### Strategy
Replace recursive policies with simpler, non-recursive alternatives:

**Before (Problematic):**
```sql
-- This causes recursion ❌
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles  -- ⚠️ Recursion here!
      WHERE user_id = auth.uid() AND role_name = 'admin'
    )
  );
```

**After (Fixed):**
```sql
-- Simple, no recursion ✅
CREATE POLICY "Authenticated users can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Block modifications ✅
CREATE POLICY "Only service role can modify roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
```

### Trade-offs
- **Security:** Less restrictive (all authenticated users can read roles)
- **Reliability:** No more infinite loops ✅
- **Workaround:** Role modifications done server-side with elevated privileges

## 📋 Deployment Steps

### Step 1: Backup Current Policies
```sql
-- Run in Supabase Dashboard → SQL Editor
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles';
```

**Save output** to `docs/deployment/backups/user_roles_policies_backup_YYYYMMDD.sql`

### Step 2: Deploy Fix Script
1. Open Supabase Dashboard → SQL Editor
2. Copy content from `scripts/fix-rls-infinite-recursion.sql`
3. Click "Run"
4. Verify output shows:
   ```
   DROP POLICY
   CREATE POLICY
   GRANT
   ```

### Step 3: Verify Fix
Run verification query:
```sql
-- Check new policies
SELECT 
  policyname,
  cmd,
  qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;
```

**Expected Result:**
| policyname | cmd | using_clause |
|------------|-----|--------------|
| Users can view own roles | SELECT | (user_id = auth.uid()) |
| Authenticated users can view all roles | SELECT | true |
| Only service role can modify roles | ALL | false |

### Step 4: Test Authentication
```sql
-- Test as authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "test-user-id"}';

-- Should return rows (no infinite recursion)
SELECT * FROM user_roles LIMIT 5;

-- Should fail (blocked by policy)
INSERT INTO user_roles (user_id, role_name) VALUES ('test-id', 'admin');
-- Expected: ERROR: new row violates row-level security policy
```

### Step 5: Application Testing
1. **Login Test:**
   - Login as admin user
   - Should NOT see "infinite recursion" error
   - Should see admin dashboard

2. **Partner Registration Test:**
   - Go to `/partner/register`
   - Submit application
   - Should create application successfully

3. **Tenant Isolation Test:**
   - Login as user from Tenant A
   - Query user_roles
   - Should only see Tenant A roles (if tenant_id filter applied)

## 🔄 Rollback Plan

If deployment causes issues:

```sql
-- Rollback: Restore original policies
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Only service role can modify roles" ON user_roles;

-- Restore original (but keep them disabled if recursion occurs)
-- Original policies in backup file
```

## ⚠️ Important Notes

### Temporary Nature
This fix is **temporary**. Proper solution:

```sql
-- TODO: Implement SECURITY DEFINER function
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER  -- Bypass RLS
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role_name = 'admin'
  );
END;
$$;

-- Then use in policy (no recursion)
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (is_admin(auth.uid()));
```

### Migration Path
1. **Phase 1 (This deployment):** Fix recursion with simpler policies
2. **Phase 2 (Next sprint):** Implement SECURITY DEFINER functions
3. **Phase 3 (Future):** Migrate to capability-based auth (Bella EIP platform)

## 📊 Monitoring

After deployment, monitor:

1. **Error Logs:**
   ```bash
   # Check for "infinite recursion" errors
   grep -i "infinite recursion" /var/log/supabase/*.log
   ```

2. **Query Performance:**
   ```sql
   SELECT
     query,
     calls,
     mean_exec_time,
     max_exec_time
   FROM pg_stat_statements
   WHERE query LIKE '%user_roles%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Authentication Success Rate:**
   - Monitor login success/failure rates
   - Check for 500 errors on admin routes

## 🎯 Success Criteria

✅ Deployment successful if:
- [ ] No "infinite recursion" errors in logs
- [ ] Admin users can login successfully
- [ ] Partner registration works
- [ ] User roles visible in admin dashboard
- [ ] INSERT/UPDATE on user_roles blocked for regular users
- [ ] Query performance: user_roles SELECT < 50ms

## 📝 Post-Deployment Checklist

- [ ] Backup policies saved
- [ ] Script executed in Supabase Dashboard
- [ ] Verification query shows 3 policies
- [ ] Login test passed (admin user)
- [ ] Partner registration test passed
- [ ] No infinite recursion errors in last 5 minutes
- [ ] Document deployed in production notes
- [ ] Notify team in Slack/Discord

## 🔗 Related Documents

- Script: `scripts/fix-rls-infinite-recursion.sql`
- Partner Portal: `scripts/deploy-partner-portal-manual.sql`
- Architecture: `docs/real-estate/CHIEF_ARCHITECT_REVIEW.md`

---

**Deployed:** [DATE]  
**By:** [NAME]  
**Environment:** Production / Staging  
**Status:** ✅ Success / ⚠️ Partial / ❌ Failed  
**Notes:** [Any issues or observations]
