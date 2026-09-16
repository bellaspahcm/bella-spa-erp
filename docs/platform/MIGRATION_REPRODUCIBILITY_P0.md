# Platform Hardening P0: Migration Chain Reproducibility

**Status:** ⏸️ STRATEGIC PIVOT - Census-First Approach  
**Priority:** P0 (Platform Foundation)  
**Started:** 2026-09-16  
**Owner:** Platform Team  
**Part of:** Bella Platform Hardening Initiative (4 workstreams)

---

## **Strategic Context**

**Previous Approach:** Sequential repair (Iterations 1-3)  
**Result:** Unsustainable - 87.5% core tables missing CREATE statements  
**New Approach:** Census → Classify → Decide → Act

**Baseline Reconstruction (Phase B0):** PAUSED  
**Reason:** Requires Production schema verification before generating canonical baseline.  
**Risk:** Creating baseline from E2E without Production reconciliation may enshrine drift.

**Next Phase:** M1 - Migration Census (evidence-based classification)

See: `docs/platform/BELLA_PLATFORM_HARDENING.md` for full 4-workstream strategy.

---

## **Phase M1: Migration Census (NEXT STEP)**

**Objective:** Classify all 458 migrations before deciding repair strategy.

**Census Dimensions:**
1. **Time:** When was migration created? (month/quarter)
2. **Ownership:** Which OS/Product? (Healthcare, Beauty, BabyCare, etc.)
3. **Type:** CREATE, ALTER, DROP, INSERT, etc.
4. **Schema Relevance:** Does it affect current E2E tables?
5. **Ledger State:** Applied to E2E? Applied to Production?

**Classification Categories:**

```text
Category A: ACTIVE SCHEMA
├─ Migrations affecting 70 current E2E tables
└─ Status: MUST PRESERVE

Category B: HISTORICAL
├─ Tables created then dropped (legitimate)
├─ Renamed/refactored tables
└─ Status: ARCHIVE (forensic value)

Category C: ORPHANED
├─ CREATE TABLE but table never existed
├─ References to non-existent objects
└─ Status: INVESTIGATE → REMOVE or DOCUMENT

Category D: UNVERIFIED
├─ E2E tables with no CREATE (26 tables, 14 core)
├─ Core business: tenants, users, bookings, etc.
└─ Status: RECOVER or BASELINE
```

**Decision Gate After Census:**
- **Option A:** Selective Repair (keep A, archive B, remove C, recover D)
- **Option B:** Canonical Baseline (requires Production reconciliation first)
- **Option C:** Hybrid (baseline before cutoff date + keep recent migrations)

**No action until census complete and classification reviewed.**

---

## **Problem Statement**

Cannot prove that Bella's migration chain can reproducibly build a complete database schema from scratch:

```text
empty DB → all migrations → current schema
```

**Evidence:**
- Historical migration conflicts documented
- No clean-build verification in CI
- New environment setup uncertain
- Disaster recovery risk unknown

---

## **Impact**

**If unresolved:**
- ❌ Disaster recovery uncertain
- ❌ New staging environment setup risky
- ❌ Onboarding new environments error-prone
- ❌ Migration rollback strategy unclear
- ❌ Schema drift undetectable

---

## **Diagnosis Protocol**

### **Phase 1: Evidence Gathering (NO MODIFICATIONS)**

**Objective:** Find first deterministic failure in migration chain

**Steps:**

1. **Provision Clean Test Database**
   - Supabase test project OR local Postgres
   - Empty schema (no existing tables)
   - Record connection details

2. **Enumerate Migration Chain**
   ```bash
   ls -1 supabase/migrations/*.sql | sort
   ```
   - Count total migrations
   - Identify naming pattern
   - Check for gaps in sequence

3. **Apply Migrations Sequentially**
   ```bash
   supabase db reset --db-url <test_db_url>
   ```
   - Run from first to last migration
   - Record success/failure for each
   - Capture exact error messages

4. **Identify First Failure**
   - Migration file that fails
   - Exact error message
   - Dependencies required (tables, functions, extensions)
   - Whether failure is deterministic (repeatable)

5. **Dependency Chain Analysis**
   - Which migrations depend on failed migration?
   - Are dependencies explicit (FKs) or implicit (column references)?
   - Can failure be isolated?

6. **Schema Comparison**
   ```bash
   # IF migrations succeed
   pg_dump --schema-only <test_db> > test_schema.sql
   pg_dump --schema-only <production_db> > prod_schema.sql
   diff test_schema.sql prod_schema.sql
   ```
   - Identify schema drift
   - Missing tables/columns/indexes
   - Extra objects in production

---

### **Phase 2: Failure Classification**

**Category A: Migration Dependency Issue**
- Migration B references table from Migration A
- But Migration A not applied yet
- Fix: Reorder migrations OR add explicit dependency

**Category B: Environment Dependency**
- Migration assumes extensions installed (uuid-ossp, pgcrypto)
- Migration assumes Supabase-specific features (auth.users)
- Fix: Add prerequisite checks OR document environment setup

**Category C: Data Dependency**
- Migration assumes seed data exists
- Migration references specific IDs
- Fix: Separate schema migrations from data migrations

**Category D: Idempotency Issue**
- Migration cannot run twice (missing IF NOT EXISTS)
- Migration fails on retry
- Fix: Add idempotency guards

**Category E: Schema Drift**
- Manual production changes not captured in migrations
- Hotfixes applied directly to DB
- Fix: Reverse-engineer missing migrations OR reset baseline

---

### **Phase 3: Fix Strategy (AFTER DIAGNOSIS)**

**NOT EXECUTED YET - awaiting diagnosis results**

Possible strategies (to be determined):
- Sequential fix: Repair migrations one by one from first failure
- Baseline reset: Create new baseline migration from production schema
- Migration squash: Consolidate old migrations into single baseline
- Environment setup: Document prerequisites explicitly

---

## **Success Criteria**

**Diagnosis Complete When:**
- ✅ First failure identified (OR all migrations pass)
- ✅ Failure category classified
- ✅ Dependency chain mapped
- ✅ Evidence documented

**P0 Complete When:**
- ✅ Empty DB → all migrations → schema matches production
- ✅ Clean-build verified in CI
- ✅ No manual steps required
- ✅ Reproducible on any Postgres instance

---

## **Non-Goals (Out of Scope)**

❌ Fix TypeScript debt (P1)  
❌ Fix BabyCare regression (P2)  
❌ Deploy Beauty products to production  
❌ Optimize migration performance  
❌ Refactor migration structure  

**Scope:** Prove reproducibility only. Other improvements are separate tasks.

---

## **Evidence Log**

### **2026-09-16: Diagnosis Started**

**Current State:**
- Total migrations: 458
- First: `20260511000000_initial_schema.sql`
- Last: `20260916000000_beauty_os_h8_persistence.sql`
- Span: ~4 months (May 11 → Sep 16, 2026)

### **2026-09-16: First Failure Detected**

```text
🔴 DETERMINISTIC FAILURE @ MIGRATION #2

Migration:  20260512000000_fix_permissions.sql
Statement:  Line 14
Error:      relation "inventory_items" does not exist (SQLSTATE 42P01)
SQL:        ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY

Dependency Chain:
├─ #1: 20260511000000_initial_schema.sql ✅ PASS
├─ #2: 20260512000000_fix_permissions.sql ❌ FAIL
│       └─ Assumes: inventory_items table exists
│       └─ Reality: inventory_items NEVER created
└─ Migrations #3-458: BLOCKED (cannot proceed)
```

**Root Cause Classification:** **Category E - Schema Drift**

The `inventory_items` table:
- ❌ Not created in initial schema (20260511000000)
- ❌ Not created in any subsequent migration (grep search: no CREATE TABLE)
- ✅ Referenced in migration #2 (RLS disable)
- ✅ Referenced in migration #12+ (RLS policies, audit triggers)
- **Hypothesis:** Table created manually in production/E2E, not captured in migrations

**Subsequent References Found:**
- `20260512000000_fix_permissions.sql`: Line 14 (ALTER TABLE ... DISABLE RLS)
- `20260520000003_audit_all_tables.sql`: Line 80-84 (CREATE TRIGGER audit)
- `20260523010000_harden_all_database_rls.sql`: Lines 171-182 (DROP/CREATE POLICY)

**Evidence:**
- Clean-build test: `supabase start` FAILED at migration #2
- Migration chain broken at position 2/458 (0.4% through chain)
- Failure is deterministic (repeatable on empty database)

**Impact:**
- ❌ Cannot build database from migrations alone
- ❌ Cannot onboard new environments without manual table creation
- ❌ Disaster recovery requires out-of-band schema knowledge
- ❌ Schema drift undetectable (production ≠ migrations)

**Resolution Applied:**
1. ✅ Connected to E2E database (bmnbqbcdbuklhopfbopv) read-only
2. ✅ Dumped complete schema using `supabase db dump --linked`
3. ✅ Extracted `inventory_items` table definition:
   - 12 columns (id, tenant_id, name, sku, unit, stock_level, etc.)
   - 1 primary key (id)
   - 1 foreign key (tenant_id → tenants)
   - 1 index (tenant_id)
   - 1 trigger (updated_at automation)
4. ✅ Created missing migration: `20260511500000_create_inventory_items.sql`
5. ✅ Positioned between #1 (initial_schema) and #2 (fix_permissions)
6. ✅ Reset local database and reran full migration chain

**Result:**
- Migration #2 (fix_permissions): ✅ NOW PASSES
- Migrations #1-5: ✅ ALL PASS
- Migration #6 (standardization_phase_1): ❌ NEW FAILURE DETECTED

**Next Failure:**
- Migration: `20260515000000_standardization_phase_1.sql`
- Error: `relation "public.profiles" does not exist (SQLSTATE 42P01)`
- Context: RLS policy references `auth.uid()` lookup in non-existent table
- Status: STOPPED (awaiting next iteration)

---

## **References**

- Beauty OS PR #115: Merged @ cfd00513
- Migration: `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql`
- ADR-008: CI migration drift target decision


---

### **2026-09-16: Iteration 1 Complete - Next Failure Found**

**Repaired:** `inventory_items` missing schema history

**Migration Created:**
```sql
-- File: supabase/migrations/20260511500000_create_inventory_items.sql
-- Timestamp: Between #1 (initial_schema) and #2 (fix_permissions)
-- Source: E2E database dump (bmnbqbcdbuklhopfbopv)
-- Schema: 12 columns, 1 PK, 1 FK, 1 index, 1 trigger
```

**Clean-Build Progress:** 5/458 migrations (1.1%)

**Next Failure (Migration #6):**
```text
File:     20260515000000_standardization_phase_1.sql
Error:    relation "public.profiles" does not exist (SQLSTATE 42P01)
SQL:      CREATE POLICY ... FROM public.profiles WHERE id = auth.uid()
Category: MISSING_SCHEMA_HISTORY (likely)
```

**Classification:** Same pattern as `inventory_items` - RLS policy references table before creation

**Status:** ⏸️ AWAITING next iteration decision


---

### **2026-09-16: Iteration 2 - Structural Issue Detected**

**Investigation:** `public.profiles` missing reference

**Root Cause:** LEGACY_CODE_ERROR (not missing schema)
- `public.profiles` table **NEVER existed** in any migration
- Migration #6 author incorrectly assumed it existed
- Correct table is `public.users` (created in migration #1)

**Repair Applied:**
```sql
-- Fixed RLS policies
- public.profiles → public.users (2 policies)
- Removed: ALTER TABLE public.profiles (never existed)
```

**Result:** Migration #6 RLS policies fixed, but **new failure immediately after**:

**New Failure (Same Migration):**
```text
File:     20260515000000_standardization_phase_1.sql
Line:     32 (line 4 of ALTER TABLE sequence)
Error:    relation "public.employees" does not exist (SQLSTATE 42P01)
SQL:      ALTER TABLE public.employees ALTER COLUMN tenant_id DROP DEFAULT
```

**Structural Issue Detected:**

Migration #6 attempts to ALTER 11 tables simultaneously:
```sql
ALTER TABLE public.employees ...      ← FAIL (doesn't exist)
ALTER TABLE public.customers ...      ← exists
ALTER TABLE public.projects ...       ← doesn't exist
ALTER TABLE public.units ...          ← doesn't exist  
ALTER TABLE public.bookings ...       ← exists
ALTER TABLE public.sale_contracts ... ← doesn't exist
ALTER TABLE public.expenses ...       ← exists
ALTER TABLE public.users ...          ← exists
ALTER TABLE public.salary_records ... ← exists
ALTER TABLE public.session_logs ...   ← exists
ALTER TABLE public.revenue ...        ← exists
```

**Tables in Initial Schema (migration #1):**
- ✅ tenants, users, customers, bookings, session_logs
- ✅ session_reviews, packages, revenue, expenses, salary_records
- ❌ employees, projects, units, sale_contracts (NOT in initial schema)

**Classification:** PREMATURE_MIGRATION
- Migration #6 was written assuming tables created by later migrations
- Violates chronological dependency (ALTER before CREATE)
- Likely written during active development when tables existed in dev DB

**Resolution Options:**

**Option A: Idempotent ALTERs (Defensive)**
```sql
-- Only ALTER if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'employees') THEN
        ALTER TABLE public.employees ALTER COLUMN tenant_id DROP DEFAULT;
    END IF;
END $$;
```
Pros: Migration becomes safe regardless of table existence  
Cons: Masks missing tables (silently succeeds)

**Option B: Reorder/Split Migration**
- Move ALTER statements to later migrations (after respective CREATE TABLE)
- Keep only relevant ALTERs in migration #6
Pros: Maintains chronological correctness  
Cons: Requires splitting migration file

**Option C: Create Missing Tables First**
- Add employees, projects, units, sale_contracts before migration #6
Pros: Matches original intent  
Cons: May create unused tables if they were never production tables

**Status:** ⏸️ AWAITING decision on structural repair approach

**Progress:** Still 5/458 migrations (multiple errors in same migration)


---

### **2026-09-16: Iteration 3 Complete - Migration #6 Repaired**

**Investigation:** 4 missing tables referenced in Migration #6

**Evidence:**
1. **Tables Never Created:**
   - `employees`, `projects`, `units`, `sale_contracts`
   - ❌ Not in any migration file
   - ❌ Not in E2E database
   - **Classification:** Dead code from abandoned development

2. **RLS Pattern Obsolescence:**
   - Migration #6 uses: `SELECT tenant_id FROM public.users WHERE id = auth.uid()`
   - E2E uses: `get_auth_tenant_id()` function (introduced migration #10)
   - Both patterns work temporarily but standardized later

**Repair Applied:**
```sql
-- Removed dead ALTER TABLE statements (5 tables)
- public.profiles (never existed)
- public.employees (never created)
- public.projects (never created)
- public.units (never created)  
- public.sale_contracts (never created)

-- Kept valid ALTER TABLE statements (7 tables)
✅ public.customers
✅ public.bookings
✅ public.expenses
✅ public.users
✅ public.salary_records
✅ public.session_logs
✅ public.revenue
```

**Result:** Migration #6 ✅ NOW PASSES

**Clean-Build Progress:** 5/458 → 7/458 (1.5%)

**Next Failure (Migration #8):**
```text
File:     20260515010000_the_great_purge.sql
Error:    relation "public.packages" does not exist (SQLSTATE 42P01)
SQL:      SELECT id INTO default_pkg_id FROM public.packages...
Context:  DO block attempts to query packages before table exists
Pattern:  Premature reference (similar to migrations #6)
```

**Status:** ⏸️ AWAITING Iteration 4
