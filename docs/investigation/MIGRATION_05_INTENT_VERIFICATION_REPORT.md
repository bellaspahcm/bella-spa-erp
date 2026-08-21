# MIGRATION 05 INTENT VERIFICATION REPORT

**Investigation Type:** READ-ONLY Git/Codebase/Schema Analysis  
**Purpose:** Determine if Migration 05 was designed for current production or different target  
**Status:** COMPLETE  
**Date:** 2026-08-19  
**Database Mutations:** 0  

---

## EXECUTIVE SUMMARY

**VERDICT:** Migration 05 was designed with **SCHEMA ASSUMPTIONS THAT NEVER EXISTED** in production.

**Evidence Grade:** CRITICAL - Design/Production Mismatch Confirmed

**Root Cause:** `tenants.slug` column assumption hardcoded in Migration 05 design, but this column **NEVER EXISTED** in any Supabase migration history.

**Recommended Action:** **Option 1 - Design Amendment Required** (NOT Option 2 - Do NOT add slug to production)

---

## 1. TENANTS.SLUG INVESTIGATION

### 1.1 Production Schema Evidence

**Current State:**
- ✅ `public.tenants.id` = UUID (primary key)
- ✅ `public.tenants.name` = TEXT
- ❌ `public.tenants.slug` = **DOES NOT EXIST**
- ✅ 41 columns in production tenants table
- ✅ Verified via database introspection 2026-08-19

**Historical Migration Search:**
```bash
grep -r "ADD COLUMN slug" supabase/migrations/*.sql
grep -r "tenants.*slug" supabase/migrations/*.sql
```

**Result:** **ZERO matches** - No migration ever created `tenants.slug`

### 1.2 When tenants.slug Appears

**First Appearance:** Migration 05 design documents (August 2026)

**Files with tenants.slug assumption:**
1. `docs/architecture/BELLA_RUNTIME_MIGRATION_05_IDENTITY_RECONCILIATION.md`
   - Line 146: `OR ct.slug = rt.tenant_id  -- Attempt slug match (if exists)`
   
2. `docs/architecture/BELLA_RUNTIME_MIGRATION_05B_CLEANUP_BACKFILL.md`
   - Line 283: `WHERE slug = 'e2e-test-tenant-a-runtime'`
   - Line 287: `WHERE slug = 'e2e-test-tenant-b-runtime'`
   - Line 460: `WHERE slug = 'e2e-test-tenant-a-runtime'`
   - Line 654: `tenant_slug TEXT NOT NULL`
   
3. `docs/architecture/BELLA_RUNTIME_MIGRATION_05C_TYPE_MIGRATION.md`
   - Line 266: `SELECT 1 FROM public.tenants WHERE slug = 'e2e-test-tenant-a-runtime'`
   - Line 270: `SELECT 1 FROM public.tenants WHERE slug = 'e2e-test-tenant-b-runtime'`
   - Line 307: `FROM public.tenants WHERE slug = 'e2e-test-tenant-a-runtime'`

**Conclusion:** `tenants.slug` is a **DESIGN ASSUMPTION**, not a production reality.

---

## 2. CANONICAL TENANT NAMING PATTERNS

### 2.1 Migration 05 Design Expectations

**05-B expects to create these canonical tenants:**
```
INSERT INTO public.tenants (id, name, slug, ...)
VALUES
  (UUID, 'E2E Test Tenant A (Runtime)', 'e2e-test-tenant-a-runtime', ...),
  (UUID, 'E2E Test Tenant B (Runtime)', 'e2e-test-tenant-b-runtime', ...),
  (UUID, 'E2E Test Attacker (Runtime)', 'e2e-test-attacker-runtime', ...)
```

**Naming Pattern:** `{purpose}-{suffix}-runtime` (e.g., `e2e-test-tenant-a-runtime`)

### 2.2 Production Reality

**Actual E2E test fixtures (5 TEXT records in runtime_tenant_registry):**
```
test-quarantine-tenant-a
test-quarantine-tenant-b
test-e2e-tenant-a
test-e2e-tenant-b
test-e2e-tenant-attacker
```

**Naming Pattern:** `test-{purpose}-tenant-{id}` (NO `-runtime` suffix)

**Production tenants table:**
- ✅ Hundreds of test tenants with various naming patterns
- ❌ ZERO tenants matching `-runtime` suffix pattern
- ❌ ZERO canonical Core tenants for Runtime E2E tests

**Evidence Source:**
- `tests/utils/e2e-fixtures.ts` (lines 22-37)
- `scripts/provision-e2e-test-users.ts` (lines 28, 35, 42)
- Database query 2026-08-19: `SELECT * FROM public.tenants WHERE name ILIKE '%runtime%'` → 0 results

---

## 3. TEXT FIXTURE ORIGIN

### 3.1 The 5 TEXT Fixtures Classification

**Created:** 2026-08-18 (integration/E2E test execution)

**Source Files:**
1. **Quarantine fixtures** (test-quarantine-tenant-a/b):
   - File: `tests/integration/runtime/quarantine-repository.integration.test.ts`
   - Lines 55-61: Explicitly create TEXT tenant_id fixtures
   - Purpose: Integration tests for quarantine repository
   
2. **E2E fixtures** (test-e2e-tenant-a/b/attacker):
   - File: `tests/utils/e2e-fixtures.ts`
   - Lines 21-37: Define E2E_TENANTS constants
   - Purpose: Phase 3C E2E security tests

**Classification in Migration 05-A:**
```
test-quarantine-tenant-a  → TEST_ORPHAN (DELETE)
test-quarantine-tenant-b  → TEST_ORPHAN (DELETE)
test-e2e-tenant-a         → TEST_FIXTURE (REPLACE)
test-e2e-tenant-b         → TEST_FIXTURE (REPLACE)
test-e2e-tenant-attacker  → TEST_FIXTURE (REPLACE)
```

**Observation:** Classification is **CORRECT** ✅, but replacement logic assumes `tenants.slug` exists ❌

---

## 4. GET_AUTH_TENANT_ID() HISTORY

### 4.1 UUID Return Type Timeline

**First Introduction:** 2026-05-21  
**Migration:** `20260521000004_harden_rls_and_tenant.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$  -- ✅ UUID from day 1
DECLARE
    t_id UUID;
BEGIN
    SELECT tenant_id INTO t_id FROM public.users WHERE id = auth.uid();
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Evolution:**
- 2026-05-21: Returns UUID, reads from `public.users.tenant_id` (UUID)
- 2026-05-23: Updated (HQ admin bypass), still returns UUID
- 2026-07-13: Optimized to read JWT app_metadata first, still returns UUID

**Conclusion:** `get_auth_tenant_id()` has **ALWAYS returned UUID**, never TEXT.

### 4.2 Production Identity Chain

**Current (2026-08-19):**
```
auth.users.id (UUID)
    ↓
public.users.id (UUID)
    ↓
public.users.tenant_id (UUID)  ← FK to tenants.id
    ↓
public.tenants.id (UUID, PK)
    ↓
get_auth_tenant_id() → UUID
```

**Migration 05 Assumption:**
```
runtime_tenant_registry.tenant_id (TEXT)
    ↓
tenants.slug (does not exist)
    ↓
TEXT → UUID reconciliation
    ↓
public.tenants.id (UUID)
```

**Mismatch:** Two parallel identity models that don't align.

---

## 5. MIGRATION 05 DESIGN CONTEXT

### 5.1 When Migration 05 Was Created

**File Timestamps:**
- `BELLA_RUNTIME_MIGRATION_05_IDENTITY_RECONCILIATION.md` - August 2026
- `BELLA_RUNTIME_MIGRATION_05B_CLEANUP_BACKFILL.md` - August 2026
- `BELLA_RUNTIME_MIGRATION_05C_TYPE_MIGRATION.md` - August 2026

**Reference Documents:**
- `BELLA_PHASE_3C_APPROVAL_1_FINAL_STATUS.md` - Contains 5 fixture classification
- `BELLA_RUNTIME_TENANT_IDENTITY_AUDIT_RCA_6.md` - References `tenants.slug`

### 5.2 Design Intent Analysis

**Migration 05 was designed to:**
1. Reconcile TEXT tenant_id fixtures to UUID
2. Delete TEST_ORPHAN fixtures (quarantine)
3. Replace TEST_FIXTURE entries (e2e) with canonical UUID tenants
4. Create canonical Core tenants with slug-based names
5. Update RLS/FK/functions to use UUID

**Design Assumption Chain:**
```
1. public.tenants has slug column (❌ FALSE)
2. Canonical tenants will be created with slug='e2e-test-tenant-*-runtime' (❌ PATTERN MISMATCH)
3. E1 can verify slug-based mappings (❌ BROKEN)
4. 05-C can SELECT by slug (❌ COLUMN MISSING)
```

**Root Cause:** Migration 05 designed against **HYPOTHETICAL schema**, not actual production.

---

## 6. SCHEMA DRIFT CLASSIFICATION

### 6.1 Drift Type

**Category:** **DESIGN ↔ PRODUCTION MISMATCH** (Type A)

**NOT:**
- ❌ Type B: Production changed after design (no evidence of slug ever existing)
- ❌ Type C: Different branch/environment (slug missing everywhere)

### 6.2 Evidence Summary

| Component | Design Assumption | Production Reality | Status |
|-----------|------------------|-------------------|--------|
| tenants.slug | EXISTS | DOES NOT EXIST | ❌ MISMATCH |
| Canonical tenant naming | e2e-*-runtime | test-e2e-tenant-* | ❌ MISMATCH |
| get_auth_tenant_id() | (implicit UUID) | UUID since 2026-05-21 | ✅ MATCH |
| 5 TEXT fixtures | Classification | Correct | ✅ MATCH |
| users.tenant_id | UUID | UUID | ✅ MATCH |
| tenants.id | UUID | UUID | ✅ MATCH |

**Conclusion:** 4/6 components match, but **2 critical design assumptions are false**.

---

## 7. ALTERNATIVE IDENTIFIER OPTIONS

### 7.1 Available Columns in public.tenants

**Identifier Candidates:**
1. ✅ `id` (UUID, PK) - Authoritative identifier
2. ✅ `name` (TEXT) - Human-readable, not unique
3. ⚠️ `zalo_secret_key` (TEXT) - Not suitable for identity
4. ⚠️ `qr_bank_code` (TEXT) - Not suitable for identity

**Recommendation:** Use `tenants.name` or direct `tenants.id` UUID mapping.

### 7.2 Possible Amendment Approaches

**Option 1A: Use tenants.name**
```sql
SELECT id FROM public.tenants 
WHERE name ILIKE '%e2e%test%tenant%a%'
```
- ⚠️ Fuzzy matching required
- ⚠️ Not deterministic
- ⚠️ Risk of multiple matches

**Option 1B: Hardcode UUID mappings**
```sql
-- Create canonical tenants with known UUIDs
INSERT INTO public.tenants (id, name, ...)
VALUES 
  ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'E2E Test Tenant A', ...),
  ...
```
- ✅ Deterministic
- ✅ No slug dependency
- ✅ Aligns with UUID-based architecture

**Option 1C: Create migration_evidence.canonical_tenant_map**
```sql
CREATE TABLE migration_evidence.canonical_tenant_map (
  text_fixture_id TEXT PRIMARY KEY,
  canonical_uuid UUID NOT NULL REFERENCES public.tenants(id)
);
```
- ✅ Explicit mapping
- ✅ Audit trail
- ✅ Decouples from tenants schema

---

## 8. EXECUTION HISTORY

### 8.1 Migration State

**Confirmed NOT executed:**
- ❌ Migration 05-A (no migration_evidence schema)
- ❌ Migration 05-B (no canonical Runtime tenants created)
- ❌ Migration 05-C (runtime_tenant_registry.tenant_id still TEXT)

**Last Applied Migration:**
- ✅ `20260817020000_finance_payment_allocation_rpcs.sql` (or later)
- ✅ Database at current production state

### 8.2 Runtime State

**runtime_tenant_registry:**
- ✅ 5 rows (TEXT type)
- ✅ Created 2026-08-18 (test fixtures)
- ✅ All child tables empty (0 rows)

**Safe State:** No production data at risk, only test fixtures present.

---

## 9. PROTOCOL COMPLIANCE

### 9.1 Actions Taken

✅ READ-ONLY investigation only  
✅ NO schema modifications  
✅ NO data mutations  
✅ NO E1 query amendments  
✅ NO migration execution  
✅ NO tenants.slug creation  

### 9.2 Gate Status

```
E0  ✅ PASS (Package integrity verified)
E1  🔴 BLOCKED (tenants.slug missing)
E2  ⛔ NOT REACHED
E3  ⛔ NOT REACHED

05-A ⛔ NOT EXECUTABLE
05-B ⛔ NOT EXECUTABLE  
05-C ⛔ NOT EXECUTABLE

Database mutations: 0
```

---

## 10. FINAL DETERMINATION

### 10.1 Target Intent Verdict

**Migration 05 Target:** Current Production (lvnvkpyxtuilhrabtlwv.supabase.co)  
**Schema Match:** ❌ **DESIGN DRIFT** - assumptions do not match production

**Historical Relationship:** DRIFT - Migration designed for schema that never existed

### 10.2 Recommended Path Forward

**🟢 APPROVED PATH:** **Option 1 - Design Amendment**

**Required Actions:**
1. ✅ Create formal Amendment 12 (or 05-D Revision)
2. ✅ Rewrite 05-A/05-B/05-C to eliminate `tenants.slug` dependency
3. ✅ Use `tenants.id` UUID directly or `tenants.name` fuzzy matching
4. ✅ Update E1 verification queries to match actual schema
5. ✅ Re-submit for Approval 3 after design revision

**🔴 FORBIDDEN PATH:** **Option 2 - Add slug to production**

**Why Forbidden:**
- ❌ Violates principle: migrations adapt to authoritative schema
- ❌ Production schema alteration to satisfy broken migration design
- ❌ Adds column that was never part of production evolution
- ❌ No business requirement for slug column
- ❌ Creates permanent schema debt

### 10.3 Amendment Scope

**Minimum Required Changes:**
1. **05-A:** Remove slug-based reconciliation queries
2. **05-B:** Remove slug INSERT, use name or hardcoded UUIDs
3. **05-C:** Remove slug-based preflight checks
4. **E1:** Remove canonical tenant slug verification
5. **Documentation:** Update all references to tenants.slug

**Estimated Effort:** Medium (design revision, not code rewrite)

---

## 11. EVIDENCE CHAIN

### 11.1 Codebase Evidence

**tenants.slug References:** 12+ occurrences, ALL in Migration 05 docs  
**Supabase migrations with slug:** ZERO  
**Production schema introspection:** tenants.slug = DOES NOT EXIST  
**Test fixtures:** All use TEXT tenant_id without slug  

### 11.2 Database Evidence

**Query:** `SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='slug'`  
**Result:** 0 rows

**Query:** `SELECT * FROM public.tenants WHERE name ILIKE '%runtime%'`  
**Result:** 0 rows (no canonical Runtime tenants)

### 11.3 Git Evidence

**Search:** `git log --all -- supabase/migrations/*slug*.sql`  
**Result:** No commits (slug never in migration files)

---

## 12. CONCLUSION

**Migration 05 was designed with a schema assumption (tenants.slug) that:**
1. Never existed in production
2. Never appeared in any Supabase migration
3. Was never part of the production evolution
4. Is incompatible with current UUID-based identity architecture

**This is NOT a production schema bug.  
This is a design specification error.**

**Correct Action:** Amend Migration 05 design to match production reality.

**Incorrect Action:** Alter production to match broken design assumptions.

---

**🔴 EXECUTION REMAINS STOPPED**  
**⏸️ AWAITING HUMAN DECISION: Proceed with Amendment 12 or alternative path**

---

**Report Generated:** 2026-08-19  
**Investigation Status:** COMPLETE  
**Database Status:** UNCHANGED (0 mutations)  
**Next Action:** Design Amendment or STOP
