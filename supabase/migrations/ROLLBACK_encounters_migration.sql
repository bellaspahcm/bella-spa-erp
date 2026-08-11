-- ============================================================================
-- ROLLBACK PLAN: Encounter Schema Migration
-- USE ONLY IF MIGRATION FAILS AND BACKUP RESTORE IS NOT VIABLE
-- ============================================================================

-- WARNING: This will UNDO all migration changes
-- Prefer restoring from backup if available:
-- psql < hc_encounters_backup_20260811.sql

BEGIN;

DO $$ 
BEGIN
  RAISE NOTICE 'Starting rollback of Encounter schema migration...';
END $$;

-- ============================================================================
-- PHASE G ROLLBACK: Remove RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_encounters;
DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_encounters;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase G rollback: RLS policies removed';
END $$;

-- ============================================================================
-- PHASE F ROLLBACK: Remove Constraints
-- ============================================================================

ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_type_check;

ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_period_valid;

-- Restore original status constraint
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_status_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_status_check
  CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'finished', 'completed', 'cancelled'));

-- Restore original encounter_class constraint
ALTER TABLE public.hc_encounters 
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

ALTER TABLE public.hc_encounters 
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN ('walk_in', 'scheduled', 'emergency', 'telemedicine', 'follow_up', 'homecare', 'inpatient'));

ALTER TABLE public.hc_encounters
  ALTER COLUMN encounter_type DROP NOT NULL;

ALTER TABLE public.hc_encounters
  ALTER COLUMN period_start DROP NOT NULL;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase F rollback: Constraints removed';
END $$;

-- ============================================================================
-- PHASE E ROLLBACK: Remove DEPRECATED Comments
-- ============================================================================

COMMENT ON COLUMN public.hc_encounters.patient_party_id IS NULL;
COMMENT ON COLUMN public.hc_encounters.doctor_party_id IS NULL;
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS NULL;
COMMENT ON COLUMN public.hc_encounters.queue_number IS NULL;
COMMENT ON COLUMN public.hc_encounters.chief_complaint IS NULL;
COMMENT ON COLUMN public.hc_encounters.notes IS NULL;
COMMENT ON COLUMN public.hc_encounters.scheduled_at IS NULL;
COMMENT ON COLUMN public.hc_encounters.arrived_at IS NULL;
COMMENT ON COLUMN public.hc_encounters.started_at IS NULL;
COMMENT ON COLUMN public.hc_encounters.finished_at IS NULL;
COMMENT ON COLUMN public.hc_encounters.completed_at IS NULL;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase E rollback: DEPRECATED comments removed';
END $$;

-- ============================================================================
-- PHASE D ROLLBACK: Restore Original Encounter Class Values
-- ============================================================================

-- Cannot automatically rollback enum transformations (data loss)
-- Must restore from backup if original enum values needed

DO $$ 
BEGIN
  RAISE WARNING 'Phase D rollback: CANNOT restore original encounter_class values automatically';
  RAISE WARNING 'Restore from backup to recover: walk_in, scheduled, follow_up, telemedicine, emergency, inpatient, homecare';
END $$;

-- ============================================================================
-- PHASE C ROLLBACK: Restore Original Status Values
-- ============================================================================

-- Cannot automatically rollback status transformations (data loss)
-- Must restore from backup if original status values needed

DO $$ 
BEGIN
  RAISE WARNING 'Phase C rollback: CANNOT restore original status values automatically';
  RAISE WARNING 'Restore from backup to recover: in_progress, completed';
END $$;

-- ============================================================================
-- PHASE B ROLLBACK: Clear Backfilled Data
-- ============================================================================

UPDATE public.hc_encounters SET
  encounter_type = NULL,
  period_start = NULL,
  period_end = NULL,
  metadata = '{}'::jsonb;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase B rollback: Backfilled data cleared';
END $$;

-- ============================================================================
-- PHASE A ROLLBACK: Remove Canonical Columns
-- ============================================================================

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS encounter_type CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS period_start CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS period_end CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS parent_encounter_id CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS department_id CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS location_id CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS reason_code CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS diagnosis CASCADE;

ALTER TABLE public.hc_encounters
  DROP COLUMN IF EXISTS metadata CASCADE;

DO $$ 
BEGIN
  RAISE NOTICE 'Phase A rollback: Canonical columns removed';
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
  RAISE NOTICE 'ROLLBACK COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total records: %', final_count;
  RAISE NOTICE 'WARNING: Enum transformations (status, encounter_class) CANNOT be auto-reversed';
  RAISE NOTICE 'Restore from backup to recover original enum values';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- BACKUP RESTORE INSTRUCTIONS (Preferred Method)
-- ============================================================================

-- If you have a backup from BEFORE migration:
--
-- 1. Drop current table:
--    DROP TABLE hc_encounters CASCADE;
--
-- 2. Restore from backup:
--    psql -h db.lvnvkpyxtuilhrabtlwv.supabase.co \
--         -U postgres \
--         -d postgres \
--         < hc_encounters_backup_20260811.sql
--
-- 3. Verify record count:
--    SELECT COUNT(*) FROM hc_encounters; -- Should be 8254
--
-- ============================================================================
