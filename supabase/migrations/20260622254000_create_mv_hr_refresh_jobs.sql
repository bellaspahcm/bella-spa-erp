-- Migration: Create Refresh Jobs and Monitoring for HR Intelligence Materialized Views
-- Purpose: Schedule hourly refresh (at :10 mark to avoid collision with Finance) and provide monitoring
-- Created: 2026-06-22

-- ============================================================================
-- PART 1: Helper function to refresh HR materialized views
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_hr_materialized_views()
RETURNS TABLE(view_name TEXT, refresh_duration_ms BIGINT, rows_count BIGINT, status TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration_ms BIGINT;
  row_count BIGINT;
BEGIN
  -- Refresh mv_workforce_analytics
  BEGIN
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workforce_analytics;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    SELECT COUNT(*) INTO row_count FROM mv_workforce_analytics;
    
    RETURN QUERY SELECT 
      'mv_workforce_analytics'::TEXT,
      duration_ms,
      row_count,
      'success'::TEXT,
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'mv_workforce_analytics'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      'error'::TEXT,
      SQLERRM::TEXT;
  END;

  -- Refresh mv_attendance_summary
  BEGIN
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_summary;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    SELECT COUNT(*) INTO row_count FROM mv_attendance_summary;
    
    RETURN QUERY SELECT 
      'mv_attendance_summary'::TEXT,
      duration_ms,
      row_count,
      'success'::TEXT,
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'mv_attendance_summary'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      'error'::TEXT,
      SQLERRM::TEXT;
  END;

  -- Refresh mv_payroll_summary
  BEGIN
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payroll_summary;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    SELECT COUNT(*) INTO row_count FROM mv_payroll_summary;
    
    RETURN QUERY SELECT 
      'mv_payroll_summary'::TEXT,
      duration_ms,
      row_count,
      'success'::TEXT,
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'mv_payroll_summary'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      'error'::TEXT,
      SQLERRM::TEXT;
  END;

  -- Refresh mv_employee_performance
  BEGIN
    start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_performance;
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    SELECT COUNT(*) INTO row_count FROM mv_employee_performance;
    
    RETURN QUERY SELECT 
      'mv_employee_performance'::TEXT,
      duration_ms,
      row_count,
      'success'::TEXT,
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'mv_employee_performance'::TEXT,
      NULL::BIGINT,
      NULL::BIGINT,
      'error'::TEXT,
      SQLERRM::TEXT;
  END;

  RETURN;
END;
$$;

-- Add comment
COMMENT ON FUNCTION refresh_hr_materialized_views() IS 
  'Refreshes all HR Intelligence materialized views (workforce analytics, attendance, payroll, performance) with timing and error tracking. Returns status for each view.';

-- ============================================================================
-- PART 2: Schedule cron job for hourly refresh (at :10 mark)
-- ============================================================================

-- Enable pg_cron extension if not already enabled (requires superuser)
-- Note: This will be automatically enabled by Supabase, but we check here for safety
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END
$$;

-- Schedule refresh job to run every hour at :10 mark (avoids collision with Finance at :05/:15/:25)
-- This ensures HR data is refreshed hourly without interfering with Finance jobs
SELECT cron.schedule(
  'refresh_hr_intelligence_views',
  '10 * * * *',  -- Every hour at minute 10 (e.g., 00:10, 01:10, 02:10, ...)
  $$SELECT * FROM refresh_hr_materialized_views()$$
);

-- Add comment to cron job
COMMENT ON FUNCTION cron.schedule(TEXT, TEXT, TEXT) IS 
  'Schedules refresh_hr_materialized_views() to run every hour at :10 mark. Avoids collision with Finance refresh jobs at :05/:15/:25.';

-- ============================================================================
-- PART 3: Monitoring view for HR Intelligence refresh status
-- ============================================================================

CREATE OR REPLACE VIEW v_hr_intelligence_monitoring AS
WITH view_stats AS (
  SELECT
    'mv_workforce_analytics' AS view_name,
    (SELECT COUNT(*) FROM mv_workforce_analytics) AS row_count,
    (SELECT MAX(computed_at) FROM mv_workforce_analytics) AS last_computed_at,
    pg_size_pretty(pg_total_relation_size('mv_workforce_analytics')) AS size
  UNION ALL
  SELECT
    'mv_attendance_summary',
    (SELECT COUNT(*) FROM mv_attendance_summary),
    (SELECT MAX(computed_at) FROM mv_attendance_summary),
    pg_size_pretty(pg_total_relation_size('mv_attendance_summary'))
  UNION ALL
  SELECT
    'mv_payroll_summary',
    (SELECT COUNT(*) FROM mv_payroll_summary),
    (SELECT MAX(computed_at) FROM mv_payroll_summary),
    pg_size_pretty(pg_total_relation_size('mv_payroll_summary'))
  UNION ALL
  SELECT
    'mv_employee_performance',
    (SELECT COUNT(*) FROM mv_employee_performance),
    (SELECT MAX(computed_at) FROM mv_employee_performance),
    pg_size_pretty(pg_total_relation_size('mv_employee_performance'))
),
cron_jobs AS (
  SELECT
    jobname,
    schedule,
    active,
    (SELECT MAX(end_time) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) AS last_run,
    (SELECT status FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid ORDER BY end_time DESC LIMIT 1) AS last_status
  FROM cron.job j
  WHERE jobname = 'refresh_hr_intelligence_views'
)
SELECT
  vs.view_name,
  vs.row_count,
  vs.last_computed_at,
  vs.size,
  EXTRACT(EPOCH FROM (NOW() - vs.last_computed_at)) / 60 AS minutes_since_last_refresh,
  cj.schedule AS cron_schedule,
  cj.active AS cron_active,
  cj.last_run AS cron_last_run,
  cj.last_status AS cron_last_status,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - vs.last_computed_at)) / 60 > 90 THEN 'stale'
    WHEN EXTRACT(EPOCH FROM (NOW() - vs.last_computed_at)) / 60 > 65 THEN 'warning'
    ELSE 'healthy'
  END AS health_status
FROM view_stats vs
CROSS JOIN cron_jobs cj
ORDER BY vs.view_name;

-- Grant access to monitoring view
GRANT SELECT ON v_hr_intelligence_monitoring TO authenticated;
GRANT SELECT ON v_hr_intelligence_monitoring TO anon;

-- Add comment
COMMENT ON VIEW v_hr_intelligence_monitoring IS 
  'Real-time monitoring dashboard for HR Intelligence materialized views. Shows row counts, last refresh times, sizes, cron job status, and health indicators. Alerts when data is stale (>90 min since refresh).';

-- ============================================================================
-- PART 4: Manual refresh function for testing/emergency
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_refresh_hr_views()
RETURNS TABLE(view_name TEXT, status TEXT, duration_ms BIGINT, rows_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM refresh_hr_materialized_views();
END;
$$;

-- Add comment
COMMENT ON FUNCTION manually_refresh_hr_views() IS 
  'Manually trigger refresh of all HR Intelligence views. Use for testing or emergency data updates. Returns refresh status and timing for each view.';

-- Grant execute permission to authenticated users (admin only in practice via RLS)
GRANT EXECUTE ON FUNCTION manually_refresh_hr_views() TO authenticated;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'HR Intelligence Refresh Jobs Setup Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - refresh_hr_materialized_views() function';
  RAISE NOTICE '  - Cron job: refresh_hr_intelligence_views (runs hourly at :10)';
  RAISE NOTICE '  - v_hr_intelligence_monitoring view';
  RAISE NOTICE '  - manually_refresh_hr_views() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring Query:';
  RAISE NOTICE '  SELECT * FROM v_hr_intelligence_monitoring;';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual Refresh:';
  RAISE NOTICE '  SELECT * FROM manually_refresh_hr_views();';
  RAISE NOTICE '========================================';
END;
$$;
