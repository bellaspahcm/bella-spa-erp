-- ============================================================================
-- STEP 3: Insert Phase 0 Feature Flag - READY TO RUN
-- ============================================================================
-- Tenant ID: c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d
-- This file is ready to copy/paste into SQL Editor
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
    jsonb_build_array('c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d')
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

-- Verify inserted
SELECT 
  key, 
  name, 
  enabled, 
  rollout_strategy, 
  rollout_config,
  metadata,
  created_at
FROM feature_flags
WHERE key = 'healthcare.new-engine-architecture';
