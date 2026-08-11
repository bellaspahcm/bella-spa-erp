# Encounter Migration Dry Run Report

**Date:** 2026-08-11  
**Status:** ✅ **DRY RUN COMPLETE - READY FOR EXECUTION**  
**Strategy:** Additive Migration (NO drops, NO renames)

---

## Pre-Migration Verification Results

✅ **ALL CHECKS PASSED**

### 1. Data Integrity
- ✅ Total Records: **8,254**
- ✅ Tenant A (Bella Medical Clinic): **8,251 records**
- ✅ Tenant B (Bella General Hospital): **3 records**
- ✅ NULL patient references: **0**
- ✅ Orphaned patient FK: **0**
- ✅ Orphaned doctor FK: **0**
- ✅ Orphaned tenant FK: **0**

### 2. Schema State
- ✅ Status values: `in_progress` (8,245), `arrived` (4), `completed` (3), `finished` (2)
- ✅ Encounter class: `walk_in` (majority), `emergency`, `inpatient`, etc.
- ✅ Foreign keys: 4 constraints (tenant, patient, doctor, care_journey)
- ✅ Indexes: 5 indexes (tenant, journey, patient, doctor, deleted)

### 3. Security State
- ✅ RLS Enabled: **true**
- 🔴 **RLS Policies: 0** (CRITICAL SECURITY ISSUE - will fix in Phase G)

---

## Migration Files Created

1. ✅ **VERIFY_PRE_MIGRATION_hc_encounters.sql** (13 validation queries)
2. ✅ **20260811120000_migrate_encounters_to_canonical_schema.sql** (main migration)
3. ✅ **VERIFY_POST_MIGRATION_hc_encounters.sql** (14 validation queries)
4. ✅ **VERIFY_RLS_ISOLATION_hc_encounters.sql** (5 security tests)
5. ✅ **ROLLBACK_encounters_migration.sql** (emergency rollback)

---

## Migration Phases Summary

### Phase A: Add Canonical Columns ✅
- `encounter_type` (derived from encounter_class)
- `period_start`, `period_end` (canonical temporal model)
- `parent_encounter_id` (hierarchy support)
- `department_id`, `location_id` (location tracking)
- `reason_code`, `diagnosis` (structured clinical data)
- `metadata` (preserve legacy fields)

### Phase B: Backfill Data ✅
**Transformation Logic:**
```sql
encounter_type = CASE encounter_class
  WHEN 'walk_in' THEN 'outpatient'
  WHEN 'emergency' THEN 'emergency'
  WHEN 'inpatient' THEN 'inpatient'
  ...
END

period_start = COALESCE(arrived_at, scheduled_at, created_at)
period_end = CASE WHEN status IN ('finished', 'completed', 'cancelled')
             THEN COALESCE(finished_at, completed_at) END

metadata = {
  legacyCareJourneyId, queueNumber, chiefComplaint, clinicalNotes, legacyTemporal
}
```

### Phase C: Normalize Status ✅
- `in_progress` → `in-progress` (8,245 records)
- `completed` → `finished` (3 records)

### Phase D: Normalize Encounter Class ✅
- `walk_in`, `scheduled`, `follow_up` → `AMB`
- `emergency` → `EMER`
- `inpatient` → `IMP`
- `telemedicine` → `VR`
- `homecare` → `HH`

### Phase E: Mark Legacy Columns DEPRECATED ✅
**NO DROPS** - Only add comments:
- `patient_party_id` → DEPRECATED (use patientId)
- `doctor_party_id` → DEPRECATED (use serviceProviderId)
- `care_journey_id` → DEPRECATED (preserved in metadata)
- `queue_number` → DEPRECATED (use Smart Queue Engine)
- Temporal columns → DEPRECATED (use period_start/end)

### Phase F: Add Constraints ✅
- `encounter_type` NOT NULL
- `period_start` NOT NULL
- CHECK constraints for canonical enums
- Period validation (end >= start)

### Phase G: Add RLS Policies 🔴 CRITICAL
```sql
CREATE POLICY tenant_isolation_select FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY tenant_isolation_write FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

---

## Expected Post-Migration State

### Data Integrity
- ✅ Total records: **8,254** (MUST match pre-migration)
- ✅ All canonical columns populated
- ✅ Zero legacy enum values
- ✅ All metadata preserved

### Security
- ✅ RLS policies: **2** (tenant_isolation_select, tenant_isolation_write)
- ✅ Tenant A sees: 8,251 records only
- ✅ Tenant B sees: 3 records only
- ✅ Cross-tenant access: **BLOCKED**

### Schema
- ✅ 21 existing columns (preserved)
- ✅ 9 new canonical columns (added)
- ✅ Legacy columns marked DEPRECATED (not dropped)
- ✅ Constraints enforced on canonical columns

---

## Execution Plan

### Step 1: Backup (5 min) - MANDATORY
```bash
pg_dump -h db.lvnvkpyxtuilhrabtlwv.supabase.co \
  -U postgres -t hc_encounters \
  > hc_encounters_backup_20260811.sql
```

### Step 2: Execute Migration (15-20 min)
```bash
supabase db query --linked \
  -f supabase/migrations/20260811120000_migrate_encounters_to_canonical_schema.sql
```

**Expected output:**
```
Phase A: Complete - 9 canonical columns added
Phase B: Complete - 8254 records backfilled
Phase C: Complete - All status values normalized
Phase D: Complete - All encounter_class values normalized
Phase E: Complete - Legacy columns marked DEPRECATED
Phase F: Complete - Constraints added
Phase G: Complete - RLS policies added
MIGRATION COMPLETE
Total records: 8254 ✓
```

### Step 3: Post-Migration Verification (5 min)
```bash
supabase db query --linked \
  -f supabase/migrations/VERIFY_POST_MIGRATION_hc_encounters.sql
```

**All checks MUST PASS.**

### Step 4: RLS Security Test (5 min)
```bash
supabase db query --linked \
  -f supabase/migrations/VERIFY_RLS_ISOLATION_hc_encounters.sql
```

### Step 5: Regenerate Types (2 min)
```bash
supabase gen types typescript --linked > src/types/supabase.ts
```

### Step 6: Update Repository (30 min)
- Update column references (patient_party_id → patient_id in queries)
- Update serialization logic
- Verify fromDatabase/toDatabase mappings

### Step 7: Run Integration Tests (10 min)
```bash
npm test -- supabase-encounter.repository.test.ts
```

**Expected:** ✅ 21/21 PASS

---

## Risk Assessment

### Data Loss Risk: 🟢 MINIMAL
- Additive-only migration
- All legacy columns preserved
- Transformation logic validated
- Backup available

### Application Risk: 🟡 MEDIUM
- Repository needs updates
- Type regeneration required
- Tests will fail until repository updated
- **Mitigation:** Update repository immediately after migration

### Security Risk: 🔴 CRITICAL → 🟢 RESOLVED
- **Before:** No RLS policies (cross-tenant data leak)
- **After:** RLS enforced at database level

---

## Rollback Plan

**IF migration fails:**

1. **Preferred:** Restore from backup
   ```bash
   psql < hc_encounters_backup_20260811.sql
   ```

2. **Alternative:** Run rollback script
   ```bash
   supabase db query --linked -f ROLLBACK_encounters_migration.sql
   ```

**Limitations:**
- Enum transformations cannot be auto-reversed
- Backup restore is safest option

---

## Success Criteria (Gate 1B)

### Database
- ✅ 8,254 records preserved
- ✅ All canonical columns populated
- ✅ RLS policies enforced
- ✅ Zero orphaned FKs

### Repository
- ✅ Reads legacy data successfully
- ✅ Writes canonical data successfully
- ✅ Domain reconstitution works

### Tests
- ✅ 21/21 integration tests pass
- ✅ RLS tenant isolation verified
- ✅ TypeScript compilation passes
- ✅ No `any` type violations

---

## Final Approval Checklist

**USER MUST VERIFY:**

- [ ] Pre-migration report reviewed (8,254 records confirmed)
- [ ] Migration strategy approved (additive, no drops)
- [ ] Backup strategy confirmed
- [ ] Rollback plan understood
- [ ] Time window available (1-2 hours)
- [ ] Post-migration verification plan approved

**After approval, execute:**
```bash
# 1. Backup
pg_dump ... > backup.sql

# 2. Migrate
supabase db query --linked -f 20260811120000_migrate_encounters_to_canonical_schema.sql

# 3. Verify
supabase db query --linked -f VERIFY_POST_MIGRATION_hc_encounters.sql
supabase db query --linked -f VERIFY_RLS_ISOLATION_hc_encounters.sql

# 4. Update code
npm run db:types
# Update repository
npm test
```

---

**Status:** ⏳ **AWAITING FINAL EXECUTION APPROVAL**

**Next Action:** User approval → Execute migration → Verify → Update repository → Report Gate 1B results

---

**END OF DRY RUN REPORT**
