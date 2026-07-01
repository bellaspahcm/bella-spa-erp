-- Create materialized view for campaign-level performance aggregation
-- This view aggregates metrics from all platforms for each campaign

CREATE MATERIALIZED VIEW mv_campaign_performance AS
SELECT
  -- Campaign identifiers
  mc.id AS campaign_id,
  mc.tenant_id,
  mc.name AS campaign_name,
  mc.budget AS campaign_budget,
  mc.start_date AS campaign_start_date,
  mc.end_date AS campaign_end_date,
  mc.status AS campaign_status,
  
  -- Aggregated metrics (all platforms)
  COALESCE(SUM(ead.impressions), 0) AS total_impressions,
  COALESCE(SUM(ead.clicks), 0) AS total_clicks,
  COALESCE(SUM(ead.spend), 0) AS total_spend,
  COALESCE(SUM(ead.conversions), 0) AS total_conversions,
  COALESCE(SUM(ead.revenue), 0) AS total_revenue,
  
  -- Calculated metrics
  ROUND(
    (COALESCE(SUM(ead.clicks), 0)::NUMERIC / NULLIF(COALESCE(SUM(ead.impressions), 0), 0)) * 100, 
    2
  ) AS avg_ctr,
  ROUND(
    COALESCE(SUM(ead.spend), 0) / NULLIF(COALESCE(SUM(ead.clicks), 0), 0), 
    2
  ) AS avg_cpc,
  ROUND(
    COALESCE(SUM(ead.spend), 0) / NULLIF(COALESCE(SUM(ead.conversions), 0), 0), 
    2
  ) AS avg_cpa,
  ROUND(
    COALESCE(SUM(ead.revenue), 0) / NULLIF(COALESCE(SUM(ead.spend), 0), 0), 
    2
  ) AS avg_roas,
  ROUND(
    ((COALESCE(SUM(ead.revenue), 0) - COALESCE(SUM(ead.spend), 0)) / 
     NULLIF(COALESCE(SUM(ead.spend), 0), 0)) * 100, 
    2
  ) AS roi_pct,
  
  -- Platform breakdown
  COUNT(DISTINCT ead.platform) AS platforms_count,
  JSONB_AGG(DISTINCT ead.platform) FILTER (WHERE ead.platform IS NOT NULL) AS platforms_list,
  
  -- Date range
  MIN(ead.date) AS first_ad_date,
  MAX(ead.date) AS last_ad_date,
  
  -- Metadata
  NOW() AS computed_at
FROM marketing_campaigns mc
LEFT JOIN external_ads_data ead 
  ON ead.internal_campaign_id = mc.id 
  AND ead.sync_status = 'success'
WHERE mc.tenant_id IS NOT NULL
GROUP BY 
  mc.id, 
  mc.tenant_id, 
  mc.name, 
  mc.budget, 
  mc.start_date, 
  mc.end_date, 
  mc.status
WITH DATA;

-- Create indexes for performance
CREATE UNIQUE INDEX idx_mv_campaign_performance_pk 
  ON mv_campaign_performance(campaign_id, tenant_id);

CREATE INDEX idx_mv_campaign_performance_tenant 
  ON mv_campaign_performance(tenant_id);

CREATE INDEX idx_mv_campaign_performance_roi 
  ON mv_campaign_performance(roi_pct DESC, tenant_id) 
  WHERE roi_pct IS NOT NULL;

CREATE INDEX idx_mv_campaign_performance_spend 
  ON mv_campaign_performance(total_spend DESC, tenant_id) 
  WHERE total_spend > 0;

CREATE INDEX idx_mv_campaign_performance_status 
  ON mv_campaign_performance(campaign_status, tenant_id);

CREATE INDEX idx_mv_campaign_performance_date_range 
  ON mv_campaign_performance(campaign_start_date, campaign_end_date, tenant_id);

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW mv_campaign_performance IS 
  'Campaign-level performance metrics aggregated from all advertising platforms (Facebook, Google, TikTok, Zalo). Refreshed hourly via pg_cron job. Used for campaign analytics dashboard and ROI reporting.';

-- Grant permissions
GRANT SELECT ON mv_campaign_performance TO authenticated;
GRANT SELECT ON mv_campaign_performance TO service_role;
