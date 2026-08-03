-- ============================================================================
-- CRITICAL FIXES DEPLOYMENT - Run this in Supabase Dashboard SQL Editor
-- ============================================================================
-- Part 1: Fix RLS Infinite Recursion (Security Critical)
-- Part 2: Deploy Partner Portal (Business Critical)
-- Estimated Time: 2-3 minutes
-- ============================================================================

-- Backup existing policies (just in case)
DO $$
DECLARE
  v_policy RECORD;
BEGIN
    FOR v_policy IN 
    SELECT policyname, cmd, qual::text, with_check::text
    FROM pg_policies
    WHERE tablename = 'user_roles'
  LOOP
    RAISE NOTICE '  Policy: %, CMD: %, USING: %, WITH CHECK: %', 
      v_policy.policyname, v_policy.cmd, v_policy.qual, v_policy.with_check;
  END LOOP;
END $$;

-- Drop problematic policies
DO $$
BEGIN
    
  DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
    
  DROP POLICY IF EXISTS "Super admins can manage roles" ON user_roles;
    
  DROP POLICY IF EXISTS "Only service role can modify roles" ON user_roles;
    
  DROP POLICY IF EXISTS "Authenticated users can view all roles" ON user_roles;
  END $$;

-- Create new policies (no recursion)
DO $$
BEGIN
    
  -- Allow authenticated users to view all roles (simple, no recursion)
  CREATE POLICY "Authenticated users can view all roles"
    ON user_roles
    FOR SELECT
    TO authenticated
    USING (true);
    
  -- Block all modifications via RLS (only service role can modify)
  CREATE POLICY "Only service role can modify roles"
    ON user_roles
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
    
  -- Grant necessary permissions
  GRANT SELECT ON user_roles TO authenticated;
  END $$;

-- Verify new policies
DO $$
DECLARE
  v_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'user_roles';
  
    
  IF v_policy_count >= 2 THEN
      ELSE
    RAISE WARNING '⚠️  Expected at least 2 policies, found %', v_policy_count;
  END IF;
END $$;

-- Check if already deployed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_applications') THEN
      ELSE
      END IF;
END $$;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums (skip if exists)
DO $$ BEGIN
  CREATE TYPE partner_application_status AS ENUM (
    'draft', 'pending_verification', 'pending_review', 'need_more_info',
    'approved', 'rejected', 'provisioned', 'activated'
  );
  EXCEPTION WHEN duplicate_object THEN 
  END $$;

DO $$ BEGIN
  CREATE TYPE partner_applicant_type AS ENUM ('individual', 'company');
  EXCEPTION WHEN duplicate_object THEN
  END $$;

DO $$ BEGIN
  CREATE TYPE partner_application_log_action AS ENUM (
    'created', 'submitted', 'email_verified', 'document_uploaded',
    'approved', 'rejected', 'info_requested', 'info_provided',
    'provisioned', 'activated', 'status_changed'
  );
  EXCEPTION WHEN duplicate_object THEN
  END $$;

-- Create tables
CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  applicant_type partner_applicant_type NOT NULL DEFAULT 'individual',
  company_name TEXT,
  tax_code TEXT,
  business_license TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  ward TEXT,
  status partner_application_status NOT NULL DEFAULT 'draft',
  registration_type TEXT DEFAULT 'partner',
  documents JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  verification_token TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  activation_token TEXT,
  activation_token_expires_at TIMESTAMPTZ,
  tenant_id UUID,
  identity_id UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  approval_notes TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  rejection_category TEXT,
  info_requested_at TIMESTAMPTZ,
  info_requested_by UUID,
  info_request_message TEXT,
  info_request_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS partner_application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  action partner_application_log_action NOT NULL,
  action_description TEXT,
  performed_by UUID,
  performed_by_role TEXT,
  old_status partner_application_status,
  new_status partner_application_status,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_partner_applications_email ON partner_applications(email);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_tenant ON partner_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_logs_application ON partner_application_logs(application_id);

-- Enable RLS
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_application_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  -- Drop existing policies first
  DROP POLICY IF EXISTS "Public can insert applications" ON partner_applications;
  DROP POLICY IF EXISTS "Authenticated can read all applications" ON partner_applications;
  DROP POLICY IF EXISTS "Authenticated can update applications" ON partner_applications;
  DROP POLICY IF EXISTS "Authenticated can read logs" ON partner_application_logs;
  DROP POLICY IF EXISTS "Authenticated can insert logs" ON partner_application_logs;
  
  -- Create policies
  CREATE POLICY "Public can insert applications" 
    ON partner_applications FOR INSERT WITH CHECK (true);
  
  CREATE POLICY "Authenticated can read all applications" 
    ON partner_applications FOR SELECT TO authenticated USING (true);
  
  CREATE POLICY "Authenticated can update applications" 
    ON partner_applications FOR UPDATE TO authenticated USING (true);
  
  CREATE POLICY "Authenticated can read logs" 
    ON partner_application_logs FOR SELECT TO authenticated USING (true);
  
  CREATE POLICY "Authenticated can insert logs" 
    ON partner_application_logs FOR INSERT TO authenticated WITH CHECK (true);
  
  END $$;

-- Create RPC functions
CREATE OR REPLACE FUNCTION add_partner_document(
  p_application_id UUID,
  p_file_path TEXT,
  p_file_url TEXT,
  p_category TEXT,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_documents JSONB;
  v_new_document JSONB;
BEGIN
  SELECT documents INTO v_documents
  FROM partner_applications
  WHERE id = p_application_id;
  
  IF v_documents IS NULL THEN
    v_documents := '[]'::JSONB;
  END IF;
  
  v_new_document := jsonb_build_object(
    'filePath', p_file_path,
    'fileUrl', p_file_url,
    'category', p_category,
    'metadata', p_metadata,
    'addedAt', NOW()
  );
  
  v_documents := v_documents || v_new_document;
  
  UPDATE partner_applications
  SET documents = v_documents, updated_at = NOW()
  WHERE id = p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION remove_partner_document(
  p_application_id UUID,
  p_file_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_documents JSONB;
  v_doc JSONB;
  v_new_documents JSONB;
BEGIN
  SELECT documents INTO v_documents
  FROM partner_applications
  WHERE id = p_application_id;
  
  IF v_documents IS NULL OR jsonb_array_length(v_documents) = 0 THEN
    RETURN;
  END IF;
  
  v_new_documents := '[]'::JSONB;
  
  FOR v_doc IN SELECT * FROM jsonb_array_elements(v_documents)
  LOOP
    IF v_doc->>'filePath' != p_file_path THEN
      v_new_documents := v_new_documents || v_doc;
    END IF;
  END LOOP;
  
  UPDATE partner_applications
  SET documents = v_new_documents, updated_at = NOW()
  WHERE id = p_application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_partner_document TO authenticated;
GRANT EXECUTE ON FUNCTION remove_partner_document TO authenticated;

DO $$
DECLARE
  v_policies INT;
  v_apps INT;
  v_logs INT;
  v_funcs INT;
BEGIN
  -- Check RLS policies
  SELECT COUNT(*) INTO v_policies FROM pg_policies WHERE tablename = 'user_roles';
    
  -- Check partner tables
  SELECT COUNT(*) INTO v_apps FROM partner_applications;
    
  SELECT COUNT(*) INTO v_logs FROM partner_application_logs;
    
  -- Check RPC functions
  SELECT COUNT(*) INTO v_funcs 
  FROM pg_proc 
  WHERE proname IN ('add_partner_document', 'remove_partner_document');
    
  -- Final summary
                        END $$;

-- Show deployed policies
SELECT 
  tablename,
  policyname,
  cmd,
  LEFT(qual::text, 50) AS using_clause
FROM pg_policies
WHERE tablename IN ('user_roles', 'partner_applications', 'partner_application_logs')
ORDER BY tablename, policyname;
