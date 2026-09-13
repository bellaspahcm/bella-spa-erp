# P5.5 Next Actions — Policy Verification Required

**Date:** 2026-09-11  
**Status:** Investigation framework ready, awaiting user verification  
**Commit:** `b2140203`

---

## Current Status

```text
P5.5 Browser E2E          ❌ FAIL (step 6: cancel reservation)
Defect Symptom            "INVALID STATE TRANSITION: Unit in 'available' status"
Root Cause Hypothesis     RLS blocks Product UPDATE (policy missing)
Hypothesis Verification   ⏸️ REQUIRED (run SQL queries)
Migration                 ⏸️ DO NOT CREATE UNTIL VERIFIED
Deployment                ⏸️ BLOCKED
P5.5 Verdict              🟡 NOT VERIFIED
Phase 5                   🟡 IN PROGRESS
17 Frozen Invariants      🔒 UNCHANGED
```

---

## What Happened

**Previous attempt (ROLLED BACK):**
1. ❌ Created migration adding INSERT/UPDATE/DELETE policies without verification
2. ❌ Violated discipline: "for completeness" over-permissioning
3. ❌ Did not runtime-verify hypothesis against actual DB state
4. ❌ Did not check canonical pattern consistency

**Corrective action:**
1. ✅ Deleted premature migration
2. ✅ Reset to proper investigation-first approach
3. ✅ Created SQL verification queries (`scripts/bella-land/inspect-product-policies.sql`)
4. ✅ Documented investigation framework (`docs/bella-land/P5_5_POLICY_INVESTIGATION.md`)
5. ✅ Force-pushed corrected commit `b2140203`

---

## Required User Actions

### Step 1: Run Policy Verification Queries

**Where:** Supabase SQL Editor  
**URL:** https://supabase.com/dashboard/project/lgzmqrqypyjgrvfhtqmk/sql/new

**File to execute:** `scripts/bella-land/inspect-product-policies.sql`

**Copy/paste all 6 queries and execute.** Capture results for:

1. **QUERY 1:** Is RLS enabled? (Expected: YES)
2. **QUERY 2:** All policies on `real_estate_products` (Expected: only SELECT)
3. **QUERY 3:** UPDATE policies specifically (Expected: EMPTY - 0 rows)
4. **QUERY 4:** Policies on `re_reservations` for comparison (Expected: has UPDATE)
5. **QUERY 5:** Pattern used by `real_estate_projects` (Expected: subquery pattern)
6. **QUERY 6:** Does `get_auth_tenant_id()` helper exist? (Expected: YES)

**Critical verification:** QUERY 3 must return **0 rows** to confirm hypothesis.

---

### Step 2: Share Query Results

After running queries, share:
- Screenshot or text output of QUERY 2 (all policies)
- Screenshot or text output of QUERY 3 (UPDATE policies - should be empty)
- Screenshot or text output of QUERY 5 (pattern from real_estate_projects)

Agent will analyze and confirm hypothesis.

---

### Step 3: Agent Creates Minimal Fix (After Verification)

**If QUERY 3 returns 0 rows (no UPDATE policy):**

Agent will create migration with **ONLY UPDATE policy** (no INSERT/DELETE):

```sql
-- Minimal fix: Add UPDATE policy only
-- Enables ReservationService to update product status during reserve/release
DROP POLICY IF EXISTS "products_tenant_update" ON real_estate_products;
CREATE POLICY "products_tenant_update" ON real_estate_products
  FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

**Pattern rationale:**
- Uses same pattern as existing `real_estate_projects` policies
- Maintains consistency within Real Estate vertical
- Does NOT add INSERT/DELETE (not needed for defect fix)

**If QUERY 3 returns existing policy:**

Investigation continues - existing policy may be insufficient or have wrong expression.

---

### Step 4: Apply Migration (After Agent Creates It)

**Only after agent confirms hypothesis and creates minimal migration:**

1. Copy migration SQL from agent response
2. Execute in Supabase SQL Editor
3. Verify success message
4. Confirm policy exists: Re-run QUERY 3 (should now return 1 row)

---

### Step 5: Verify Vercel Deployment

Check that Vercel has deployed commit `b2140203`:
- Preview URL: https://bella-spa-jgx3zxonb-bella-spa-s-projects.vercel.app
- Confirm "Ready" status
- Verify commit hash matches `b2140203`

---

### Step 6: Rerun Full P5.5 Browser E2E

**Test Account:** loadtest-realestate@test.local / Test123456!  
**Tenant:** 1a6643da-3806-4793-a301-7a6d60b0d888

**Full 7-step flow:**

1. ✅ Login → Navigate to Reservations page
2. ✅ Create Reservation
   - Select Project (e.g., "Bella Marina Bay")
   - Select Product (e.g., "TEST-APT-001")
   - Select Customer
   - Enter Deposit amount
   - Submit
3. ✅ Verify reservation appears in list
4. ✅ Navigate to Apartments page → verify Product status shows "Giữ chỗ" (Held/Booked)
5. ✅ Reload page (F5) → verify persistence
6. ✅ Navigate back to Reservations → Cancel reservation
   - **Expected:** Success message, no error
   - **Previously failed here:** "INVALID STATE TRANSITION"
7. ✅ Navigate to Apartments → verify Product status back to "Còn trống" (Available)

**Success criteria:**
- All 7 steps complete without errors
- Product status transitions: available → booked → available
- DB state matches UI display

---

## Evidence Required

### Pre-Fix (Capture Now)
- ✅ Query results from Step 1 (policy verification)
- ✅ Screenshot: Reservation cancel error (already have)
- ✅ DB query: Product status 'available' despite reservation (already have)

### Post-Fix (Capture After Migration)
- ⏸️ QUERY 3 result showing UPDATE policy now exists
- ⏸️ Screenshot: Product "Giữ chỗ" after create reservation
- ⏸️ Screenshot: Successful cancel (no error message)
- ⏸️ Screenshot: Product "Còn trống" after cancel
- ⏸️ Full P5.5 checklist with all 7 steps marked PASS

---

## Discipline Checkpoints

**What we WILL do:**
- ✅ Runtime-verify hypothesis before creating fix
- ✅ Use canonical pattern matching existing Real Estate tables
- ✅ Add ONLY the missing UPDATE policy (minimal scope)
- ✅ Test full E2E flow after fix
- ✅ Capture evidence at each step

**What we WILL NOT do:**
- ❌ Create migration without verifying actual DB state
- ❌ Add INSERT/DELETE policies "for completeness"
- ❌ Introduce new patterns inconsistent with vertical
- ❌ Skip verification steps to "save time"
- ❌ Apply untested migrations to production

---

## Timeline

```text
Now                     User runs SQL verification queries
↓
After query results     Agent analyzes → confirms/rejects hypothesis
↓
If hypothesis confirmed Agent creates minimal UPDATE-only migration
↓
User applies migration  Execute in SQL Editor
↓
After migration applied Rerun full P5.5 Browser E2E (7 steps)
↓
If all steps PASS       Mark P5.5 VERIFIED → proceed to P5.6
↓
If any step fails       Capture evidence → continue RCA
```

**Estimated time:** 15-30 minutes (includes SQL execution, migration, full E2E rerun)

---

## Freeze Point

Conversation resumes from: **"User runs policy verification queries and shares results"**

All files committed and pushed:
- `scripts/bella-land/inspect-product-policies.sql` (6 verification queries)
- `docs/bella-land/P5_5_POLICY_INVESTIGATION.md` (investigation framework)
- `docs/bella-land/P5_5_NEXT_ACTIONS.md` (this file)

No migration created yet. Waiting for runtime verification.

---

## Security Note

**Test credentials exposed in previous messages:** After RC seal, rotate/disable:
- Email: loadtest-realestate@test.local
- Password: Test123456!
- Tenant: 1a6643da-3806-4793-a301-7a6d60b0d888
