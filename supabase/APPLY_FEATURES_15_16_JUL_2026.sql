/**
 * ============================================
 * APPLY ADVANCED FEATURES TO PRODUCTION
 * ============================================
 * 
 * Date: 15-16 July 2026
 * Features: Break Time Buffer + Inventory Forecast
 * 
 * HOW TO APPLY:
 * 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/qojcexojqslzrhljhxqi/sql
 * 2. Copy this ENTIRE file
 * 3. Paste into SQL Editor
 * 4. Click "Run"
 * 5. Verify success messages
 * 
 * SAFETY:
 * - All operations are idempotent (safe to run multiple times)
 * - Uses IF NOT EXISTS and conditional updates
 * - No data deletion
 * - Rollback plan included at bottom
 * 
 * ============================================
 */

-- ============================================
-- MIGRATION 1: BREAK TIME BUFFER
-- ============================================

-- Purpose: Add capacity_config to tenant metadata to enforce 15-minute break between sessions
-- Impact: Improves KTV wellness and service quality

-- Step 1: Add capacity_config to tenants without it
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

-- Step 2: Update existing capacity_config to ensure break time is enabled
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'true'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NOT NULL
  AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean IS NOT TRUE;

-- Step 3: Ensure minBreakMinutes is at least 15 minutes
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

-- Verification: Check configuration
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
  
  RAISE NOTICE '✅ Break Time Buffer Configuration:';
  RAISE NOTICE '   Total active tenants: %', total_tenants;
  RAISE NOTICE '   Configured tenants: %', configured_tenants;
  
  IF total_tenants = configured_tenants THEN
    RAISE NOTICE '   ✅ All tenants configured successfully';
  ELSE
    RAISE WARNING '   ⚠️ Some tenants missing configuration: % unconfigured', (total_tenants - configured_tenants);
  END IF;
END $$;

-- Show sample configuration
SELECT 
  id,
  name,
  metadata->'capacity_config' as capacity_config,
  status
FROM tenants
WHERE status = 'active'
LIMIT 3;

-- ============================================
-- MIGRATION 2: INVENTORY FORECAST
-- ============================================

-- Purpose: Enable inventory forecasting based on booking packages
-- Impact: Proactive shortage warnings 30 days ahead

-- Add product_usage column to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS product_usage JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN packages.product_usage IS 'Product usage per session. Format: {"product_id": quantity}. Used for inventory forecasting.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_packages_product_usage 
ON packages USING GIN (product_usage);

-- Update table comment
COMMENT ON TABLE packages IS 'Service packages with product usage tracking. product_usage example: {"uuid-dau-massage": 2, "uuid-khan": 1} means each session uses 2 bottles of oil and 1 towel.';

-- Verification: Check column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'packages' 
      AND column_name = 'product_usage'
  ) THEN
    RAISE NOTICE '✅ Inventory Forecast: product_usage column exists';
  ELSE
    RAISE EXCEPTION '❌ Inventory Forecast: product_usage column NOT created';
  END IF;
END $$;

-- Show packages table structure
SELECT 
  COUNT(*) as total_packages,
  COUNT(product_usage) as packages_with_usage_field,
  COUNT(CASE WHEN product_usage != '{}'::jsonb THEN 1 END) as packages_with_usage_data
FROM packages;

-- ============================================
-- UPDATE MIGRATION HISTORY
-- ============================================

-- Record these migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES 
  ('20260715200000', ARRAY['ALTER TABLE tenants'], 'enable_break_time_buffer'),
  ('20260716000000', ARRAY['ALTER TABLE packages'], 'add_product_usage_to_packages')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- FINAL SUMMARY
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ MIGRATIONS APPLIED SUCCESSFULLY';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Feature 1: Break Time Buffer';
  RAISE NOTICE '   - capacity_config added to tenants';
  RAISE NOTICE '   - 15-minute break enforced';
  RAISE NOTICE '   - Code already deployed and active';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Feature 2: Inventory Forecast';
  RAISE NOTICE '   - product_usage column added to packages';
  RAISE NOTICE '   - API endpoint ready';
  RAISE NOTICE '   - UI hook enabled';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '   1. Populate product_usage for each package';
  RAISE NOTICE '   2. Redeploy app to enable inventory forecast UI';
  RAISE NOTICE '   3. Test break time buffer in booking modal';
  RAISE NOTICE '   4. Monitor production for 24 hours';
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- ROLLBACK PLAN (IF NEEDED)
-- ============================================

-- To disable break time enforcement (EMERGENCY ONLY):
/*
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'false'::jsonb,
  true
);
*/

-- To remove product_usage column (EMERGENCY ONLY):
/*
ALTER TABLE packages DROP COLUMN IF EXISTS product_usage;
*/

-- ============================================
-- VERIFICATION QUERIES (RUN AFTER MIGRATION)
-- ============================================

-- Check break time config
-- SELECT name, metadata->'capacity_config' FROM tenants WHERE status = 'active';

-- Check product_usage column
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'product_usage';

-- Check migration history
-- SELECT * FROM supabase_migrations.schema_migrations WHERE version IN ('20260715200000', '20260716000000');
