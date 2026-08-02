-- =====================================================================================
-- Migration: Create external_ads_data table for multi-platform ad metrics
-- Description: Stores daily ad performance data from Facebook, Google, TikTok, Zalo
-- Author: Intelligence Layer Phase 3
-- Date: 2026-06-22
-- =====================================================================================

-- ---
-- Table: external_ads_data
-- Purpose: Store ad metrics from external platforms with normalization
-- ---

CREATE TABLE IF NOT EXISTS external_ads_data (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Platform identification
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'google', 'tiktok', 'zalo')),
  
  -- External IDs (platform-specific campaign/adset/ad identifiers)
  external_campaign_id VARCHAR(255) NOT NULL,
  external_adset_id VARCHAR(255), -- Optional (adset level)
  external_ad_id VARCHAR(255),    -- Optional (ad level)
  
  -- Internal campaign mapping (links to marketing_campaigns table)
  internal_campaign_id UUID, -- Will be added as FK after marketing_campaigns table exists
  
  -- Date (daily granularity)
  date DATE NOT NULL,
  
  -- Core metrics (normalized across all platforms)
  impressions BIGINT DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT DEFAULT 0 CHECK (clicks >= 0),
  spend NUMERIC(12, 2) DEFAULT 0 CHECK (spend >= 0),
  conversions INTEGER DEFAULT 0 CHECK (conversions >= 0),
  revenue NUMERIC(12, 2) DEFAULT 0 CHECK (revenue >= 0),
  
  -- Calculated metrics (auto-computed, can be NULL if no data)
  ctr NUMERIC(5, 2), -- Click-through rate: (clicks / impressions) * 100
  cpc NUMERIC(10, 2), -- Cost per click: spend / clicks
  cpa NUMERIC(10, 2), -- Cost per acquisition: spend / conversions
  roas NUMERIC(10, 2), -- Return on ad spend: revenue / spend
  roi NUMERIC(10, 2), -- Return on investment: ((revenue - spend) / spend) * 100
  
  -- Raw platform response (store original JSON for debugging/audit)
  raw_data JSONB,
  
  -- Sync metadata
  synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'success' CHECK (sync_status IN ('success', 'error', 'partial')),
  sync_error TEXT, -- Error message if sync failed
  
  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint using functional index (COALESCE not supported in table-level UNIQUE)
CREATE UNIQUE INDEX uq_external_ads_data_platform_ids_date 
ON external_ads_data (
  tenant_id,
  platform,
  external_campaign_id,
  COALESCE(external_adset_id, ''),
  COALESCE(external_ad_id, ''),
  date
);

-- ---
-- Indexes for performance optimization
-- ---

-- Tenant isolation index (most common filter)
CREATE INDEX idx_external_ads_data_tenant 
ON external_ads_data(tenant_id);

-- Platform + tenant index (filter by platform)
CREATE INDEX idx_external_ads_data_platform 
ON external_ads_data(platform, tenant_id);

-- Date range queries (descending for recent data)
CREATE INDEX idx_external_ads_data_date 
ON external_ads_data(date DESC, tenant_id);

-- Internal campaign mapping (for join with marketing_campaigns)
CREATE INDEX idx_external_ads_data_campaign 
ON external_ads_data(internal_campaign_id, tenant_id) 
WHERE internal_campaign_id IS NOT NULL;

-- Sync monitoring (find recent syncs or failed syncs)
CREATE INDEX idx_external_ads_data_sync 
ON external_ads_data(synced_at DESC, tenant_id);

-- Composite index for date range + platform queries
CREATE INDEX idx_external_ads_data_date_platform 
ON external_ads_data(tenant_id, date DESC, platform);

-- ---
-- Trigger: Auto-update updated_at timestamp
-- ---

CREATE OR REPLACE FUNCTION update_external_ads_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_external_ads_data_updated_at
BEFORE UPDATE ON external_ads_data
FOR EACH ROW
EXECUTE FUNCTION update_external_ads_data_updated_at();

-- ---
-- RLS (Row Level Security) Policies
-- ---

ALTER TABLE external_ads_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access data for their tenant
-- NOTE: Temporarily disabled - requires user_tenant_access table to be created first
-- CREATE POLICY external_ads_data_tenant_isolation 
-- ON external_ads_data
-- FOR ALL
-- USING (
--   tenant_id IN (
--     SELECT tenant_id 
--     FROM user_tenant_access 
--     WHERE user_id = auth.uid()
--   )
-- );

-- Temporary policy: Allow all authenticated users (remove after user_tenant_access is created)
CREATE POLICY external_ads_data_allow_all_temp
ON external_ads_data
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ---
-- Comments for documentation
-- ---

COMMENT ON TABLE external_ads_data IS 'Stores daily ad performance metrics from external platforms (Facebook, Google, TikTok, Zalo)';

COMMENT ON COLUMN external_ads_data.platform IS 'Ad platform: facebook, google, tiktok, or zalo';
COMMENT ON COLUMN external_ads_data.external_campaign_id IS 'Platform-specific campaign identifier (e.g., Facebook campaign ID)';
COMMENT ON COLUMN external_ads_data.internal_campaign_id IS 'Links to marketing_campaigns.id for internal campaign management';
COMMENT ON COLUMN external_ads_data.date IS 'Date of ad performance (daily granularity)';
COMMENT ON COLUMN external_ads_data.ctr IS 'Click-through rate: (clicks / impressions) * 100';
COMMENT ON COLUMN external_ads_data.cpc IS 'Cost per click: spend / clicks';
COMMENT ON COLUMN external_ads_data.cpa IS 'Cost per acquisition: spend / conversions';
COMMENT ON COLUMN external_ads_data.roas IS 'Return on ad spend: revenue / spend';
COMMENT ON COLUMN external_ads_data.roi IS 'Return on investment: ((revenue - spend) / spend) * 100';
COMMENT ON COLUMN external_ads_data.raw_data IS 'Original JSON response from platform API for debugging';
COMMENT ON COLUMN external_ads_data.sync_status IS 'Sync result: success, error, or partial';

-- ---
-- Grant permissions
-- ---

-- Grant read/write to authenticated users (RLS handles tenant isolation)
GRANT SELECT, INSERT, UPDATE, DELETE ON external_ads_data TO authenticated;
-- Note: UUID primary key does not use sequence

-- =====================================================================================
-- End of migration
-- =====================================================================================
