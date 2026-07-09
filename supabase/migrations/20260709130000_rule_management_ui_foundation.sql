-- ============================================================
-- Rule Management UI - Foundation
-- ============================================================
-- Created: 2026-07-09
-- Purpose: Create tables for visual workflow and rule management
-- Dependencies: tenants, users tables
-- ============================================================

-- ============================================================
-- 1. Create workflow_definitions table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Workflow metadata
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'booking', 'payroll', 'inventory', 'hr', 'finance'
  
  -- Workflow configuration (JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Version tracking
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'published', 'archived')),
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: workflow_id per tenant
  UNIQUE(tenant_id, workflow_id)
);

-- ============================================================
-- 2. Create workflow_rules table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  
  -- Rule identification
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,  -- 'condition', 'action', 'decision', 'validation'
  
  -- Rule definition (JSONB for flexibility)
  rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Execution settings
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  description TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, rule_name)
);

-- ============================================================
-- 3. Create workflow_versions table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  
  -- Version metadata
  version TEXT NOT NULL,
  snapshot JSONB NOT NULL,  -- Full workflow config snapshot
  changelog TEXT,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, version)
);

-- ============================================================
-- 4. Create rule_simulations table
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES workflow_rules(id) ON DELETE SET NULL,
  
  -- Simulation input/output
  input_data JSONB NOT NULL,
  output_data JSONB,
  
  -- Execution trace
  trace JSONB,  -- Step-by-step execution trace
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Create indexes for performance
-- ============================================================

-- workflow_definitions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions(category);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_at ON workflow_definitions(created_at DESC);

-- workflow_rules indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_workflow ON workflow_rules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_enabled ON workflow_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_priority ON workflow_rules(priority DESC);

-- workflow_versions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_created_at ON workflow_versions(created_at DESC);

-- rule_simulations indexes
CREATE INDEX IF NOT EXISTS idx_rule_simulations_workflow ON rule_simulations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_rule_simulations_rule ON rule_simulations(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_simulations_created_at ON rule_simulations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_simulations_created_by ON rule_simulations(created_by);

-- ============================================================
-- 6. Create updated_at triggers
-- ============================================================

-- Trigger for workflow_definitions
DROP TRIGGER IF EXISTS workflow_definitions_updated_at ON workflow_definitions;
CREATE TRIGGER workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- Trigger for workflow_rules
DROP TRIGGER IF EXISTS workflow_rules_updated_at ON workflow_rules;
CREATE TRIGGER workflow_rules_updated_at
  BEFORE UPDATE ON workflow_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_simulations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see workflows from their tenant
CREATE POLICY workflow_definitions_tenant_isolation ON workflow_definitions
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY workflow_rules_tenant_isolation ON workflow_rules
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY workflow_versions_tenant_isolation ON workflow_versions
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY rule_simulations_tenant_isolation ON rule_simulations
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Service role bypass (for server-side operations)
CREATE POLICY workflow_definitions_service_role ON workflow_definitions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY workflow_rules_service_role ON workflow_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY workflow_versions_service_role ON workflow_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY rule_simulations_service_role ON rule_simulations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. Grant permissions
-- ============================================================

-- Grant authenticated users access
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rule_simulations TO authenticated;

-- Grant service role full access
GRANT ALL ON workflow_definitions TO service_role;
GRANT ALL ON workflow_rules TO service_role;
GRANT ALL ON workflow_versions TO service_role;
GRANT ALL ON rule_simulations TO service_role;

-- ============================================================
-- 9. Helper RPC functions
-- ============================================================

-- Function: Get workflow with all rules
CREATE OR REPLACE FUNCTION get_workflow_with_rules(
  p_workflow_id UUID
)
RETURNS TABLE (
  workflow_id UUID,
  workflow_name TEXT,
  workflow_description TEXT,
  workflow_category TEXT,
  workflow_config JSONB,
  workflow_version TEXT,
  workflow_status TEXT,
  rules JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wd.id,
    wd.name,
    wd.description,
    wd.category,
    wd.config,
    wd.version,
    wd.status,
    -- Aggregate all rules as JSONB array
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', wr.id,
          'ruleName', wr.rule_name,
          'ruleType', wr.rule_type,
          'ruleConfig', wr.rule_config,
          'priority', wr.priority,
          'enabled', wr.enabled,
          'description', wr.description
        )
        ORDER BY wr.priority DESC, wr.rule_name
      ) FILTER (WHERE wr.id IS NOT NULL),
      '[]'::jsonb
    ) AS rules
  FROM workflow_definitions wd
  LEFT JOIN workflow_rules wr ON wr.workflow_id = wd.id
  WHERE wd.id = p_workflow_id
  GROUP BY wd.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_workflow_with_rules(UUID) TO authenticated, service_role;

-- Function: Get workflow versions history
CREATE OR REPLACE FUNCTION get_workflow_versions_history(
  p_workflow_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  version_id UUID,
  version TEXT,
  changelog TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wv.id,
    wv.version,
    wv.changelog,
    u.name AS created_by_name,
    wv.created_at
  FROM workflow_versions wv
  LEFT JOIN users u ON u.id = wv.created_by
  WHERE wv.workflow_id = p_workflow_id
  ORDER BY wv.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_workflow_versions_history(UUID, INTEGER) TO authenticated, service_role;

-- Function: Get workflow execution statistics
CREATE OR REPLACE FUNCTION get_workflow_execution_stats(
  p_workflow_definition_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  avg_execution_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_executions,
    COUNT(*) FILTER (WHERE we.status = 'completed')::BIGINT AS successful_executions,
    COUNT(*) FILTER (WHERE we.status = 'failed')::BIGINT AS failed_executions,
    AVG(
      EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) * 1000
    )::NUMERIC AS avg_execution_time_ms,
    (
      COUNT(*) FILTER (WHERE we.status = 'completed')::NUMERIC / 
      NULLIF(COUNT(*)::NUMERIC, 0) * 100
    ) AS success_rate
  FROM workflow_executions we
  JOIN workflow_definitions wd ON wd.workflow_id = we.workflow_id
  WHERE wd.id = p_workflow_definition_id
    AND we.started_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY wd.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_workflow_execution_stats(UUID, INTEGER) TO authenticated, service_role;

-- ============================================================
-- 10. Add comments for documentation
-- ============================================================

COMMENT ON TABLE workflow_definitions IS 
'Visual workflow definitions created via Rule Management UI. Stores workflow metadata and configuration.';

COMMENT ON TABLE workflow_rules IS 
'Individual rules within a workflow. Can be conditions, actions, or decisions.';

COMMENT ON TABLE workflow_versions IS 
'Version history for workflows. Enables rollback to previous versions.';

COMMENT ON TABLE rule_simulations IS 
'Test execution history for workflows. Stores dry-run results for validation.';

COMMENT ON COLUMN workflow_definitions.config IS 
'Workflow configuration as JSONB. Contains steps, transitions, retry policies, timeouts, etc.';

COMMENT ON COLUMN workflow_rules.rule_config IS 
'Rule configuration as JSONB. Structure depends on rule_type (condition, action, decision).';

COMMENT ON COLUMN workflow_versions.snapshot IS 
'Complete snapshot of workflow configuration at the time of version creation. Used for rollback.';

COMMENT ON COLUMN rule_simulations.trace IS 
'Step-by-step execution trace as JSONB. Shows which steps executed, in what order, with what results.';

-- ============================================================
-- Migration complete
-- ============================================================
