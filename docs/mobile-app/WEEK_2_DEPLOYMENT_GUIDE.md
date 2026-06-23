# Week 2 Deployment Guide — RPC Migration & Testing
**Date:** 2026-06-22
**Target:** Staging/Production Supabase instance

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Verify Local Build
```bash
✓ npm run shared:typecheck — PASSED
✓ npm run mobile:typecheck — PASSED
✓ npm run build — PASSED
```

### 2. Review Migration File
- ✅ File: `supabase/migrations/20260621_mobile_rpc.sql`
- ✅ Security: `SECURITY DEFINER` with tenant_id filter
- ✅ Permissions: `GRANT EXECUTE TO authenticated`
- ✅ Performance: Documented index suggestion

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy RPC Migration

**Option A: Supabase CLI (Recommended)**
```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push

# Verify migration applied
supabase db diff
```

**Option B: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy content from `supabase/migrations/20260621_mobile_rpc.sql`
5. Run the SQL
6. Verify success message

**Option C: Direct psql**
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260621_mobile_rpc.sql
```

---

### Step 2: Verify RPC Function

**Check function exists:**
```sql
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'rpc_mobile_today_sessions';
```

**Expected result:**
```
routine_name              | routine_type | security_type
--------------------------|--------------|---------------
rpc_mobile_today_sessions | FUNCTION     | DEFINER
```

---

### Step 3: Test RPC with Sample Data

**Test as Admin (see all sessions):**
```sql
SELECT * FROM rpc_mobile_today_sessions(
  p_tenant_id := 'YOUR_TENANT_ID'::uuid,
  p_today := CURRENT_DATE,
  p_ktv_id := NULL
);
```

**Test as KTV (filtered sessions):**
```sql
SELECT * FROM rpc_mobile_today_sessions(
  p_tenant_id := 'YOUR_TENANT_ID'::uuid,
  p_today := CURRENT_DATE,
  p_ktv_id := 'SOME_KTV_USER_ID'::uuid
);
```

**Expected columns:**
- session_id
- booking_id
- status
- assigned_time
- customer_name
- baby_name
- ktv_name
- package_name
- completed_sessions
- total_sessions

---

### Step 4: Test from Supabase Client

**Node.js test script:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
);

async function testRpc() {
  const { data, error } = await supabase.rpc('rpc_mobile_today_sessions', {
    p_tenant_id: 'YOUR_TENANT_ID',
    p_today: new Date().toISOString().split('T')[0],
    p_ktv_id: null, // Admin view
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data.length, 'sessions');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

testRpc();
```

---

### Step 5: Performance Check

**Check query execution time:**
```sql
EXPLAIN ANALYZE
SELECT * FROM rpc_mobile_today_sessions(
  p_tenant_id := 'YOUR_TENANT_ID'::uuid,
  p_today := CURRENT_DATE,
  p_ktv_id := NULL
);
```

**Expected:**
- Execution time: < 100ms for ~50 sessions
- Planning time: < 10ms

**If slow (> 200ms), add index:**
```sql
CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_date_status
  ON session_logs(tenant_id, scheduled_date, status)
  WHERE status != 'completed';
```

---

## 🧪 MOBILE APP TESTING

### Test 1: RPC vs Fallback

**Before deployment (expect fallback):**
1. Open mobile app
2. Check console: Should see warning "RPC not available, using fallback join"
3. Dashboard should still load (via fallback)

**After deployment (expect RPC):**
1. Kill and restart mobile app
2. Check console: No RPC warning
3. Dashboard loads faster (~80ms vs ~200ms)

---

### Test 2: Tenant Isolation

**Setup:**
- User A: Tenant 1, Role: KTV
- User B: Tenant 2, Role: KTV

**Test:**
1. Login as User A
2. Verify dashboard shows only Tenant 1 sessions
3. Logout
4. Login as User B
5. Verify dashboard shows only Tenant 2 sessions
6. Verify NO cross-tenant data leaks

---

### Test 3: Role-Based Filtering

**Setup:**
- User C: Tenant 1, Role: Admin
- User D: Tenant 1, Role: KTV (ID: xxx)

**Test:**
1. Login as User C (Admin)
2. Verify dashboard shows ALL Tenant 1 sessions
3. Logout
4. Login as User D (KTV)
5. Verify dashboard shows ONLY sessions assigned to User D
6. Verify no sessions from other KTVs visible

---

### Test 4: Realtime Updates

**Setup:**
- Mobile app open on dashboard
- Web admin open on bookings page

**Test:**
1. Create new session in web admin
2. Verify mobile dashboard updates after ~500ms debounce
3. Update session status in web admin
4. Verify mobile dashboard reflects change
5. Delete session in web admin
6. Verify mobile dashboard removes item

---

### Test 5: Cache Behavior

**Test:**
1. Open mobile app → Dashboard loads
2. Kill app completely
3. Turn off WiFi/data
4. Reopen app
5. Verify tenant name shows (from cache)
6. Verify dashboard shows empty state (no cached sessions)
7. Turn on WiFi/data
8. Verify dashboard refreshes automatically

---

## 📊 MONITORING

### Key Metrics to Track

**Query Performance:**
```sql
-- Check RPC call frequency
SELECT 
  COUNT(*) as call_count,
  AVG(duration_ms) as avg_duration
FROM pg_stat_statements
WHERE query LIKE '%rpc_mobile_today_sessions%'
  AND calls > 0;
```

**Error Rate:**
- Monitor Supabase logs for RPC errors
- Check mobile app Sentry/crash reports

**Cache Hit Rate:**
- Monitor AsyncStorage reads vs API calls
- Target: >90% cache hit rate

---

## 🔧 ROLLBACK PLAN

**If RPC causes issues:**

### Option 1: Drop Function (Quick)
```sql
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions;
```

**Effect:**
- Mobile app will fall back to direct join automatically
- No code deploy needed
- Slightly slower but still works

### Option 2: Revert Migration (Clean)
```bash
# Create revert migration
supabase migration new revert_mobile_rpc

# Content:
DROP FUNCTION IF EXISTS rpc_mobile_today_sessions CASCADE;

# Push
supabase db push
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Checklist

- [ ] RPC function exists in database
- [ ] RPC returns correct data for test tenant
- [ ] Admin sees all sessions
- [ ] KTV sees only their sessions
- [ ] No cross-tenant leaks
- [ ] Performance < 100ms
- [ ] Mobile app uses RPC (no fallback warning)
- [ ] Realtime updates work
- [ ] Cache works offline
- [ ] No errors in Supabase logs
- [ ] No crashes in mobile app

---

## 🐛 TROUBLESHOOTING

### Issue: RPC returns empty array

**Possible causes:**
1. No sessions for today
2. Wrong tenant_id
3. Wrong date format

**Debug:**
```sql
-- Check if sessions exist
SELECT COUNT(*) FROM session_logs 
WHERE tenant_id = 'YOUR_TENANT_ID'
  AND scheduled_date = CURRENT_DATE;

-- Check RPC directly
SELECT * FROM rpc_mobile_today_sessions(
  'YOUR_TENANT_ID'::uuid,
  CURRENT_DATE,
  NULL
);
```

---

### Issue: "Permission denied for function"

**Cause:** Missing GRANT

**Fix:**
```sql
GRANT EXECUTE ON FUNCTION rpc_mobile_today_sessions TO authenticated;
```

---

### Issue: Mobile app still uses fallback

**Possible causes:**
1. RPC not deployed yet
2. Wrong function name
3. Supabase client cache

**Fix:**
1. Verify RPC exists in database
2. Hard refresh mobile app (kill + restart)
3. Clear AsyncStorage if needed

---

### Issue: Slow query (> 200ms)

**Cause:** Missing index

**Fix:**
```sql
CREATE INDEX idx_session_logs_tenant_date_status
  ON session_logs(tenant_id, scheduled_date, status)
  WHERE status != 'completed';

-- Also check bookings table
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_customer
  ON bookings(tenant_id, customer_id);
```

---

## 📈 SUCCESS CRITERIA

**Deployment is successful if:**
1. ✅ RPC exists and returns correct data
2. ✅ Mobile app uses RPC (no fallback warnings)
3. ✅ Query performance < 100ms
4. ✅ No cross-tenant data leaks
5. ✅ Role-based filtering works correctly
6. ✅ Realtime updates work
7. ✅ No production errors for 24 hours

---

## 📞 SUPPORT

**If issues occur:**
1. Check Supabase logs: Dashboard → Logs
2. Check mobile app console
3. Roll back using instructions above
4. Create incident report with:
   - Error message
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs

---

**Deployment Owner:** Backend Team
**Testing Owner:** Mobile Team
**Approval Required:** QA + Product Manager

**Date Deployed:** ____________
**Deployed By:** ____________
**Verified By:** ____________
