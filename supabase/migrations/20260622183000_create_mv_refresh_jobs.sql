-- Migration: Setup Auto-Refresh Jobs for Materialized Views
-- Purpose: Automatically refresh materialized views at regular intervals
-- Requires: pg_cron extension
-- Created: 2026-06-22

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh for mv_ktv_performance_summary (every 10 minutes)
SELECT cron.schedule(
  'refresh-mv-ktv-performance',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ktv_performance_summary$$
);

-- Schedule refresh for mv_inventory_status (every 5 minutes - more critical)
SELECT cron.schedule(
  'refresh-mv-inventory-status',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status$$
);

-- Schedule refresh for mv_session_analytics (every 10 minutes)
SELECT cron.schedule(
  'refresh-mv-session-analytics',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_analytics$$
);

-- Create a function to manually refresh all operational materialized views
CREATE OR REPLACE FUNCTION refresh_operational_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ktv_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_analytics;
  
  RAISE NOTICE 'All operational materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_operational_materialized_views() TO authenticated;

-- Add comment
COMMENT ON FUNCTION refresh_operational_materialized_views() IS 
  'Manually refresh all operational materialized views. Use when immediate refresh is needed after bulk data operations.';

-- Create a monitoring view to check materialized view refresh status
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
  'mv_ktv_performance_summary',
  'mv_inventory_status',
  'mv_session_analytics'
)
ORDER BY matviewname;

-- Grant access to authenticated users
GRANT SELECT ON v_mv_refresh_status TO authenticated;

-- Add comment
COMMENT ON VIEW v_mv_refresh_status IS 
  'Monitor status of operational materialized views (populated, indexes, etc.)';

-- Log successful setup
DO $$
BEGIN
  RAISE NOTICE '✅ Materialized View Refresh Jobs Setup Complete';
  RAISE NOTICE '   - mv_ktv_performance_summary: Refresh every 10 minutes';
  RAISE NOTICE '   - mv_inventory_status: Refresh every 5 minutes';
  RAISE NOTICE '   - mv_session_analytics: Refresh every 10 minutes';
  RAISE NOTICE '   - Manual refresh function: refresh_operational_materialized_views()';
  RAISE NOTICE '   - Monitor status: SELECT * FROM v_mv_refresh_status';
END $$;
