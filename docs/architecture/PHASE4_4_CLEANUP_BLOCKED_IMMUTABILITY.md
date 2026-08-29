# Phase 4.4: Cleanup Blocked by Immutability Policy

**Date:** 2026-08-24  
**Status:** 🛑 BLOCKED — Requires RPC Deployment  
**Issue:** Finance OS immutability trigger blocks POSTED transaction deletion

---

## Executive Summary

**Phase 4.4 cleanup execution blocked** by Finance OS architectural protection:

```
TRANSACTION_IMMUTABLE: A POSTED transaction cannot be deleted
```

This is **CORRECT BEHAVIOR** — POSTED transactions are immutable accounting facts.

---

## Root Cause

**Finance OS Immutability Policy:**
- POSTED transactions = immutable accounting facts
- DELETE operations blocked by database trigger
- Protection ensures accounting integrity

**Impact:**
- Direct `DELETE FROM finance_transactions` fails
- Standard Supabase client cannot bypass immutability
- Requires privileged test cleanup RPC

---

## Approved Solution Pattern

**Precedent:** F5 Test Infrastructure + Phase 2.5 Cleanup

**Method:** `session_replication_role = replica` pattern

### Existing RPCs:
1. ✅ `f5_admin_cleanup_test_data()` (F5 test cleanup)
2. ✅ Phase 2.5 cleanup script (18 orphan F2 movements)

### Pattern:
```sql
SET session_replication_role = replica;  -- bypass immutability
DELETE FROM finance_transactions WHERE id = ANY(p_transaction_ids);
SET session_replication_role = DEFAULT;  -- restore protection
```

**Safety Controls:**
- Only callable by service_role
- Exact transaction IDs required (NO wildcard deletes)
- Tenant validation enforced
- POSTED status verification

---

## Created Solution

### Migration: `20260824000000_finance_test_cleanup_rpc.sql`

**RPC:** `finance_admin_cleanup_test_transactions(UUID[], UUID)`

**Parameters:**
- `p_transaction_ids`: Exact 274 transaction IDs from manifest
- `p_tenant_id`: Tenant validation

**Returns:**
```typescript
{
  deleted_count: number;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  message: string;
}
```

**Safety Gates:**
1. ✅ Authorization: Only service_role
2. ✅ Empty list check
3. ✅ Tenant validation (all 274 must belong to same tenant)
4. ✅ Status validation (all 274 must be POSTED)
5. ✅ Immutability bypass: `session_replication_role = replica`
6. ✅ Exact count verification

---

## Deployment Status

### ✅ Created Files:
1. `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
2. `scripts/phase4_4_execute_cleanup.ts` (updated to use RPC)
3. `scripts/deploy_cleanup_rpc.ts` (deployment helper)

### ⏸️ Pending:
**RPC Migration Deployment**

**Options:**

#### Option A: Supabase CLI (Recommended)
```bash
npx supabase db push --include-all
```

**Issue:** Local migrations conflict (20260819* already applied)

**Resolution:** Manual SQL execution via Supabase Dashboard

#### Option B: Supabase Dashboard → SQL Editor
1. Navigate to: https://supabase.com/dashboard → SQL Editor
2. Paste content from: `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
3. Execute
4. Verify: `SELECT * FROM pg_proc WHERE proname = 'finance_admin_cleanup_test_transactions';`

#### Option C: psql (if available)
```bash
psql $DATABASE_URL -f supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql
```

---

## Execution Plan (After RPC Deployment)

### Step 1: Deploy RPC Migration
```bash
# Via Supabase Dashboard SQL Editor
# OR
npx supabase db push --include-all
```

### Step 2: Verify RPC Exists
```typescript
const { data, error } = await supabase
  .rpc('finance_admin_cleanup_test_transactions', {
    p_transaction_ids: [],  // empty = returns error
    p_tenant_id: '00000000-0000-0000-0000-000000000000'
  });

// Expected: "Empty transaction ID list" error
// Confirms RPC is deployed and callable
```

### Step 3: Execute Cleanup
```bash
npx tsx scripts/phase4_4_execute_cleanup.ts
```

**Expected Output:**
```
🚀 Phase 4.4: Execute Controlled Cleanup
📸 STEP 1: Create Pre-Deletion Snapshot ✅
✅ STEP 2: Verify Snapshot Count ✅
🗑️  STEP 3: Execute Deletion via RPC
   RPC Status: SUCCESS
   RPC Message: Successfully deleted 274 test transactions
   Deleted count: 274
🔍 STEP 4: Post-Deletion Verification
   4a. F1 Remaining Count: 401 ✅
   4b. Orphan F2 Check: 0 ✅
   4c. Preserved Records: 165 ✅
✅ Cleanup Execution Complete
```

### Step 4: SPA Regression Tests
```bash
npm run test -- spa-bookings
npm run test -- spa-services
npm run test -- spa-revenue
```

### Step 5: Architecture Guards
```bash
npm run healthcare:verify
npm run logistics:verify
```

---

## Decision Required

### Human Architect Approval:

**Option 1: Deploy RPC + Execute Cleanup (RECOMMENDED)**

✅ Use approved pattern (`session_replication_role = replica`)  
✅ Follow F5/Phase 2.5 precedent  
✅ Maintain immutability protection (bypass only for test cleanup)  
✅ All safety gates enforced

**Steps:**
1. Deploy `20260824000000_finance_test_cleanup_rpc.sql` via Supabase Dashboard
2. Run `npx tsx scripts/phase4_4_execute_cleanup.ts`
3. Verify: F1=401, orphans=0, preserved=165
4. SPA regression + Architecture Guards
5. Phase 4.5: M-F1-DATES Migration Proposal

---

**Option 2: Alternative Approach (NOT RECOMMENDED)**

❌ Modify immutability trigger (breaks Finance OS invariants)  
❌ Use CASCADE delete (too risky)  
❌ Defer cleanup (migrate dirty data)

---

## Architectural Analysis

### ✅ Immutability Policy = CORRECT

**Finance OS Design:**
- POSTED = immutable fact
- DELETE blocked = accounting integrity
- Test cleanup = exception with controls

**This block is GOOD ARCHITECTURE**, not a bug.

### ✅ RPC Solution = APPROVED PATTERN

**Precedent:**
1. F5 test infrastructure: `f5_admin_cleanup_test_data()`
2. Phase 2.5 cleanup: 18 orphan F2 movements
3. Reset customer data: `reset-customer-data.sql`

**All use:** `session_replication_role = replica`

### ✅ Safety Gates = COMPREHENSIVE

1. Authorization (service_role only)
2. Exact IDs (no wildcard)
3. Tenant validation
4. Status check (POSTED only)
5. Count verification
6. Replication role reset after operation

---

## Next Steps

### Immediate:
1. **Human Architect decision** on RPC deployment
2. **If approved:** Deploy RPC via Supabase Dashboard
3. **Execute:** `npx tsx scripts/phase4_4_execute_cleanup.ts`
4. **Verify:** F1=401, orphans=0, SPA integrity

### After Cleanup:
1. SPA regression tests
2. Architecture Guards
3. Phase 4.5: M-F1-DATES Migration Proposal (design only)

---

## Files Ready for Execution

✅ `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql` (RPC definition)  
✅ `scripts/phase4_4_execute_cleanup.ts` (cleanup execution via RPC)  
✅ `docs/architecture/PHASE4_4_DELETION_MANIFEST.json` (274 exact IDs)  
✅ `docs/architecture/PHASE4_4_DELETION_MANIFEST.md` (human-readable)  
✅ `docs/architecture/PHASE4_4_TEST_DATA_CLEANUP_PROPOSAL.md` (full proposal)

---

**Status:** Awaiting Human Architect approval to deploy RPC  
**Frozen Boundary:** NO deletion until RPC deployed + verified  
**Principle:** Immutability protection is correct architecture, not a blocker
