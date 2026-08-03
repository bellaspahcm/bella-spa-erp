-- =====================================================
-- Phase 5: Customer Experience & AI Decision (NPS/CSI)
-- Migration: Bella Auto - Survey, NPS, CSI, Health Score
-- =====================================================

-- =====================================================
-- 1. Survey Types & Templates
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_survey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Template Info
  name VARCHAR(200) NOT NULL,
  description TEXT,
  survey_type VARCHAR(50) NOT NULL, -- 'nps', 'csi', 'post_delivery', 'post_service', 'lost_analysis'
  trigger_event VARCHAR(100) NOT NULL, -- 'vehicle_delivered', 'service_completed', 'quotation_lost', etc.
  
  -- Survey Configuration
  questions JSONB NOT NULL DEFAULT '[]', -- Array of question objects
  is_active BOOLEAN DEFAULT true,
  auto_send BOOLEAN DEFAULT true, -- Auto-send when trigger fires
  send_delay_hours INT DEFAULT 24, -- Delay after trigger event
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_auto_survey_templates_tenant ON auto_survey_templates(tenant_id);
CREATE INDEX idx_auto_survey_templates_type ON auto_survey_templates(survey_type);
CREATE INDEX idx_auto_survey_templates_active ON auto_survey_templates(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE auto_survey_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_survey_templates_tenant_isolation ON auto_survey_templates
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 2. Survey Instances & Responses
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Survey Info
  template_id UUID REFERENCES auto_survey_templates(id) ON DELETE SET NULL,
  survey_type VARCHAR(50) NOT NULL,
  
  -- Customer & Context
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES auto_customer_journeys(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES auto_vehicles(id) ON DELETE SET NULL,
  
  -- Related Records
  delivery_id UUID, -- Reference to delivery record
  service_appointment_id UUID, -- Reference to service appointment
  quotation_id UUID, -- Reference to lost quotation
  
  -- Survey Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'partially_completed', 'completed', 'expired'
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Survey Data
  questions JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_surveys_tenant ON auto_surveys(tenant_id);
CREATE INDEX idx_auto_surveys_customer ON auto_surveys(customer_id);
CREATE INDEX idx_auto_surveys_journey ON auto_surveys(journey_id);
CREATE INDEX idx_auto_surveys_status ON auto_surveys(status);
CREATE INDEX idx_auto_surveys_type ON auto_surveys(survey_type);
CREATE INDEX idx_auto_surveys_sent_at ON auto_surveys(sent_at);

-- RLS
ALTER TABLE auto_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_surveys_tenant_isolation ON auto_surveys
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 3. Survey Responses
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Survey Reference
  survey_id UUID NOT NULL REFERENCES auto_surveys(id) ON DELETE CASCADE,
  
  -- Response Data
  question_id VARCHAR(100) NOT NULL, -- ID from template questions
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL, -- 'nps_score', 'rating', 'multiple_choice', 'text', 'yes_no'
  
  -- Answer
  answer_value TEXT, -- Numeric score, text answer, or choice ID
  answer_numeric NUMERIC(5,2), -- Numeric value for scores/ratings
  answer_text TEXT, -- Text responses
  
  -- Metadata
  responded_at TIMESTAMPTZ DEFAULT now(),
  response_source VARCHAR(50) DEFAULT 'web' -- 'web', 'email', 'sms', 'mobile_app'
);

-- Indexes
CREATE INDEX idx_auto_survey_responses_tenant ON auto_survey_responses(tenant_id);
CREATE INDEX idx_auto_survey_responses_survey ON auto_survey_responses(survey_id);
CREATE INDEX idx_auto_survey_responses_question ON auto_survey_responses(question_id);
CREATE INDEX idx_auto_survey_responses_responded_at ON auto_survey_responses(responded_at);

-- RLS
ALTER TABLE auto_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_survey_responses_tenant_isolation ON auto_survey_responses
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 4. NPS Scores (Net Promoter Score)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_nps_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Survey Reference
  survey_id UUID NOT NULL REFERENCES auto_surveys(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- NPS Data
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  category VARCHAR(20) NOT NULL, -- 'detractor' (0-6), 'passive' (7-8), 'promoter' (9-10)
  
  -- Context
  survey_type VARCHAR(50) NOT NULL, -- 'post_delivery', 'post_service'
  vehicle_id UUID REFERENCES auto_vehicles(id) ON DELETE SET NULL,
  journey_id UUID REFERENCES auto_customer_journeys(id) ON DELETE SET NULL,
  
  -- Feedback
  feedback_text TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_completed BOOLEAN DEFAULT false,
  
  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_nps_scores_tenant ON auto_nps_scores(tenant_id);
CREATE INDEX idx_auto_nps_scores_customer ON auto_nps_scores(customer_id);
CREATE INDEX idx_auto_nps_scores_score ON auto_nps_scores(score);
CREATE INDEX idx_auto_nps_scores_category ON auto_nps_scores(category);
CREATE INDEX idx_auto_nps_scores_recorded_at ON auto_nps_scores(recorded_at);
CREATE INDEX idx_auto_nps_scores_survey_type ON auto_nps_scores(survey_type);

-- RLS
ALTER TABLE auto_nps_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_nps_scores_tenant_isolation ON auto_nps_scores
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 5. CSI Scores (Customer Satisfaction Index)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_csi_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Survey Reference
  survey_id UUID NOT NULL REFERENCES auto_surveys(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- CSI Dimensions (Scale 1-5)
  sales_consultant_score NUMERIC(3,2) CHECK (sales_consultant_score >= 1 AND sales_consultant_score <= 5),
  facility_score NUMERIC(3,2) CHECK (facility_score >= 1 AND facility_score <= 5),
  delivery_timing_score NUMERIC(3,2) CHECK (delivery_timing_score >= 1 AND delivery_timing_score <= 5),
  vehicle_quality_score NUMERIC(3,2) CHECK (vehicle_quality_score >= 1 AND vehicle_quality_score <= 5),
  after_sales_score NUMERIC(3,2) CHECK (after_sales_score >= 1 AND after_sales_score <= 5),
  
  -- Overall CSI
  overall_csi NUMERIC(3,2) NOT NULL CHECK (overall_csi >= 1 AND overall_csi <= 5),
  
  -- Context
  survey_type VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES auto_vehicles(id) ON DELETE SET NULL,
  journey_id UUID REFERENCES auto_customer_journeys(id) ON DELETE SET NULL,
  
  -- Sales Consultant
  sales_consultant_id UUID ,
  
  -- Feedback
  positive_feedback TEXT,
  negative_feedback TEXT,
  improvement_suggestions TEXT,
  
  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_csi_scores_tenant ON auto_csi_scores(tenant_id);
CREATE INDEX idx_auto_csi_scores_customer ON auto_csi_scores(customer_id);
CREATE INDEX idx_auto_csi_scores_overall ON auto_csi_scores(overall_csi);
CREATE INDEX idx_auto_csi_scores_consultant ON auto_csi_scores(sales_consultant_id);
CREATE INDEX idx_auto_csi_scores_recorded_at ON auto_csi_scores(recorded_at);

-- RLS
ALTER TABLE auto_csi_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_csi_scores_tenant_isolation ON auto_csi_scores
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 6. Customer Health Scores
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Customer Reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Health Score Components (0-100)
  engagement_score INT CHECK (engagement_score >= 0 AND engagement_score <= 100),
  satisfaction_score INT CHECK (satisfaction_score >= 0 AND satisfaction_score <= 100),
  revenue_score INT CHECK (revenue_score >= 0 AND revenue_score <= 100),
  loyalty_score INT CHECK (loyalty_score >= 0 AND loyalty_score <= 100),
  
  -- Overall Health Score (0-100)
  overall_health_score INT NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status VARCHAR(20) NOT NULL, -- 'at_risk', 'needs_attention', 'healthy', 'excellent'
  
  -- Risk Factors
  risk_factors JSONB DEFAULT '[]', -- Array of identified risk factors
  
  -- Last Interactions
  last_purchase_date DATE,
  last_service_date DATE,
  last_interaction_date DATE,
  days_since_last_interaction INT,
  
  -- Calculation Metadata
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculation_version VARCHAR(20) DEFAULT 'v1.0',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one active score per customer
  UNIQUE(tenant_id, customer_id)
);

-- Indexes
CREATE INDEX idx_auto_customer_health_tenant ON auto_customer_health_scores(tenant_id);
CREATE INDEX idx_auto_customer_health_customer ON auto_customer_health_scores(customer_id);
CREATE INDEX idx_auto_customer_health_score ON auto_customer_health_scores(overall_health_score);
CREATE INDEX idx_auto_customer_health_status ON auto_customer_health_scores(health_status);
CREATE INDEX idx_auto_customer_health_calculated ON auto_customer_health_scores(calculated_at);

-- RLS
ALTER TABLE auto_customer_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_customer_health_scores_tenant_isolation ON auto_customer_health_scores
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 7. Next Best Action Recommendations
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_next_best_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Customer & Journey Context
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES auto_customer_journeys(id) ON DELETE SET NULL,
  
  -- Recommendation
  action_type VARCHAR(100) NOT NULL, -- 'follow_up_call', 'send_promotion', 'schedule_test_drive', 'offer_trade_in', etc.
  action_priority VARCHAR(20) NOT NULL, -- 'critical', 'high', 'medium', 'low'
  action_title VARCHAR(200) NOT NULL,
  action_description TEXT NOT NULL,
  
  -- AI Reasoning
  reason TEXT NOT NULL, -- Why this action is recommended
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- AI confidence 0-1
  
  -- Data Points Used
  data_points JSONB DEFAULT '{}', -- Key signals that triggered this recommendation
  
  -- Assignment
  assigned_to UUID ,
  assigned_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'dismissed'
  status_reason TEXT,
  
  -- Outcome
  completed_at TIMESTAMPTZ,
  outcome VARCHAR(50), -- 'successful', 'unsuccessful', 'no_response'
  outcome_notes TEXT,
  
  -- Expiration
  valid_until TIMESTAMPTZ,
  is_expired BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_next_best_actions_tenant ON auto_next_best_actions(tenant_id);
CREATE INDEX idx_auto_next_best_actions_customer ON auto_next_best_actions(customer_id);
CREATE INDEX idx_auto_next_best_actions_journey ON auto_next_best_actions(journey_id);
CREATE INDEX idx_auto_next_best_actions_status ON auto_next_best_actions(status);
CREATE INDEX idx_auto_next_best_actions_priority ON auto_next_best_actions(action_priority);
CREATE INDEX idx_auto_next_best_actions_assigned ON auto_next_best_actions(assigned_to);
CREATE INDEX idx_auto_next_best_actions_created ON auto_next_best_actions(created_at);

-- RLS
ALTER TABLE auto_next_best_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_next_best_actions_tenant_isolation ON auto_next_best_actions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 8. Lost Opportunity Analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_lost_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Customer & Journey Context
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES auto_customer_journeys(id) ON DELETE CASCADE,
  
  -- Lost Stage
  lost_at_stage VARCHAR(100) NOT NULL, -- Which journey stage was lost
  lost_date DATE NOT NULL,
  
  -- Primary Reason (from survey or sales input)
  primary_reason VARCHAR(100) NOT NULL, -- 'price_too_high', 'competitor_better_offer', 'changed_mind', 'bought_elsewhere', etc.
  secondary_reasons JSONB DEFAULT '[]',
  
  -- Competitor Info (if applicable)
  competitor_brand VARCHAR(100),
  competitor_model VARCHAR(100),
  competitor_price NUMERIC(15,2),
  price_difference NUMERIC(15,2), -- Our price - Competitor price
  
  -- Customer Feedback
  customer_feedback TEXT,
  
  -- AI Analysis
  ai_analyzed BOOLEAN DEFAULT false,
  ai_analysis_result JSONB DEFAULT '{}', -- AI-generated insights
  ai_prevention_suggestions JSONB DEFAULT '[]', -- What could have prevented this loss
  
  -- Sales Consultant
  sales_consultant_id UUID ,
  consultant_notes TEXT,
  
  -- Recovery Attempt
  recovery_attempted BOOLEAN DEFAULT false,
  recovery_outcome VARCHAR(50), -- 'recovered', 'failed', 'pending'
  recovery_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_lost_analysis_tenant ON auto_lost_analysis(tenant_id);
CREATE INDEX idx_auto_lost_analysis_customer ON auto_lost_analysis(customer_id);
CREATE INDEX idx_auto_lost_analysis_journey ON auto_lost_analysis(journey_id);
CREATE INDEX idx_auto_lost_analysis_stage ON auto_lost_analysis(lost_at_stage);
CREATE INDEX idx_auto_lost_analysis_reason ON auto_lost_analysis(primary_reason);
CREATE INDEX idx_auto_lost_analysis_date ON auto_lost_analysis(lost_date);
CREATE INDEX idx_auto_lost_analysis_consultant ON auto_lost_analysis(sales_consultant_id);

-- RLS
ALTER TABLE auto_lost_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_lost_analysis_tenant_isolation ON auto_lost_analysis
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 9. Trigger Functions
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_auto_experience_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_survey_templates_updated
  BEFORE UPDATE ON auto_survey_templates
  FOR EACH ROW EXECUTE FUNCTION update_auto_experience_timestamp();

CREATE TRIGGER auto_surveys_updated
  BEFORE UPDATE ON auto_surveys
  FOR EACH ROW EXECUTE FUNCTION update_auto_experience_timestamp();

CREATE TRIGGER auto_customer_health_scores_updated
  BEFORE UPDATE ON auto_customer_health_scores
  FOR EACH ROW EXECUTE FUNCTION update_auto_experience_timestamp();

CREATE TRIGGER auto_next_best_actions_updated
  BEFORE UPDATE ON auto_next_best_actions
  FOR EACH ROW EXECUTE FUNCTION update_auto_experience_timestamp();

CREATE TRIGGER auto_lost_analysis_updated
  BEFORE UPDATE ON auto_lost_analysis
  FOR EACH ROW EXECUTE FUNCTION update_auto_experience_timestamp();

-- Auto-categorize NPS score
CREATE OR REPLACE FUNCTION auto_categorize_nps_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score >= 0 AND NEW.score <= 6 THEN
    NEW.category = 'detractor';
  ELSIF NEW.score >= 7 AND NEW.score <= 8 THEN
    NEW.category = 'passive';
  ELSIF NEW.score >= 9 AND NEW.score <= 10 THEN
    NEW.category = 'promoter';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_nps_scores_categorize
  BEFORE INSERT OR UPDATE OF score ON auto_nps_scores
  FOR EACH ROW EXECUTE FUNCTION auto_categorize_nps_score();

-- Auto-determine health status
CREATE OR REPLACE FUNCTION auto_determine_health_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.overall_health_score >= 80 THEN
    NEW.health_status = 'excellent';
  ELSIF NEW.overall_health_score >= 60 THEN
    NEW.health_status = 'healthy';
  ELSIF NEW.overall_health_score >= 40 THEN
    NEW.health_status = 'needs_attention';
  ELSE
    NEW.health_status = 'at_risk';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_customer_health_status
  BEFORE INSERT OR UPDATE OF overall_health_score ON auto_customer_health_scores
  FOR EACH ROW EXECUTE FUNCTION auto_determine_health_status();

-- =====================================================
-- 10. Initial Survey Templates (Seed Data)
-- =====================================================

-- This will be populated via application code or manual insert
-- Example templates for NPS and CSI surveys

COMMENT ON TABLE auto_survey_templates IS 'Survey templates for NPS, CSI and other customer feedback';
COMMENT ON TABLE auto_surveys IS 'Individual survey instances sent to customers';
COMMENT ON TABLE auto_survey_responses IS 'Individual question responses from surveys';
COMMENT ON TABLE auto_nps_scores IS 'Net Promoter Score records from post-delivery and post-service surveys';
COMMENT ON TABLE auto_csi_scores IS 'Customer Satisfaction Index scores across multiple dimensions';
COMMENT ON TABLE auto_customer_health_scores IS 'Overall customer health scores based on engagement, satisfaction, and revenue';
COMMENT ON TABLE auto_next_best_actions IS 'AI-generated recommendations for sales team actions';
COMMENT ON TABLE auto_lost_analysis IS 'Analysis of lost opportunities with AI insights';


