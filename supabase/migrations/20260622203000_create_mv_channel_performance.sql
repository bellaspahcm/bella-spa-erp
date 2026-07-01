-- Create materialized view for platform/channel-level performance aggregation
-- This view aggregates metrics by platform and month for channel comparison

CREATE MATERIALIZED VIEW mv_channel_performance AS
SELECT
  -- Channel identifiers
  ead.tenant_id,
  ead.platform,
  DATE_TRUNC('month', ead.date)::DATE AS month,
  
  -- Aggregated metrics
  SUM(ead.impressions) AS total_impressions,
  SUM(ead.clicks) AS total_clicks,
  SUM(ead.spend) AS total_spend,
  SUM(ead.conversions) AS total_conversions,
  SUM(ead.revenue) AS total_revenue,
  
  -- Calculated metrics
  ROUND(
    (SUM(ead.clicks)::NUMERIC / NULLIF(SUM(ead.impressions), 0)) * 100, 
    2
  ) AS avg_ctr,
  ROUND(
    SUM(ead.spend) / NULLIF(SUM(ead.clicks), 0), 
    2
  ) AS avg_cpc,
  ROUND(
    SUM(ead.spend) / NULLIF(SUM(ead.conversions), 0), 
    2
  ) AS avg_cpa,
  ROUND(
    SUM(ead.revenue) / NULLIF(SUM(ead.spend), 0), 
    2
  ) AS avg_roas,
  ROUND(
    ((SUM(ead.revenue) - SUM(ead.spend)) / NULLIF(SUM(ead.spend), 0)) * 100, 
    2
  ) AS roi_pct,
  
  -- Additional insights
  COUNT(DISTINCT ead.internal_campaign_id) AS campaigns_count,
  COUNT(*) AS records_count,
  
  -- Metadata
  NOW() AS computed_at
FROM external_ads_data ead
WHERE ead.sync_status = 'success'
  AND ead.tenant_id IS NOT NULL
GROUP BY 
  ead.tenant_id, 
  ead.platform, 
  DATE_TRUNC('month', ead.date)
WITH DATA;

-- Create indexes for performance
CREATE UNIQUE INDEX idx_mv_channel_performance_pk 
  ON mv_channel_performance(tenant_id, platform, month);

CREATE INDEX idx_mv_channel_performance_month 
  ON mv_channel_performance(month DESC, tenant_id);

CREATE INDEX idx_mv_channel_performance_platform 
  ON mv_channel_performance(platform, tenant_id);

CREATE INDEX idx_mv_channel_performance_roi 
  ON mv_channel_performance(roi_pct DESC, tenant_id) 
  WHERE roi_pct IS NOT NULL;

CREATE INDEX idx_mv_channel_performance_spend 
  ON mv_channel_performance(total_spend DESC, tenant_id) 
  WHERE total_spend > 0;

CREATE INDEX idx_mv_channel_performance_recent 
  ON mv_channel_performance(month DESC, platform, tenant_id);
  -- Note: Removed WHERE clause with NOW() as it's not IMMUTABLE
  -- Filter in queries instead: WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW mv_channel_performance IS 
  'Platform-level performance metrics aggregated by month. Used for channel comparison, budget allocation analysis, and platform ROI comparison. Refreshed hourly via pg_cron job.';

-- Grant permissions
GRANT SELECT ON mv_channel_performance TO authenticated;
GRANT SELECT ON mv_channel_performance TO service_role;
