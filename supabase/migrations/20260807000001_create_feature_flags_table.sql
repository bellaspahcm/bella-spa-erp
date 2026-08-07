-- ============================================================================
-- Feature Flags Platform - Database Migration
-- ============================================================================
-- Purpose: Create feature_flags table for Host Platform
-- Constitution: Law 9 (Zero Regression Guarantee)
-- Phase: Phase 0 (Week 1)
-- Date: 2026-08-07
-- ============================================================================

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  -- Primary key
  key VARCHAR(255) PRIMARY KEY,
  
  -- Metadata
  name VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  owner VARCHAR(255) NOT NULL,
  tags TEXT[], -- Array of tags for grouping
  
  -- Flag state
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_strategy VARCHAR(50) NOT NULL DEFAULT 'instant',
    CHECK (rollout_strategy IN ('instant', 'canary', 'progressive', 'dark', 'manual')),
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  
  -- Targeting (JSONB arrays for flexibility)
  enabled_tenants JSONB DEFAULT '[]'::jsonb,
  disabled_tenants JSONB DEFAULT '[]'::jsonb,
  enabled_users JSONB DEFAULT '[]'::jsonb,
  disabled_users JSONB DEFAULT '[]'::jsonb,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  
  -- Indexes for performance
  CONSTRAINT feature_flags_key_check CHECK (key ~ '^[a-z0-9._-]+$') -- Enforce key format
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_strategy ON feature_flags(rollout_strategy);
CREATE INDEX IF NOT EXISTS idx_feature_flags_owner ON feature_flags(owner);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tags ON feature_flags USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_feature_flags_expires_at ON feature_flags(expires_at) WHERE expires_at IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flags_updated_at_trigger
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- ============================================================================
-- Seed Phase 0 Feature Flags
-- ============================================================================

-- Feature flag for Phase 0 engine refactor
INSERT INTO feature_flags (
  key,
  name,
  description,
  owner,
  enabled,
  rollout_strategy,
  rollout_percentage,
  tags
) VALUES (
  'healthcare.new-engine-architecture',
  'Healthcare Platform Engine Architecture',
  'Enable new Healthcare Platform engines (Bed, Nursing, Pharmacy) instead of Hospital services. Phase 0 refactor flag.',
  'Healthcare Platform Team',
  FALSE, -- Start disabled
  'manual', -- Manual rollout (explicit tenant whitelist)
  0,
  ARRAY['phase-0', 'hospital', 'critical', 'engine-refactor']
) ON CONFLICT (key) DO NOTHING;

-- Feature flag for Contract Registry enforcement
INSERT INTO feature_flags (
  key,
  name,
  description,
  owner,
  enabled,
  rollout_strategy,
  tags
) VALUES (
  'platform.contract-registry-enforcement',
  'Contract Registry Enforcement',
  'Enforce contract validation at runtime for all engine calls. Constitution Law 8.',
  'Platform Team',
  FALSE, -- Start disabled
  'progressive', -- Progressive rollout
  ARRAY['phase-0', 'governance', 'contract-registry']
) ON CONFLICT (key) DO NOTHING;

-- Feature flag for Event Bus publishing
INSERT INTO feature_flags (
  key,
  name,
  description,
  owner,
  enabled,
  rollout_strategy,
  tags
) VALUES (
  'platform.event-bus-publishing',
  'Event Bus Domain Event Publishing',
  'Enable domain event publishing to Event Bus for all engines. Constitution Law 5.',
  'Platform Team',
  FALSE, -- Start disabled
  'canary', -- Canary rollout
  ARRAY['phase-0', 'event-bus', 'integration']
) ON CONFLICT (key) DO NOTHING;

-- Feature flag for Type Safety enforcement
INSERT INTO feature_flags (
  key,
  name,
  description,
  owner,
  enabled,
  rollout_strategy,
  tags
) VALUES (
  'platform.strict-type-safety',
  'Strict Type Safety Enforcement',
  'Enforce zero "any" types via ESLint and pre-commit hooks. Constitution Law 11.',
  'Platform Team',
  FALSE, -- Start disabled
  'instant', -- Enable instantly once ready
  ARRAY['phase-0', 'type-safety', 'critical']
) ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read for authenticated users
CREATE POLICY feature_flags_select_policy ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow insert/update/delete for admins only
CREATE POLICY feature_flags_modify_policy ON feature_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- Audit Log Table (Optional - for tracking flag changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key VARCHAR(255) NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'evaluated'
  changes JSONB, -- Old vs new values
  context JSONB, -- Evaluation context (tenant, user, etc.)
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_audit_flag_key ON feature_flags_audit_log(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_audit_performed_at ON feature_flags_audit_log(performed_at);

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE feature_flags IS 'Feature flags for progressive rollout, A/B testing, and zero-regression deployments (Constitution Law 9)';
COMMENT ON COLUMN feature_flags.key IS 'Unique flag identifier (format: domain.feature-name)';
COMMENT ON COLUMN feature_flags.rollout_strategy IS 'Rollout strategy: instant, canary, progressive, dark, manual';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of traffic to enable (0-100) for canary/progressive rollout';
COMMENT ON COLUMN feature_flags.enabled_tenants IS 'JSONB array of tenant IDs with flag explicitly enabled';
COMMENT ON COLUMN feature_flags.disabled_tenants IS 'JSONB array of tenant IDs with flag explicitly disabled (blacklist)';
COMMENT ON COLUMN feature_flags.expires_at IS 'Auto-expire date for temporary flags';

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT SELECT ON feature_flags TO authenticated;
GRANT ALL ON feature_flags TO service_role;
GRANT SELECT ON feature_flags_audit_log TO authenticated;
GRANT ALL ON feature_flags_audit_log TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Feature Flags Platform migration complete';
  RAISE NOTICE 'Tables created: feature_flags, feature_flags_audit_log';
  RAISE NOTICE 'Seeded flags: 4 Phase 0 flags';
  RAISE NOTICE 'Next steps: Deploy FeatureFlagService, register flags at startup';
END $$;
