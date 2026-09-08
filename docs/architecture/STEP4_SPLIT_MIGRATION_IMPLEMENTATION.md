# STEP 4: Split Migration Implementation

**Date:** 2026-09-05  
**Status:** ✅ **COMPLETE — Split migrations created and verified**

---

## Executive Summary

**Split migration created to resolve dependency cycle:**
- **Part 1:** `20260509000000_create_spa_base_tables.sql` (base structure, zero dependencies)
- **Part 2:** `20260517000000_add_spa_constraints.sql` (FK/triggers/RLS after dependencies exist)

**Original migration preserved:** `20260510000000_create_spa_core_tables.sql` (to be archived ONLY after fresh-DB test)

**Static verification:** ✅ PASSED (all dependencies satisfied, downstream migrations compatible)

**Next gate:** Fresh database migration test

---

## 1. Files Created

### 1.1 Part 1: Base Tables (20260509)

**File:** `supabase/migrations/20260509000000_create_spa_base_tables.sql`

**Purpose:** Establish base table structures with ZERO external dependencies

**Contents:**
- `CREATE TABLE packages` (33 columns, no FK constraints, no triggers)
- `CREATE TABLE inventory_items` (12 columns, no FK constraints, no triggers)
- `CREATE TABLE inventory_logs` (13 columns, no FK constraints, no triggers)
- Basic indexes (non-FK indexes only)
- Basic CHECK constraints (non-FK validations)
- GRANT statements

**External dependencies:** NONE

**Size:** ~9.2KB

**Key design decisions:**
- `tenant_id`, `created_by`, `session_log_id`, `item_id`, `template_id` columns exist but WITHOUT FK constraints
- No audit triggers (log_audit_event not yet available)
- No update triggers (update_updated_at_column not yet available)
- No RLS policies (functions not yet available)
- Full table structure available for downstream migrations (20260512, 20260515, 20260522+)

**Audit gap note included:**
```sql
-- Audit Gap Note (20260515):
--   Migration 20260515 performs schema normalization UPDATE (price, duration encoding).
--   This UPDATE executes BEFORE audit trigger application (20260517).
--   Decision: ACCEPTED per architectural policy - schema migration operations are
--   infrastructure changes, not business transactions, and do not require audit trail.
```

---

### 1.2 Part 2: Constraints and Triggers (20260517)

**File:** `supabase/migrations/20260517000000_add_spa_constraints.sql`

**Purpose:** Apply integrity constraints and audit infrastructure after dependencies exist

**Contents:**
- Foreign key constraints (7 constraints)
  - `packages.tenant_id` → `tenants(id)`
  - `packages.template_id` → `packages(id)` (self-reference)
  - `inventory_items.tenant_id` → `tenants(id)`
  - `inventory_logs.tenant_id` → `tenants(id)`
  - `inventory_logs.item_id` → `inventory_items(id)`
  - `inventory_logs.session_log_id` → `session_logs(id)`
  - `inventory_logs.created_by` → `users(id)`

- CHECK constraints (3 constraints)
  - `packages.module_key` IN ('babycare', 'beauty_spa', 'industrial_cleaning', 'student_training')
  - `packages.service_kind` IN ('single_service', 'treatment_package', 'retail_product', 'consultation')
  - `packages.default_duration_minutes` BETWEEN 1 AND 1440

- Audit triggers (2 triggers)
  - `audit_packages_changes` EXECUTE FUNCTION `log_audit_event()`
  - `audit_inventory_items_changes` EXECUTE FUNCTION `log_audit_event()`

- Update triggers (2 triggers)
  - `packages_updated_at` EXECUTE FUNCTION `update_updated_at_column()`
  - `inventory_items_updated_at` EXECUTE FUNCTION `update_updated_at_column()`

- RLS policies (6 policies)
  - packages: read (tenant + HQ template), manage (admin)
  - inventory_items: tenant isolation
  - inventory_logs: tenant isolation

- FK-dependent indexes (3 indexes)
  - `idx_packages_tenant_module_kind`
  - `idx_packages_template_id`
  - `idx_inventory_logs_session`

**External dependencies:**
- ✅ `tenants` table (20260511)
- ✅ `users` table (20260511)
- ✅ `session_logs` table (20260511)
- ✅ `update_updated_at_column()` function (20260511)
- ✅ `log_audit_event()` function (20260516)
- ✅ `packages`, `inventory_items`, `inventory_logs` base tables (20260509)

**Size:** ~8.4KB

---

## 2. Static Dependency Verification

### 2.1 Execution Order Timeline

```
20260509 (May 9)  - Part 1: Base tables (ZERO dependencies)
    ↓
20260511 (May 11) - Platform core: tenants, users, session_logs, update_updated_at_column()
    ↓
20260512 (May 12) - Permissions (uses base tables from 20260509) ✅
    ↓
20260515 (May 15) - ALTER TABLE packages, UPDATE (uses base tables) ✅
    ↓
20260516 (May 16) - Audit infrastructure: audit_logs, log_audit_event()
    ↓
20260517 (May 17) - Part 2: Constraints + triggers (ALL dependencies available) ✅
    ↓
20260522+ (May 22+) - Downstream migrations (use fully-constrained tables) ✅
```

### 2.2 Dependency Matrix

| Migration | Requires | Provided By | Status |
|-----------|----------|-------------|--------|
| **20260509** | NONE | - | ✅ SATISFIED |
| **20260511** | NONE | uuid extension (built-in) | ✅ SATISFIED |
| **20260512** | packages, inventory_items | 20260509 | ✅ SATISFIED |
| **20260515** | packages (ALTER), packages (UPDATE) | 20260509 | ✅ SATISFIED |
| **20260516** | tenants, auth.users | 20260511, Supabase | ✅ SATISFIED |
| **20260517** | tenants, users, session_logs, functions, base tables | 20260509, 20260511, 20260516 | ✅ SATISFIED |

### 2.3 Intermediate State Safety (20260509-20260516)

**Migration 20260512: fix_permissions.sql**
- Operation: `GRANT ALL`, `DISABLE RLS`
- Requires FK? ❌ NO (permissive operations)
- Requires triggers? ❌ NO
- **Status:** ✅ SAFE

**Migration 20260515: create_packages_table.sql**
- Operations: `ALTER TABLE packages ADD COLUMN`, `UPDATE packages SET price/duration`
- Requires FK? ❌ NO (UPDATE modifies price/duration, NOT tenant_id/updated_by)
- Requires triggers? ⚠️ NO (audit gap accepted)
- **Status:** ✅ SAFE (with accepted audit gap)

**No migrations 20260513, 20260514** (natural gap)

**Conclusion:** ✅ **INTERMEDIATE STATE SAFE**

---

## 3. Downstream Migration Compatibility

### 3.1 Migrations Assuming Tables Exist

**20260515:** `ALTER TABLE packages ADD COLUMN ...`
- Requires: `packages` table exists
- Satisfied by: 20260509 ✅

**20260522:** `ALTER TABLE packages ADD template_id FK`
- Requires: `packages` table + `packages.id` PK
- Satisfied by: 20260509 (PK created), 20260517 (FK constraint application) ✅

**20260608:** `UPDATE packages SET module_key ...`
- Requires: `packages` table + `module_key` column
- Satisfied by: 20260509 ✅

**20260622:** `CREATE MATERIALIZED VIEW ... FROM inventory_items`
- Requires: `inventory_items` table structure
- Satisfied by: 20260509 ✅

**20260622:** `FOREIGN KEY ... REFERENCES packages(id)`
- Requires: `packages.id` PK
- Satisfied by: 20260509 ✅

**20260709-20260716:** Multiple FK to `packages(id)`
- Requires: `packages.id` PK
- Satisfied by: 20260509 ✅

**Conclusion:** ✅ **ALL DOWNSTREAM MIGRATIONS COMPATIBLE**

---

## 4. Original Migration Preservation

**File:** `supabase/migrations/20260510000000_create_spa_core_tables.sql`

**Status:** ⚠️ **PRESERVED (not yet archived)**

**Rationale:**
- Original must remain until fresh-DB test proves split replacement works
- Archive only after:
  1. ✅ Fresh DB reset successful
  2. ✅ Schema verification matches production
  3. ✅ Regression tests pass
  4. ✅ User approval

**Archive location (when approved):**
- `supabase/migrations/archive/20260510000000_create_spa_core_tables.sql`
- Add `ARCHIVED.md` with reason and replacement references

---

## 5. Key Design Decisions

### 5.1 Split Boundary Rationale

**Why 20260509 + 20260517 (not other combinations)?**

**Rejected: 20260508 + 20260517**
- Would place base tables BEFORE tenants table (20260511)
- Semantically incorrect (spa tables should not precede core platform)
- No benefit (tenant_id FK not enforced in Part 1 anyway)

**Rejected: 20260509 + 20260512**
- Would apply constraints before log_audit_event() exists (20260516)
- Breaks audit infrastructure dependency

**Rejected: 20260509 + 20260518**
- Too late (20260517 is natural position after 20260516)
- No migrations exist between 20260517-20260521 (no collision risk)

**Chosen: 20260509 + 20260517**
- ✅ Part 1 chronologically before core schema (logical ordering)
- ✅ Part 2 chronologically after all dependencies (20260511, 20260516)
- ✅ Natural gap exists (no intermediate migrations between 20260516-20260517)
- ✅ Preserves historical semantics (tables available early, constraints applied later)

### 5.2 Audit Gap Acceptance

**Decision:** ACCEPTED per user directive

**Justification:**
- Schema migration UPDATE (20260515) is infrastructure operation, not business transaction
- Historical execution already had same gap (tables from seed, audit added later)
- No FK columns modified (price/duration normalization only)
- Policy: "Schema migration operations do not require audit trail"

**Documentation:** Included inline comment in 20260509 explaining gap and rationale

### 5.3 Function Ownership

**update_updated_at_column():**
- ✅ Confirmed shared platform infrastructure
- ✅ Ownership: Platform Core (created 20260511)
- ✅ Reused across 8+ migrations
- ❌ NOT inlined/duplicated

**log_audit_event():**
- ✅ Confirmed shared platform infrastructure
- ✅ Ownership: Platform Core audit infrastructure (created 20260516)
- ✅ Reused across 10+ migrations
- ❌ NOT inlined/duplicated

**Decision:** Keep functions in original positions (20260511, 20260516). Do NOT move to earlier migrations.

---

## 6. Static Verification Checklist

### 6.1 Part 1 Verification

- ✅ File created: `20260509000000_create_spa_base_tables.sql`
- ✅ Zero external dependencies (no FK, no triggers, no function calls)
- ✅ All base tables created (packages, inventory_items, inventory_logs)
- ✅ Basic indexes created
- ✅ Basic constraints created (CHECK for non-FK validations)
- ✅ Comments documenting split rationale and audit gap
- ✅ GRANT statements included

### 6.2 Part 2 Verification

- ✅ File created: `20260517000000_add_spa_constraints.sql`
- ✅ All FK constraints added (7 constraints)
- ✅ All CHECK constraints added (3 constraints)
- ✅ All audit triggers added (2 triggers)
- ✅ All update triggers added (2 triggers)
- ✅ All RLS policies added (6 policies)
- ✅ FK-dependent indexes added (3 indexes)
- ✅ Comments documenting constraint purpose

### 6.3 Dependency Verification

- ✅ Part 1 executable before Part 2
- ✅ Part 2 dependencies satisfied by 20260511 + 20260516
- ✅ Intermediate state safe for 20260512, 20260515
- ✅ Downstream migrations (20260522+) compatible

### 6.4 Content Verification

- ✅ All columns from original migration preserved
- ✅ All constraints from original migration preserved
- ✅ All triggers from original migration preserved
- ✅ All indexes from original migration preserved
- ✅ All policies from original migration preserved
- ✅ All comments from original migration preserved
- ✅ Currency types correct (bigint for VND)
- ✅ Stock types correct (numeric for fractional contract)
- ✅ module_key CHECK correct ('babycare', not 'baby_care')
- ✅ accounting_review_status correct ('UNREVIEWED' default, UPPERCASE)

---

## 7. Next Steps (NOT YET EXECUTED)

### 7.1 Fresh Database Test

**Command:** `npx supabase db reset`

**Purpose:** Verify migration chain executes from zero

**Expected result:**
- ✅ All migrations execute in order
- ✅ No dependency errors
- ✅ Final schema contains packages, inventory_items, inventory_logs
- ✅ All FK constraints present
- ✅ All triggers present
- ✅ All RLS policies present

**Blocked on:** User approval to proceed

### 7.2 Schema Verification

**Command:** `npx supabase db diff --schema public --use-migra`

**Purpose:** Compare fresh DB schema vs production

**Expected result:**
- ✅ packages table structure matches
- ✅ inventory_items table structure matches
- ✅ inventory_logs table structure matches
- ⚠️ Known acceptable diffs (module_key production drift)

**Blocked on:** Fresh DB test success

### 7.3 Regression Testing

**Scope:** Verify existing functionality unaffected

**Tests:**
- TypeScript compilation (Gate B)
- Regression protection baseline
- Architecture Guard (frozen Kernels)
- Relevant unit/integration tests

**Blocked on:** Schema verification success

### 7.4 Original Migration Archive

**Action:** Move original to archive folder with documentation

**Command:**
```bash
mv supabase/migrations/20260510000000_create_spa_core_tables.sql \
   supabase/migrations/archive/
```

**Documentation:** Create `ARCHIVED.md` explaining replacement

**Blocked on:** All tests passing + user approval

---

## 8. Risk Assessment

### 8.1 High Confidence Areas

- ✅ Static dependency analysis (verified exhaustively)
- ✅ Intermediate state safety (evidence-based)
- ✅ Downstream compatibility (all references checked)
- ✅ Function ownership (shared infrastructure confirmed)

### 8.2 Medium Confidence Areas

- ⚠️ Fresh DB execution (not yet tested)
- ⚠️ RLS policy behavior (not yet tested with auth)
- ⚠️ Trigger execution (not yet tested with DML)

### 8.3 Low Risk Areas

- ❌ Production impact: ZERO (no production changes in this step)
- ❌ Data loss: ZERO (no data operations)
- ❌ Breaking changes: ZERO (migrations additive only)

---

## 9. Rollback Plan

**If fresh DB test fails:**

**Option 1: Revert split**
- Delete 20260509, 20260517
- Keep 20260510 (original)
- Investigate failure cause
- Redesign if needed

**Option 2: Fix split**
- Analyze failure error
- Adjust split boundary if needed
- Re-verify dependencies
- Retry fresh DB test

**Option 3: Historical acceptance**
- Archive all three (20260509, 20260510, 20260517)
- Document migration gap
- Use production schema as canonical
- Future modifications via new migrations only

---

## 10. Success Criteria

### 10.1 Implementation Phase (CURRENT)

- ✅ Split migrations created
- ✅ Static verification passed
- ✅ Documentation complete
- ⏳ **AWAITING:** User approval to proceed with fresh DB test

### 10.2 Validation Phase (NEXT)

- ⏳ Fresh DB reset successful
- ⏳ Schema matches production (with known diffs)
- ⏳ Regression tests pass
- ⏳ No new TypeScript errors

### 10.3 Completion Phase (FINAL)

- ⏳ Original migration archived
- ⏳ Documentation updated
- ⏳ Manufacturing Phase 3.5 unblocked
- ⏳ User acceptance

---

**Status:** ✅ **STEP 4 COMPLETE — AWAITING USER APPROVAL FOR FRESH DB TEST**

**Gate:**
```
✅ Dependency Graph Audit
✅ Intermediate State Audit
✅ Split Migration Implementation
⏳ User Approval → Fresh DB Test
❌ Schema Verification
❌ Regression Testing
❌ Archive Original
🔒 Production UNTOUCHED
```

**NO database operations performed. NO production changes. Split migrations ready for testing.**
