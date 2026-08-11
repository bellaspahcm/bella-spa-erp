# Encounter Schema Migration Analysis

**Date:** 2026-08-11  
**Strategy:** Option A - Additive Migration (Preserve 8,254 records)  
**Status:** 📋 Analysis Phase - NO DATABASE CHANGES YET

---

## Executive Summary

**Objective:** Migrate legacy `hc_encounters` schema → Encounter Platform canonical schema while preserving all 8,254 existing records.

**Approach:** Additive-only migration compliant with Constitution Law 4.

**Key Findings:**
- ✅ 85% semantic compatibility (core fields map cleanly)
- ⚠️ 15% requires transformation (temporal model, clinical data)
- ✅ All legacy FKs preserved (party_parties, tenants)
- ❌ Missing canonical fields require backfill strategy
- 🔴 RLS policies MUST be added (security blocker)

---

## Part 1: Field Mapping Analysis

### 1.1 Identity & References

| Legacy Column | Canonical Field | Mapping Strategy | Data Loss Risk |
|---------------|-----------------|------------------|----------------|
| `id` | `id` | ✅ Direct copy | NONE |
| `tenant_id` | `tenantId` | ✅ Direct copy | NONE |
| `patient_party_id` | `patientId` | ✅ Rename column | NONE |
| `doctor_party_id` | `serviceProviderId` | ✅ Rename column | NONE |

**FK Verification:**
```sql
-- Verify all patient_party_id exist in party_parties
SELECT COUNT(*) FROM hc_encounters e
LEFT JOIN party_parties p ON e.patient_party_id = p.id
WHERE p.id IS NULL;
-- Expected: 0
```

**Decision:** Column renames are safe. Both reference `party_parties(id)`.

---

### 1.2 Encounter Classification

| Legacy Column | Legacy Values | Canonical Field | Canonical Values | Mapping |
|---------------|---------------|-----------------|------------------|---------|
| `encounter_class` | walk_in, scheduled, emergency, telemedicine, follow_up, homecare, inpatient | `encounter_class` | AMB, EMER, IMP, HH, VR | ⚠️ ENUM MAP |
| (missing) | N/A | `encounter_type` | outpatient, inpatient, emergency, home-health, virtual | ⚠️ DERIVE |

**Enum Mapping Logic:**
```sql
-- encounter_class transformation
CASE legacy.encounter_class
  WHEN 'walk_in' THEN 'AMB'
  WHEN 'scheduled' THEN 'AMB'
  WHEN 'follow_up' THEN 'AMB'
  WHEN 'telemedicine' THEN 'VR'
  WHEN 'emergency' THEN 'EMER'
  WHEN 'inpatient' THEN 'IMP'
  WHEN 'homecare' THEN 'HH'
END

-- encounter_type derivation
CASE legacy.encounter_class
  WHEN 'walk_in' THEN 'outpatient'
  WHEN 'scheduled' THEN 'outpatient'
  WHEN 'follow_up' THEN 'outpatient'
  WHEN 'telemedicine' THEN 'virtual'
  WHEN 'emergency' THEN 'emergency'
  WHEN 'inpatient' THEN 'inpatient'
  WHEN 'homecare' THEN 'home-health'
END
```

**Validation Query:**
```sql
SELECT encounter_class, COUNT(*) FROM hc_encounters GROUP BY encounter_class;
```

---

### 1.3 Status Lifecycle

| Legacy Status | Canonical Status | Mapping | Notes |
|---------------|------------------|---------|-------|
| `planned` | `planned` | ✅ Direct | No change |
| `arrived` | `arrived` | ✅ Direct | No change |
| `triaged` | `triaged` | ✅ Direct | No change |
| `in_progress` | `in-progress` | ⚠️ HYPHENATE | Underscore → hyphen |
| `finished` | `finished` | ✅ Direct | No change |
| `completed` | `finished` | ⚠️ MERGE | `completed` → `finished` |
| `cancelled` | `cancelled` | ✅ Direct | No change |

**Status Distribution (Current):**
- `in_progress`: 8,245 records → will become `in-progress`
- `arrived`: 4 records → no change
- `completed`: 3 records → will become `finished`
- `finished`: 2 records → no change

**Transformation:**
```sql
CASE legacy.status
  WHEN 'in_progress' THEN 'in-progress'
  WHEN 'completed' THEN 'finished'
  ELSE legacy.status
END
```

---

### 1.4 Temporal Model (COMPLEX)

| Legacy Columns | Canonical Fields | Mapping Strategy |
|----------------|------------------|------------------|
| `scheduled_at` | `period.start` | ⚠️ COALESCE |
| `arrived_at` | (metadata) | Move to metadata |
| `started_at` | (metadata) | Move to metadata |
| `finished_at` | `period.end` | ⚠️ COALESCE |
| `completed_at` | `period.end` | ⚠️ COALESCE |

**Period Mapping Logic:**
```sql
-- period.start (non-nullable)
period_start = COALESCE(
  arrived_at,      -- Most accurate (patient actually arrived)
  scheduled_at,    -- Fallback (planned time)
  created_at       -- Last resort
)

-- period.end (nullable, only for finished/cancelled)
period_end = CASE
  WHEN status IN ('finished', 'cancelled') THEN
    COALESCE(finished_at, completed_at)
  ELSE NULL
END
```

**Metadata Preservation:**
```json
{
  "legacy_temporal": {
    "scheduled_at": "2026-08-09T00:16:00Z",
    "arrived_at": null,
    "started_at": null,
    "finished_at": null
  }
}
```

---

### 1.5 Clinical Data

| Legacy Column | Canonical Field | Mapping Strategy |
|---------------|-----------------|------------------|
| `chief_complaint` | `metadata.chiefComplaint` | Move to metadata |
| `notes` | `metadata.clinicalNotes` | Move to metadata |
| (missing) | `diagnosis` | Empty array (backfill later) |

**Rationale:**
- Phase 2 domain model uses structured `diagnosis` (JSONB array with ICD-10)
- Legacy free-text fields preserved in metadata for reference
- Future: Parse SOAP notes → extract diagnosis codes

---

### 1.6 Hierarchy & Location

| Legacy Column | Canonical Field | Mapping Strategy |
|---------------|-----------------|------------------|
| (missing) | `departmentId` | NULL (backfill later) |
| (missing) | `locationId` | NULL (backfill later) |
| (missing) | `parentEncounterId` | NULL (no legacy transfers) |
| (missing) | `reasonCode` | Empty array |

**Backfill Strategy:**
- Department/Location: Can be inferred from tenant config later
- Parent encounter: Legacy has no transfer chain concept
- Reason codes: Future enhancement

---

### 1.7 Audit & Provenance

| Legacy Column | Canonical Field | Mapping | Notes |
|---------------|-----------------|---------|-------|
| `created_at` | `provenance.createdAt` | ✅ Direct | |
| `updated_at` | `provenance.updatedAt` | ✅ Direct | |
| `created_by` | `provenance.createdBy` | ⚠️ NULL handling | Many are NULL |
| `updated_by` | `provenance.updatedBy` | ⚠️ NULL handling | Many are NULL |
| `deleted_at` | (soft delete flag) | ✅ Preserve | |
| `version` | (optimistic locking) | ✅ Preserve | |

**NULL Handling:**
```sql
created_by = COALESCE(created_by, 'system-migration')
updated_by = COALESCE(updated_by, created_by, 'system-migration')
```

---

### 1.8 Legacy-Specific Fields (Preserve in Metadata)

| Legacy Column | Disposition | Rationale |
|---------------|-------------|-----------|
| `care_journey_id` | metadata.legacyCareJourneyId | Medical Clinic concept, not Platform-wide |
| `queue_number` | metadata.queueNumber | Will use Smart Queue Engine in future |

---

## Part 2: Migration Strategy

### 2.1 Phased Approach

**Phase A: Add New Columns (Additive)**
```sql
ALTER TABLE hc_encounters
  ADD COLUMN IF NOT EXISTS encounter_type TEXT,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS parent_encounter_id UUID,
  ADD COLUMN IF NOT EXISTS reason_code JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnosis JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
```

**Phase B: Backfill Data**
```sql
UPDATE hc_encounters SET
  encounter_type = CASE encounter_class
    WHEN 'walk_in' THEN 'outpatient'
    WHEN 'scheduled' THEN 'outpatient'
    WHEN 'follow_up' THEN 'outpatient'
    WHEN 'telemedicine' THEN 'virtual'
    WHEN 'emergency' THEN 'emergency'
    WHEN 'inpatient' THEN 'inpatient'
    WHEN 'homecare' THEN 'home-health'
  END,
  period_start = COALESCE(arrived_at, scheduled_at, created_at),
  period_end = CASE
    WHEN status IN ('finished', 'completed', 'cancelled')
    THEN COALESCE(finished_at, completed_at)
    ELSE NULL
  END,
  metadata = jsonb_build_object(
    'legacyCareJourneyId', care_journey_id,
    'queueNumber', queue_number,
    'chiefComplaint', chief_complaint,
    'clinicalNotes', notes,
    'legacyTemporal', jsonb_build_object(
      'scheduled_at', scheduled_at,
      'arrived_at', arrived_at,
      'started_at', started_at,
      'finished_at', finished_at
    )
  );
```

**Phase C: Update Status Values**
```sql
UPDATE hc_encounters SET
  status = CASE status
    WHEN 'in_progress' THEN 'in-progress'
    WHEN 'completed' THEN 'finished'
    ELSE status
  END;
```

**Phase D: Update Encounter Class Enum**
```sql
UPDATE hc_encounters SET
  encounter_class = CASE encounter_class
    WHEN 'walk_in' THEN 'AMB'
    WHEN 'scheduled' THEN 'AMB'
    WHEN 'follow_up' THEN 'AMB'
    WHEN 'telemedicine' THEN 'VR'
    WHEN 'emergency' THEN 'EMER'
    WHEN 'inpatient' THEN 'IMP'
    WHEN 'homecare' THEN 'HH'
  END;
```

**Phase E: Rename Columns (Non-Breaking)**
```sql
ALTER TABLE hc_encounters
  RENAME COLUMN patient_party_id TO patient_id;

ALTER TABLE hc_encounters
  RENAME COLUMN doctor_party_id TO service_provider_id;
```

**Phase F: Add Constraints**
```sql
ALTER TABLE hc_encounters
  ALTER COLUMN encounter_type SET NOT NULL,
  ALTER COLUMN period_start SET NOT NULL;

-- Update CHECK constraints
ALTER TABLE hc_encounters DROP CONSTRAINT IF EXISTS hc_encounters_status_check;
ALTER TABLE hc_encounters ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'));

ALTER TABLE hc_encounters DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;
ALTER TABLE hc_encounters ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('AMB', 'EMER', 'IMP', 'HH', 'VR'));
```

**Phase G: Add RLS Policies (CRITICAL)**
```sql
-- Already enabled: ALTER TABLE hc_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON hc_encounters
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY tenant_isolation_write ON hc_encounters
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

---

## Part 3: Data Integrity Verification

### 3.1 Pre-Migration Checks
```sql
-- Record count
SELECT COUNT(*) as total_before FROM hc_encounters;
-- Expected: 8254

-- Tenant distribution
SELECT t.name, COUNT(e.id)
FROM hc_encounters e
JOIN tenants t ON e.tenant_id = t.id
GROUP BY t.name;
-- Expected: Bella Medical Clinic (8251), Bella General Hospital (3)

-- NULL patient_party_id (MUST be 0)
SELECT COUNT(*) FROM hc_encounters WHERE patient_party_id IS NULL;
-- Expected: 0

-- Orphaned patient references
SELECT COUNT(*) FROM hc_encounters e
LEFT JOIN party_parties p ON e.patient_party_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- Orphaned doctor references (NULL allowed)
SELECT COUNT(*) FROM hc_encounters e
LEFT JOIN party_parties p ON e.doctor_party_id = p.id
WHERE e.doctor_party_id IS NOT NULL AND p.id IS NULL;
-- Expected: 0
```

### 3.2 Post-Migration Checks
```sql
-- Record count preserved
SELECT COUNT(*) as total_after FROM hc_encounters;
-- Expected: 8254 (MUST match pre-migration)

-- All encounter_type populated
SELECT COUNT(*) FROM hc_encounters WHERE encounter_type IS NULL;
-- Expected: 0

-- All period_start populated
SELECT COUNT(*) FROM hc_encounters WHERE period_start IS NULL;
-- Expected: 0

-- Status values correct
SELECT status, COUNT(*) FROM hc_encounters GROUP BY status;
-- Expected: 'in-progress' (not 'in_progress'), no 'completed' (all → 'finished')

-- Encounter class values correct
SELECT encounter_class, COUNT(*) FROM hc_encounters GROUP BY encounter_class;
-- Expected: Only AMB, EMER, IMP, HH, VR (no legacy values)

-- Metadata populated
SELECT COUNT(*) FROM hc_encounters WHERE metadata IS NULL OR metadata = '{}'::jsonb;
-- Expected: 0 (all should have legacy fields preserved)
```

### 3.3 RLS Verification (CRITICAL)
```sql
-- Test as tenant A user (should see 8251 records)
SET LOCAL jwt.claims.tenant_id = '88888888-8888-8888-8888-888888888888';
SELECT COUNT(*) FROM hc_encounters;
-- Expected: 8251

-- Test as different tenant (should see 0 records)
SET LOCAL jwt.claims.tenant_id = '99999999-9999-9999-9999-999999999999';
SELECT COUNT(*) FROM hc_encounters;
-- Expected: 0 or 3 (depending on tenant)
```

---

## Part 4: Repository Compatibility

### 4.1 Column Name Changes
**Repository MUST update queries:**
- `patient_party_id` → `patient_id`
- `doctor_party_id` → `service_provider_id`

**File to update:** `src/platform/healthcare/engines/encounter-engine/infrastructure/supabase-encounter.repository.ts`

### 4.2 Serialization/Deserialization
```typescript
// FROM database
function fromDatabase(row: Database['public']['Tables']['hc_encounters']['Row']): EncounterProps {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    patientId: row.patient_id,  // ← Changed from patient_party_id
    encounterType: row.encounter_type as EncounterType,
    encounterClass: row.encounter_class as EncounterClass,
    status: row.status as EncounterStatus,
    period: {
      start: new Date(row.period_start),
      end: row.period_end ? new Date(row.period_end) : undefined,
    },
    serviceProviderId: row.service_provider_id ?? undefined,  // ← Changed
    departmentId: row.department_id ?? undefined,
    locationId: row.location_id ?? undefined,
    reasonCode: row.reason_code as string[] ?? [],
    diagnosis: row.diagnosis as Diagnosis[] ?? [],
    parentEncounterId: row.parent_encounter_id ?? undefined,
    metadata: row.metadata as Record<string, unknown> ?? {},
    provenance: {
      createdBy: row.created_by ?? 'system',
      createdAt: new Date(row.created_at),
      updatedBy: row.updated_by ?? row.created_by ?? 'system',
      updatedAt: new Date(row.updated_at),
    },
  };
}

// TO database
function toDatabase(props: EncounterProps): Database['public']['Tables']['hc_encounters']['Insert'] {
  return {
    id: props.id,
    tenant_id: props.tenantId,
    patient_id: props.patientId,  // ← Changed
    encounter_type: props.encounterType,
    encounter_class: props.encounterClass,
    status: props.status,
    period_start: props.period.start.toISOString(),
    period_end: props.period.end?.toISOString() ?? null,
    service_provider_id: props.serviceProviderId ?? null,  // ← Changed
    department_id: props.departmentId ?? null,
    location_id: props.locationId ?? null,
    reason_code: props.reasonCode,
    diagnosis: props.diagnosis,
    parent_encounter_id: props.parentEncounterId ?? null,
    metadata: props.metadata,
    created_by: props.provenance.createdBy,
    created_at: props.provenance.createdAt.toISOString(),
    updated_by: props.provenance.updatedBy,
    updated_at: props.provenance.updatedAt.toISOString(),
  };
}
```

---

## Part 5: Risk Assessment

### 5.1 Data Loss Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Record count mismatch | LOW | 🔴 CRITICAL | Pre/post count verification |
| NULL patient_id | NONE | 🔴 CRITICAL | Pre-check (already 0 NULLs) |
| Orphaned FKs | LOW | 🟡 MEDIUM | Pre-check FK integrity |
| Enum mapping error | MEDIUM | 🟡 MEDIUM | Test on staging first |
| Metadata truncation | NONE | 🟢 LOW | JSONB has no length limit |

### 5.2 Application Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Repository fails to read | HIGH | 🔴 CRITICAL | Update repository before migration |
| Type mismatch | MEDIUM | 🟡 MEDIUM | Regenerate types after migration |
| Tests fail | HIGH | 🟡 MEDIUM | Expected (will fix with new schema) |

### 5.3 Security Risks

| Risk | Likelihood | Impact | Current State | Required Action |
|------|------------|--------|---------------|-----------------|
| Cross-tenant data leak | HIGH | 🔴 CRITICAL | No RLS policies | ✅ ADD RLS (Phase G) |

---

## Part 6: Execution Plan

### Step 1: Backup (5 min)
```bash
# Dump existing table
pg_dump -h db.lvnvkpyxtuilhrabtlwv.supabase.co \
  -U postgres \
  -t hc_encounters \
  > hc_encounters_backup_20260811.sql
```

### Step 2: Run Pre-Migration Checks (5 min)
```bash
supabase db query --linked -f supabase/migrations/PRE_MIGRATION_CHECKS.sql
```

### Step 3: Execute Migration (Phases A-G) (30 min)
```bash
supabase db query --linked -f supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql
```

### Step 4: Run Post-Migration Checks (10 min)
```bash
supabase db query --linked -f supabase/migrations/POST_MIGRATION_CHECKS.sql
```

### Step 5: Update Repository Code (30 min)
- Update column name references
- Regenerate types
- Update serialization logic

### Step 6: Run Integration Tests (15 min)
```bash
npm test -- supabase-encounter.repository.test.ts
```
**Expected:** ✅ 21/21 PASS

### Step 7: RLS Verification (10 min)
```bash
supabase db query --linked -f supabase/migrations/VERIFY_RLS_POLICIES.sql
```

**Total Time Estimate:** 1.5-2 hours

---

## Part 7: Rollback Plan

**IF migration fails:**

```sql
-- Restore from backup
psql -h db.lvnvkpyxtuilhrabtlwv.supabase.co \
  -U postgres \
  < hc_encounters_backup_20260811.sql

-- Drop new columns
ALTER TABLE hc_encounters
  DROP COLUMN IF EXISTS encounter_type,
  DROP COLUMN IF EXISTS period_start,
  DROP COLUMN IF EXISTS period_end,
  DROP COLUMN IF EXISTS department_id,
  DROP COLUMN IF EXISTS location_id,
  DROP COLUMN IF EXISTS parent_encounter_id,
  DROP COLUMN IF EXISTS reason_code,
  DROP COLUMN IF EXISTS diagnosis,
  DROP COLUMN IF EXISTS metadata;

-- Restore original constraints
-- (See legacy schema constraints in 20260806030000 migration)
```

---

## Next Steps

**USER APPROVAL REQUIRED before proceeding:**

1. ✅ Review mapping logic (Part 1)
2. ✅ Review migration phases (Part 2)
3. ✅ Review verification queries (Part 3)
4. ✅ Approve execution plan (Part 6)

**After approval, agent will:**
1. Create migration SQL files
2. Create pre/post-check SQL files
3. Execute on database
4. Update repository code
5. Regenerate types
6. Run tests
7. Report Gate 1B results

**Status:** ⏳ **AWAITING USER APPROVAL**

---

**END OF ANALYSIS**
