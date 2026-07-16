-- Migration: Enable Break Time Buffer for All Tenants
-- Date: 2026-07-15 20:00:00
-- Purpose: Add capacity_config to tenant metadata to enforce 15-minute break between sessions
-- Impact: Improves KTV wellness and service quality

-- =====================================================
-- STEP 1: Add capacity_config to tenants without it
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{capacity_config}',
  jsonb_build_object(
    'minBreakMinutes', 15,
    'workingHoursStart', '08:00',
    'workingHoursEnd', '20:00',
    'enforceBreakTimes', true,
    'enablePeakHours', false,
    'bufferPercentage', 10
  ),
  true
)
WHERE metadata->'capacity_config' IS NULL
   OR metadata->'capacity_config'->>'minBreakMinutes' IS NULL;

-- =====================================================
-- STEP 2: Update existing capacity_config to ensure break time is enabled
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'true'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NOT NULL
  AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean IS NOT TRUE;

-- =====================================================
-- STEP 3: Ensure minBreakMinutes is at least 15 minutes
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, minBreakMinutes}',
  '15'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NOT NULL
  AND (
    metadata->'capacity_config'->>'minBreakMinutes' IS NULL
    OR (metadata->'capacity_config'->>'minBreakMinutes')::int < 15
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check how many tenants now have capacity_config
-- Expected: All active tenants
DO $$
DECLARE
  total_tenants INT;
  configured_tenants INT;
BEGIN
  SELECT COUNT(*) INTO total_tenants FROM tenants WHERE status = 'active';
  
  SELECT COUNT(*) INTO configured_tenants 
  FROM tenants 
  WHERE status = 'active'
    AND metadata->'capacity_config' IS NOT NULL
    AND metadata->'capacity_config'->>'minBreakMinutes' IS NOT NULL;
  
  RAISE NOTICE 'Total active tenants: %', total_tenants;
  RAISE NOTICE 'Configured tenants: %', configured_tenants;
  
  IF total_tenants = configured_tenants THEN
    RAISE NOTICE '✅ All tenants configured successfully';
  ELSE
    RAISE WARNING '⚠️ Some tenants missing configuration: % unconfigured', (total_tenants - configured_tenants);
  END IF;
END $$;

-- =====================================================
-- ROLLBACK PLAN (if needed)
-- =====================================================

-- To disable break time enforcement:
-- UPDATE tenants
-- SET metadata = jsonb_set(
--   metadata,
--   '{capacity_config, enforceBreakTimes}',
--   'false'::jsonb,
--   true
-- );

-- To completely remove capacity_config:
-- UPDATE tenants
-- SET metadata = metadata - 'capacity_config';

-- =====================================================
-- POST-MIGRATION VALIDATION
-- =====================================================

-- Show sample of configured tenants
SELECT 
  id,
  name,
  metadata->'capacity_config' as capacity_config,
  status
FROM tenants
WHERE status = 'active'
LIMIT 5;

-- =====================================================
-- COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN tenants.metadata IS 'Tenant metadata including capacity_config for break time enforcement. See docs/FEATURE_BREAK_TIME_BUFFER_ANALYSIS_15_07_2026.md for details.';
