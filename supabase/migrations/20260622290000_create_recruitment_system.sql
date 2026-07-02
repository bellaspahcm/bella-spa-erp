-- =====================================================================
-- Migration: Recruitment System Foundation
-- Created: 2026-06-22
-- Description: Creates tables for recruitment pipeline tracking
-- =====================================================================
-- 
-- Tables:
-- - recruitment_positions: Job openings and requirements
-- - recruitment_candidates: Applicant records
-- - recruitment_pipelines: Pipeline stages and workflow
-- - recruitment_interviews: Interview schedules and feedback
-- 
-- Features:
-- - Full tenant isolation with RLS
-- - Audit logging on all tables
-- - Status tracking through pipeline stages
-- - Cost tracking per hire
-- - Source effectiveness tracking
-- - Time-to-hire metrics
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. Create recruitment_positions table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recruitment_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Position details
  position_title TEXT NOT NULL,
  department TEXT NOT NULL, -- 'operations', 'admin', 'hr', 'sales', etc.
  role TEXT NOT NULL, -- 'ktv', 'receptionist', 'manager', 'accountant', etc.
  employment_type TEXT NOT NULL DEFAULT 'full_time', -- 'full_time', 'part_time', 'contract', 'intern'
  experience_level TEXT NOT NULL DEFAULT 'entry', -- 'entry', 'mid', 'senior', 'lead'
  
  -- Requirements
  required_skills TEXT[] DEFAULT '{}',
  required_certifications TEXT[] DEFAULT '{}',
  min_experience_years INTEGER DEFAULT 0,
  
  -- Compensation
  salary_min NUMERIC(12, 2),
  salary_max NUMERIC(12, 2),
  currency TEXT DEFAULT 'VND',
  
  -- Headcount
  headcount_target INTEGER NOT NULL DEFAULT 1,
  headcount_filled INTEGER NOT NULL DEFAULT 0,
  
  -- Description
  job_description TEXT,
  responsibilities TEXT,
  benefits TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'open', 'on_hold', 'closed', 'filled'
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT valid_headcount CHECK (headcount_filled <= headcount_target),
  CONSTRAINT valid_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

-- Indexes
CREATE INDEX idx_recruitment_positions_tenant ON recruitment_positions(tenant_id);
CREATE INDEX idx_recruitment_positions_status ON recruitment_positions(status) WHERE status IN ('open', 'on_hold');
CREATE INDEX idx_recruitment_positions_role ON recruitment_positions(role);

-- RLS Policies
ALTER TABLE recruitment_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_positions_tenant_isolation 
  ON recruitment_positions
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY recruitment_positions_service_role
  ON recruitment_positions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_positions TO authenticated;
GRANT ALL ON recruitment_positions TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Create recruitment_candidates table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES recruitment_positions(id) ON DELETE CASCADE,
  
  -- Personal info
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  
  -- Professional info
  current_company TEXT,
  current_title TEXT,
  years_of_experience INTEGER DEFAULT 0,
  education_level TEXT, -- 'high_school', 'associate', 'bachelor', 'master', 'doctorate'
  skills TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  
  -- Application
  resume_url TEXT,
  cover_letter TEXT,
  portfolio_url TEXT,
  linkedin_url TEXT,
  source TEXT NOT NULL DEFAULT 'direct', -- 'direct', 'referral', 'linkedin', 'facebook', 'job_board', 'agency', 'other'
  source_details TEXT, -- Referrer name, agency name, job board name, etc.
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Screening
  screening_status TEXT NOT NULL DEFAULT 'new', -- 'new', 'screening', 'shortlisted', 'rejected'
  screening_notes TEXT,
  screened_by UUID REFERENCES users(id),
  screened_at TIMESTAMPTZ,
  
  -- Pipeline stage
  current_stage TEXT NOT NULL DEFAULT 'applied', -- 'applied', 'phone_screen', 'technical_test', 'interview_1', 'interview_2', 'interview_final', 'offer', 'hired', 'rejected'
  stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Final status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'hired', 'rejected', 'withdrawn'
  rejection_reason TEXT,
  hired_at TIMESTAMPTZ,
  hired_as_user_id UUID REFERENCES users(id),
  
  -- Costs
  recruitment_cost NUMERIC(12, 2) DEFAULT 0, -- Agency fees, job board costs, etc.
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_recruitment_candidates_tenant ON recruitment_candidates(tenant_id);
CREATE INDEX idx_recruitment_candidates_position ON recruitment_candidates(position_id);
CREATE INDEX idx_recruitment_candidates_status ON recruitment_candidates(status);
CREATE INDEX idx_recruitment_candidates_stage ON recruitment_candidates(current_stage);
CREATE INDEX idx_recruitment_candidates_source ON recruitment_candidates(source);
CREATE INDEX idx_recruitment_candidates_applied_at ON recruitment_candidates(applied_at);

-- RLS Policies
ALTER TABLE recruitment_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_candidates_tenant_isolation 
  ON recruitment_candidates
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY recruitment_candidates_service_role
  ON recruitment_candidates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_candidates TO authenticated;
GRANT ALL ON recruitment_candidates TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Create recruitment_pipelines table (Stage transitions history)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recruitment_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  
  -- Stage transition
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transitioned_by UUID REFERENCES users(id),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recruitment_pipelines_tenant ON recruitment_pipelines(tenant_id);
CREATE INDEX idx_recruitment_pipelines_candidate ON recruitment_pipelines(candidate_id);
CREATE INDEX idx_recruitment_pipelines_transitioned_at ON recruitment_pipelines(transitioned_at);

-- RLS Policies
ALTER TABLE recruitment_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_pipelines_tenant_isolation 
  ON recruitment_pipelines
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY recruitment_pipelines_service_role
  ON recruitment_pipelines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE ON recruitment_pipelines TO authenticated;
GRANT ALL ON recruitment_pipelines TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Create recruitment_interviews table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recruitment_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES recruitment_candidates(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES recruitment_positions(id) ON DELETE CASCADE,
  
  -- Interview details
  interview_type TEXT NOT NULL DEFAULT 'phone', -- 'phone', 'video', 'in_person', 'technical', 'panel'
  interview_round INTEGER NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT, -- Office address or video call link
  
  -- Interviewers
  interviewer_ids UUID[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Feedback
  overall_rating INTEGER, -- 1-5 scale
  technical_rating INTEGER, -- 1-5 scale
  cultural_fit_rating INTEGER, -- 1-5 scale
  communication_rating INTEGER, -- 1-5 scale
  feedback_notes TEXT,
  recommendation TEXT, -- 'strong_yes', 'yes', 'maybe', 'no', 'strong_no'
  feedback_by UUID REFERENCES users(id),
  feedback_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT valid_ratings CHECK (
    (overall_rating IS NULL OR overall_rating BETWEEN 1 AND 5) AND
    (technical_rating IS NULL OR technical_rating BETWEEN 1 AND 5) AND
    (cultural_fit_rating IS NULL OR cultural_fit_rating BETWEEN 1 AND 5) AND
    (communication_rating IS NULL OR communication_rating BETWEEN 1 AND 5)
  )
);

-- Indexes
CREATE INDEX idx_recruitment_interviews_tenant ON recruitment_interviews(tenant_id);
CREATE INDEX idx_recruitment_interviews_candidate ON recruitment_interviews(candidate_id);
CREATE INDEX idx_recruitment_interviews_position ON recruitment_interviews(position_id);
CREATE INDEX idx_recruitment_interviews_scheduled_at ON recruitment_interviews(scheduled_at);
CREATE INDEX idx_recruitment_interviews_status ON recruitment_interviews(status);

-- RLS Policies
ALTER TABLE recruitment_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY recruitment_interviews_tenant_isolation 
  ON recruitment_interviews
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY recruitment_interviews_service_role
  ON recruitment_interviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_interviews TO authenticated;
GRANT ALL ON recruitment_interviews TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Triggers for updated_at
-- ─────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_recruitment_positions_updated_at
  BEFORE UPDATE ON recruitment_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_recruitment_candidates_updated_at
  BEFORE UPDATE ON recruitment_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_recruitment_interviews_updated_at
  BEFORE UPDATE ON recruitment_interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────
-- 6. Audit logging triggers
-- ─────────────────────────────────────────────────────────────────────

-- Enable audit logging if audit_log_changes function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_log_changes') THEN
    CREATE TRIGGER audit_recruitment_positions
      AFTER INSERT OR UPDATE OR DELETE ON recruitment_positions
      FOR EACH ROW
      EXECUTE FUNCTION audit_log_changes();
    
    CREATE TRIGGER audit_recruitment_candidates
      AFTER INSERT OR UPDATE OR DELETE ON recruitment_candidates
      FOR EACH ROW
      EXECUTE FUNCTION audit_log_changes();
    
    CREATE TRIGGER audit_recruitment_pipelines
      AFTER INSERT OR UPDATE OR DELETE ON recruitment_pipelines
      FOR EACH ROW
      EXECUTE FUNCTION audit_log_changes();
    
    CREATE TRIGGER audit_recruitment_interviews
      AFTER INSERT OR UPDATE OR DELETE ON recruitment_interviews
      FOR EACH ROW
      EXECUTE FUNCTION audit_log_changes();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Comments
-- ─────────────────────────────────────────────────────────────────────

COMMENT ON TABLE recruitment_positions IS 'Job openings and position requirements';
COMMENT ON TABLE recruitment_candidates IS 'Applicant records and screening status';
COMMENT ON TABLE recruitment_pipelines IS 'Pipeline stage transition history for candidates';
COMMENT ON TABLE recruitment_interviews IS 'Interview schedules and feedback';

COMMENT ON COLUMN recruitment_candidates.source IS 'Where the candidate came from (direct, referral, linkedin, facebook, job_board, agency, other)';
COMMENT ON COLUMN recruitment_candidates.current_stage IS 'Current pipeline stage (applied, phone_screen, technical_test, interview_1, interview_2, interview_final, offer, hired, rejected)';
COMMENT ON COLUMN recruitment_candidates.recruitment_cost IS 'Total cost to recruit this candidate (agency fees, job board costs, etc.)';
COMMENT ON COLUMN recruitment_interviews.recommendation IS 'Interviewer recommendation (strong_yes, yes, maybe, no, strong_no)';
