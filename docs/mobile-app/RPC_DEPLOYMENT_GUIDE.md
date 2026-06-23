# RPC Deployment Guide — Production Deployment
**Date:** 2026-06-22  
**Target:** Bella ERP Production Database  
**Migrations:** `20260621_mobile_rpc.sql` + `20260622_ktv_dashboard_stats.sql`

---

## 📋 OVERVIEW

This guide covers deploying 2 RPC functions for mobile app to production:

1. **`rpc_mobile_today_sessions`** - Fetch today's sessions with server-side filtering
2. **`rpc_ktv_dashboard_stats`** - Fetch KTV-specific dashboard stats

**Why these RPCs matter:**
- Replace insecure client-side filtering
- Fix KTV stats business logic bug
- Improve performance (single query vs multiple)
- Required for Week 3 → Week 4 transition

---

## ⚠️ PRE-DEPLOYMENT CHECKLIST

### Required Access
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Access to production project credentials
- [ ] Production project ref: `__________________`
- [ ] Staging project ref (for testing): `__________________`

### Backup
- [ ] Database backup taken (automatic daily backup exists)
- [ ] Rollback plan ready (see section below)

### Communication
- [ ] Team notified of deployment window
- [ ] Maintenance window scheduled (if needed): **NO DOWNTIME expected**

---

## 🔧 STEP-BY-STEP DEPLOYMENT

### Step 1: Test Locally (5 min)

**Verify migrations work locally:**

```bash
# Reset local database with migrations
cd "d:\Antigravity\Projects\BELLA SPA ERP"
supabase db reset

# Verify functions exist
supabase db diff
```

**Expected output:**
- No diff errors
- 2 functions created successfully

---

### Step 2: Deploy to Staging (15 min)

**Deploy migrations:**

```bash
# Link to staging project
supabase link --project-ref YOUR_STAGING_REF

# Push migrations
supabase db push
```

**Verify functions exist in staging:**

```sql
-- Connect to staging database
-- Run this query in Supabase Dashboard → SQL Editor

SELECT 
  routine_name,
  routine_type,
  security_type,
  volatility
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats')
ORDER BY routine_name;
```

**Expected result:**
```
routine_name                 | routine_type | security_type | volatility
-----------------------------+--------------+---------------+-----------
rpc_ktv_dashboard_stats      | FUNCTION     | DEFINER       | STABLE
rpc_mobile_today_sessions    | FUNCTION     | DEFINER       | STABLE
```

---

### Step 3: Test on Staging (30 min)

**A. Test `rpc_mobile_today_sessions`:**

```sql
-- Test as Admin (should see all sessions)
SELECT * FROM rpc_mobile_today_sessions(
  '<your-tenant-id>',
  CURRENT_DATE,
  NULL  -- NULL = admin sees all
);

-- Test as KTV (should see only assigned sessions)
SELECT * FROM rpc_mobile_today_sessions(
  '<your-tenant-id>',
  CURRENT_DATE,
  '<ktv-user-id>'  -- Specific KTV ID
);
```

**Verify:**
- Admin query returns ALL tenant sessions
- KTV query returns ONLY sessions where `assigned_ktv_id` = that KTV
- Results include: customer_name, baby_name, ktv_name, package_name

---

**B. Test `rpc_ktv_dashboard_stats`:**

```sql
-- Test with KTV who has sessions today
SELECT * FROM rpc_ktv_dashboard_stats(
  '<your-tenant-id>',
  '<ktv-user-id>',
  CURRENT_DATE
);
```

**Expected result:**
```
total_sessions | completed_sessions
---------------+-------------------
           5   |                3
```

**Verify:**
- `total_sessions` = count of sessions assigned to this KTV today
- `completed_sessions` = count where status = 'completed'
- Result is 0 if KTV has no sessions today

---

**C. Test with mobile app on staging:**

1. Update mobile app env to point to staging:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_staging_anon_key
   ```

2. Run mobile app locally:
   ```bash
   npm run mobile:dev
   ```

3. Login as KTV user

4. Verify dashboard shows correct stats:
   - KTV sees only their sessions (not all spa sessions)
   - Stats numbers are correct
   - No console errors about RPC

5. Test error handling:
   - Turn off network briefly
   - Verify error UI shows
   - Turn on network
   - Press retry
   - Verify data loads

---

### Step 4: Deploy to Production (10 min)

**⚠️ CRITICAL: Read entire step before executing**

**Deploy command:**

```bash
# Link to production project
supabase link --project-ref YOUR_PRODUCTION_REF

# Review what will be deployed
supabase db diff

# If diff looks correct, push to production
supabase db push

# ALTERNATIVE: If you prefer manual control, run migrations individually
supabase db execute --file supabase/migrations/20260621_mobile_rpc.sql
supabase db execute --file supabase/migrations/20260622_ktv_dashboard_stats.sql
```

**Expected output:**
```
Applying migration 20260621_mobile_rpc.sql...
Migration applied successfully.
Applying migration 20260622_ktv_dashboard_stats.sql...
Migration applied successfully.
```

---

### Step 5: Verify Production (15 min)

**A. Verify functions exist:**

```sql
-- In Supabase Dashboard → SQL Editor (Production)
SELECT 
  routine_name,
  routine_type,
  security_type,
  volatility,
  pg_get_functiondef(p.oid) as definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public' 
AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats');
```

**Verify:**
- Both functions exist
- `security_type` = DEFINER
- `volatility` = STABLE
- Function definitions match migration files

---

**B. Test with production data:**

```sql
-- Quick smoke test
SELECT COUNT(*) FROM rpc_mobile_today_sessions(
  (SELECT id FROM tenants LIMIT 1),
  CURRENT_DATE,
  NULL
);

-- Should return count of today's sessions (may be 0 if no sessions today)
```

---

**C. Monitor logs for 30 minutes:**

In Supabase Dashboard → Logs:

```
Filter: level:error AND message:rpc_mobile_today_sessions
       OR message:rpc_ktv_dashboard_stats
```

**Look for:**
- No RPC execution errors
- No permission errors
- No slow query warnings (>200ms)

---

### Step 6: Update Mobile App (5 min)

**Mobile app already uses these RPCs** (Week 3 code changes), so no code changes needed.

**Just verify env points to production:**

```env
# apps/mobile/.env.production
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROD_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
```

**Deploy updated mobile app:**
```bash
# Build for TestFlight/Internal Testing
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

---

## 🔍 VERIFICATION CHECKLIST

After deployment, verify:

### Database Level
- [ ] Both functions exist in production
- [ ] Functions have SECURITY DEFINER
- [ ] Functions have STABLE volatility
- [ ] GRANT EXECUTE permissions set correctly

### Functional Testing
- [ ] Admin query returns all tenant sessions
- [ ] KTV query returns only assigned sessions
- [ ] KTV stats show correct numbers (not all spa sessions)
- [ ] No SQL errors in logs

### Mobile App Testing
- [ ] Login works
- [ ] Dashboard loads
- [ ] KTV sees correct session count
- [ ] Pull-to-refresh works
- [ ] Error handling works

### Performance
- [ ] RPC queries complete in <200ms (check logs)
- [ ] No N+1 query warnings
- [ ] No timeout errors

---

## 🚨 ROLLBACK PLAN

**If issues occur, rollback immediately:**

### Option 1: Drop Functions (30 seconds)

```sql
-- Rollback: Drop both functions
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS rpc_ktv_dashboard_stats(UUID, UUID, DATE);
```

**Effect:**
- Mobile app will show error messages (expected)
- Mobile app will NOT use fallback (fallback was removed in Week 3)
- Users will need to wait for fix

---

### Option 2: Restore from Backup (5-10 min)

```bash
# In Supabase Dashboard → Database → Backups
# Click "Restore" on the latest backup before deployment
```

**Effect:**
- Entire database restored to pre-deployment state
- All functions removed
- Data created after backup will be lost (⚠️ use with caution)

---

### Option 3: Redeploy Fixed Version (10 min)

If functions have bugs:

1. Fix SQL in migration files
2. Create new migration:
   ```bash
   supabase migration new fix_rpc_functions
   ```
3. Add corrected `CREATE OR REPLACE FUNCTION` statements
4. Deploy fix:
   ```bash
   supabase db push
   ```

---

## 📊 POST-DEPLOYMENT MONITORING

### First 24 Hours

**Monitor these metrics:**

1. **Error Rate:**
   - Supabase Dashboard → Logs → Filter errors
   - Look for: RPC execution failures, permission denied, slow queries

2. **Performance:**
   - Query duration: Should be <200ms average
   - Use: Supabase Dashboard → Database → Query Performance

3. **User Feedback:**
   - Check support channels (Telegram, Zalo)
   - Look for: "Dashboard blank", "Wrong numbers", "Error messages"

4. **Mobile App Crashes:**
   - Once Sentry is setup, check crash rate
   - For now: Monitor user reports

---

### Red Flags

**Rollback immediately if:**

- RPC error rate >5% of requests
- Query duration >1 second consistently
- Permission denied errors
- Multiple users report dashboard issues
- KTV stats still showing wrong numbers

---

## 📝 DEPLOYMENT LOG TEMPLATE

**Use this to document your deployment:**

```markdown
# RPC Deployment Log

**Date:** 2026-06-__
**Deployed by:** __________
**Project Ref:** __________

## Staging Deployment
- [ ] Time: __:__
- [ ] Functions created: ✅ / ❌
- [ ] Tests passed: ✅ / ❌
- [ ] Issues: None / [describe]

## Production Deployment
- [ ] Time: __:__
- [ ] Functions created: ✅ / ❌
- [ ] Verification query: ✅ / ❌
- [ ] Mobile app tested: ✅ / ❌

## Post-Deployment (24h)
- [ ] Error rate: __%
- [ ] Avg query time: __ms
- [ ] User issues reported: __
- [ ] Rollback needed: Yes / No

## Notes:
[Any issues, observations, or improvements for next time]
```

---

## 🎯 SUCCESS CRITERIA

**Deployment is successful when:**

✅ Both RPC functions exist in production  
✅ Admin users see all tenant sessions  
✅ KTV users see only their assigned sessions  
✅ KTV dashboard stats show correct numbers (not all spa sessions)  
✅ No RPC errors in logs for 24 hours  
✅ Mobile app works correctly on devices  
✅ Query performance <200ms average  
✅ No user complaints about incorrect data  

**Once all criteria met:** ✅ **Week 4 UNBLOCKED**

---

## 📞 SUPPORT CONTACTS

**If issues during deployment:**

- Database Team: [contact]
- DevOps Team: [contact]
- Mobile Team: [contact]
- On-call: [contact]

**Escalation path:**
1. Check logs for error details
2. Try rollback Option 1 (drop functions)
3. If not resolved, escalate to Database Team
4. If critical, use rollback Option 2 (restore backup)

---

**Document Owner:** Mobile Development Team  
**Last Updated:** 2026-06-22  
**Version:** 1.0
