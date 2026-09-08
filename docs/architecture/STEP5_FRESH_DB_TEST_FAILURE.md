# STEP 5: Fresh DB Test - FAILURE (Original Migration Conflict)

**Date:** 2026-09-05  
**Status:** 🔴 **FAILED — Original migration (20260510) still executing**

---

## Failure Summary

**Command:** `npx supabase start`

**Result:** Migration execution FAILED at 20260510

**Error:**
```
Applying migration 20260509000000_create_spa_base_tables.sql... ✅
Applying migration 20260510000000_create_spa_core_tables.sql... 🔴
ERROR: function public.get_auth_tenant_id() does not exist (SQLSTATE 42883)
At statement: 11
CREATE POLICY "Tenant read packages" ON public.packages
  FOR SELECT TO authenticated
  USING (
    ...
    (public.get_auth_tenant_id() IS NULL)
    ...
  )
```

**Root cause:** Original migration (20260510) executed ALONGSIDE split migrations (20260509, 20260517), causing both versions to run. The original references `get_auth_tenant_id()` which doesn't exist yet in migration sequence.

---

## Execution Order Analysis

### Expected Behavior (Split Only)

```
20260509 → base tables (no dependencies)
20260511 → core schema + functions
20260516 → audit infrastructure  
20260517 → constraints + triggers
```

### Actual Behavior (Split + Original)

```
20260509 ✅ → base tables created
20260510 🔴 → original migration attempted (CONFLICT)
         ↓
    ERROR: function does not exist
         ↓
20260517 ❌ → never reached
```

---

## Root Cause

**Original migration (20260510) NOT archived before test.**

Per Gate 5 pause decision:
> "Không archive `20260510` cho tới khi Step 5–7 PASS."

**This was correct policy** - we needed runtime proof before finalizing archive.

**However:** Cannot test split migrations while original still in `migrations/` folder. Supabase executes ALL files in chronological order.

---

## Conflict Details

### File Present

`supabase/migrations/20260510000000_create_spa_core_tables.sql`

**Status:** Original (pre-split) version

**Content:** Creates tables + RLS policies referencing `get_auth_tenant_id()`

**Problem:** Function `get_auth_tenant_id()` created later in migration chain, causing forward reference error

### Migration Execution Order

Supabase CLI applies migrations sorted by timestamp:

1. `20260509000000` ✅
2. `20260510000000` ← **BLOCKS HERE** (original still present)
3. `20260511000000` (never reached)
4. ...
5. `20260517000000` (never reached - split Part 2)

**Result:** Split migrations never tested because original fails first.

---

## Decision Required

**Cannot proceed with fresh DB test until original migration handled.**

### Option A: Archive Now (Permanent)

**Action:**
```bash
mkdir -p supabase/migrations/archive
mv supabase/migrations/20260510000000_create_spa_core_tables.sql \
   supabase/migrations/archive/
```

**Pros:**
- ✅ Allows immediate split migration testing
- ✅ Clean migration history (only split versions)
- ✅ Follows intended remediation plan

**Cons:**
- ⚠️ Archive before runtime proof that split works
- ⚠️ Harder to rollback if split fails

**Risk:** MEDIUM (violates "archive after proof" principle)

---

### Option B: Temporary Rename (Reversible)

**Action:**
```bash
mv supabase/migrations/20260510000000_create_spa_core_tables.sql \
   supabase/migrations/20260510000000_create_spa_core_tables.sql.ORIGINAL.bak
```

**Pros:**
- ✅ Allows split migration testing
- ✅ Easily reversible (just rename back)
- ✅ Preserves original for rollback

**Cons:**
- ⚠️ Still in migrations/ folder (cluttered)
- ⚠️ `.bak` extension may confuse future developers

**Risk:** LOW (fully reversible)

---

### Option C: Stop and Report (Wait for User)

**Action:**
- Document failure
- Report conflict to user
- Wait for explicit approval to archive/rename

**Pros:**
- ✅ Maintains gate discipline (no archive without proof)
- ✅ User makes final decision
- ✅ Clear accountability

**Cons:**
- ⏱️ Delays testing (requires user response)

**Risk:** ZERO (no changes made)

---

## Recommendation

**Option B: Temporary Rename (Reversible)**

**Rationale:**
- Allows immediate testing of split migrations
- Fully reversible if split fails
- Preserves original for emergency rollback
- Low risk (no permanent changes)
- Maintains "proof before archive" principle

**After rename → test → if split PASSES → then archive permanently with user approval**

---

## Alternative Analysis

### Why Not Fix 20260510 Instead?

**Could we make 20260510 work by:**
- Moving RLS policies to later migration?
- Removing forward references?

**Answer: NO**

**Reason:** That would be "fixing the original" rather than "testing the split replacement". The goal is to REPLACE 20260510 with 20260509+20260517, not patch 20260510.

**Evidence needed:** Split migrations (20260509+20260517) work as designed, making original (20260510) obsolete.

---

## Execution Evidence Captured

### Migration Log

```
Applying migration 20260509000000_create_spa_base_tables.sql... ✅
Applying migration 20260510000000_create_spa_core_tables.sql... 🔴
ERROR: function public.get_auth_tenant_id() does not exist (SQLSTATE 42883)
```

### Error Context

**Failed at:** 20260510 statement 11 (RLS policy creation)

**Function missing:** `public.get_auth_tenant_id()`

**Expected creation:** Later in migration chain (platform functions)

**Actual state:** Function doesn't exist when 20260510 tries to reference it

---

## Impact Assessment

### On Split Migrations

**20260509:** ✅ Executed successfully (base tables created)

**20260517:** ❌ Never reached (blocked by 20260510 failure)

**Conclusion:** Cannot verify split migrations work because original blocks execution

### On Production

**Impact:** ZERO (local test only, production untouched)

### On Rollback

**Current state:** Original preserved, can revert split if needed

**If renamed:** Still preserved, easy restore

**If archived:** Slightly harder restore (need to move back from archive/)

---

## Next Steps Based on User Decision

### If User Approves Option A (Archive)

```bash
# 1. Archive original
mkdir -p supabase/migrations/archive
mv supabase/migrations/20260510000000_create_spa_core_tables.sql \
   supabase/migrations/archive/

# 2. Create archive documentation
cat > supabase/migrations/archive/20260510_ARCHIVED.md << 'EOF'
# 20260510000000_create_spa_core_tables.sql - ARCHIVED

**Archived:** 2026-09-05
**Reason:** Replaced by split migrations 20260509 + 20260517
**Issue:** Forward reference to get_auth_tenant_id() caused migration failure

**Replacement:**
- 20260509000000_create_spa_base_tables.sql (Part 1)
- 20260517000000_add_spa_constraints.sql (Part 2)

**Restore if needed:**
mv archive/20260510000000_create_spa_core_tables.sql migrations/
(Then remove 20260509 and 20260517)
EOF

# 3. Retry fresh DB reset
npx supabase db reset

# 4. Collect evidence (4 layers)

# 5. Continue to Step 6
```

---

### If User Approves Option B (Rename)

```bash
# 1. Rename original (temporary)
mv supabase/migrations/20260510000000_create_spa_core_tables.sql \
   supabase/migrations/20260510000000_create_spa_core_tables.sql.ORIGINAL.bak

# 2. Retry fresh DB reset
npx supabase db reset

# 3. Collect evidence (4 layers)

# 4. If split PASSES → archive permanently
#    If split FAILS → restore original

# 5. Continue based on test result
```

---

### If User Chooses Option C (Wait)

**Action:** NONE

**Status:** Paused at failure evidence

**Next:** Await user directive

---

## Key Insight

**"Archive after proof" principle encounters paradox:**

**Cannot get proof without removing original → Cannot remove original without proof**

**Resolution:** Temporary rename (Option B) breaks paradox:
- Remove original temporarily (allows test)
- Get proof (split works or fails)
- Make permanent decision based on proof

---

## Updated Gate Status

```
✅ Step 1: Production evidence
✅ Step 2: Cycle identified, static resolution designed
✅ Step 3: Intermediate state audit
✅ Step 4: Split implementation
🔴 Step 5: Fresh DB test FAILED (original conflict)
   ├─ Evidence: 20260510 blocks split migration testing
   ├─ Decision needed: Archive, Rename, or Wait
   └─ Production: UNTOUCHED
⏸️ Step 6-8: Blocked pending Step 5 resolution
```

---

## Recommendations Summary

**PRIMARY:** Option B (Temporary Rename)
- Allows testing immediately
- Fully reversible
- Maintains proof-before-archive principle
- Low risk

**SECONDARY:** Option A (Archive Now)
- Clean solution
- Permanent
- Slightly higher risk (harder rollback)

**NOT RECOMMENDED:** Option C (Wait)
- Unnecessary delay
- Blocking issue is clear and fixable
- User already approved split approach

---

**Status:** 🔴 **FAILURE DOCUMENTED — Awaiting user decision on original migration handling**

**Recommendation:** Proceed with Option B (rename) → test → then archive permanently if PASS

**Evidence captured:** Migration execution log, error message, root cause analysis complete

**Production:** 🔒 UNTOUCHED (local test failure only)
