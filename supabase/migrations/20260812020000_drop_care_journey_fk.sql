-- ============================================================================
-- Drop care_journey FK Constraint
-- Migration: 20260812020000_drop_care_journey_fk.sql
--
-- PURPOSE: Remove FK constraint to non-existent hc_care_journeys table
--
-- RATIONALE:
--   - care_journey_id marked DEPRECATED and made NULLABLE
--   - hc_care_journeys table does not exist in Healthcare Platform
--   - FK constraint blocks encounter creation
--   - Field preserved for legacy data only (in metadata)
--
-- IMPACT:
--   - Removes FK constraint hc_encounters_care_journey_id_fkey
--   - Allows NULL values for care_journey_id
--   - No data change (preserves existing 8,254+ records)
--
-- ROLLBACK: 
--   -- Cannot restore FK if table doesn't exist
--   -- Would need to create hc_care_journeys first
-- ============================================================================

BEGIN;

DO $$ 
BEGIN
  RAISE NOTICE 'Dropping care_journey_id FK constraint...';
END $$;

-- Drop FK constraint
ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_care_journey_id_fkey;

-- Verify constraint dropped
DO $$ 
DECLARE
  fk_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hc_encounters_care_journey_id_fkey'
      AND table_name = 'hc_encounters'
  ) INTO fk_exists;
  
  IF fk_exists THEN
    RAISE EXCEPTION 'FK constraint still exists';
  ELSE
    RAISE NOTICE 'SUCCESS: FK constraint dropped';
  END IF;
END $$;

-- Update comment to reflect FK removal
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide. NULLABLE since 2026-08-12. FK removed 2026-08-12.';

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'care_journey_id: FK DROPPED ✓';
  RAISE NOTICE 'Field: NULLABLE ✓';
  RAISE NOTICE 'Encounter creation: UNBLOCKED ✓';
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
