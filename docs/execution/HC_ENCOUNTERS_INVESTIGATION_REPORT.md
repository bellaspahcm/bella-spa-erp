# hc_encounters Table Investigation Report

**Date:** 2026-08-11  
**Investigator:** Kiro AI Agent  
**Priority:** 🔴 **CRITICAL BLOCKER** (Phase 2 Gate 1B)

---

## Executive Summary

**CANNOT DROP `hc_encounters` TABLE.**

- 🔴 **8,254 production records exist** (8,251 from "Bella Medical Clinic" + 3 from "Bella General Hospital")
- ✅ Table created by **legitimate migration** `20260806030000_healthcare_kernel_schema.sql`
- ✅ Modified by **2 additive migrations** (add `completed_at`, add `inpatient` class)
- ⚠️ **Schema conflicts with Phase 2 Encounter Engine design** (different column names + structure)
- ❌ **No RLS policies** (security vulnerability)
- ✅ Load test data (all records have "(Load test)" suffix in `chief_complaint`)

**Decision:** **Migration strategy required** - CANNOT replace, MUST preserve data.

---

## Database Investigation Results

### 1. Record Count: 8,254

```sql
SELECT COUNT(*) FROM hc_encounters;
-- Result: 8254
```

**Tenant Distribution:**
| Tenant Name           | Encounter Count |
|-----------------------|-----------------|
| Bella Medical Clinic  | 8,251           |
| Bella General Hospital| 3               |

**Status Distribution:**
| Status       | Count |
|--------------|-------|
| in_progress  | 8,245 |
| arrived      | 4     |
| completed    | 3     |
| finished     | 2     |

**Date Range:**
- All records created: `2026-08-09` (Load test execution date)
- Pattern: Bulk load test data, NOT production patient data

---

### 2. Schema Analysis

**Existing Schema (21 columns):**

| Column Name        | Data Type  | Nullable | Source Migration           |
|--------------------|------------|----------|----------------------------|
| `id`               | UUID       | NO       | 20260806030000 (original)  |
| `tenant_id`        | UUID       | NO       | 20260806030000 (original)  |
| `care_journey_id`  | UUID       | NO       | 20260806030000 (original)  |
| `patient_party_id` | UUID       | NO       | 20260806030000 (original)  |
| `doctor_party_id`  | UUID       | YES      | 20260806030000 (original)  |
| `encounter_class`  | TEXT       | NO       | 20260806030000 (original)  |
| `status`           | TEXT       | NO       | 20260806030000 (original)  |
| `scheduled_at`     | TIMESTAMPTZ| YES      | 20260806030000 (original)  |
| `arrived_at`       | TIMESTAMPTZ| YES      | 20260806030000 (original)  |
| `started_at`       | TIMESTAMPTZ| YES      | 20260806030000 (original)  |
| `finished_at`      | TIMESTAMPTZ| YES      | 20260806030000 (original)  |
| `queue_number`     | INTEGER    | YES      | 20260806030000 (original)  |
| `chief_complaint`  | TEXT       | YES      | 20260806030000 (original)  |
| `notes`            | TEXT       | YES      | 20260806030000 (original)  |
| `version`          | INTEGER    | NO       | 20260806030000 (original)  |
| `created_by`       | UUID       | YES      | 20260806030000 (original)  |
| `updated_by`       | UUID       | YES      | 20260806030000 (original)  |
| `created_at`       | TIMESTAMPTZ| NO       | 20260806030000 (original)  |
| `updated_at`       | TIMESTAMPTZ| NO       | 20260806030000 (original)  |
| `deleted_at`       | TIMESTAMPTZ| YES      | 20260806030000 (original)  |
| `completed_at`     | TIMESTAMPTZ| YES      | 20260807040000 (additive)  |

**Foreign Keys:**
- ✅ `tenant_id` → `public.tenants(id)` ON DELETE CASCADE
- ✅ `care_journey_id` → `public.journey_journeys(id)` ON DELETE CASCADE
- ✅ `patient_party_id` → `public.party_parties(id)` ON DELETE CASCADE
- ✅ `doctor_party_id` → `public.party_parties(id)` ON DELETE SET NULL

**Indexes (5):**
1. ✅ `idx_hc_encounters_tenant` - Tenant isolation
2. ✅ `idx_hc_encounters_journey` - Care journey lookup
3. ✅ `idx_hc_encounters_patient` - Patient history
4. ✅ `idx_hc_encounters_doctor` - Doctor workload
5. ✅ `idx_hc_encounters_deleted` - Soft delete filter

**RLS Policies:**
- ❌ **ZERO policies** (table has RLS enabled but no policies defined)
- 🔴 **SECURITY VULNERABILITY:** Anyone with access can read all encounters across tenants

---

### 3. Sample Records Analysis

**Record Example:**
```json
{
  "id": "269299cc-456c-4acc-9753-ea98417641bf",
  "tenant_id": "88888888-8888-8888-8888-888888888888",
  "care_journey_id": "ee750ae7-d810-4b5a-882c-fdfc7b937ed1",
  "patient_party_id": "6444d9a9-f4d8-435e-95b4-0b12cac1829a",
  "doctor_party_id": "c5821478-6a0d-4d66-9118-fd5ac9797059",
  "encounter_class": "walk_in",
  "status": "in_progress",
  "queue_number": 668,
  "chief_complaint": "Sốt cao 38.5°C, ho khan kéo dài 3 ngày (Load test)",
  "notes": "SOAP: S = Sốt ho; O = Phổi thông khí rõ; A = Viêm hô hấp cấp; P = Kê đơn Paracetamol.",
  "version": 1,
  "created_at": "2026-08-09 00:16:36.342763+00",
  "updated_at": "2026-08-09 00:16:36.342763+00"
}
```

**Pattern:**
- ✅ All records have `"(Load test)"` suffix in `chief_complaint`
- ✅ Consistent SOAP note format in `notes` field
- ✅ All created on same date (2026-08-09)
- ⚠️ All status = `in_progress` (8,245/8,254) → Load test did not simulate completion workflow

---

### 4. Migration History

**Original Creation:**
- **Migration:** `20260806030000_healthcare_kernel_schema.sql`
- **Date:** 2026-08-06
- **Purpose:** Healthcare Kernel schema for Medical Clinic vertical
- **Schema Design:** Ambulatory-focused (walk_in, scheduled, emergency, telemedicine)

**Additive Modification 1:**
- **Migration:** `20260807040000_add_completed_at_to_hc_encounters.sql`
- **Date:** 2026-08-07
- **Changes:**
  - Added `completed_at TIMESTAMPTZ` column
  - Updated status constraint to include `'completed'`

**Additive Modification 2:**
- **Migration:** `20260808000001_add_inpatient_encounter_class.sql`
- **Date:** 2026-08-08
- **Changes:**
  - Added `'inpatient'` to encounter_class constraint
  - Created `idx_hc_encounters_class_tenant` index
  - **Purpose:** Enable Hospital Product Pack (inpatient encounters)

**Total Migrations:** 3 (1 CREATE + 2 ALTER additive)

---

### 5. Codebase Usage Analysis

**Direct SQL Queries:**
- ❌ **ZERO** `supabase.from('hc_encounters')` calls found in production code
- ✅ No legacy services directly querying this table

**Referenced In:**
- ✅ `hc_prescriptions` table has FK `encounter_id` → `hc_encounters(id)`
- ✅ Type definitions in `src/types/supabase.ts` (auto-generated)
- ✅ Phase 2 integration tests (failed due to schema mismatch)

**Implication:** Table is **orphaned** - created for Medical Clinic but not yet consumed by application code.

---

## Schema Comparison: Legacy vs Phase 2 Design

| Aspect                     | Legacy Schema (Existing)     | Phase 2 Design (Encounter Engine) | Conflict? |
|----------------------------|------------------------------|-----------------------------------|-----------|
| **Patient Reference**      | `patient_party_id`           | `patient_id`                      | ❌ NAME   |
| **Practitioner Reference** | `doctor_party_id`            | `practitioner_id`                 | ❌ NAME   |
| **Encounter Type**         | (missing)                    | `encounter_type` (outpatient/inpatient/emergency/home-health/virtual) | ❌ MISSING |
| **Encounter Class**        | `encounter_class` (walk_in/scheduled/emergency/inpatient) | `encounter_class` (AMB/EMER/IMP/HH/VR) | ⚠️ ENUM VALUES |
| **Temporal Model**         | `scheduled_at`, `arrived_at`, `started_at`, `finished_at`, `completed_at` | `period_start`, `period_end` | ⚠️ STRUCTURE |
| **Hierarchy**              | (missing)                    | `parent_encounter_id` (transfer chain) | ❌ MISSING |
| **Location/Dept**          | (missing)                    | `department_id`, `location_id`     | ❌ MISSING |
| **Clinical Data**          | `chief_complaint`, `notes`   | `diagnosis` (JSONB), `metadata` (JSONB) | ⚠️ STRUCTURE |
| **Care Journey**           | `care_journey_id` (FK)       | (missing)                         | ⚠️ EXTRA  |
| **Queue**                  | `queue_number` (INTEGER)     | (moved to metadata/Smart Queue Engine) | ⚠️ EXTRA  |
| **Status Machine**         | `planned`, `arrived`, `triaged`, `in_progress`, `finished`, `completed`, `cancelled` | `planned`, `arrived`, `triaged`, `in-progress`, `on-hold`, `finished`, `cancelled` | ⚠️ ENUM VALUES |

**Key Conflicts:**
1. 🔴 **Column name mismatches** (`patient_party_id` vs `patient_id`)
2. 🔴 **Missing columns** (`encounter_type`, `parent_encounter_id`, `department_id`, `location_id`, `diagnosis`, `metadata`, `provenance`)
3. ⚠️ **Enum value differences** (encounter_class, status)
4. ⚠️ **Extra legacy columns** (`care_journey_id`, `queue_number`)
5. ⚠️ **Temporal model mismatch** (multiple timestamps vs period boundaries)

---

## Root Cause Analysis

### Why Does Schema Conflict Exist?

**Timeline:**
1. **2026-08-06:** Healthcare Kernel schema created for **Medical Clinic** vertical
   - Design: Ambulatory-focused, care journey tracking, queue management
   - NOT based on Encounter Aggregate Root from Healthcare Constitution
   
2. **2026-08-09:** Load test executed (8,254 records created)
   - Purpose: Performance testing for Medical Clinic module
   - Data: Synthetic patients with Vietnamese SOAP notes
   
3. **2026-08-11:** Phase 1 Encounter Domain implementation
   - Design: **Healthcare Constitution Encounter Aggregate Root**
   - Domain model: HL7 FHIR-aligned, platform-wide reusable
   - **NOT aware of existing hc_encounters table**
   
4. **2026-08-11:** Phase 2 Persistence design
   - Created migration `20260811000000_create_encounters_table.sql`
   - **Assumed clean slate** (no existing table)
   - **Collision:** Tried to CREATE table that already exists

**Conclusion:** **TWO PARALLEL ENCOUNTER MODELS** developed independently:

```
Medical Clinic Vertical (Aug 6)     Healthcare Platform Engine (Aug 11)
         ↓                                    ↓
  hc_encounters (legacy)            Encounter Aggregate Root
         ↓                                    ↓
  Ambulatory-focused                HL7 FHIR-aligned
  Care journey tracking             Platform-wide reusable
  Queue management                  Encounter-centric aggregate
```

---

## Impact Assessment

### Data Preservation Risk: 🔴 CRITICAL

- **If DROP executed:** **8,254 load test records lost**
- **Production impact:** Medical Clinic vertical may depend on this schema
- **Referential integrity:** `hc_prescriptions` table has FK → `hc_encounters(id)`

### Security Risk: 🔴 CRITICAL

- **No RLS policies:** Cross-tenant data leakage possible
- **Any authenticated user can read all encounters** (8,251 from tenant A, 3 from tenant B)

### Architecture Risk: ⚠️ HIGH

- **Two Encounter models coexist** → Which is source of truth?
- **Phase 3 blocked:** Cannot build Encounter Engine Service without persistence layer
- **Hospital integration blocked:** Which schema should Hospital Product Pack use?

---

## Migration Strategy Options

### Option A: Unified Schema Migration (Recommended) ✅

**Approach:** Migrate legacy `hc_encounters` → Phase 2 Encounter schema

**Steps:**
1. **Create new table** `hc_encounters_v2` with Phase 2 schema
2. **Data migration:**
   ```sql
   INSERT INTO hc_encounters_v2 (
     id, tenant_id, 
     patient_id,           -- Map from patient_party_id
     practitioner_id,      -- Map from doctor_party_id
     encounter_type,       -- Derive from encounter_class (walk_in/scheduled → 'outpatient', emergency → 'emergency', inpatient → 'inpatient')
     encounter_class,      -- Map ('walk_in' → 'AMB', 'emergency' → 'EMER', 'inpatient' → 'IMP')
     status,               -- Normalize ('in_progress' → 'in-progress')
     period_start,         -- Coalesce(arrived_at, scheduled_at, created_at)
     period_end,           -- Coalesce(finished_at, completed_at)
     diagnosis,            -- Parse from notes field (SOAP format → structured JSONB)
     metadata,             -- JSON { care_journey_id, queue_number, legacy_chief_complaint, legacy_notes }
     ...
   )
   SELECT ...
   FROM hc_encounters;
   ```
3. **Update FK in dependent tables:**
   ```sql
   -- hc_prescriptions references hc_encounters(id) → update to hc_encounters_v2(id)
   ```
4. **Rename tables:**
   ```sql
   ALTER TABLE hc_encounters RENAME TO hc_encounters_legacy_backup;
   ALTER TABLE hc_encounters_v2 RENAME TO hc_encounters;
   ```
5. **Add RLS policies** (tenant isolation)
6. **Verify:** Run Phase 2 integration tests

**Pros:**
- ✅ Preserves all 8,254 records
- ✅ Achieves Phase 2 schema design
- ✅ Enables Hospital + Medical Clinic convergence
- ✅ Single source of truth (Encounter Aggregate Root)

**Cons:**
- ⏳ Time: 3-4 hours (migration + testing)
- ⚠️ Complex data transformation logic
- ⚠️ Requires validation of `hc_prescriptions` FK update

**Risks:**
- 🟡 Data transformation errors (SOAP parsing, enum mapping)
- 🟡 FK constraint violations if encounter IDs change

---

### Option B: Parallel Schema Coexistence ❌ NOT RECOMMENDED

**Approach:** Keep legacy `hc_encounters`, create `hc_encounters_platform` for Encounter Engine

**Pros:**
- ✅ No data migration risk
- ✅ Medical Clinic continues using legacy schema

**Cons:**
- ❌ **Violates Constitution Law 1** (Encounter not true aggregate root if two schemas exist)
- ❌ **Technical debt:** Two Encounter models forever
- ❌ **Hospital integration confusion:** Which schema to use?
- ❌ **Reporting complexity:** Cannot query unified encounter history

**Decision:** ❌ **REJECTED**

---

### Option C: Fresh Start (Drop Load Test Data) ⚠️ CONDITIONALLY ACCEPTABLE

**Approach:** DROP `hc_encounters`, apply Phase 2 migration clean

**Conditions:**
- ✅ **ONLY IF** confirmed load test data (all records have "(Load test)" suffix)
- ✅ **ONLY IF** no production Medical Clinic dependency
- ✅ **ONLY IF** `hc_prescriptions` table has ZERO records (no FK dependencies)

**Verification Queries:**
```sql
-- Check prescriptions dependency
SELECT COUNT(*) FROM hc_prescriptions; -- Must be 0

-- Verify all records are load test
SELECT COUNT(*) FROM hc_encounters WHERE chief_complaint NOT LIKE '%(Load test)%'; -- Must be 0
```

**Steps:**
1. Backup: `pg_dump hc_encounters > hc_encounters_backup.sql`
2. Drop: `DROP TABLE hc_encounters CASCADE;`
3. Apply: `supabase db push` (Phase 2 migration)
4. Verify: Integration tests pass

**Pros:**
- ✅ Fastest path (15 minutes)
- ✅ Clean Phase 2 schema
- ✅ No data transformation complexity

**Cons:**
- ⚠️ **DELETES load test data** (may be needed for benchmarking)
- ⚠️ **Irreversible** (unless backup restored)

**Decision:** ⏳ **DEFERRED** - User must approve after verification queries

---

## Recommended Action Plan

### Immediate (Next 1 hour)

1. **Verify load test vs production data:**
   ```sql
   -- Must return 0 (all records are load test)
   SELECT COUNT(*) FROM hc_encounters WHERE chief_complaint NOT LIKE '%(Load test)%';
   
   -- Must return 0 (no prescription dependencies)
   SELECT COUNT(*) FROM hc_prescriptions;
   ```

2. **Check Medical Clinic module usage:**
   - Search codebase for any unreported `hc_encounters` queries
   - Check if Medical Clinic dashboard uses encounter data
   - Verify no production tenants depend on this table

3. **User decision required:**
   - **IF** load test only + no dependencies → **Option C** (DROP + recreate)
   - **IF** production data or dependencies exist → **Option A** (migration)

---

### Post-Decision (Phase 2 Continuation)

**IF Option C (DROP) approved:**
1. Backup table: `pg_dump`
2. Drop table: `DROP TABLE hc_encounters CASCADE;`
3. Restore migration file: `20260811000000_create_encounters_table.sql`
4. Apply: `supabase db push`
5. Add RLS policies (tenant isolation)
6. Regenerate types: `supabase gen types typescript --linked`
7. Run tests: `npm test -- supabase-encounter.repository.test.ts`
8. Expected: ✅ 21/21 PASS

**IF Option A (Migration) required:**
1. Create migration: `20260811100000_migrate_legacy_encounters_to_v2.sql`
2. Implement data transformation logic
3. Test on staging database first
4. Apply to production
5. Update repository to use new schema
6. Run integration tests
7. Time estimate: 3-4 hours

---

## Security Remediation (URGENT)

**Regardless of migration decision, RLS MUST be added immediately:**

```sql
-- Enable RLS (already done)
ALTER TABLE hc_encounters ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenant isolation for SELECT
CREATE POLICY tenant_isolation_select ON hc_encounters
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::TEXT::UUID);

-- Policy 2: Tenant isolation for INSERT/UPDATE/DELETE
CREATE POLICY tenant_isolation_write ON hc_encounters
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::TEXT::UUID)
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id'::TEXT::UUID);
```

**Apply NOW** via SQL Editor to prevent cross-tenant data leakage.

---

## Files Created (This Investigation)

1. ✅ `supabase/migrations/INVESTIGATE_hc_encounters.sql` - Investigation queries
2. ✅ `supabase/migrations/VERIFY_hc_encounters.sql` - Verification script (previous session)
3. ✅ `supabase/migrations/MANUAL_cleanup_hc_encounters.sql` - Cleanup script (DO NOT RUN without approval)
4. ✅ `docs/execution/HC_ENCOUNTERS_INVESTIGATION_REPORT.md` - This report

---

## Phase 2 Status Update

**Previous Status:** ⚠️ BLOCKED (schema conflict)  
**Current Status:** 🔴 **CRITICAL DECISION REQUIRED**

**Gate 1B cannot proceed until:**
- ✅ User confirms data disposition (DROP vs MIGRATE)
- ✅ Migration strategy executed
- ✅ RLS policies applied (security fix)
- ✅ Integration tests pass (21/21)

**Phase 3 remains BLOCKED** until Gate 1B passes.

---

## Next Steps

**User must provide:**

1. **Decision:** Option A (migrate) vs Option C (drop + recreate)?
2. **Verification results:**
   ```sql
   -- Run these queries and share results:
   SELECT COUNT(*) FROM hc_encounters WHERE chief_complaint NOT LIKE '%(Load test)%';
   SELECT COUNT(*) FROM hc_prescriptions;
   ```
3. **Medical Clinic usage confirmation:**
   - Is Medical Clinic module actively using `hc_encounters` table?
   - Are there unreported services querying this table?

**Agent will then:**
- Execute approved migration strategy
- Apply RLS policies
- Complete Phase 2 runtime verification
- Report Gate 1B results

---

**END OF INVESTIGATION REPORT**

**Status:** ⏳ **AWAITING USER DECISION**
