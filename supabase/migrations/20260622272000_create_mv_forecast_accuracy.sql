-- Migration: Create Materialized View for Forecast Accuracy Tracking
-- Purpose: Track accuracy of all forecasting models over time
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- MATERIALIZED VIEW: Forecast Accuracy Summary
-- ============================================================================
-- Aggregates forecast accuracy metrics by model, type, and horizon
-- Used for model comparison and performance monitoring

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_forecast_accuracy AS
WITH forecast_with_actual AS (
  SELECT
    tenant_id,
    forecast_type,
    model_name,
    model_version,
    forecast_horizon,
    forecast_date,
    predicted_value,
    actual_value,
    confidence_lower,
    confidence_upper,
    confidence_level,
    accuracy_error,
    accuracy_pct,
    created_at,
    -- Calculate additional accuracy metrics
    CASE 
      WHEN actual_value IS NOT NULL AND actual_value != 0 THEN
        ABS((predicted_value - actual_value) / actual_value) * 100
      ELSE NULL
    END AS mape, -- Mean Absolute Percentage Error
    CASE
      WHEN actual_value IS NOT NULL THEN
        CASE 
          WHEN actual_value BETWEEN confidence_lower AND confidence_upper THEN TRUE
          ELSE FALSE
        END
      ELSE NULL
    END AS within_confidence_interval
  FROM public.forecast_results
  WHERE actual_value IS NOT NULL -- Only include forecasts that can be validated
),
accuracy_summary AS (
  SELECT
    tenant_id,
    forecast_type,
    model_name,
    model_version,
    forecast_horizon,
    
    -- Count metrics
    COUNT(*) AS total_forecasts,
    COUNT(CASE WHEN within_confidence_interval THEN 1 END) AS forecasts_within_ci,
    
    -- Accuracy metrics
    AVG(accuracy_pct) AS avg_accuracy_pct,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_pct) AS median_accuracy_pct,
    MIN(accuracy_pct) AS min_accuracy_pct,
    MAX(accuracy_pct) AS max_accuracy_pct,
    
    -- Error metrics
    AVG(accuracy_error) AS avg_error,
    AVG(mape) AS avg_mape,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_error) AS median_error,
    STDDEV(accuracy_error) AS stddev_error,
    
    -- Confidence interval coverage
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(CASE WHEN within_confidence_interval THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END AS ci_coverage_pct,
    
    -- Bias metrics (systematic over/under prediction)
    AVG(predicted_value - actual_value) AS avg_bias,
    CASE
      WHEN AVG(actual_value) != 0 THEN
        (AVG(predicted_value - actual_value) / AVG(actual_value)) * 100
      ELSE 0
    END AS avg_bias_pct,
    
    -- Recent performance (last 30 days)
    AVG(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN accuracy_pct END) AS recent_accuracy_pct,
    AVG(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN accuracy_error END) AS recent_error,
    
    -- Time range
    MIN(forecast_date) AS earliest_forecast_date,
    MAX(forecast_date) AS latest_forecast_date,
    MAX(created_at) AS last_updated
    
  FROM forecast_with_actual
  GROUP BY tenant_id, forecast_type, model_name, model_version, forecast_horizon
),
model_ranking AS (
  SELECT
    *,
    -- Rank models by accuracy within each forecast type and horizon
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, forecast_type, forecast_horizon 
      ORDER BY avg_accuracy_pct DESC, avg_mape ASC
    ) AS accuracy_rank,
    -- Identify best model for each type/horizon
    CASE
      WHEN ROW_NUMBER() OVER (
        PARTITION BY tenant_id, forecast_type, forecast_horizon 
        ORDER BY avg_accuracy_pct DESC, avg_mape ASC
      ) = 1 THEN TRUE
      ELSE FALSE
    END AS is_best_model
  FROM accuracy_summary
)
SELECT
  tenant_id,
  forecast_type,
  model_name,
  model_version,
  forecast_horizon,
  total_forecasts,
  forecasts_within_ci,
  ROUND(avg_accuracy_pct, 2) AS avg_accuracy_pct,
  ROUND(median_accuracy_pct, 2) AS median_accuracy_pct,
  ROUND(min_accuracy_pct, 2) AS min_accuracy_pct,
  ROUND(max_accuracy_pct, 2) AS max_accuracy_pct,
  ROUND(avg_error, 2) AS avg_error,
  ROUND(avg_mape, 2) AS avg_mape,
  ROUND(median_error, 2) AS median_error,
  ROUND(stddev_error, 2) AS stddev_error,
  ROUND(ci_coverage_pct, 2) AS ci_coverage_pct,
  ROUND(avg_bias, 2) AS avg_bias,
  ROUND(avg_bias_pct, 2) AS avg_bias_pct,
  ROUND(recent_accuracy_pct, 2) AS recent_accuracy_pct,
  ROUND(recent_error, 2) AS recent_error,
  earliest_forecast_date,
  latest_forecast_date,
  last_updated,
  accuracy_rank,
  is_best_model
FROM model_ranking
ORDER BY tenant_id, forecast_type, accuracy_rank;

-- ============================================================================
-- INDEXES for mv_forecast_accuracy
-- ============================================================================

CREATE UNIQUE INDEX idx_mv_forecast_accuracy_unique 
  ON public.mv_forecast_accuracy(tenant_id, forecast_type, model_name, model_version, forecast_horizon);

CREATE INDEX idx_mv_forecast_accuracy_tenant_type 
  ON public.mv_forecast_accuracy(tenant_id, forecast_type, accuracy_rank);

CREATE INDEX idx_mv_forecast_accuracy_best_models 
  ON public.mv_forecast_accuracy(tenant_id, forecast_type, forecast_horizon)
  WHERE is_best_model = TRUE;

-- ============================================================================
-- SCHEDULED REFRESH JOB
-- ============================================================================
-- Refresh daily at 3:00 AM (after actual values are populated)

CREATE TABLE IF NOT EXISTS public.mv_forecast_accuracy_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  rows_affected INTEGER,
  error_message TEXT,
  CONSTRAINT mv_forecast_accuracy_refresh_jobs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_mv_forecast_accuracy_refresh_jobs_status 
  ON public.mv_forecast_accuracy_refresh_jobs(started_at DESC, status);

-- Schedule daily refresh at 3:00 AM
SELECT cron.schedule(
  'refresh-mv-forecast-accuracy',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  DO $$
  DECLARE
    v_job_id UUID;
    v_rows_affected INTEGER;
  BEGIN
    -- Create job record
    INSERT INTO public.mv_forecast_accuracy_refresh_jobs (status)
    VALUES ('running')
    RETURNING id INTO v_job_id;
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_forecast_accuracy;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- Update job record
    UPDATE public.mv_forecast_accuracy_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'completed',
      rows_affected = v_rows_affected
    WHERE id = v_job_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error
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

-- ============================================================================
-- FUNCTION: Get Best Model for Forecast Type
-- ============================================================================
-- Returns the best-performing model for a given forecast type and horizon

CREATE OR REPLACE FUNCTION public.get_best_forecast_model(
  p_tenant_id UUID,
  p_forecast_type VARCHAR(50),
  p_forecast_horizon INTEGER
)
RETURNS TABLE (
  model_name VARCHAR(100),
  model_version VARCHAR(50),
  avg_accuracy_pct NUMERIC,
  avg_mape NUMERIC,
  total_forecasts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mfa.model_name,
    mfa.model_version,
    mfa.avg_accuracy_pct,
    mfa.avg_mape,
    mfa.total_forecasts
  FROM public.mv_forecast_accuracy mfa
  WHERE 
    mfa.tenant_id = p_tenant_id
    AND mfa.forecast_type = p_forecast_type
    AND mfa.forecast_horizon = p_forecast_horizon
    AND mfa.is_best_model = TRUE
  LIMIT 1;
END;
$$;

-- ============================================================================
-- FUNCTION: Compare Model Performance
-- ============================================================================
-- Compares accuracy of multiple models for A/B testing

CREATE OR REPLACE FUNCTION public.compare_forecast_models(
  p_tenant_id UUID,
  p_forecast_type VARCHAR(50),
  p_forecast_horizon INTEGER
)
RETURNS TABLE (
  model_name VARCHAR(100),
  model_version VARCHAR(50),
  avg_accuracy_pct NUMERIC,
  avg_mape NUMERIC,
  ci_coverage_pct NUMERIC,
  total_forecasts BIGINT,
  recent_accuracy_pct NUMERIC,
  accuracy_rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mfa.model_name,
    mfa.model_version,
    mfa.avg_accuracy_pct,
    mfa.avg_mape,
    mfa.ci_coverage_pct,
    mfa.total_forecasts,
    mfa.recent_accuracy_pct,
    mfa.accuracy_rank
  FROM public.mv_forecast_accuracy mfa
  WHERE 
    mfa.tenant_id = p_tenant_id
    AND mfa.forecast_type = p_forecast_type
    AND mfa.forecast_horizon = p_forecast_horizon
  ORDER BY mfa.accuracy_rank;
END;
$$;

-- ============================================================================
-- FUNCTION: Update Forecast Accuracy
-- ============================================================================
-- Updates accuracy metrics when actual values become available

CREATE OR REPLACE FUNCTION public.update_forecast_accuracy(
  p_forecast_id UUID,
  p_actual_value NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_predicted_value NUMERIC;
  v_accuracy_error NUMERIC;
  v_accuracy_pct NUMERIC;
BEGIN
  -- Get predicted value
  SELECT predicted_value INTO v_predicted_value
  FROM public.forecast_results
  WHERE id = p_forecast_id;
  
  -- Calculate accuracy metrics
  v_accuracy_error := ABS(v_predicted_value - p_actual_value);
  
  IF p_actual_value != 0 THEN
    v_accuracy_pct := 100 - ((v_accuracy_error / ABS(p_actual_value)) * 100);
  ELSE
    v_accuracy_pct := CASE WHEN v_accuracy_error = 0 THEN 100 ELSE 0 END;
  END IF;
  
  -- Update forecast result
  UPDATE public.forecast_results
  SET
    actual_value = p_actual_value,
    accuracy_error = v_accuracy_error,
    accuracy_pct = v_accuracy_pct,
    updated_at = NOW()
  WHERE id = p_forecast_id;
  
  -- Note: Materialized view will be refreshed by scheduled job
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW public.mv_forecast_accuracy IS 
  'Tracks accuracy of all forecasting models (revenue, churn, demand) over time for model comparison and performance monitoring';

COMMENT ON COLUMN public.mv_forecast_accuracy.avg_accuracy_pct IS 
  'Average accuracy percentage: 100 - (|error/actual| * 100)';

COMMENT ON COLUMN public.mv_forecast_accuracy.avg_mape IS 
  'Average Mean Absolute Percentage Error (lower is better)';

COMMENT ON COLUMN public.mv_forecast_accuracy.ci_coverage_pct IS 
  'Percentage of forecasts where actual value fell within confidence interval (should be ~95% for 95% CI)';

COMMENT ON COLUMN public.mv_forecast_accuracy.avg_bias IS 
  'Average bias (systematic over/under prediction): positive = over-prediction, negative = under-prediction';

COMMENT ON COLUMN public.mv_forecast_accuracy.avg_bias_pct IS 
  'Average bias as percentage of actual values';

COMMENT ON COLUMN public.mv_forecast_accuracy.recent_accuracy_pct IS 
  'Average accuracy in last 30 days (for detecting model drift)';

COMMENT ON COLUMN public.mv_forecast_accuracy.is_best_model IS 
  'TRUE if this is the best-performing model for this forecast type and horizon';

COMMENT ON FUNCTION public.get_best_forecast_model IS 
  'Returns the best-performing model for a given forecast type and horizon';

COMMENT ON FUNCTION public.compare_forecast_models IS 
  'Compares accuracy of all models for a forecast type and horizon (for A/B testing)';

COMMENT ON FUNCTION public.update_forecast_accuracy IS 
  'Updates accuracy metrics when actual values become available';
