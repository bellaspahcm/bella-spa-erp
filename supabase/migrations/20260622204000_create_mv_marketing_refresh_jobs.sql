-- Migration: Setup Auto-Refresh Jobs for Marketing Intelligence Materialized Views
-- Purpose: Automatically refresh marketing materialized views every hour
-- Requires: pg_cron extension
-- Created: 2026-06-22

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh for mv_campaign_performance (every hour at minute 0)
-- Marketing data changes less frequently than operational data, so 1-hour interval is appropriate
SELECT cron.schedule(
  'refresh-mv-campaign-performance',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance$$
);

-- Schedule refresh for mv_channel_performance (every hour at minute 5)
-- Stagger by 5 minutes to avoid concurrent refresh load
SELECT cron.schedule(
  'refresh-mv-channel-performance',
  '5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_performance$$
);

-- Create a function to manually refresh all marketing materialized views
CREATE OR REPLACE FUNCTION refresh_marketing_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_performance;
  
  RAISE NOTICE 'All marketing materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_marketing_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_marketing_materialized_views() TO service_role;

-- Add comment
COMMENT ON FUNCTION refresh_marketing_materialized_views() IS 
  'Manually refresh all marketing materialized views. Use after bulk ad data sync or when immediate refresh is needed.';

-- Extend the monitoring view to include marketing materialized views
CREATE OR REPLACE VIEW v_mv_refresh_status AS
SELECT
  schemaname,
  matviewname,
  matviewowner,
  tablespace,
  hasindexes,
  ispopulated,
  definition
FROM pg_matviews
WHERE matviewname IN (
  -- Operational views (Phase 2)
  'mv_ktv_performance_summary',
  'mv_inventory_status',
  'mv_session_analytics',
  -- Marketing views (Phase 3)
  'mv_campaign_performance',
  'mv_channel_performance'
)
ORDER BY matviewname;

-- Grant access to authenticated users
GRANT SELECT ON v_mv_refresh_status TO authenticated;
GRANT SELECT ON v_mv_refresh_status TO service_role;

-- Add comment
COMMENT ON VIEW v_mv_refresh_status IS 
  'Monitor status of all intelligence layer materialized views (operational + marketing)';

-- Create a comprehensive manual refresh function for all intelligence views
CREATE OR REPLACE FUNCTION refresh_all_intelligence_materialized_views()
RETURNS TABLE(
  view_name TEXT,
  refresh_status TEXT,
  refresh_duration INTERVAL
) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  -- Operational Views
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ktv_performance_summary;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'mv_ktv_performance_summary'::TEXT, 
    'SUCCESS'::TEXT, 
    (end_time - start_time)::INTERVAL;
  
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'mv_inventory_status'::TEXT, 
    'SUCCESS'::TEXT, 
    (end_time - start_time)::INTERVAL;
  
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_analytics;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'mv_session_analytics'::TEXT, 
    'SUCCESS'::TEXT, 
    (end_time - start_time)::INTERVAL;
  
  -- Marketing Views
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'mv_campaign_performance'::TEXT, 
    'SUCCESS'::TEXT, 
    (end_time - start_time)::INTERVAL;
  
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_performance;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'mv_channel_performance'::TEXT, 
    'SUCCESS'::TEXT, 
    (end_time - start_time)::INTERVAL;
  
  RAISE NOTICE 'All intelligence layer materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_all_intelligence_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_intelligence_materialized_views() TO service_role;

-- Add comment
COMMENT ON FUNCTION refresh_all_intelligence_materialized_views() IS 
  'Manually refresh ALL intelligence layer materialized views (operational + marketing). Returns timing for each view. Use after major data imports or system maintenance.';

-- Create a view to check pg_cron job status
CREATE OR REPLACE VIEW v_cron_jobs_status AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE '%refresh-mv-%'
ORDER BY jobname;

-- Grant access
GRANT SELECT ON v_cron_jobs_status TO authenticated;
GRANT SELECT ON v_cron_jobs_status TO service_role;

-- Add comment
COMMENT ON VIEW v_cron_jobs_status IS 
  'Monitor all scheduled pg_cron jobs for materialized view refresh';

-- Log successful setup
DO $$
BEGIN
  RAISE NOTICE '✅ Marketing Intelligence Materialized View Refresh Jobs Setup Complete';
  RAISE NOTICE '   ';
  RAISE NOTICE '📊 MARKETING VIEWS (Phase 3):';
  RAISE NOTICE '   - mv_campaign_performance: Refresh every hour at :00';
  RAISE NOTICE '   - mv_channel_performance: Refresh every hour at :05';
  RAISE NOTICE '   ';
  RAISE NOTICE '🔧 MANUAL REFRESH FUNCTIONS:';
  RAISE NOTICE '   - refresh_marketing_materialized_views() - Marketing views only';
  RAISE NOTICE '   - refresh_all_intelligence_materialized_views() - All views with timing';
  RAISE NOTICE '   ';
  RAISE NOTICE '📈 MONITORING VIEWS:';
  RAISE NOTICE '   - SELECT * FROM v_mv_refresh_status - View population status';
  RAISE NOTICE '   - SELECT * FROM v_cron_jobs_status - Cron job schedules';
END $$;
