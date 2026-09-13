# P5.5 Policy Investigation — Before Remediation

**Date:** 2026-09-11  
**Phase:** Bella Land v2 RC Phase 5.5 Production Browser E2E  
**Status:** RCA In Progress  

---

## Defect Evidence

**Symptom:**
- Reservation cancel fails: `"INVALID STATE TRANSITION: Cannot perform this operation. Unit is currently in 'available' status"`
- Reservation record cancels successfully (status='cancelled') ✅
- Product status remains 'available' instead of 'booked' ❌

**Hypothesis:**
- `ReservationService.reserveProduct()` creates reservation but cannot UPDATE product status
- Possible cause: RLS policy missing or insufficient for UPDATE on `real_estate_products`

---

## Investigation Steps

### Step 1: Verify Actual Policies on Production DB ⏸️

**Required queries:** `scripts/bella-land/inspect-product-policies.sql`

**Must verify:**
1. Is RLS enabled on `real_estate_products`? (Expected: YES)
2. What policies currently exist? (Expected: only SELECT policy)
3. Is there an UPDATE policy? (Expected: NO - this is the gap)
4. What canonical helper functions exist? (`get_auth_tenant_id`, `is_admin`)
5. What pattern do similar tables use? (compare with `re_reservations`, `real_estate_projects`)

**Action:** Run queries in Supabase SQL Editor and capture results

---

### Step 2: Compare with Canonical Patterns

**Pattern A: Bella Spa canonical (most tables)**
```sql
USING (tenant_id = public.get_auth_tenant_id())
WITH CHECK (tenant_id = public.get_auth_tenant_id())
```

**Pattern B: Real Estate tables (current)**
```sql
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
```

**Key difference:** Real Estate tables do NOT use canonical helper `get_auth_tenant_id()`

**Decision required:**
- Option A: Use Pattern B to match existing Real Estate policies (consistency within vertical)
- Option B: Upgrade to Pattern A to match system-wide canonical (consistency across system)

---

### Step 3: Minimal Necessary Permission

**Current defect:** Reservation lifecycle cannot UPDATE product status

**Required policy:** UPDATE only (for reservation reserve/release flow)

**NOT required immediately:**
- ❌ INSERT policy (Products created separately via Product management UI)
- ❌ DELETE policy (Products not deleted during reservation lifecycle)

**Principle:** Add ONLY the missing UPDATE policy. Do not add INSERT/DELETE "for completeness."

---

### Step 4: Proposed Fix (After Verification)

**If hypothesis confirmed (no UPDATE policy exists):**

```sql
-- Add UPDATE policy for real_estate_products
-- Allows authenticated users to UPDATE products in their tenant
-- Enables ReservationService to update product status during reserve/release
DROP POLICY IF EXISTS "products_tenant_update" ON real_estate_products;
CREATE POLICY "products_tenant_update" ON real_estate_products
  FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

**Rationale:**
- Matches existing Real Estate policy pattern (Pattern B)
- Minimal scope: UPDATE only, no INSERT/DELETE
- Tenant isolation preserved
- Enables reservation lifecycle without over-permissioning

---

### Step 5: Verification After Fix

1. Apply migration to production DB
2. Create new reservation via UI
3. Query product status → should be 'booked' ✅
4. Cancel reservation via UI
5. Query product status → should be 'available' ✅
6. No "INVALID STATE TRANSITION" error ✅

---

## Freeze Status

```text
P5.5 Browser E2E          ❌ FAIL (cancel defect)
RCA Hypothesis            Product UPDATE blocked by RLS
Policy Verification       ▶️ REQUIRED (run SQL queries)
Pattern Decision          ▶️ REQUIRED (A vs B)
Migration                 ⏸️ DO NOT CREATE YET
Deployment                ⏸️ BLOCKED
P5.5 Verdict              🟡 NOT VERIFIED
Phase 5                   🟡 IN PROGRESS
Bella Land RC             ⏸️ NOT SEALED
17 Invariants             🔒 UNCHANGED
```

---

## Next Actions

1. **User:** Run `scripts/bella-land/inspect-product-policies.sql` in Supabase SQL Editor
2. **User:** Capture policy query results and share
3. **Agent:** Analyze results, confirm hypothesis
4. **Agent:** Create minimal UPDATE-only migration (if hypothesis confirmed)
5. **User:** Apply migration via SQL Editor
6. **User:** Rerun full P5.5 Browser E2E (7 steps)
7. **Verify:** All steps PASS → mark P5.5 VERIFIED

---

## Security Note

Test credentials exposed in previous messages:
- `loadtest-realestate@test.local / Test123456!`
- Tenant: `1a6643da-3806-4793-a301-7a6d60b0d888`

**Action required:** After RC seal, rotate/disable test credentials.
