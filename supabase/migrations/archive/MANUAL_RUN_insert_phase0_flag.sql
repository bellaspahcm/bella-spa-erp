-- ============================================================================
-- Insert Phase 0 Feature Flag
-- ============================================================================
-- Run this AFTER creating the feature_flags table
-- Replace YOUR_TEST_TENANT_ID with actual tenant ID
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
    jsonb_build_array('YOUR_TEST_TENANT_ID')
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
