-- ============================================================================
-- Bella Healthcare Platform — Make care_journey_id Nullable
-- Migration: 20260812010000_make_care_journey_id_nullable.sql
--
-- PURPOSE: Fix constraint blocking new encounter creation
--
-- RATIONALE:
--   - care_journey_id marked DEPRECATED (Medical Clinic concept only)
--   - No hc_care_journeys table exists in Healthcare Platform
--   - Not documented in Healthcare architecture
--   - Blocking smoke tests and new encounter creation
--   - Legacy encounters have this value, new ones don't need it
--
-- IMPACT:
--   - Allows NULL for care_journey_id
--   - Preserves existing 8,254 records (no data change)
--   - Enables new encounter creation without FK dependency
--
-- ROLLBACK: ALTER TABLE hc_encounters ALTER COLUMN care_journey_id SET NOT NULL;
-- ============================================================================

BEGIN;

DO $$ 
BEGIN
  RAISE NOTICE 'Making care_journey_id nullable...';
END $$;

-- Allow NULL values
ALTER TABLE public.hc_encounters
  ALTER COLUMN care_journey_id DROP NOT NULL;

-- Verify constraint removed
DO $$ 
DECLARE
  is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO is_nullable
  FROM information_schema.columns
  WHERE table_name = 'hc_encounters'
    AND column_name = 'care_journey_id';
  
  IF is_nullable = 'YES' THEN
    RAISE NOTICE 'SUCCESS: care_journey_id is now NULLABLE';
  ELSE
    RAISE EXCEPTION 'FAILED: care_journey_id is still NOT NULL';
  END IF;
END $$;

-- Update comment to reflect nullable status
COMMENT ON COLUMN public.hc_encounters.care_journey_id IS 
  'DEPRECATED: Preserved in metadata.legacyCareJourneyId. Medical Clinic concept, not Platform-wide. NULLABLE since 2026-08-12.';

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'care_journey_id: NULLABLE ✓';
  RAISE NOTICE 'Existing records: PRESERVED ✓';
  RAISE NOTICE 'New encounters: Can omit care_journey_id ✓';
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
