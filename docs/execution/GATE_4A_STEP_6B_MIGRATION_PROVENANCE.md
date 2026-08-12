# Gate 4A STEP 6B: Migration Provenance & Immutability Fix

**Date:** 2026-08-12  
**Issue:** Migration file modified after being applied to remote database  
**Severity:** 🔴 HIGH (breaks migration immutability principle)

---

## Problem Statement

Migration `20260812030000_extend_clinical_orders_table.sql` was:
1. Committed in `8e15377e` with syntax errors (standalone `RAISE NOTICE`, wrong column name)
2. Applied to remote database AFTER manual fixes (via Supabase Studio)
3. Committed again in `26ddc329` with fixes included

**This violates migration immutability:** The SQL in git history does not match SQL executed on database.

---

## Migration Timeline (Actual)

### Commit 8e15377e (2026-08-12)
**File:** `supabase/migrations/20260812030000_extend_clinical_orders_table.sql`  
**Status:** COMMITTED but NOT APPLIED (had syntax errors)  
**Issues:**
- Standalone `RAISE NOTICE` statements (not in `DO` blocks)
- Column name `order_status` (should be `status`)
- Index instead of UNIQUE constraint for composite FK

### Manual Fixes (2026-08-12)
**Location:** Local file edits (not committed yet)  
**Fixes applied:**
1. Wrapped all `RAISE NOTICE` in `DO $$ ... END $$` blocks
2. Changed `order_status` → `status`
3. Changed `CREATE INDEX idx_hc_encounters_id_patient` → `ADD CONSTRAINT uq_hc_encounters_id_patient UNIQUE`

### Remote Application (2026-08-12)
**Method:** Manual copy/paste to Supabase Studio SQL Editor  
**SQL Version:** FIXED version (post-manual-edits)  
**Result:** ✅ SUCCESS - All phases completed

### Commit 26ddc329 (2026-08-12)
**File:** `supabase/migrations/20260812030000_extend_clinical_orders_table.sql`  
**Status:** COMMITTED with fixes  
**Problem:** Same filename, different content from `8e15377e`

---

## Source of Truth Determination

**Question:** Which SQL is the source of truth?

**Answer:** The SQL that was actually executed on remote database (FIXED version in `26ddc329`)

**Evidence:**
1. Verification script shows UNIQUE constraint exists (not just index)
2. Verification script shows `status` column queried successfully (not `order_status`)
3. No syntax errors in remote database logs

**Conclusion:** Commit `26ddc329` accurately represents remote database state.

---

## Immutability Fix Strategy

### ❌ WRONG Approach: Keep modified file
**Problem:** Git history shows migration changed after "applied" commit  
**Risk:** Confusion about which version was applied, impossible to reproduce migration state

### ✅ CORRECT Approach: Accept 26ddc329 as canonical, document exception

**Reasoning:**
1. Migration was NEVER applied from `8e15377e` (had syntax errors)
2. Migration WAS applied from fixed version (manual Studio application)
3. Commit `26ddc329` accurately reflects what was applied
4. No production impact (healthcare test data only)

**Action:** Mark `8e15377e` as "design only" commit, `26ddc329` as "applied" commit

---

## Migration Metadata

### Applied Migration
**Version:** `20260812030000`  
**Filename:** `extend_clinical_orders_table.sql`  
**Applied Date:** 2026-08-12  
**Applied Via:** Supabase Studio SQL Editor (manual)  
**Applied From:** Commit `26ddc329` content  
**Database:** Remote Supabase (lvnvkpyxtuilhrabtlwv)  
**Schema State:** ✅ VERIFIED (9/9 checks passed)

### Commit History
| Commit | Date | Status | Notes |
|--------|------|--------|-------|
| `8e15377e` | 2026-08-12 | ❌ NOT APPLIED | Design only, had syntax errors |
| `26ddc329` | 2026-08-12 | ✅ APPLIED | Source of truth, matches remote |

---

## Cleanup Actions

### 1. Remove duplicate/temporary migration file
**File:** `supabase/migrations/20260812040000_extend_clinical_orders_table_final.sql`  
**Status:** Untracked  
**Action:** DELETE (was temporary copy to bypass CLI conflicts, never applied)

### 2. Remove investigation scripts
**Files:**
- `scripts/apply-clinical-orders-migration-remote.js` (not used, manual Studio faster)
- `scripts/apply-migration-via-api.js` (not used)
- `scripts/check-clinical-orders-schema.js` (failed due to API key issues)
- `scripts/check-remote-schema.js` (failed due to API key issues)

**Action:** DELETE (temporary troubleshooting, not reusable)

### 3. Keep verification script
**File:** `scripts/VERIFY_CLINICAL_ORDERS_MIGRATION.sql`  
**Status:** COMMITTED  
**Action:** KEEP (reusable for future verification)

---

## Future Prevention

### Migration Workflow (Enforced)
1. **Design:** Write migration in `supabase/migrations/YYYYMMDD_name.sql`
2. **Test:** Run on local Supabase (`supabase db reset`) to catch syntax errors
3. **Commit:** Commit ONLY after local test passes
4. **Apply:** Apply to remote via CLI (`supabase db push`) or Studio
5. **Verify:** Run verification script
6. **Document:** Update execution plan
7. **NEVER:** Modify migration file after it's been applied to ANY database

### If Syntax Errors Found AFTER Commit
**Option A:** Revert commit, fix, re-commit  
**Option B:** Apply corrected SQL, document exception (this case)  
**NOT ALLOWED:** Modify committed migration file silently

---

## Negative Tests (Next)

Before Repository implementation, must verify constraint behavior:

### Test 1: Wrong patient_party_id (Composite FK)
```sql
-- Given: Encounter A has patient P1
-- When: Try to create order for Encounter A with patient P2
-- Then: MUST FAIL with FK violation

INSERT INTO hc_clinical_orders (
  id, tenant_id, encounter_id, patient_party_id, 
  order_type, status, version
) VALUES (
  gen_random_uuid(), 
  'test-tenant', 
  '<encounter-a-id>', 
  '<patient-p2-id>',  -- WRONG patient
  'medication', 
  'draft', 
  1
);
-- Expected: ERROR: insert or update on table "hc_clinical_orders" 
--           violates foreign key constraint "fk_clinical_orders_patient_matches_encounter"
```

### Test 2: NULL patient_party_id (NOT NULL)
```sql
-- When: Try to create order with NULL patient_party_id
-- Then: MUST FAIL with NOT NULL violation

INSERT INTO hc_clinical_orders (
  id, tenant_id, encounter_id, patient_party_id, 
  order_type, status, version
) VALUES (
  gen_random_uuid(), 
  'test-tenant', 
  '<encounter-id>', 
  NULL,  -- NULL patient
  'medication', 
  'draft', 
  1
);
-- Expected: ERROR: null value in column "patient_party_id" of relation "hc_clinical_orders" 
--           violates not-null constraint
```

### Test 3: Duplicate (tenant_id, request_id) (UNIQUE)
```sql
-- Given: Order exists with request_id R1 in tenant T1
-- When: Try to create another order with same request_id in same tenant
-- Then: MUST FAIL with uniqueness violation

INSERT INTO hc_clinical_orders (
  id, tenant_id, encounter_id, patient_party_id, 
  order_type, status, version, request_id
) VALUES (
  gen_random_uuid(), 
  'tenant-t1', 
  '<encounter-id>', 
  '<patient-id>', 
  'medication', 
  'draft', 
  1,
  '<request-id-r1>'  -- Duplicate request_id
);
-- Expected: ERROR: duplicate key value violates unique constraint 
--           "idx_hc_clinical_orders_request_id"
```

### Test 4: Same request_id, different tenant (PASS)
```sql
-- Given: Order exists with request_id R1 in tenant T1
-- When: Create order with same request_id in tenant T2
-- Then: MUST SUCCEED (tenant-scoped uniqueness)

INSERT INTO hc_clinical_orders (
  id, tenant_id, encounter_id, patient_party_id, 
  order_type, status, version, request_id
) VALUES (
  gen_random_uuid(), 
  'tenant-t2',  -- Different tenant
  '<encounter-id>', 
  '<patient-id>', 
  'medication', 
  'draft', 
  1,
  '<request-id-r1>'  -- Same request_id as tenant T1
);
-- Expected: SUCCESS (no error)
```

---

## Sign-off

✅ **Migration Provenance:** Established (26ddc329 is source of truth)  
✅ **Immutability Exception:** Documented (8e15377e never applied)  
⏳ **Negative Tests:** Not yet executed (next action)  
⏳ **Cleanup:** Not yet executed (after negative tests)  
⏳ **Repository:** Blocked until negative tests pass

**Next Action:** Execute 4 negative tests in Supabase Studio

---

**End of Provenance Report**
