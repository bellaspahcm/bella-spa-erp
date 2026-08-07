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
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Rollout configuration
  rollout_strategy VARCHAR(50) NOT NULL DEFAULT 'off',
  rollout_config JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
  ON feature_flags(enabled);

CREATE INDEX IF NOT EXISTS idx_feature_flags_rollout_strategy 
  ON feature_flags(rollout_strategy);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read feature flags
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Only service_role can insert/update/delete
CREATE POLICY "Service role can manage feature flags"
  ON feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON feature_flags TO authenticated;
GRANT ALL ON feature_flags TO service_role;
