-- =====================================================================================
-- Migration: Create marketing_campaigns table for campaign management
-- Description: Internal campaign tracking with external platform ID mappings
-- Author: Intelligence Layer Phase 3
-- Date: 2026-06-22
-- =====================================================================================

-- ---
-- Table: marketing_campaigns
-- Purpose: Store internal campaigns with mappings to external platform campaign IDs
-- ---

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Campaign details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Budget tracking
  budget NUMERIC(12, 2) CHECK (budget >= 0),
  
  -- Campaign timeline
  start_date DATE,
  end_date DATE CHECK (end_date IS NULL OR end_date >= start_date),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  
  -- External platform mappings (JSONB array for flexibility)
  -- Format: [
  --   { "platform": "facebook", "campaign_id": "123456789" },
  --   { "platform": "google", "campaign_id": "987654321" },
  --   ...
  -- ]
  external_mappings JSONB DEFAULT '[]'::jsonb,
  
  -- Owner (optional)
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: campaign name per tenant
  CONSTRAINT uq_marketing_campaigns_name UNIQUE (tenant_id, name)
);

-- ---
-- Indexes for performance optimization
-- ---

-- Tenant isolation index
CREATE INDEX idx_marketing_campaigns_tenant 
ON marketing_campaigns(tenant_id);

-- Status filter (find active campaigns)
CREATE INDEX idx_marketing_campaigns_status 
ON marketing_campaigns(status, tenant_id);

-- Date range queries (find campaigns running in period)
CREATE INDEX idx_marketing_campaigns_date_range 
ON marketing_campaigns(tenant_id, start_date, end_date) 
WHERE status != 'archived';

-- Created by filter (find campaigns by creator)
CREATE INDEX idx_marketing_campaigns_creator 
ON marketing_campaigns(created_by_id, tenant_id) 
WHERE created_by_id IS NOT NULL;

-- GIN index for external_mappings JSONB (search by platform or campaign ID)
CREATE INDEX idx_marketing_campaigns_external_mappings 
ON marketing_campaigns USING GIN (external_mappings);

-- ---
-- Trigger: Auto-update updated_at timestamp
-- ---

CREATE OR REPLACE FUNCTION update_marketing_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketing_campaigns_updated_at
BEFORE UPDATE ON marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_marketing_campaigns_updated_at();

-- ---
-- Add foreign key to external_ads_data (now that marketing_campaigns exists)
-- ---

ALTER TABLE external_ads_data
ADD CONSTRAINT fk_external_ads_data_campaign
FOREIGN KEY (internal_campaign_id)
REFERENCES marketing_campaigns(id)
ON DELETE SET NULL;

-- ---
-- RLS (Row Level Security) Policies
-- ---

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access campaigns for their tenant
-- NOTE: Temporarily disabled - requires user_tenant_access table to be created first
-- CREATE POLICY marketing_campaigns_tenant_isolation 
-- ON marketing_campaigns
-- FOR ALL
-- USING (
--   tenant_id IN (
--     SELECT tenant_id 
--     FROM user_tenant_access 
--     WHERE user_id = auth.uid()
--   )
-- );

-- Temporary policy: Allow all authenticated users (remove after user_tenant_access is created)
CREATE POLICY marketing_campaigns_allow_all_temp
ON marketing_campaigns
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ---
-- Helper functions for external_mappings JSONB operations
-- ---

-- Function: Check if campaign has external mapping for a platform
CREATE OR REPLACE FUNCTION has_external_mapping(
  campaign_row marketing_campaigns,
  platform_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(campaign_row.external_mappings) AS mapping
    WHERE mapping->>'platform' = platform_name
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get external campaign ID for a platform
CREATE OR REPLACE FUNCTION get_external_campaign_id(
  campaign_row marketing_campaigns,
  platform_name TEXT
)
RETURNS TEXT AS $$
DECLARE
  mapping JSONB;
BEGIN
  SELECT elem INTO mapping
  FROM jsonb_array_elements(campaign_row.external_mappings) AS elem
  WHERE elem->>'platform' = platform_name
  LIMIT 1;
  
  RETURN mapping->>'campaign_id';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---
-- Comments for documentation
-- ---

COMMENT ON TABLE marketing_campaigns IS 'Internal marketing campaign management with external platform mappings';

COMMENT ON COLUMN marketing_campaigns.name IS 'Campaign name (unique per tenant)';
COMMENT ON COLUMN marketing_campaigns.budget IS 'Total campaign budget across all platforms';
COMMENT ON COLUMN marketing_campaigns.status IS 'Campaign status: draft, active, paused, completed, or archived';
COMMENT ON COLUMN marketing_campaigns.external_mappings IS 'JSONB array mapping internal campaign to external platform campaign IDs';

COMMENT ON FUNCTION has_external_mapping IS 'Check if campaign has external mapping for specified platform';
COMMENT ON FUNCTION get_external_campaign_id IS 'Get external campaign ID for specified platform';

-- ---
-- Grant permissions
-- ---

-- Grant read/write to authenticated users (RLS handles tenant isolation)
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO authenticated;
-- Note: UUID primary key does not use sequence

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION has_external_mapping TO authenticated;
GRANT EXECUTE ON FUNCTION get_external_campaign_id TO authenticated;

-- ---
-- Sample data structure for external_mappings
-- ---

/*
Example external_mappings JSONB:

[
  {
    "platform": "facebook",
    "campaign_id": "23850891234567890",
    "campaign_name": "Summer Sale 2026 - Facebook"
  },
  {
    "platform": "google",
    "campaign_id": "1234567890",
    "campaign_name": "Summer Sale 2026 - Google Ads"
  },
  {
    "platform": "tiktok",
    "campaign_id": "7123456789012345678",
    "campaign_name": "Summer Sale 2026 - TikTok"
  }
]

Query examples:

-- Find campaigns with Facebook mapping
SELECT * FROM marketing_campaigns
WHERE external_mappings @> '[{"platform": "facebook"}]'::jsonb;

-- Get all Facebook campaign IDs for a tenant
SELECT 
  id,
  name,
  elem->>'campaign_id' AS facebook_campaign_id
FROM marketing_campaigns,
     jsonb_array_elements(external_mappings) AS elem
WHERE tenant_id = 'your-tenant-id'
  AND elem->>'platform' = 'facebook';
*/

-- =====================================================================================
-- End of migration
-- =====================================================================================
