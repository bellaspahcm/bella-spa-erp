-- =====================================================================================
-- Bella Auto Phase 9: AI Center (Trí Tuệ Nhân Tạo & Báo Cáo Nâng Cao)
-- Migration: 20260803290000
-- 
-- Tables:
-- 1. auto_ai_insights - Store AI-generated insights and predictions
-- 2. auto_demand_forecasts - Demand forecasting data
-- 3. auto_churn_predictions - Service churn prediction scores
-- 4. auto_customer_lifetime_events - Comprehensive 10-year customer journey view
-- 
-- Features:
-- - AI Agent query history and results
-- - Demand forecasting by make/model/variant/color
-- - Churn prediction with confidence scores
-- - Customer lifetime journey aggregation
-- - AI model metadata tracking
-- 
-- Zero Regression: All tables prefixed with 'auto_', no core table modifications
-- =====================================================================================

-- =====================================================================================
-- TABLE: auto_ai_insights
-- Purpose: Store AI-generated insights, predictions, and query results
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_ai_insights (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Insight Type
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'ceo_query',           -- CEO natural language query
    'next_best_action',    -- Sales next best action
    'lost_analysis',       -- Lost deal analysis
    'performance_alert',   -- Performance anomaly detection
    'recommendation',      -- General AI recommendation
    'prediction'          -- Prediction result
  )),
  
  -- Query Information (for CEO queries)
  query_text TEXT,
  query_intent TEXT,
  query_parameters JSONB,
  
  -- Insight Content
  insight_title TEXT NOT NULL,
  insight_summary TEXT NOT NULL,
  insight_details JSONB,
  
  -- AI Model Information
  model_name TEXT,
  model_version TEXT,
  confidence_score NUMERIC(5, 4), -- 0.0000 to 1.0000
  
  -- Associated Entities
  customer_id UUID,
  journey_id UUID,
  sale_id UUID,
  lead_id UUID,
  
  -- Actions
  suggested_actions JSONB, -- Array of action objects
  action_taken BOOLEAN DEFAULT false,
  action_taken_at TIMESTAMPTZ,
  action_taken_by UUID,
  action_result TEXT,
  
  -- Priority & Status
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  expires_at TIMESTAMPTZ -- For time-sensitive insights
);

-- Indexes
CREATE INDEX idx_auto_ai_insights_tenant ON auto_ai_insights(tenant_id);
CREATE INDEX idx_auto_ai_insights_type ON auto_ai_insights(tenant_id, insight_type);
CREATE INDEX idx_auto_ai_insights_status ON auto_ai_insights(tenant_id, status);
CREATE INDEX idx_auto_ai_insights_priority ON auto_ai_insights(tenant_id, priority);
CREATE INDEX idx_auto_ai_insights_customer ON auto_ai_insights(customer_id);
CREATE INDEX idx_auto_ai_insights_journey ON auto_ai_insights(journey_id);
CREATE INDEX idx_auto_ai_insights_created ON auto_ai_insights(tenant_id, created_at DESC);

-- RLS Policies
ALTER TABLE auto_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_ai_insights_tenant_isolation ON auto_ai_insights
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_ai_insights_updated_at
  BEFORE UPDATE ON auto_ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_demand_forecasts
-- Purpose: Store demand forecasting predictions for inventory planning
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_demand_forecasts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Forecast Period
  forecast_date DATE NOT NULL,
  forecast_period TEXT NOT NULL CHECK (forecast_period IN ('daily', 'weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Vehicle Specification
  make TEXT NOT NULL,
  model TEXT,
  variant TEXT,
  color TEXT,
  
  -- Forecast Data
  predicted_demand INTEGER NOT NULL,
  predicted_demand_min INTEGER, -- Lower bound
  predicted_demand_max INTEGER, -- Upper bound
  confidence_level NUMERIC(5, 2), -- Percentage 0-100
  
  -- Current Inventory
  current_stock INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  
  -- Recommendation
  recommended_order_quantity INTEGER,
  recommended_order_date DATE,
  urgency TEXT CHECK (urgency IN ('normal', 'moderate', 'urgent')),
  
  -- Historical Context
  historical_avg_monthly_sales NUMERIC(8, 2),
  trend_direction TEXT CHECK (trend_direction IN ('increasing', 'stable', 'decreasing')),
  seasonality_factor NUMERIC(5, 4),
  
  -- AI Model Information
  model_name TEXT,
  model_version TEXT,
  model_accuracy NUMERIC(5, 4),
  
  -- Features Used (for explainability)
  features_used JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX idx_auto_demand_forecasts_tenant ON auto_demand_forecasts(tenant_id);
CREATE INDEX idx_auto_demand_forecasts_date ON auto_demand_forecasts(tenant_id, forecast_date DESC);
CREATE INDEX idx_auto_demand_forecasts_period ON auto_demand_forecasts(tenant_id, period_start, period_end);
CREATE INDEX idx_auto_demand_forecasts_vehicle ON auto_demand_forecasts(tenant_id, make, model);
CREATE INDEX idx_auto_demand_forecasts_urgency ON auto_demand_forecasts(tenant_id, urgency);
CREATE UNIQUE INDEX idx_auto_demand_forecasts_unique ON auto_demand_forecasts(
  tenant_id, forecast_date, forecast_period, make, 
  COALESCE(model, ''), COALESCE(variant, ''), COALESCE(color, '')
);

-- RLS Policies
ALTER TABLE auto_demand_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_demand_forecasts_tenant_isolation ON auto_demand_forecasts
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================================================
-- TABLE: auto_churn_predictions
-- Purpose: Predict which service customers are likely to churn
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_churn_predictions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Customer & Vehicle
  customer_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  
  -- Prediction
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  churn_probability NUMERIC(5, 4) NOT NULL, -- 0.0000 to 1.0000
  churn_risk_level TEXT NOT NULL CHECK (churn_risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Time to Churn (estimated days)
  estimated_days_to_churn INTEGER,
  
  -- Contributing Factors
  factors JSONB NOT NULL, -- Array of factor objects with weights
  primary_reason TEXT,
  
  -- Customer Metrics
  days_since_last_service INTEGER,
  total_service_visits INTEGER,
  average_visit_frequency_days NUMERIC(8, 2),
  total_lifetime_value NUMERIC(15, 2),
  average_repair_cost NUMERIC(12, 2),
  nps_score INTEGER,
  csi_score NUMERIC(5, 2),
  
  -- Recommended Actions
  recommended_actions JSONB, -- Array of retention actions
  retention_strategy TEXT,
  estimated_retention_cost NUMERIC(12, 2),
  
  -- AI Model Information
  model_name TEXT,
  model_version TEXT,
  model_confidence NUMERIC(5, 4),
  
  -- Action Tracking
  action_taken BOOLEAN DEFAULT false,
  action_date DATE,
  action_type TEXT,
  action_result TEXT CHECK (action_result IN ('retained', 'churned', 'pending')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'actioned', 'expired')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_churn_predictions_tenant ON auto_churn_predictions(tenant_id);
CREATE INDEX idx_auto_churn_predictions_customer ON auto_churn_predictions(customer_id);
CREATE INDEX idx_auto_churn_predictions_vehicle ON auto_churn_predictions(vehicle_id);
CREATE INDEX idx_auto_churn_predictions_risk ON auto_churn_predictions(tenant_id, churn_risk_level);
CREATE INDEX idx_auto_churn_predictions_probability ON auto_churn_predictions(tenant_id, churn_probability DESC);
CREATE INDEX idx_auto_churn_predictions_date ON auto_churn_predictions(tenant_id, prediction_date DESC);
CREATE INDEX idx_auto_churn_predictions_status ON auto_churn_predictions(tenant_id, status);

-- RLS Policies
ALTER TABLE auto_churn_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_churn_predictions_tenant_isolation ON auto_churn_predictions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_churn_predictions_updated_at
  BEFORE UPDATE ON auto_churn_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_customer_lifetime_events
-- Purpose: Comprehensive 10-year customer journey view (aggregated timeline)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_customer_lifetime_events (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Customer
  customer_id UUID NOT NULL,
  
  -- Event Information
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'first_contact',       -- Initial lead capture
    'test_drive',          -- Test drive completed
    'quotation_sent',      -- Quotation provided
    'deposit_paid',        -- Deposit received
    'vehicle_purchased',   -- Vehicle sale completed
    'vehicle_delivered',   -- Vehicle delivered
    'first_service',       -- First service visit
    'regular_service',     -- Regular maintenance
    'repair_visit',        -- Repair service
    'warranty_claim',      -- Warranty claim filed
    'insurance_renewal',   -- Insurance renewed
    'trade_in_inquiry',    -- Trade-in inquiry
    'trade_in_completed',  -- Trade-in completed
    'referral_made',       -- Customer referred someone
    'complaint',           -- Complaint filed
    'compliment',          -- Positive feedback
    'churn_warning',       -- Churn risk detected
    'win_back',           -- Re-engaged after churn
    'milestone'           -- Special milestone (5-year ownership, etc.)
  )),
  event_title TEXT NOT NULL,
  event_description TEXT,
  
  -- Associated Records
  journey_id UUID,
  sale_id UUID,
  vehicle_id UUID,
  service_appointment_id UUID,
  repair_order_id UUID,
  
  -- Financial Impact
  revenue_amount NUMERIC(15, 2),
  cost_amount NUMERIC(15, 2),
  profit_amount NUMERIC(15, 2),
  
  -- Sentiment & Satisfaction
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  nps_score INTEGER,
  csi_score NUMERIC(5, 2),
  
  -- Tags & Categories
  tags TEXT[], -- Array of tags for filtering
  is_milestone BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX idx_auto_customer_lifetime_events_tenant ON auto_customer_lifetime_events(tenant_id);
CREATE INDEX idx_auto_customer_lifetime_events_customer ON auto_customer_lifetime_events(customer_id);
CREATE INDEX idx_auto_customer_lifetime_events_date ON auto_customer_lifetime_events(tenant_id, customer_id, event_date DESC);
CREATE INDEX idx_auto_customer_lifetime_events_type ON auto_customer_lifetime_events(tenant_id, event_type);
CREATE INDEX idx_auto_customer_lifetime_events_vehicle ON auto_customer_lifetime_events(vehicle_id);
CREATE INDEX idx_auto_customer_lifetime_events_milestone ON auto_customer_lifetime_events(tenant_id, is_milestone) WHERE is_milestone = true;

-- RLS Policies
ALTER TABLE auto_customer_lifetime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_customer_lifetime_events_tenant_isolation ON auto_customer_lifetime_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================================================
-- RPC FUNCTIONS
-- =====================================================================================

-- Get active high-priority AI insights for dashboard
CREATE OR REPLACE FUNCTION get_active_ai_insights(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  insight_id UUID,
  insight_type TEXT,
  insight_title TEXT,
  insight_summary TEXT,
  priority TEXT,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id AS insight_id,
    ai.insight_type,
    ai.insight_title,
    ai.insight_summary,
    ai.priority,
    ai.confidence_score,
    ai.created_at
  FROM auto_ai_insights ai
  WHERE ai.tenant_id = p_tenant_id
    AND ai.status = 'new'
    AND (ai.expires_at IS NULL OR ai.expires_at > NOW())
  ORDER BY
    CASE ai.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    ai.created_at DESC
  LIMIT p_limit;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION get_active_ai_insights TO authenticated;

-- Get customer lifetime journey summary
CREATE OR REPLACE FUNCTION get_customer_lifetime_summary(
  p_tenant_id UUID,
  p_customer_id UUID
)
RETURNS TABLE (
  total_events INTEGER,
  first_contact_date DATE,
  years_as_customer NUMERIC,
  vehicles_purchased INTEGER,
  total_revenue NUMERIC,
  total_service_visits INTEGER,
  average_nps NUMERIC,
  average_csi NUMERIC,
  last_event_date DATE,
  last_event_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_events,
    MIN(event_date) AS first_contact_date,
    ROUND(EXTRACT(EPOCH FROM (MAX(event_date) - MIN(event_date))) / 31536000, 1) AS years_as_customer,
    COUNT(*) FILTER (WHERE event_type = 'vehicle_purchased')::INTEGER AS vehicles_purchased,
    COALESCE(SUM(revenue_amount), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE event_type IN ('first_service', 'regular_service', 'repair_visit'))::INTEGER AS total_service_visits,
    ROUND(AVG(nps_score), 2) AS average_nps,
    ROUND(AVG(csi_score), 2) AS average_csi,
    MAX(event_date) AS last_event_date,
    (SELECT event_type FROM auto_customer_lifetime_events 
     WHERE customer_id = p_customer_id AND tenant_id = p_tenant_id 
     ORDER BY event_date DESC LIMIT 1) AS last_event_type
  FROM auto_customer_lifetime_events
  WHERE tenant_id = p_tenant_id
    AND customer_id = p_customer_id;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION get_customer_lifetime_summary TO authenticated;

-- =====================================================================================
-- COMMENTS
-- =====================================================================================

COMMENT ON TABLE auto_ai_insights IS 'Phase 9: AI-generated insights, predictions, and CEO query results';
COMMENT ON TABLE auto_demand_forecasts IS 'Phase 9: Demand forecasting for inventory planning';
COMMENT ON TABLE auto_churn_predictions IS 'Phase 9: Service customer churn prediction scores';
COMMENT ON TABLE auto_customer_lifetime_events IS 'Phase 9: Comprehensive 10-year customer journey view';

COMMENT ON COLUMN auto_ai_insights.query_text IS 'CEO natural language query text';
COMMENT ON COLUMN auto_ai_insights.suggested_actions IS 'JSONB array of suggested action objects';
COMMENT ON COLUMN auto_demand_forecasts.features_used IS 'JSONB object of features used by model for explainability';
COMMENT ON COLUMN auto_churn_predictions.factors IS 'JSONB array of churn factor objects with weights';
COMMENT ON COLUMN auto_customer_lifetime_events.tags IS 'Array of tags for filtering and categorization';

COMMENT ON FUNCTION get_active_ai_insights IS 'Get active high-priority AI insights for dashboard';
COMMENT ON FUNCTION get_customer_lifetime_summary IS 'Get comprehensive customer lifetime summary statistics';

-- =====================================================================================
-- END OF MIGRATION
-- =====================================================================================
