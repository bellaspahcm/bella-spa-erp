-- Migration: Performance Optimization - Materialized View Refresh Tuning
-- Purpose: Optimize materialized view refresh strategies
-- Related: Phase 8 - Optimization & Production Readiness

-- ============================================================================
-- OPTIMIZE MV_FORECAST_ACCURACY REFRESH
-- ============================================================================
-- Current: Daily at 3:00 AM
-- Optimization: Add ANALYZE after refresh for better query plans

-- Drop existing job
SELECT cron.unschedule('refresh-mv-forecast-accuracy');

-- Recreate with optimization
SELECT cron.schedule(
  'refresh-mv-forecast-accuracy',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  DO $$
  DECLARE
    v_job_id UUID;
    v_rows_affected INTEGER;
    v_start_time TIMESTAMP;
  BEGIN
    v_start_time := clock_timestamp();
    
    -- Create job record
    INSERT INTO public.mv_forecast_accuracy_refresh_jobs (status)
    VALUES ('running')
    RETURNING id INTO v_job_id;
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_forecast_accuracy;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- ANALYZE table for better query plans
    ANALYZE public.mv_forecast_accuracy;
    
    -- Update job record
    UPDATE public.mv_forecast_accuracy_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'completed',
      rows_affected = v_rows_affected
    WHERE id = v_job_id;
    
    -- Log performance
    RAISE NOTICE 'mv_forecast_accuracy refreshed: % rows in % ms', 
      v_rows_affected, 
      EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time);
    
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.mv_forecast_accuracy_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'failed',
      error_message = SQLERRM
    WHERE id = v_job_id;
    
    RAISE;
  END $$;
  $$
);

