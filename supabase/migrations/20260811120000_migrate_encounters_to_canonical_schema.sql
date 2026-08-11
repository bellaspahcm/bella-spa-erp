-- ============================================================================
-- Bella Healthcare Platform — Encounter Schema Migration
-- Migration: 20260811120000_migrate_encounters_to_canonical_schema.sql
--
-- PURPOSE: Migrate legacy hc_encounters schema → Encounter Platform canonical schema
--          PRESERVE all 8,254 existing records
--
-- STRATEGY: Additive-only (Constitution Law 4)
--           NO column drops, NO renames (legacy columns preserved for transition)
--
-- PHASES:
--   A. Add canonical columns
--   B. Backfill data with transformation logic
--   C. Normalize status enum values
--   D. Normalize encounter_class enum values
--   E. Mark legacy columns as DEPRECATED (comments only, no drops)
--   F. Add constraints to new canonical columns
--   G. Add RLS policies (CRITICAL security fix)
--
-- PRE-REQUISITES:
--   1. Run VERIFY_PRE_MIGRATION_hc_encounters.sql
--   2. Backup: pg_dump hc_encounters > backup.sql
--   3. Verify: 8,254 records, 0 orphaned FKs
--
-- ROLLBACK: See ROLLBACK_encounters_migration.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE A: Add Canonical Columns (Additive Only)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase A: Adding canonical columns...';
END $$;

-- Encounter type (derived from encounter_class)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS encounter_type TEXT;

-- Period boundaries (canonical temporal model)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;

ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;

-- Hierarchy
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS parent_encounter_id UUID
  REFERENCES public.hc_encounters(id) ON DELETE SET NULL;

-- Location/Department
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS department_id UUID;

ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS location_id UUID;

-- Clinical data (structured)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS reason_code JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS diagnosis JSONB DEFAULT '[]'::jsonb;

-- Metadata (preserve legacy fields)
ALTER TABLE public.hc_encounters
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase A: Complete - 9 canonical columns added';
END $$;

-- ============================================================================
-- PHASE B: Backfill Data (8,254 records)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase B: Backfilling canonical columns...';
END $$;

UPDATE public.hc_encounters SET
  -- Derive encounter_type from encounter_class
  encounter_type = CASE encounter_class
    WHEN 'walk_in' THEN 'outpatient'
    WHEN 'scheduled' THEN 'outpatient'
    WHEN 'follow_up' THEN 'outpatient'
    WHEN 'telemedicine' THEN 'virtual'
    WHEN 'emergency' THEN 'emergency'
    WHEN 'inpatient' THEN 'inpatient'
    WHEN 'homecare' THEN 'home-health'
    ELSE 'outpatient'  -- Default fallback
  END,

  -- period_start: prefer arrived_at (actual), fallback to scheduled_at, then created_at
  period_start = COALESCE(arrived_at, scheduled_at, created_at),

  -- period_end: only for finished/completed/cancelled encounters
  period_end = CASE
    WHEN status IN ('finished', 'completed', 'cancelled') THEN
      COALESCE(finished_at, completed_at)
    ELSE NULL
  END,

  -- Preserve legacy fields in metadata
  metadata = jsonb_build_object(
    'legacyCareJourneyId', care_journey_id::TEXT,
    'queueNumber', queue_number,
    'chiefComplaint', chief_complaint,
    'clinicalNotes', notes,
    'legacyTemporal', jsonb_build_object(
      'scheduled_at', scheduled_at,
      'arrived_at', arrived_at,
      'started_at', started_at,
      'finished_at', finished_at,
      'completed_at', completed_at
    )
  );

-- Verify backfill count
DO $$ 
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM hc_encounters WHERE encounter_type IS NOT NULL;
  RAISE NOTICE 'Phase B: Complete - % records backfilled', updated_count;
  
  IF updated_count != 8254 THEN
    RAISE EXCEPTION 'BACKFILL FAILED: Expected 8254 records, got %', updated_count;
  END IF;
END $$;

-- ============================================================================
-- PHASE C: Update Status Constraint FIRST (Before Data Update)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase C: Updating status constraint to allow transition values...';
END $$;

-- Temporarily allow BOTH old and new status values during migration
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'in-progress', 'on-hold', 'finished', 'completed', 'cancelled'));

DO $$ 
BEGIN
  RAISE NOTICE 'Phase C: Constraint updated - now normalizing status values...';
END $$;

-- Now update the data
UPDATE public.hc_encounters SET
  status = CASE status
    WHEN 'in_progress' THEN 'in-progress'  -- Underscore → hyphen
    WHEN 'completed' THEN 'finished'       -- Merge completed → finished
    ELSE status                            -- Keep others unchanged
  END;

-- Verify status normalization
DO $$ 
DECLARE
  legacy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM hc_encounters 
  WHERE status IN ('in_progress', 'completed');
  
  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'Status normalization FAILED: % legacy values remain', legacy_count;
  END IF;
  
  RAISE NOTICE 'Phase C: Complete - All status values normalized';
END $$;

-- ============================================================================
-- PHASE D: Update Encounter Class Constraint FIRST (Before Data Update)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase D: Updating encounter_class constraint to allow transition values...';
END $$;

-- Temporarily allow BOTH old and new encounter_class values during migration
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('walk_in', 'scheduled', 'emergency', 'telemedicine', 'follow_up', 'homecare', 'inpatient', 'AMB', 'EMER', 'IMP', 'HH', 'VR'));

DO $$ 
BEGIN
  RAISE NOTICE 'Phase D: Constraint updated - now normalizing encounter_class values...';
END $$;

-- Now update the data
UPDATE public.hc_encounters SET
  encounter_class = CASE encounter_class
    WHEN 'walk_in' THEN 'AMB'
    WHEN 'scheduled' THEN 'AMB'
    WHEN 'follow_up' THEN 'AMB'
    WHEN 'telemedicine' THEN 'VR'
    WHEN 'emergency' THEN 'EMER'
    WHEN 'inpatient' THEN 'IMP'
    WHEN 'homecare' THEN 'HH'
    ELSE 'AMB'  -- Default fallback
  END;

-- Verify encounter_class normalization
DO $$ 
DECLARE
  legacy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM hc_encounters 
  WHERE encounter_class NOT IN ('AMB', 'EMER', 'IMP', 'HH', 'VR');
  
  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'Encounter class normalization FAILED: % legacy values remain', legacy_count;
  END IF;
  
  RAISE NOTICE 'Phase D: Complete - All encounter_class values normalized';
END $$;

-- ============================================================================
-- PHASE E: Mark Legacy Columns as DEPRECATED (No Drops)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase E: Marking legacy columns as DEPRECATED...';
END $$;

COMMENT ON COLUMN public.hc_encounters.patient_party_id IS 
  'DEPRECATED: Use Encounter aggregate patientId property. Will be removed after Platform migration complete.';

COMMENT ON COLUMN public.hc_encounters.doctor_party_id IS 
  'DEPRECATED: Use serviceProviderId property. Will be removed after Platform migration complete.';

COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide.';

COMMENT ON COLUMN public.hc_encounters.queue_number IS 
  'DEPRECATED: Preserved in metadata.queueNumber. Will use Smart Queue Engine in future.';

COMMENT ON COLUMN public.hc_encounters.chief_complaint IS 
  'DEPRECATED: Preserved in metadata.chiefComplaint. Use structured diagnosis field.';

COMMENT ON COLUMN public.hc_encounters.notes IS 
  'DEPRECATED: Preserved in metadata.clinicalNotes. Use structured diagnosis field.';

COMMENT ON COLUMN public.hc_encounters.scheduled_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_start.';

COMMENT ON COLUMN public.hc_encounters.arrived_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal.';

COMMENT ON COLUMN public.hc_encounters.started_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal.';

COMMENT ON COLUMN public.hc_encounters.finished_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_end.';

COMMENT ON COLUMN public.hc_encounters.completed_at IS 
  'DEPRECATED: Preserved in metadata.legacyTemporal. Use period_end.';

DO $$ 
BEGIN
  RAISE NOTICE 'Phase E: Complete - Legacy columns marked DEPRECATED (not dropped)';
END $$;

-- ============================================================================
-- PHASE F: Add Constraints to Canonical Columns
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase F: Adding constraints to canonical columns...';
END $$;

-- encounter_type NOT NULL
ALTER TABLE public.hc_encounters
  ALTER COLUMN encounter_type SET NOT NULL;

-- period_start NOT NULL
ALTER TABLE public.hc_encounters
  ALTER COLUMN period_start SET NOT NULL;

-- Finalize status CHECK constraint (remove transition values)
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'));

-- Finalize encounter_class CHECK constraint (remove transition values)
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('AMB', 'EMER', 'IMP', 'HH', 'VR'));

-- Add CHECK constraint for encounter_type
ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_type_check
  CHECK (encounter_type IN ('outpatient', 'inpatient', 'emergency', 'home-health', 'virtual'));

-- Add period validation (end >= start if end exists)
ALTER TABLE public.hc_encounters
  ADD CONSTRAINT hc_encounters_period_valid
  CHECK (period_end IS NULL OR period_end >= period_start);

DO $$ 
BEGIN
  RAISE NOTICE 'Phase F: Complete - Constraints added';
END $$;

-- ============================================================================
-- PHASE G: Add RLS Policies (CRITICAL Security Fix)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Phase G: Adding RLS policies...';
END $$;

-- RLS already enabled from original migration (20260806030000)
-- Verify it's enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'hc_encounters') THEN
    ALTER TABLE public.hc_encounters ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on hc_encounters';
  ELSE
    RAISE NOTICE 'RLS already enabled on hc_encounters';
  END IF;
END $$;

-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_encounters;
DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_encounters;

-- Policy 1: Tenant isolation for SELECT
CREATE POLICY tenant_isolation_select ON public.hc_encounters
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Policy 2: Tenant isolation for INSERT/UPDATE/DELETE
CREATE POLICY tenant_isolation_write ON public.hc_encounters
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

DO $$ 
BEGIN
  RAISE NOTICE 'Phase G: Complete - RLS policies added (tenant isolation enforced)';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$ 
DECLARE
  final_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM hc_encounters;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total records: %', final_count;
  RAISE NOTICE 'Expected: 8254';
  
  IF final_count != 8254 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Record count mismatch (expected 8254, got %)', final_count;
  END IF;
  
  RAISE NOTICE 'Record count: VERIFIED ✓';
  RAISE NOTICE 'Next step: Run VERIFY_POST_MIGRATION_hc_encounters.sql';
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
