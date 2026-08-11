# Instructions: Restart PostgREST on Supabase Dashboard

**Goal:** Force PostgREST schema cache refresh to make `courses` and `enrollments` tables visible to Supabase JS Client.

---

## Step 1: Access Supabase Dashboard

1. Open browser: https://supabase.com/dashboard
2. Login with your account
3. Select project: **bellaspahcm's Project** (`lvnvkpyxtuilhrabtlwv`)

---

## Step 2: Locate PostgREST Restart Option

### Option A: Database Settings (Most Common)

1. Go to **Database** section (left sidebar)
2. Click **Settings** tab
3. Look for **PostgREST** section
4. Find button: **Restart PostgREST** or **Reload Schema Cache**
5. Click and confirm restart

### Option B: Project Settings

1. Go to **Settings** (gear icon, bottom left)
2. Click **API** tab
3. Look for **PostgREST** or **Schema Cache** section
4. Find button: **Restart** or **Refresh Schema**
5. Click and confirm

### Option C: Database Pooler (If Using Connection Pooling)

1. Go to **Database** → **Connection Pooler**
2. Look for **PostgREST** status
3. Click **Restart** if available

### Option D: Manual Schema Reload (Fallback)

If no restart button found, try manual SQL reload:

1. Go to **SQL Editor**
2. Create new query
3. Run this command:
   ```sql
   NOTIFY pgrst, 'reload schema';
   NOTIFY pgrst, 'reload config';
   ```
4. Wait 30-60 seconds
5. Check if schema refreshed

---

## Step 3: Verify Schema Refresh

After restart, verify tables are now visible:

### Method 1: Test Script (Recommended)

Run in project terminal:
```bash
node scripts/test_postgrest_schema.js
```

**Expected output:**
```
✅ courses table is visible to PostgREST
✅ enrollments table is visible to PostgREST
✅ students table is visible (control test passed)
```

### Method 2: Direct API Test

Open browser console (F12) and run:
```javascript
fetch('https://lvnvkpyxtuilhrabtlwv.supabase.co/rest/v1/courses?select=id&limit=0', {
  headers: {
    'apikey': 'sb_publishable_wyBe78-eZNjDM2MZ8ETeig_bwxM0QOr',
    'Authorization': 'Bearer sb_publishable_wyBe78-eZNjDM2MZ8ETeig_bwxM0QOr'
  }
})
.then(r => r.json())
.then(console.log)
```

**Expected:** Empty array `[]` (not error)  
**Failure:** `{"message": "Could not find..."}` or permission error

---

## Step 4: Re-run Integration Tests

Once schema refresh confirmed, run tests:

```bash
npm test src/platform/education/enrollment/__tests__/enrollment.integration.test.ts
```

**Expected outcome:** 14/14 tests pass ✅

**If still failing:**
- Schema cache may take 2-5 more minutes to propagate
- Wait and re-run test
- If persists after 10 minutes → Move to Option C (Local Dev)

---

## Step 5: Record Evidence

**If 14/14 tests pass:**

1. Calculate total Enrollment time:
   - Code time: 35 minutes
   - Infrastructure wait: ? minutes (from start to test pass)
   - **Total:** ? minutes

2. Update status:
   ```bash
   # Update ENROLLMENT_E2E_STATUS.md
   Status: ✅ COMPLETE
   Wall-clock: [total time]
   E2E: 14/14 tests pass
   ```

3. Compare to Student:
   - Student: 75 minutes
   - Enrollment: ? minutes
   - Acceleration: ?%

4. Proceed to Course capability

---

## Troubleshooting

### PostgREST Restart Not Available in Dashboard

**Reason:** Supabase Cloud may not expose direct restart button for free/hobby tiers.

**Solutions:**
1. Wait 20-30 minutes for auto-refresh (most reliable)
2. Switch to Supabase local dev (Option C)
3. Contact Supabase support for manual restart

### Tests Still Fail After Restart

**Possible causes:**
1. Schema cache not fully propagated (wait 5 more minutes)
2. RLS policies blocking access (check policies in SQL Editor)
3. Service role key incorrect (verify `.env.test`)
4. Different Supabase project (verify `lvnvkpyxtuilhrabtlwv`)

**Debug steps:**
1. Run `node scripts/test_postgrest_schema.js` again
2. If HTTP API works but Jest fails → Supabase JS Client issue (rare)
3. If HTTP API also fails → PostgREST not refreshed yet

### Schema Visible but Tests Still Timeout

**Cause:** Network/connection issue, not schema cache.

**Fix:**
1. Check internet connection
2. Verify Supabase project not paused
3. Check Supabase status page: https://status.supabase.com/

---

## What NOT to Do

❌ **Don't** create more workaround code  
❌ **Don't** modify test logic to bypass schema check  
❌ **Don't** create additional helper RPCs  
❌ **Don't** continue to Course before Enrollment E2E pass  
❌ **Don't** mark Enrollment complete if tests don't pass

---

## Success Criteria

✅ PostgREST restarted (or schema cache manually reloaded)  
✅ `node scripts/test_postgrest_schema.js` shows all tables visible  
✅ `npm test .../enrollment.integration.test.ts` returns 14/14 pass  
✅ Total Enrollment time recorded (code + wait)  
✅ Evidence documented for Platform acceleration comparison

---

**Current Status:** Waiting for user to restart PostgREST via dashboard  
**Next Step:** Re-run tests after restart  
**Fallback:** If restart not available → Option C (Local Dev)
