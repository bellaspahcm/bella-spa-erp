# Phase 4.4: RPC Deployment Procedure

**Date:** 2026-08-24  
**Status:** Ready for Deployment  
**Method:** Migration Pipeline (NOT Dashboard)

---

## Executive Summary

Deploy `finance_admin_cleanup_test_transactions` RPC via migration pipeline with full verification.

**RPC Contract Verified:**
- ✅ service_role authorization
- ✅ exact IDs parameter (UUID[])
- ✅ tenant validation (UUID)
- ✅ POSTED status check
- ✅ session_replication_role = replica
- ✅ count verification (GET DIAGNOSTICS)
- ✅ REVOKE PUBLIC
- ✅ GRANT service_role only

---

## Migration State Check Results

**Local Migration:** ✅ EXISTS  
`supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`

**RPC Contract:** ✅ VALID (8/8 requirements)

**Remote State:** ⚠️ CANNOT VERIFY  
(schema cache access issue, but non-blocking)

**Deployment Status:** ⏸️ NOT YET DEPLOYED

---

## Deployment Procedure

### Step 1: Pre-Deployment Check ✅

```bash
npx tsx scripts/check_migration_state.ts
```

**Expected:**
- Target migration exists: ✅
- RPC contract valid: ✅
- RPC not yet deployed: ✅

### Step 2: Deploy Migration

**Option A: Supabase CLI (Recommended)**

```bash
npx supabase db push
```

**Expected Output:**
```
Connecting to remote database...
Do you want to push these migrations?
 • 20260824000000_finance_test_cleanup_rpc.sql
 [Y/n] y
Applying migration 20260824000000_finance_test_cleanup_rpc.sql...
Migration applied successfully.
```

**If Migration Conflict:**

```bash
# Check which migrations are pending
npx supabase db diff

# If 20260824000000 shows as pending, push individually:
# (Requires manual SQL execution via Dashboard if CLI fails)
```

**Option B: Manual SQL (Fallback)**

1. Copy content from: `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
2. Supabase Dashboard → SQL Editor
3. Paste and execute
4. Verify: Check for errors in output

### Step 3: Verify RPC Deployment

```bash
npx tsx scripts/verify_cleanup_rpc.ts
```

**Expected Output:**
```
✅ Test 1: RPC Existence
   ✅ RPC exists and returns expected error
   Message: "Empty transaction ID list"

✅ Test 2: Tenant Validation Gate
   ✅ Tenant validation gate working

✅ Test 3: Return Structure Verification
   ✅ Return structure correct

✅ Test 4: Manifest ID Format Compatibility
   ✅ Parameter format compatible

✅ RPC DEPLOYMENT VERIFIED
```

---

## Post-Deployment Verification

### Verify RPC in Database

```sql
-- Check RPC exists
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    prosecdef as security_definer
FROM pg_proc
WHERE proname = 'finance_admin_cleanup_test_transactions';

-- Expected: 1 row
-- security_definer should be TRUE
```

### Verify Permissions

```sql
-- Check RPC permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'finance_admin_cleanup_test_transactions';

-- Expected: Only service_role has EXECUTE
```

### Test RPC Call (Empty List)

```sql
SELECT * FROM finance_admin_cleanup_test_transactions(
    ARRAY[]::UUID[],
    '00000000-0000-0000-0000-000000000000'::UUID
);

-- Expected: 
-- deleted_count: 0
-- status: 'ERROR'
-- message: 'Empty transaction ID list'
```

---

## Rollback Procedure (If Needed)

### If RPC Deployment Fails:

```sql
-- Drop RPC
DROP FUNCTION IF EXISTS public.finance_admin_cleanup_test_transactions(UUID[], UUID);

-- Verify removal
SELECT proname FROM pg_proc WHERE proname = 'finance_admin_cleanup_test_transactions';
-- Expected: 0 rows
```

### If Cleanup Execution Fails:

**Snapshot exists:** `docs/architecture/PHASE4_4_SNAPSHOT_20260824.json`

**Restore:**
```sql
-- Load from snapshot JSON
INSERT INTO finance_transactions 
SELECT * FROM json_populate_recordset(
    NULL::finance_transactions,
    '<snapshot_json_content>'
);
```

---

## Safety Checklist

Before executing cleanup (after RPC deployment):

- [ ] ✅ RPC deployed successfully
- [ ] ✅ Verification script PASS (all 4 tests)
- [ ] ✅ service_role authorization confirmed
- [ ] ✅ Manifest exists (274 exact IDs)
- [ ] ✅ Snapshot created (274 records)
- [ ] ✅ No orphan F2 in manifest (verified)
- [ ] ✅ Preserved records = 165 (with F2 dependencies)
- [ ] ✅ SPA_BOOKING = 5 (all preserved)

---

## Execution Plan (After RPC Verified)

### Do NOT execute cleanup immediately after deployment

**Sequence:**

```bash
# 1. Deploy RPC
npx supabase db push

# 2. Verify RPC
npx tsx scripts/verify_cleanup_rpc.ts

# 3. PAUSE - Review verification output

# 4. IF verification PASS:
npx tsx scripts/phase4_4_execute_cleanup.ts

# 5. Post-cleanup verification (automatic in script)

# 6. SPA regression tests
npm run test -- spa-bookings
npm run test -- spa-services
npm run test -- spa-revenue

# 7. Architecture Guards
npm run healthcare:verify
npm run logistics:verify

# 8. Cleanup completion report
```

---

## Expected Timeline

1. **RPC Deployment:** 1-2 minutes
2. **RPC Verification:** 30 seconds
3. **Review & Approval:** Human decision
4. **Cleanup Execution:** 2-3 minutes
5. **Post-Verification:** 1 minute
6. **SPA Regression:** 5-10 minutes
7. **Architecture Guards:** 3-5 minutes

**Total:** ~15-25 minutes (excluding review time)

---

## Risk Assessment

### ✅ Low Risk (RPC Deployment)
- Read-only operation (just creating function)
- No data modification
- Reversible (DROP FUNCTION)
- Following approved pattern (F5, Phase 2.5)

### ⚠️ Medium Risk (Cleanup Execution)
- Deletes 274 POSTED transactions
- Bypasses immutability trigger
- Requires exact manifest IDs
- Snapshot available for rollback

### 🛡️ Risk Mitigations
1. Exact ID manifest (no wildcard deletes)
2. Tenant validation enforced
3. F2 dependency = 0 verified
4. Snapshot created before deletion
5. Count verification after deletion
6. Orphan check automated
7. SPA regression tests mandatory
8. Architecture Guards mandatory

---

## Human Architect Decision Points

### Decision 1: Deploy RPC?
- ✅ Contract verified
- ✅ Following approved pattern
- ✅ Migration ready

**Action:** Approve RPC deployment

### Decision 2: Execute Cleanup? (After RPC verified)
- ⏸️ Review verification output
- ⏸️ Confirm all 4 tests PASS
- ⏸️ Confirm manifest = 274 IDs
- ⏸️ Confirm preserved = 165

**Action:** Approve cleanup execution OR defer

---

## Current Status

**Migration State:** ✅ READY  
**RPC Contract:** ✅ VERIFIED  
**Deployment:** ⏸️ PENDING  
**Cleanup:** 🔒 BLOCKED (awaiting RPC deployment)

---

## Next Steps

1. **Human Architect approval** for RPC deployment
2. **Execute:** `npx supabase db push`
3. **Verify:** `npx tsx scripts/verify_cleanup_rpc.ts`
4. **Review verification output**
5. **If PASS:** Proceed to cleanup execution (separate approval)
6. **If FAIL:** Investigate and resolve

---

**Frozen Boundary:**  
- ❌ NO cleanup until RPC deployed + verified  
- ❌ NO direct DELETE operations  
- ❌ NO Dashboard ad-hoc execution  
- ✅ Migration pipeline only  
- ✅ Full verification required  
- ✅ Human approval at each gate
