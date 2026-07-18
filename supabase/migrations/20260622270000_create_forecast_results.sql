-- Migration: Create Forecast Results Table
-- Purpose: Store forecast outputs from various forecasting models
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- FORECAST RESULTS TABLE
-- ============================================================================
-- Stores historical and future forecast data for revenue, churn, demand
-- Supports multiple forecast types and models with confidence intervals

CREATE TABLE IF NOT EXISTS public.forecast_results (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Forecast metadata
  forecast_type VARCHAR(50) NOT NULL, -- 'revenue', 'churn', 'demand'
  model_version VARCHAR(50) NOT NULL, -- e.g., 'v1.0', 'v2.1'
  model_name VARCHAR(100) NOT NULL, -- e.g., 'arima', 'logistic_regression', 'prophet'
  
  -- Forecast period
  forecast_date DATE NOT NULL, -- The date being forecasted
  forecast_horizon INTEGER NOT NULL, -- How many days/months ahead (1-12 for revenue, 30/60/90 for churn)
  
  -- Forecast values
  predicted_value NUMERIC(12, 2), -- Main prediction (revenue amount, churn probability 0-1, demand count)
  confidence_lower NUMERIC(12, 2), -- Lower bound of confidence interval
  confidence_upper NUMERIC(12, 2), -- Upper bound of confidence interval
  confidence_level NUMERIC(3, 2) DEFAULT 0.95, -- Confidence level (0.80, 0.90, 0.95)
  
  -- Actual values (for accuracy tracking)
  actual_value NUMERIC(12, 2), -- Actual value when available
  accuracy_error NUMERIC(12, 4), -- Absolute error |predicted - actual|
  accuracy_pct NUMERIC(5, 2), -- Percentage accuracy (100 - |error/actual| * 100)
  
  -- Additional context
  features JSONB, -- Input features used for this forecast
  metadata JSONB, -- Additional model metadata (hyperparameters, data range, etc.)
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT forecast_results_type_check CHECK (forecast_type IN ('revenue', 'churn', 'demand')),
  CONSTRAINT forecast_results_horizon_check CHECK (forecast_horizon > 0),
  CONSTRAINT forecast_results_confidence_check CHECK (confidence_level >= 0 AND confidence_level <= 1),
  CONSTRAINT forecast_results_churn_probability_check CHECK (
    forecast_type != 'churn' OR (predicted_value >= 0 AND predicted_value <= 1)
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query patterns
CREATE INDEX idx_forecast_results_tenant_type_date 
  ON public.forecast_results(tenant_id, forecast_type, forecast_date DESC);

CREATE INDEX idx_forecast_results_tenant_model 
  ON public.forecast_results(tenant_id, model_name, model_version);

-- For accuracy tracking queries
CREATE INDEX idx_forecast_results_accuracy 
  ON public.forecast_results(tenant_id, forecast_type, created_at DESC)
  WHERE actual_value IS NOT NULL;

-- For horizon-based queries
CREATE INDEX idx_forecast_results_horizon 
  ON public.forecast_results(tenant_id, forecast_type, forecast_horizon);

-- Unique index to support upsert on conflict
CREATE UNIQUE INDEX idx_forecast_results_upsert_key 
  ON public.forecast_results(tenant_id, forecast_type, model_name, model_version, forecast_date, forecast_horizon);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.forecast_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see forecasts for their tenant
CREATE POLICY forecast_results_select_policy ON public.forecast_results
  FOR SELECT
  USING (is_hq_super_admin() OR tenant_id = get_auth_tenant_id());

CREATE POLICY forecast_results_all_policy ON public.forecast_results
  FOR ALL
  USING (is_hq_super_admin() OR (tenant_id = get_auth_tenant_id() AND current_user_role() = 'admin'));

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE TRIGGER set_forecast_results_updated_at
  BEFORE UPDATE ON public.forecast_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.forecast_results IS 
  'Stores forecast outputs from various forecasting models (revenue, churn, demand) with confidence intervals and accuracy tracking';

COMMENT ON COLUMN public.forecast_results.forecast_type IS 
  'Type of forecast: revenue (monthly revenue), churn (customer churn probability), demand (service/package demand)';

COMMENT ON COLUMN public.forecast_results.model_version IS 
  'Version of the model used for this forecast (for A/B testing and model comparison)';

COMMENT ON COLUMN public.forecast_results.forecast_horizon IS 
  'How many days/months ahead: 1-12 for revenue, 30/60/90 for churn, 1-4 weeks for demand';

COMMENT ON COLUMN public.forecast_results.predicted_value IS 
  'Main prediction: revenue amount (VND), churn probability (0-1), or demand count (number of bookings)';

COMMENT ON COLUMN public.forecast_results.confidence_lower IS 
  'Lower bound of confidence interval (same unit as predicted_value)';

COMMENT ON COLUMN public.forecast_results.confidence_upper IS 
  'Upper bound of confidence interval (same unit as predicted_value)';

COMMENT ON COLUMN public.forecast_results.actual_value IS 
  'Actual value when available (populated after forecast_date passes for accuracy tracking)';

COMMENT ON COLUMN public.forecast_results.accuracy_error IS 
  'Absolute error between predicted and actual value';

COMMENT ON COLUMN public.forecast_results.accuracy_pct IS 
  'Percentage accuracy: 100 - (|error/actual| * 100)';

COMMENT ON COLUMN public.forecast_results.features IS 
  'JSONB object containing input features used for this forecast (for debugging and reproducibility)';

COMMENT ON COLUMN public.forecast_results.metadata IS 
  'Additional model metadata: hyperparameters, training data range, feature importance, etc.';
