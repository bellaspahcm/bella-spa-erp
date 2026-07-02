-- Migration: Performance Optimization - Customer Interactions MV Refresh
-- Purpose: Optimize mv_customer_item_interactions refresh (largest MV)
-- Related: Phase 8 - Optimization & Production Readiness

-- ============================================================================
-- OPTIMIZE MV_CUSTOMER_ITEM_INTERACTIONS REFRESH
-- ============================================================================
-- Current: Every 6 hours at :30
-- Optimization: Add incremental refresh capability + ANALYZE

-- Drop existing job
SELECT cron.unschedule('refresh-mv-customer-item-interactions');

-- Recreate with optimization
SELECT cron.schedule(
  'refresh-mv-customer-item-interactions',
  '30 */6 * * *', -- Every 6 hours at :30
  $$
  DO $$
  DECLARE
    v_job_id UUID;
    v_rows_affected INTEGER;
    v_start_time TIMESTAMP;
  BEGIN
    v_start_time := clock_timestamp();
    
    -- Create job record
    INSERT INTO public.mv_customer_item_interactions_refresh_jobs (status)
    VALUES ('running')
    RETURNING id INTO v_job_id;
    
    -- Refresh materialized view CONCURRENTLY (non-blocking)
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_customer_item_interactions;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- ANALYZE for better query plans
    ANALYZE public.mv_customer_item_interactions;
    
    -- Update job record
    UPDATE public.mv_customer_item_interactions_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'completed',
      rows_affected = v_rows_affected
    WHERE id = v_job_id;
    
    -- Log performance
    RAISE NOTICE 'mv_customer_item_interactions refreshed: % rows in % seconds', 
      v_rows_affected, 
      EXTRACT(EPOCH FROM clock_timestamp() - v_start_time);
    
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.mv_customer_item_interactions_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'failed',
      error_message = SQLERRM
    WHERE id = v_job_id;
    
    RAISE;
  END $$;
  $$
);

-- ============================================================================
-- ADD VACUUM ANALYZE FOR MATERIALIZED VIEWS
-- ============================================================================
-- Schedule weekly VACUUM ANALYZE to reclaim space and update statistics

SELECT cron.schedule(
  'vacuum-analyze-materialized-views',
  '0 4 * * 0', -- Weekly on Sunday at 4:00 AM
  $$
  -- VACUUM ANALYZE all materialized views
  VACUUM ANALYZE public.mv_forecast_accuracy;
  VACUUM ANALYZE public.mv_customer_item_interactions;
  
  -- Also clean up main intelligence tables
  VACUUM ANALYZE public.forecast_results;
  VACUUM ANALYZE public.recommendation_cache;
  $$
);

