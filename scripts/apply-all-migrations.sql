-- ============================================================================
-- COMBINED MIGRATIONS FOR PARTNER REGISTRATION SYSTEM
-- Copy entire file and run in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Partner Registration System
-- File: 20260802112935_partner_registration_system.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE partner_application_status AS ENUM (
  'draft',
  'pending_verification',
  'pending_review',
  'need_more_info',
  'approved',
  'rejected',
  'provisioned',
  'activated'
);

CREATE TYPE partner_applicant_type AS ENUM (
  'individual',
  'company'
);

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

-- Partner Applications Table
CREATE TABLE partner_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Applicant Info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  company_name TEXT,
  business_type partner_applicant_type NOT NULL DEFAULT 'individual',
  tax_code TEXT,
  company_address TEXT,
  city TEXT,
  
  -- Business Info
  expected_monthly_sales BIGINT,
  referral_source TEXT,
  additional_notes TEXT,
  
  -- Documents
  documents JSONB DEFAULT '[]'::JSONB,
  
  -- Email Verification
  verification_token TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  
  -- Status
  status partner_application_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  
  -- Admin Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  approval_notes TEXT,
  rejection_reason TEXT,
  additional_info_requested TEXT,
  
  -- Provisioning
  tenant_id UUID,
  identity_id UUID,
  provisioned_at TIMESTAMPTZ,
  
  -- Activation
  activation_token TEXT,
  activation_token_expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_partner_applications_email ON partner_applications(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_partner_applications_status ON partner_applications(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_partner_applications_tenant ON partner_applications(tenant_id) WHERE tenant_id IS NOT NULL;

-- Partner Application Logs
CREATE TABLE partner_application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  
  action partner_application_log_action NOT NULL,
  action_description TEXT,
  
  performed_by_user_id UUID REFERENCES auth.users(id),
  performed_by_role TEXT,
  
  old_status partner_application_status,
  new_status partner_application_status,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partner_application_logs_application ON partner_application_logs(application_id);
CREATE INDEX idx_partner_application_logs_created_at ON partner_application_logs(created_at);

-- Triggers
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

-- RLS
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view applications"
  ON partner_applications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update applications"
  ON partner_applications FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert applications"
  ON partner_applications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view logs"
  ON partner_application_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON partner_application_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION 2: User Roles
-- File: 20260802130000_create_user_roles.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  tenant_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(user_id, role_name, tenant_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_name ON user_roles(role_name);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can manage roles"
  ON user_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name = 'super_admin'
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Checking tables...';
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_applications') THEN
    RAISE EXCEPTION 'partner_applications table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_application_logs') THEN
    RAISE EXCEPTION 'partner_application_logs table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    RAISE EXCEPTION 'user_roles table not created';
  END IF;
  
  RAISE NOTICE '✅ All tables created successfully!';
  RAISE NOTICE '✅ Partner Registration System migrations complete!';
END $$;

-- Show created tables
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('partner_applications', 'partner_application_logs', 'user_roles')
ORDER BY table_name;
