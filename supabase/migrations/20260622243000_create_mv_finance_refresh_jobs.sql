-- Migration: Create Auto-Refresh Jobs for Finance Intelligence Materialized Views
-- Purpose: Schedule automatic refresh of P&L, Cash Flow, and Budget Variance views
-- Refresh Frequency: Every 1 hour (financial data changes less frequently than operational data)
-- Created: 2026-06-22

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing jobs if they exist (idempotent)
SELECT cron.unschedule('refresh_mv_monthly_pnl') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_monthly_pnl'
);

SELECT cron.unschedule('refresh_mv_cash_flow') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_cash_flow'
);

SELECT cron.unschedule('refresh_mv_budget_variance') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_budget_variance'
);

-- Schedule refresh jobs (every hour at :05 past the hour to avoid conflicts)
-- Job 1: Refresh mv_monthly_pnl every hour
SELECT cron.schedule(
  'refresh_mv_monthly_pnl',
  '5 * * * *',  -- At 5 minutes past every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_pnl$$
);

-- Job 2: Refresh mv_cash_flow every hour (offset by 10 minutes)
SELECT cron.schedule(
  'refresh_mv_cash_flow',
  '15 * * * *',  -- At 15 minutes past every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cash_flow$$
);

-- Job 3: Refresh mv_budget_variance every hour (offset by 20 minutes)
SELECT cron.schedule(
  'refresh_mv_budget_variance',
  '25 * * * *',  -- At 25 minutes past every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_budget_variance$$
);

-- Create helper function to manually refresh all finance MVs
CREATE OR REPLACE FUNCTION refresh_all_finance_mvs()
RETURNS TABLE(
  view_name TEXT,
  refresh_started_at TIMESTAMPTZ,
  refresh_completed_at TIMESTAMPTZ,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  -- Refresh mv_monthly_pnl
  start_time := NOW();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_pnl;
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_monthly_pnl'::TEXT, 
      start_time, 
      end_time, 
      TRUE, 
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_monthly_pnl'::TEXT, 
      start_time, 
      end_time, 
      FALSE, 
      SQLERRM::TEXT;
  END;

  -- Refresh mv_cash_flow
  start_time := NOW();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cash_flow;
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_cash_flow'::TEXT, 
      start_time, 
      end_time, 
      TRUE, 
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_cash_flow'::TEXT, 
      start_time, 
      end_time, 
      FALSE, 
      SQLERRM::TEXT;
  END;

  -- Refresh mv_budget_variance
  start_time := NOW();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_budget_variance;
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_budget_variance'::TEXT, 
      start_time, 
      end_time, 
      TRUE, 
      NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    end_time := NOW();
    RETURN QUERY SELECT 
      'mv_budget_variance'::TEXT, 
      start_time, 
      end_time, 
      FALSE, 
      SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get last refresh times
CREATE OR REPLACE FUNCTION get_finance_mv_refresh_status()
RETURNS TABLE(
  view_name TEXT,
  last_refresh TIMESTAMPTZ,
  row_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'mv_monthly_pnl'::TEXT,
    (SELECT computed_at FROM mv_monthly_pnl ORDER BY computed_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM mv_monthly_pnl)
  UNION ALL
  SELECT 
    'mv_cash_flow'::TEXT,
    (SELECT computed_at FROM mv_cash_flow ORDER BY computed_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM mv_cash_flow)
  UNION ALL
  SELECT 
    'mv_budget_variance'::TEXT,
    (SELECT computed_at FROM mv_budget_variance ORDER BY computed_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM mv_budget_variance);
END;
$$ LANGUAGE plpgsql;

-- Create monitoring view for finance MV refresh jobs
CREATE OR REPLACE VIEW v_finance_mv_refresh_jobs AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.command,
  j.active,
  r.runid,
  r.start_time AS last_run_start,
  r.end_time AS last_run_end,
  r.status AS last_run_status,
  r.return_message AS last_run_message,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time))::INT AS last_run_duration_seconds
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT *
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) r ON TRUE
WHERE j.jobname IN ('refresh_mv_monthly_pnl', 'refresh_mv_cash_flow', 'refresh_mv_budget_variance')
ORDER BY j.jobname;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION refresh_all_finance_mvs() TO authenticated;
GRANT EXECUTE ON FUNCTION get_finance_mv_refresh_status() TO authenticated;
GRANT SELECT ON v_finance_mv_refresh_jobs TO authenticated;

-- Add comments
COMMENT ON FUNCTION refresh_all_finance_mvs() IS 
  'Manually refresh all 3 finance intelligence materialized views. Returns status for each view. Used for on-demand refresh or troubleshooting.';

COMMENT ON FUNCTION get_finance_mv_refresh_status() IS 
  'Get last refresh time and row count for each finance MV. Used for monitoring dashboard health.';

COMMENT ON VIEW v_finance_mv_refresh_jobs IS 
  'Monitoring view showing cron job status and last run details for finance MV refresh jobs.';

-- Log successful setup
DO $$
BEGIN
  RAISE NOTICE 'Finance Intelligence auto-refresh jobs created successfully:';
  RAISE NOTICE '  - mv_monthly_pnl: refreshes at :05 past every hour';
  RAISE NOTICE '  - mv_cash_flow: refreshes at :15 past every hour';
  RAISE NOTICE '  - mv_budget_variance: refreshes at :25 past every hour';
  RAISE NOTICE 'Helper functions created: refresh_all_finance_mvs(), get_finance_mv_refresh_status()';
END $$;
