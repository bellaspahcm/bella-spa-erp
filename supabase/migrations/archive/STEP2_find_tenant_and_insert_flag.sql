-- ============================================================================
-- STEP 2: Find Tenant + Insert Feature Flag (Combined)
-- ============================================================================
-- This combines finding tenant and inserting flag in one go
-- ============================================================================

-- Part 1: Show available tenants
-- Copy one of the 'id' values from results below
SELECT 
  id as tenant_id,
  name,
  email,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- Part 2: Insert Feature Flag
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Look at results from Part 1 above
-- 2. Copy one tenant_id (UUID format)
-- 3. Replace 'PASTE_TENANT_ID_HERE' in line 33 below
-- 4. Select ONLY lines 29-49 (the INSERT statement)
-- 5. Click RUN again
-- ============================================================================

INSERT INTO feature_flags (
  key,
  name,
  description,
  enabled,
  rollout_strategy,
  rollout_config,
  metadata
) VALUES (
  'healthcare.new-engine-architecture',
  'Healthcare Platform-of-Platforms Architecture',
  'Phase 0: Bed, Nursing, Pharmacy engines with Contract Registry',
  true,
  'manual',
  jsonb_build_object(
    'enabledTenants', 
    jsonb_build_array('PASTE_TENANT_ID_HERE')  -- ⚠️ REPLACE THIS
  ),
  jsonb_build_object(
    'deployedAt', NOW(),
    'phase', 'Phase 0',
    'constitutionCompliance', '91/100',
    'engines', jsonb_build_array('BedEngine', 'NursingEngine', 'PharmacyEngine')
  )
)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_config = EXCLUDED.rollout_config,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
