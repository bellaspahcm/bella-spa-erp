-- ============================================================
-- Workflow Engine Foundation
-- ============================================================
-- Created: 2026-07-09
-- Purpose: Create workflow execution state tables for Workflow Engine Platform
-- Architecture: Follows Principle #8 - Engine never accesses DB directly
--               All DB operations go through StateManager abstraction
-- Dependencies: tenants table
-- ============================================================

-- ============================================================
-- 1. Create workflow_executions table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Workflow identification
  workflow_id TEXT NOT NULL,
  workflow_version TEXT NOT NULL,
  
  -- Execution state
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
  
  -- Context data (JSONB for flexibility)
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Execution result (stored on completion)
  result JSONB,
  
  -- Error information (stored on failure)
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Create workflow_step_executions table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  
  -- Step identification
  step_name TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  
  -- Step execution state
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  
  -- Step data (JSONB for flexibility)
  input_data JSONB,
  output_data JSONB,
  
  -- Error information
  error_message TEXT,
  
  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Performance metrics
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one step execution per workflow + step name
  UNIQUE(workflow_execution_id, step_name)
);

-- ============================================================
-- 3. Create indexes for performance
-- ============================================================

-- Fast lookup by execution ID
CREATE INDEX IF NOT EXISTS idx_workflow_executions_id ON workflow_executions(id);

-- Fast lookup by tenant (multi-tenancy)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);

-- Fast lookup by status (for monitoring)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- Fast lookup by workflow ID (for workflow-level analytics)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);

-- Fast lookup by correlation ID (JSONB index)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_correlation 
ON workflow_executions USING GIN ((context -> 'correlationId'));

-- Fast lookup of step executions by workflow
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_workflow 
ON workflow_step_executions(workflow_execution_id);

-- Fast lookup by step status (for monitoring)
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status 
ON workflow_step_executions(status);

-- ============================================================
-- 4. Create updated_at trigger
-- ============================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to workflow_executions
DROP TRIGGER IF EXISTS workflow_executions_updated_at ON workflow_executions;
CREATE TRIGGER workflow_executions_updated_at
  BEFORE UPDATE ON workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- Apply trigger to workflow_step_executions
DROP TRIGGER IF EXISTS workflow_step_executions_updated_at ON workflow_step_executions;
CREATE TRIGGER workflow_step_executions_updated_at
  BEFORE UPDATE ON workflow_step_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- ============================================================
-- 5. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see workflows from their tenant
CREATE POLICY workflow_executions_tenant_isolation ON workflow_executions
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Policy: Users can only see step executions from their tenant (via workflow)
CREATE POLICY workflow_step_executions_tenant_isolation ON workflow_step_executions
  FOR ALL
  USING (
    workflow_execution_id IN (
      SELECT id 
      FROM workflow_executions 
      WHERE tenant_id = (
        SELECT tenant_id 
        FROM users 
        WHERE users.id = auth.uid()
      )
    )
  );

-- Service role bypass (for server-side operations)
CREATE POLICY workflow_executions_service_role ON workflow_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY workflow_step_executions_service_role ON workflow_step_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. Grant permissions
-- ============================================================

-- Grant authenticated users access to workflow tables
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_step_executions TO authenticated;

-- Grant service role full access (for server-side state manager)
GRANT ALL ON workflow_executions TO service_role;
GRANT ALL ON workflow_step_executions TO service_role;

-- ============================================================
-- 7. Create helper RPC functions
-- ============================================================

-- Function: Get workflow execution with all step executions
CREATE OR REPLACE FUNCTION get_workflow_execution_detail(
  p_execution_id UUID
)
RETURNS TABLE (
  execution_id UUID,
  tenant_id UUID,
  workflow_id TEXT,
  workflow_version TEXT,
  status TEXT,
  context JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  steps JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id,
    we.tenant_id,
    we.workflow_id,
    we.workflow_version,
    we.status,
    we.context,
    we.result,
    we.error_message,
    we.started_at,
    we.completed_at,
    we.paused_at,
    -- Aggregate all step executions as JSONB array
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', wse.id,
          'stepName', wse.step_name,
          'stepIndex', wse.step_index,
          'status', wse.status,
          'inputData', wse.input_data,
          'outputData', wse.output_data,
          'errorMessage', wse.error_message,
          'retryCount', wse.retry_count,
          'startedAt', wse.started_at,
          'completedAt', wse.completed_at,
          'executionTimeMs', wse.execution_time_ms
        )
        ORDER BY wse.step_index
      ),
      '[]'::jsonb
    ) AS steps
  FROM workflow_executions we
  LEFT JOIN workflow_step_executions wse ON wse.workflow_execution_id = we.id
  WHERE we.id = p_execution_id
  GROUP BY we.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_workflow_execution_detail(UUID) TO authenticated, service_role;

-- Function: Get workflow executions for a tenant with pagination
CREATE OR REPLACE FUNCTION get_workflow_executions(
  p_tenant_id UUID,
  p_workflow_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  workflow_id TEXT,
  workflow_version TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  step_count INTEGER,
  failed_step_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id,
    we.workflow_id,
    we.workflow_version,
    we.status,
    we.started_at,
    we.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at))::INTEGER * 1000 AS execution_time_ms,
    COUNT(wse.id)::INTEGER AS step_count,
    COUNT(wse.id) FILTER (WHERE wse.status = 'failed')::INTEGER AS failed_step_count
  FROM workflow_executions we
  LEFT JOIN workflow_step_executions wse ON wse.workflow_execution_id = we.id
  WHERE we.tenant_id = p_tenant_id
    AND (p_workflow_id IS NULL OR we.workflow_id = p_workflow_id)
    AND (p_status IS NULL OR we.status = p_status)
  GROUP BY we.id
  ORDER BY we.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_workflow_executions(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- ============================================================
-- 8. Add comments for documentation
-- ============================================================

COMMENT ON TABLE workflow_executions IS 
'Workflow execution state table. Stores the state of each workflow execution including context, status, and result. Used by Workflow Engine StateManager for persistence.';

COMMENT ON TABLE workflow_step_executions IS 
'Workflow step execution table. Stores the state of each step execution including input/output data, status, and performance metrics. Provides full audit trail of workflow execution.';

COMMENT ON COLUMN workflow_executions.context IS 
'Workflow context data stored as JSONB. Contains executionId, tenantId, userId, correlationId, data, metadata, currentStepIndex, and stepResults.';

COMMENT ON COLUMN workflow_executions.result IS 
'Workflow execution result stored on completion. Contains final output data and step execution summary.';

COMMENT ON COLUMN workflow_step_executions.retry_count IS 
'Number of retry attempts for this step. Incremented each time step fails and is retried.';

COMMENT ON COLUMN workflow_step_executions.execution_time_ms IS 
'Step execution time in milliseconds. Used for performance monitoring and optimization.';

-- ============================================================
-- Migration complete
-- ============================================================
