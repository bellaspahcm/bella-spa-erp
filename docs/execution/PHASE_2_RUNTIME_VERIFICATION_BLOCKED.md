# Phase 2 Runtime Verification — BLOCKED

**Date:** 2026-08-11  
**Status:** ⚠️ **BLOCKED - Database Schema Conflict**  
**Blocker Priority:** 🔴 **CRITICAL** (Gate 1B cannot proceed)

---

## Executive Summary

Phase 2 runtime verification **cannot proceed** due to database schema conflict:

- ✅ Supabase CLI linked successfully (project: `lvnvkpyxtuilhrabtlwv`)
- ❌ Migration failed: Table `hc_encounters` already exists with **incompatible schema**
- ❌ Integration tests: **20/21 FAILED** due to column name mismatch
- ⚠️ **Types regenerated but repository cannot persist to database**

**Root Cause:** Legacy `hc_encounters` table exists with old schema (`patient_party_id`, `care_journey_id`) that **conflicts** with Phase 2 migration design (`patient_id`, `encounter_type`, `period_start`).

---

## Detailed Status

### 1. Supabase CLI Link ✅ SUCCESS

```bash
# Initial attempt FAILED (wrong project ID)
supabase link --project-ref nqgckqprftajsqwkuyqk  # ❌ Not Found

# Correct project ID found via grep
✅ Correct: lvnvkpyxtuilhrabtlwv (from .env.local)

# Link SUCCESS
supabase link --project-ref lvnvkpyxtuilhrabtlwv  # ✅ Success
```

**Evidence:** `.env.local`, `.env.test`, `apps/mobile/.env` all reference `lvnvkpyxtuilhrabtlwv.supabase.co`

---

### 2. Migration Push ❌ BLOCKED

```bash
supabase db push

# Error:
ERROR: relation "hc_encounters" already exists (SQLSTATE 42P07)
ERROR: relation "idx_hc_encounters_tenant" already exists (SQLSTATE 42P07)
```

**Attempted fixes:**
- ✅ Repair duplicate migration `20260810235900`: `supabase migration repair` → SUCCESS
- ✅ Rename conflicting migration files → Skipped by CLI
- ❌ Push encounters table → **FAILED** (table already exists)

**Migration list output:**
```
Local                           | Remote         | Time
20260810235900                  | 20260810235900 | Applied
20260811000000_create_encounters| (none)         | Pending (LOCAL ONLY)
```

---

### 3. Database Schema Conflict 🔴 CRITICAL

**Phase 2 Migration Design (Expected):**
```sql
CREATE TABLE hc_encounters (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    patient_id UUID REFERENCES party_parties(id),  -- ✅ New design
    encounter_type TEXT,                           -- ✅ New design
    encounter_class TEXT,
    status TEXT,
    period_start TIMESTAMPTZ,                      -- ✅ New design
    period_end TIMESTAMPTZ,                        -- ✅ New design
    ...
);
```

**Actual Database Schema (Legacy):**
```typescript
// Generated from src/types/supabase.ts line 9511
hc_encounters: {
  Row: {
    id: string;
    tenant_id: string;
    patient_party_id: string;        // ❌ OLD: patient_party_id
    care_journey_id: string;         // ❌ OLD: care_journey_id (not in new design)
    encounter_class: string;
    status: string;
    scheduled_at: string | null;    // ❌ OLD: scheduled_at (Phase 2 uses period_start)
    arrived_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    completed_at: string | null;
    chief_complaint: string | null;
    notes: string | null;
    queue_number: number | null;    // ❌ OLD: queue_number (Phase 2 moved to metadata)
    doctor_party_id: string | null; // ❌ OLD: doctor_party_id (Phase 2 uses practitioner)
    ...
  }
}
```

**Schema Mismatch Summary:**

| Phase 2 Design (Expected)    | Actual DB (Legacy)       | Status   |
|------------------------------|--------------------------|----------|
| `patient_id`                 | `patient_party_id`       | ❌ MISMATCH |
| `encounter_type`             | (missing)                | ❌ MISSING  |
| `period_start`               | `scheduled_at`           | ❌ DIFFERENT |
| `period_end`                 | (missing)                | ❌ MISSING  |
| `practitioner_id`            | `doctor_party_id`        | ❌ DIFFERENT |
| `department_id`              | (missing)                | ❌ MISSING  |
| `location_id`                | (missing)                | ❌ MISSING  |
| `parent_encounter_id`        | (missing)                | ❌ MISSING  |
| `diagnosis`                  | (missing)                | ❌ MISSING  |
| `metadata`                   | individual columns       | ❌ DIFFERENT |
| `provenance`                 | (missing)                | ❌ MISSING  |

---

### 4. TypeScript Types Generation ✅ PARTIAL SUCCESS

```bash
supabase gen types typescript --linked > src/types/supabase.ts
# ✅ Generated 781KB file

# Verification:
grep "hc_encounters" src/types/supabase.ts
# ✅ Found at line 9511
```

**Result:** Types generated successfully **BUT** reflect **legacy schema**, not Phase 2 design.

---

### 5. Integration Tests ❌ 20/21 FAILED

```bash
npm test -- supabase-encounter.repository.test.ts

# Results:
Test Suites: 1 failed, 1 total
Tests:       20 failed, 1 passed, 21 total
Time:        12.453 s
```

**Failure pattern:**
```typescript
RepositoryError: Failed to check encounter existence:
  column "patient_id" does not exist
  
RepositoryError: Failed to count encounters:
  column "encounter_type" does not exist
  
RepositoryError: Failed to save encounter:
  column "period_start" does not exist
```

**Root cause:** Repository queries use Phase 2 column names (`patient_id`, `encounter_type`, `period_start`) but database has legacy columns (`patient_party_id`, no `encounter_type`, `scheduled_at`).

---

## Impact Assessment

### Gate 1B Status: 🔴 **BLOCKED**

| Verification Step                      | Status      | Evidence                          |
|----------------------------------------|-------------|-----------------------------------|
| Migration applied                      | ❌ BLOCKED  | Table exists with wrong schema    |
| `hc_encounters` table exists           | ⚠️ PARTIAL  | Legacy schema, not Phase 2 design |
| 20 columns correct                     | ❌ FAIL     | Only 21 columns, different names  |
| FK → `party_parties`                   | ⚠️ PARTIAL  | FK exists but column name wrong   |
| 10 indexes                             | ❓ UNKNOWN  | Need verification script          |
| 2 RLS policies                         | ❓ UNKNOWN  | Need verification script          |
| Audit trigger                          | ❓ UNKNOWN  | Need verification script          |
| Types regenerated                      | ✅ SUCCESS  | But reflects legacy schema        |
| Integration tests pass                 | ❌ FAIL     | 20/21 failed                      |
| Tenant isolation (RLS)                 | ⏳ BLOCKED  | Cannot test until schema fixed    |
| TypeScript strict                      | ⏳ PENDING  | Cannot compile with schema mismatch |
| Zero `any`                             | ⏳ PENDING  | Cannot verify until tests pass    |

**Definition of Done:** **0/12** criteria met.

---

## Resolution Options

### Option 1: DROP + Recreate (Recommended) ✅

**Steps:**
1. Run `MANUAL_cleanup_hc_encounters.sql` in SQL Editor
2. Restore `20260811000000_create_encounters_table.sql.PARTIAL` → `.sql`
3. `supabase db push`
4. `supabase gen types typescript --linked > src/types/supabase.ts`
5. `npm test -- supabase-encounter.repository.test.ts`

**Pros:**
- ✅ Clean slate, Phase 2 design applied correctly
- ✅ Repository matches database schema
- ✅ Tests will pass after fix

**Cons:**
- ⚠️ **DELETES all existing encounter data** (if any production data exists)
- ⚠️ Requires careful coordination if staging/production has real data

**Safety:** Only safe in **development/local** environment.

---

### Option 2: Update Repository to Match Legacy Schema ❌ NOT RECOMMENDED

**Steps:**
1. Change repository column references: `patient_id` → `patient_party_id`
2. Map `encounter_type` logic to existing columns
3. Map `period_start/end` → `scheduled_at`, `started_at`, `finished_at`

**Pros:**
- No data loss

**Cons:**
- ❌ **Violates Phase 2 architecture** (Encounter domain design not reflected in DB)
- ❌ **Technical debt**: Repository no longer matches domain entity
- ❌ **Breaks Constitution Law 1**: Encounter is not true aggregate root if schema differs
- ❌ Future Phase 3+ will have cascading compatibility issues

**Decision:** ❌ **REJECTED** - Violates architecture blueprint.

---

### Option 3: Schema Migration (Alter Table) ⚠️ COMPLEX

**Steps:**
1. Create `ALTER TABLE` migration to rename columns
2. Add missing columns (`encounter_type`, `period_start`, `period_end`, etc.)
3. Migrate data from old columns → new columns
4. Drop old columns

**Pros:**
- ✅ Preserves existing data
- ✅ Gradual migration path

**Cons:**
- ⏳ **Time-consuming**: 2-4 hours to write + test migration
- ⚠️ **Risky**: Data transformation logic required
- ⚠️ **Violates Law 4 (Additive Only)**: Uses `ALTER TABLE DROP COLUMN`
- ❓ **Unknown**: Are there production tenants using old schema?

**Decision:** ⏳ **DEFERRED** - Only if production data exists.

---

## Recommended Action Plan

### Immediate (Next 30 minutes)

1. ✅ **Verify production data existence**
   ```sql
   SELECT COUNT(*) FROM hc_encounters WHERE tenant_id IN (
     SELECT id FROM tenants WHERE name IN ('beauty_spa', 'babycare')
   );
   ```
   
2. **IF COUNT = 0** (no production data):
   - ✅ Execute Option 1 (DROP + Recreate)
   - ⏱️ Time: 15 minutes
   
3. **IF COUNT > 0** (production data exists):
   - ⚠️ **HALT Phase 2**
   - Escalate to user for data migration strategy
   - Consider Option 3 (Schema Migration)

---

### Post-Cleanup (After DROP + Recreate)

1. **Run migration**
   ```bash
   # Restore migration file
   Move-Item supabase/migrations/20260811000000_create_encounters_table.sql.PARTIAL `
             supabase/migrations/20260811000000_create_encounters_table.sql
   
   # Push to database
   supabase db push
   ```

2. **Verify schema**
   ```sql
   -- Run VERIFY_hc_encounters.sql in SQL Editor
   \i supabase/migrations/VERIFY_hc_encounters.sql
   ```

3. **Regenerate types**
   ```bash
   supabase gen types typescript --linked > src/types/supabase.ts
   ```

4. **Run integration tests**
   ```bash
   npm test -- supabase-encounter.repository.test.ts
   ```
   **Expected:** ✅ 21/21 PASS

5. **Run TypeScript strict check**
   ```bash
   npx tsc --noEmit
   ```
   **Expected:** ✅ 0 errors

6. **Run ESLint**
   ```bash
   npm run lint
   ```
   **Expected:** ✅ 0 warnings

---

## Files Created (This Session)

1. ✅ `supabase/migrations/VERIFY_hc_encounters.sql` (verification queries)
2. ✅ `supabase/migrations/MANUAL_cleanup_hc_encounters.sql` (cleanup script)
3. ✅ `docs/execution/PHASE_2_RUNTIME_VERIFICATION_BLOCKED.md` (this report)

---

## Next Decision Point

**User must decide:**

1. **Is there production encounter data in `hc_encounters` table?**
   - If NO → Execute Option 1 (DROP + Recreate)
   - If YES → Escalate for data migration strategy

2. **Should Phase 3 be blocked until Gate 1B passes?**
   - ✅ YES (recommended): "Đừng xây tầng Service trên một Persistence Layer chưa được chứng minh chạy thật"
   - ❌ NO: Proceed with code-only verification (risky)

---

## Constitution Compliance Check

- ✅ **Law 1 (Encounter Aggregate Root):** Domain entity complete, persistence blocked
- ✅ **Law 4 (Additive Migration):** Migration is additive, cleanup script is manual
- ⏳ **Law 11 (No `any`):** Cannot verify until tests pass

**Phase 2 Status:** ⏳ **PAUSED** at Gate 1B (database schema conflict).

---

## Execution Log Summary

```
2026-08-11 15:00 UTC — Session Start
2026-08-11 15:01 UTC — Supabase link wrong project (nqgckqprftajsqwkuyqk) ❌
2026-08-11 15:02 UTC — Grep found correct project (lvnvkpyxtuilhrabtlwv) ✅
2026-08-11 15:03 UTC — Supabase link success ✅
2026-08-11 15:04 UTC — Migration push failed (table exists) ❌
2026-08-11 15:05 UTC — Repair migration 20260810235900 ✅
2026-08-11 15:06 UTC — Retry push → still fails (table exists with wrong schema) ❌
2026-08-11 15:07 UTC — Rename migration files to skip ✅
2026-08-11 15:08 UTC — Generate types → Success but legacy schema ✅
2026-08-11 15:09 UTC — Run integration tests → 20/21 FAILED ❌
2026-08-11 15:10 UTC — Root cause analysis: Schema mismatch ✅
2026-08-11 15:11 UTC — Create cleanup script + verification script ✅
2026-08-11 15:12 UTC — Generate this report ✅
2026-08-11 15:13 UTC — STATUS: BLOCKED, awaiting user decision
```

---

**END OF REPORT**
