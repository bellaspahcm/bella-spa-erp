-- ============================================================================
-- Partner Registration System Migration
-- Version: 1.0
-- Date: 2026-08-02
-- Purpose: Implement hybrid approval model for partner registration
-- 
-- Tables Created:
--   - partner_applications (registration requests)
--   - partner_application_logs (audit trail)
--
-- Features:
--   - Multi-step registration (draft → verified → approved → provisioned)
--   - Document upload support
--   - Email verification
--   - Admin approval workflow
--   - Full audit logging
--   - RLS policies for data isolation
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Application status lifecycle
CREATE TYPE partner_application_status AS ENUM (
  'draft',                -- Initial state, incomplete
  'pending_verification', -- Submitted, awaiting email verification
  'need_more_info',       -- Admin requests additional info
  'approved',             -- Admin approved, awaiting provisioning
  'rejected',             -- Admin rejected
  'provisioned',          -- Tenant + User created
  'activated'             -- Partner activated account (final state)
);

-- Applicant type
CREATE TYPE partner_applicant_type AS ENUM (
  'individual_broker',    -- Individual real estate broker
  'agency',               -- Real estate agency
  'company'               -- Real estate company
);

-- Application log action types
CREATE TYPE partner_application_log_action AS ENUM (
  'created',
  'submitted',
  'email_verified',
  'document_uploaded',
  'info_requested',
  'resubmitted',
  'approved',
  'rejected',
  'provisioned',
  'activated',
  'status_changed',
  'comment_added'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Partner Applications (Registration Requests)
CREATE TABLE partner_applications (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Type Classification
  registration_type TEXT NOT NULL DEFAULT 'partner', -- For future: employee, customer, etc.
  applicant_type partner_applicant_type NOT NULL,
  
  -- Applicant Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Organization Info (for agency/company)
  company_name TEXT,
  tax_code TEXT,
  business_license TEXT,
  
  -- Address
  address TEXT,
  city TEXT,
  district TEXT,
  ward TEXT,
  
  -- Documents (JSONB array of {type, url, uploaded_at})
  documents JSONB DEFAULT '[]'::JSONB,
  
  -- Email Verification
  email_verified_at TIMESTAMPTZ,
  email_verification_token TEXT,
  email_verification_token_expires_at TIMESTAMPTZ,
  
  -- Phone Verification (future)
  phone_verified_at TIMESTAMPTZ,
  phone_verification_token TEXT,
  
  -- Status & Lifecycle
  status partner_application_status NOT NULL DEFAULT 'draft',
  
  -- Submission
  submitted_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  
  -- Admin Review
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approval_notes TEXT,
  
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  rejection_category TEXT, -- 'invalid_docs', 'duplicate', 'policy_violation', 'other'
  
  -- Info Request
  info_request_message TEXT,
  info_request_fields JSONB, -- Array of field names to update
  info_requested_at TIMESTAMPTZ,
  info_requested_by UUID REFERENCES auth.users(id),
  
  -- Provisioning Result
  organization_id UUID, -- Will reference organizations(id) when table exists
  tenant_id UUID, -- Will reference tenants(id) when table exists
  identity_id UUID, -- Will reference identities table (to be created)
  
  -- Activation
  activation_token TEXT,
  activation_token_expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  
  -- AI Review (future integration)
  ai_review_id UUID, -- Will reference ai_reviews table
  ai_fraud_score NUMERIC(3,2), -- 0.00-1.00
  ai_risk_score NUMERIC(3,2),
  ai_recommendation TEXT, -- 'AUTO_APPROVE', 'MANUAL_REVIEW', 'AUTO_REJECT'
  
  -- Extensibility
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT phone_format CHECK (phone ~* '^\+?[0-9]{10,15}$'),
  CONSTRAINT email_verified_before_approval CHECK (
    status != 'approved' OR email_verified_at IS NOT NULL
  ),
  CONSTRAINT tax_code_required_for_org CHECK (
    applicant_type = 'individual_broker' OR tax_code IS NOT NULL
  )
);

-- Comments
COMMENT ON TABLE partner_applications IS 'Partner registration applications with approval workflow';
COMMENT ON COLUMN partner_applications.documents IS 'Array of {type: string, url: string, uploaded_at: timestamp}';
COMMENT ON COLUMN partner_applications.metadata IS 'Extensible JSON field for industry-specific data';

-- Indexes
CREATE INDEX idx_partner_applications_email ON partner_applications(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_partner_applications_status ON partner_applications(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_partner_applications_submitted_at ON partner_applications(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX idx_partner_applications_tenant ON partner_applications(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_partner_applications_identity ON partner_applications(identity_id) WHERE identity_id IS NOT NULL;
CREATE INDEX idx_partner_applications_created_at ON partner_applications(created_at);

-- Full-text search index for name/email/company
CREATE INDEX idx_partner_applications_search ON partner_applications 
USING gin(to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(company_name, '')))
WHERE deleted_at IS NULL;

-- ============================================================================
-- Partner Application Logs (Audit Trail)
CREATE TABLE partner_application_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign Key
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  
  -- Action
  action partner_application_log_action NOT NULL,
  action_description TEXT,
  
  -- Performer
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT, -- Denormalized for audit
  performed_by_role TEXT, -- 'system', 'admin', 'partner'
  
  -- Details
  old_status partner_application_status,
  new_status partner_application_status,
  changes JSONB, -- {field: {old: value, new: value}}
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE partner_application_logs IS 'Immutable audit log for all partner application actions';
COMMENT ON COLUMN partner_application_logs.changes IS 'Field-level change tracking';

-- Indexes
CREATE INDEX idx_partner_application_logs_application ON partner_application_logs(application_id);
CREATE INDEX idx_partner_application_logs_action ON partner_application_logs(action);
CREATE INDEX idx_partner_application_logs_created_at ON partner_application_logs(created_at);
CREATE INDEX idx_partner_application_logs_performed_by ON partner_application_logs(performed_by) WHERE performed_by IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_partner_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partner_application_updated_at
  BEFORE UPDATE ON partner_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_application_updated_at();

-- Auto-log status changes
CREATE OR REPLACE FUNCTION log_partner_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO partner_application_logs (
      application_id,
      action,
      action_description,
      performed_by,
      old_status,
      new_status,
      created_at
    ) VALUES (
      NEW.id,
      'status_changed',
      format('Status changed from %s to %s', OLD.status, NEW.status),
      NEW.updated_by,
      OLD.status,
      NEW.status,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_partner_application_status_change
  AFTER UPDATE ON partner_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_partner_application_status_change();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Public can create draft applications (self-registration)
CREATE POLICY "Public can create partner applications"
  ON partner_applications
  FOR INSERT
  TO public
  WITH CHECK (status = 'draft');

-- Policy: Applicants can view their own applications
CREATE POLICY "Applicants can view own applications"
  ON partner_applications
  FOR SELECT
  TO public
  USING (
    email = current_setting('request.jwt.claims', true)::json->>'email'
    OR id::text = current_setting('request.jwt.claims', true)::json->>'application_id'
  );

-- Policy: Applicants can update their draft/need_more_info applications
CREATE POLICY "Applicants can update own draft applications"
  ON partner_applications
  FOR UPDATE
  TO public
  USING (
    (email = current_setting('request.jwt.claims', true)::json->>'email')
    AND (status IN ('draft', 'need_more_info'))
  )
  WITH CHECK (
    (email = current_setting('request.jwt.claims', true)::json->>'email')
    AND (status IN ('draft', 'pending_verification', 'need_more_info'))
  );

-- Policy: Admins can view all applications (TODO: Add user_roles check when table exists)
CREATE POLICY "Admins can view all applications"
  ON partner_applications
  FOR SELECT
  TO authenticated
  USING (true); -- Temporarily allow all authenticated users

-- Policy: Admins can update applications (TODO: Add user_roles check when table exists)
CREATE POLICY "Admins can update applications"
  ON partner_applications
  FOR UPDATE
  TO authenticated
  USING (true); -- Temporarily allow all authenticated users

-- Policy: Admins can view all logs (TODO: Add user_roles check when table exists)
CREATE POLICY "Admins can view all logs"
  ON partner_application_logs
  FOR SELECT
  TO authenticated
  USING (true); -- Temporarily allow all authenticated users

-- Policy: System can insert logs (trigger-based)
CREATE POLICY "System can insert logs"
  ON partner_application_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate email verification token
CREATE OR REPLACE FUNCTION generate_email_verification_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate activation token
CREATE OR REPLACE FUNCTION generate_activation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify email for application
CREATE OR REPLACE FUNCTION verify_partner_application_email(
  p_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_application partner_applications%ROWTYPE;
BEGIN
  -- Find application by token
  SELECT * INTO v_application
  FROM partner_applications
  WHERE email_verification_token = p_token
    AND email_verification_token_expires_at > NOW()
    AND email_verified_at IS NULL
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired verification token'
    );
  END IF;
  
  -- Mark as verified
  UPDATE partner_applications
  SET 
    email_verified_at = NOW(),
    status = CASE 
      WHEN status = 'draft' THEN 'pending_verification'::partner_application_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = v_application.id;
  
  -- Log action
  INSERT INTO partner_application_logs (
    application_id,
    action,
    action_description,
    performed_by_role,
    created_at
  ) VALUES (
    v_application.id,
    'email_verified',
    'Email verified successfully',
    'system',
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application.id,
    'status', 'pending_verification'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get application statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_partner_application_stats(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'draft', COUNT(*) FILTER (WHERE status = 'draft'),
    'pending_verification', COUNT(*) FILTER (WHERE status = 'pending_verification'),
    'need_more_info', COUNT(*) FILTER (WHERE status = 'need_more_info'),
    'approved', COUNT(*) FILTER (WHERE status = 'approved'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
    'provisioned', COUNT(*) FILTER (WHERE status = 'provisioned'),
    'activated', COUNT(*) FILTER (WHERE status = 'activated'),
    'avg_approval_time_hours', AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) FILTER (WHERE approved_at IS NOT NULL),
    'pending_review_count', COUNT(*) FILTER (WHERE status = 'pending_verification' AND email_verified_at IS NOT NULL)
  ) INTO v_stats
  FROM partner_applications
  WHERE deleted_at IS NULL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA (for development only - remove in production)
-- ============================================================================

-- Uncomment for local development
/*
INSERT INTO partner_applications (
  applicant_type,
  full_name,
  email,
  phone,
  company_name,
  tax_code,
  status,
  created_at
) VALUES
  (
    'individual_broker',
    'Nguyễn Văn A',
    'nguyenvana@example.com',
    '+84901234567',
    NULL,
    NULL,
    'draft',
    NOW()
  ),
  (
    'agency',
    'Trần Thị B',
    'tranthib@agency.com',
    '+84987654321',
    'Sunshine Realty',
    '0123456789',
    'pending_verification',
    NOW() - INTERVAL '2 days'
  );
*/

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON partner_applications TO anon, authenticated;
GRANT SELECT, INSERT ON partner_application_logs TO authenticated;
GRANT EXECUTE ON FUNCTION generate_email_verification_token() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_activation_token() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_partner_application_email(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_partner_application_stats(UUID) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'partner_applications') = 1,
    'partner_applications table not created';
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'partner_application_logs') = 1,
    'partner_application_logs table not created';
  RAISE NOTICE 'Partner Registration System migration completed successfully';
END $$;
