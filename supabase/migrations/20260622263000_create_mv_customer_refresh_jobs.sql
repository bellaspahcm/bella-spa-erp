-- Migration: Create Materialized View Refresh Jobs for Customer Intelligence
-- Purpose: Schedule automatic refresh of customer intelligence materialized views
-- Refresh Schedule: Every 6 hours (customer behavior changes gradually)
-- Created: 2026-06-22

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- REFRESH JOB: mv_customer_segments (Every 6 hours)
-- ============================================================================

-- Drop existing job if exists
SELECT cron.unschedule('refresh_mv_customer_segments') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_customer_segments'
);

-- Schedule refresh job (every 6 hours at :00)
SELECT cron.schedule(
  'refresh_mv_customer_segments',
  '0 */6 * * *',  -- At minute 0 past every 6th hour (00:00, 06:00, 12:00, 18:00)
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;$$
);

COMMENT ON EXTENSION pg_cron IS 
  'pg_cron extension for scheduling materialized view refreshes. Job: refresh_mv_customer_segments runs every 6 hours.';

-- ============================================================================
-- REFRESH JOB: mv_customer_ltv (Every 6 hours, offset by 10 minutes)
-- ============================================================================

-- Drop existing job if exists
SELECT cron.unschedule('refresh_mv_customer_ltv') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_customer_ltv'
);

-- Schedule refresh job (every 6 hours at :10, offset to avoid concurrent refresh)
SELECT cron.schedule(
  'refresh_mv_customer_ltv',
  '10 */6 * * *',  -- At minute 10 past every 6th hour (00:10, 06:10, 12:10, 18:10)
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_ltv;$$
);

-- ============================================================================
-- REFRESH JOB: mv_customer_activity_summary (Every 6 hours, offset by 20 minutes)
-- ============================================================================

-- Drop existing job if exists
SELECT cron.unschedule('refresh_mv_customer_activity_summary') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_customer_activity_summary'
);

-- Schedule refresh job (every 6 hours at :20, offset to avoid concurrent refresh)
SELECT cron.schedule(
  'refresh_mv_customer_activity_summary',
  '20 */6 * * *',  -- At minute 20 past every 6th hour (00:20, 06:20, 12:20, 18:20)
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_activity_summary;$$
);

-- ============================================================================
-- MONITORING VIEW: Customer Intelligence Refresh Status
-- ============================================================================

-- Create a view to monitor refresh job status and performance
CREATE OR REPLACE VIEW v_customer_intelligence_refresh_status AS
SELECT
  'mv_customer_segments' AS view_name,
  pg_size_pretty(pg_total_relation_size('mv_customer_segments')) AS view_size,
  (
    SELECT computed_at 
    FROM mv_customer_segments 
    ORDER BY computed_at DESC 
    LIMIT 1
  ) AS last_refresh_time,
  EXTRACT(EPOCH FROM (NOW() - (
    SELECT computed_at 
    FROM mv_customer_segments 
    ORDER BY computed_at DESC 
    LIMIT 1
  )))::INTEGER AS seconds_since_refresh,
  (
    SELECT COUNT(*) 
    FROM mv_customer_segments
  ) AS row_count,
  (
    SELECT job.schedule 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_segments'
  ) AS cron_schedule,
  (
    SELECT job.active 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_segments'
  ) AS cron_active

UNION ALL

SELECT
  'mv_customer_ltv' AS view_name,
  pg_size_pretty(pg_total_relation_size('mv_customer_ltv')) AS view_size,
  (
    SELECT computed_at 
    FROM mv_customer_ltv 
    ORDER BY computed_at DESC 
    LIMIT 1
  ) AS last_refresh_time,
  EXTRACT(EPOCH FROM (NOW() - (
    SELECT computed_at 
    FROM mv_customer_ltv 
    ORDER BY computed_at DESC 
    LIMIT 1
  )))::INTEGER AS seconds_since_refresh,
  (
    SELECT COUNT(*) 
    FROM mv_customer_ltv
  ) AS row_count,
  (
    SELECT job.schedule 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_ltv'
  ) AS cron_schedule,
  (
    SELECT job.active 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_ltv'
  ) AS cron_active

UNION ALL

SELECT
  'mv_customer_activity_summary' AS view_name,
  pg_size_pretty(pg_total_relation_size('mv_customer_activity_summary')) AS view_size,
  (
    SELECT computed_at 
    FROM mv_customer_activity_summary 
    ORDER BY computed_at DESC 
    LIMIT 1
  ) AS last_refresh_time,
  EXTRACT(EPOCH FROM (NOW() - (
    SELECT computed_at 
    FROM mv_customer_activity_summary 
    ORDER BY computed_at DESC 
    LIMIT 1
  )))::INTEGER AS seconds_since_refresh,
  (
    SELECT COUNT(*) 
    FROM mv_customer_activity_summary
  ) AS row_count,
  (
    SELECT job.schedule 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_activity_summary'
  ) AS cron_schedule,
  (
    SELECT job.active 
    FROM cron.job job 
    WHERE job.jobname = 'refresh_mv_customer_activity_summary'
  ) AS cron_active;

-- Grant access to monitoring view
GRANT SELECT ON v_customer_intelligence_refresh_status TO authenticated;
GRANT SELECT ON v_customer_intelligence_refresh_status TO anon;

COMMENT ON VIEW v_customer_intelligence_refresh_status IS 
  'Monitoring view for customer intelligence materialized view refresh status. Shows last refresh time, row counts, view sizes, and cron job status.';

-- ============================================================================
-- HELPER FUNCTION: Manual Refresh All Customer Intelligence Views
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_customer_intelligence_views()
RETURNS TABLE(
  view_name TEXT,
  refresh_status TEXT,
  rows_affected BIGINT,
  refresh_duration_ms INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  row_count BIGINT;
BEGIN
  -- Refresh mv_customer_segments
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;
  end_time := clock_timestamp();
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  view_name := 'mv_customer_segments';
  refresh_status := 'SUCCESS';
  rows_affected := (SELECT COUNT(*) FROM mv_customer_segments);
  refresh_duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
  RETURN NEXT;
  
  -- Refresh mv_customer_ltv
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_ltv;
  end_time := clock_timestamp();
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  view_name := 'mv_customer_ltv';
  refresh_status := 'SUCCESS';
  rows_affected := (SELECT COUNT(*) FROM mv_customer_ltv);
  refresh_duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
  RETURN NEXT;
  
  -- Refresh mv_customer_activity_summary
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_activity_summary;
  end_time := clock_timestamp();
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  view_name := 'mv_customer_activity_summary';
  refresh_status := 'SUCCESS';
  rows_affected := (SELECT COUNT(*) FROM mv_customer_activity_summary);
  refresh_duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
  RETURN NEXT;
  
EXCEPTION
  WHEN OTHERS THEN
    view_name := 'ERROR';
    refresh_status := SQLERRM;
    rows_affected := 0;
    refresh_duration_ms := 0;
    RETURN NEXT;
END;
$$;

-- Grant execute permission to service_role (for API calls)
GRANT EXECUTE ON FUNCTION refresh_all_customer_intelligence_views() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_all_customer_intelligence_views() TO authenticated;

COMMENT ON FUNCTION refresh_all_customer_intelligence_views() IS 
  'Manually refresh all customer intelligence materialized views. Returns refresh status, row counts, and duration for each view. Useful for on-demand refresh or debugging.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Query to verify all jobs are scheduled
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname IN (
  'refresh_mv_customer_segments',
  'refresh_mv_customer_ltv',
  'refresh_mv_customer_activity_summary'
)
ORDER BY jobname;

-- Initial verification: Show refresh status
SELECT * FROM v_customer_intelligence_refresh_status;
