-- =====================================================
-- MANUAL DEPLOYMENT: Rule Management UI Foundation
-- =====================================================
-- File: 20260709130000_rule_management_ui_foundation.sql
-- Deploy Date: July 9, 2026
-- Deploy Method: Run in Supabase SQL Editor
--
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and run
-- 4. Verify tables created (see VERIFICATION section below)
-- =====================================================

-- Step 1: Create Tables
-- =====================================================

-- workflow_definitions: Workflow metadata and configuration
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- workflow_rules: Individual rules within workflows
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('condition', 'action', 'decision')),
  priority INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- workflow_versions: Version history of workflow configurations
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  config JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE (workflow_id, version)
);

-- rule_simulations: Saved simulation results
CREATE TABLE IF NOT EXISTS rule_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_data JSONB NOT NULL,
  results JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Step 2: Create Indexes
-- =====================================================

-- workflow_definitions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant_status 
  ON workflow_definitions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant_category 
  ON workflow_definitions(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_at 
  ON workflow_definitions(created_at DESC);

-- workflow_rules indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_workflow 
  ON workflow_rules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant_type 
  ON workflow_rules(tenant_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_priority 
  ON workflow_rules(workflow_id, priority DESC);

-- workflow_versions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow 
  ON workflow_versions(workflow_id, version DESC);

-- rule_simulations indexes
CREATE INDEX IF NOT EXISTS idx_rule_simulations_workflow 
  ON rule_simulations(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_simulations_tenant 
  ON rule_simulations(tenant_id, created_at DESC);

-- Step 3: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_simulations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
-- =====================================================

-- workflow_definitions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_definitions' AND policyname = 'Users can view their tenant workflows') THEN
    CREATE POLICY "Users can view their tenant workflows"
      ON workflow_definitions FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_definitions' AND policyname = 'Users can create workflows for their tenant') THEN
    CREATE POLICY "Users can create workflows for their tenant"
      ON workflow_definitions FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_definitions' AND policyname = 'Users can update their tenant workflows') THEN
    CREATE POLICY "Users can update their tenant workflows"
      ON workflow_definitions FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_definitions' AND policyname = 'Users can delete their tenant workflows') THEN
    CREATE POLICY "Users can delete their tenant workflows"
      ON workflow_definitions FOR DELETE
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- workflow_rules policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Users can view their tenant rules') THEN
    CREATE POLICY "Users can view their tenant rules"
      ON workflow_rules FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Users can create rules for their tenant') THEN
    CREATE POLICY "Users can create rules for their tenant"
      ON workflow_rules FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Users can update their tenant rules') THEN
    CREATE POLICY "Users can update their tenant rules"
      ON workflow_rules FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'Users can delete their tenant rules') THEN
    CREATE POLICY "Users can delete their tenant rules"
      ON workflow_rules FOR DELETE
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- workflow_versions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_versions' AND policyname = 'Users can view their tenant workflow versions') THEN
    CREATE POLICY "Users can view their tenant workflow versions"
      ON workflow_versions FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_versions' AND policyname = 'Users can create versions for their tenant') THEN
    CREATE POLICY "Users can create versions for their tenant"
      ON workflow_versions FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- rule_simulations policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rule_simulations' AND policyname = 'Users can view their tenant simulations') THEN
    CREATE POLICY "Users can view their tenant simulations"
      ON rule_simulations FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rule_simulations' AND policyname = 'Users can create simulations for their tenant') THEN
    CREATE POLICY "Users can create simulations for their tenant"
      ON rule_simulations FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Step 5: Create RPC Functions
-- =====================================================

-- get_workflow_definitions: List workflows with filters
CREATE OR REPLACE FUNCTION get_workflow_definitions(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  status TEXT,
  config JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wd.id,
    wd.tenant_id,
    wd.name,
    wd.description,
    wd.category,
    wd.status,
    wd.config,
    wd.metadata,
    wd.created_at,
    wd.updated_at,
    wd.created_by
  FROM workflow_definitions wd
  WHERE wd.tenant_id = p_tenant_id
    AND (p_status IS NULL OR wd.status = p_status)
    AND (p_category IS NULL OR wd.category = p_category)
  ORDER BY wd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- get_workflow_rules: List rules with filters
CREATE OR REPLACE FUNCTION get_workflow_rules(
  p_tenant_id UUID,
  p_workflow_id UUID DEFAULT NULL,
  p_rule_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  workflow_id UUID,
  tenant_id UUID,
  name TEXT,
  description TEXT,
  rule_type TEXT,
  priority INT,
  config JSONB,
  metadata JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.id,
    wr.workflow_id,
    wr.tenant_id,
    wr.name,
    wr.description,
    wr.rule_type,
    wr.priority,
    wr.config,
    wr.metadata,
    wr.is_active,
    wr.created_at,
    wr.updated_at,
    wr.created_by
  FROM workflow_rules wr
  WHERE wr.tenant_id = p_tenant_id
    AND (p_workflow_id IS NULL OR wr.workflow_id = p_workflow_id)
    AND (p_rule_type IS NULL OR wr.rule_type = p_rule_type)
    AND (p_status IS NULL OR (p_status = 'active' AND wr.is_active = TRUE) OR (p_status = 'inactive' AND wr.is_active = FALSE))
  ORDER BY wr.priority DESC, wr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- get_rule_simulation_results: List simulation results
CREATE OR REPLACE FUNCTION get_rule_simulation_results(
  p_tenant_id UUID,
  p_workflow_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  workflow_id UUID,
  tenant_id UUID,
  test_data JSONB,
  results JSONB,
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.id,
    rs.workflow_id,
    rs.tenant_id,
    rs.test_data,
    rs.results,
    rs.summary,
    rs.created_at,
    rs.created_by
  FROM rule_simulations rs
  WHERE rs.tenant_id = p_tenant_id
    AND (p_workflow_id IS NULL OR rs.workflow_id = p_workflow_id)
  ORDER BY rs.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Step 6: Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_workflow_definitions TO authenticated;
GRANT EXECUTE ON FUNCTION get_workflow_rules TO authenticated;
GRANT EXECUTE ON FUNCTION get_rule_simulation_results TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Run these queries to verify deployment:

-- 1. Check tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations')
ORDER BY table_name;

-- 2. Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations')
ORDER BY tablename, indexname;

-- 3. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('workflow_definitions', 'workflow_rules', 'workflow_versions', 'rule_simulations');

-- 4. Check RPC functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_workflow_definitions', 'get_workflow_rules', 'get_rule_simulation_results');

-- Expected Results:
-- - 4 tables created
-- - 9 indexes created
-- - All tables have RLS enabled (rowsecurity = true)
-- - 3 RPC functions created

-- =====================================================
-- ROLLBACK (IF NEEDED)
-- =====================================================

-- CAUTION: This will delete all data!
-- Only run if deployment failed and you need to start over

/*
DROP FUNCTION IF EXISTS get_rule_simulation_results(UUID, UUID, INT, INT);
DROP FUNCTION IF EXISTS get_workflow_rules(UUID, UUID, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_workflow_definitions(UUID, TEXT, TEXT, INT, INT);
DROP TABLE IF EXISTS rule_simulations CASCADE;
DROP TABLE IF EXISTS workflow_versions CASCADE;
DROP TABLE IF EXISTS workflow_rules CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
*/

-- =====================================================
-- END OF DEPLOYMENT SCRIPT
-- =====================================================
