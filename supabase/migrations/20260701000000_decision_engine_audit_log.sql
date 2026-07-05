-- ============================================================================
-- Decision Engine Audit Log & Policy Versions
-- Sprint 1: Core Evidence Console - Database Foundation
-- 
-- Features:
-- 1. decision_audit_log: Complete audit trail với version snapshots, correlation tracing, resource metrics
-- 2. policy_versions: Version history cho Time Machine feature
-- 3. Indexes for performance
-- 4. RLS policies for security
-- ============================================================================

-- ============================================================================
-- Table: decision_audit_log
-- Purpose: Comprehensive audit trail for all Decision Engine executions
-- ============================================================================

CREATE TABLE IF NOT EXISTS decision_audit_log (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core decision metadata
  decision_id TEXT NOT NULL,
  decision_type TEXT NOT NULL, -- No enum constraint - allow any workflow type
  provider TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL CHECK (execution_time_ms >= 0),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  
  -- Decision data (JSONB for flexibility)
  input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  policies_executed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  matched_rules JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { ruleId, ruleName, priority, conditions }
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { timestamp, level, message }
  
  -- Tenant & User context
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Sprint 1 NEW: Correlation & Distributed Tracing (OpenTelemetry-style)
  correlation_id UUID,
  trace_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  
  -- Sprint 1 NEW: Version Snapshot (for Time Machine replay)
  version_snapshot JSONB DEFAULT '{}'::jsonb,
  -- Structure: { engineVersion: string, policyVersions: {}, ruleVersions: {}, providerVersions: {} }
  
  -- Sprint 2 NEW: Resource Metrics (cost tracking)
  resource_metrics JSONB DEFAULT '{}'::jsonb,
  -- Structure: { cpuTimeMs, memoryUsedMB, dbQueries: {count, totalTimeMs, queries}, remoteApiCalls, cacheHits, cacheMisses }
  
  -- Sprint 4 NEW: Business Outcome tracking
  business_outcome JSONB DEFAULT '{}'::jsonb,
  -- Structure: { outcomeType: 'approved'|'rejected'|'modified', revenueImpact, costImpact, timeImpact }
  
  -- Sprint 4 NEW: AI Metadata (for AI provider decisions)
  ai_metadata JSONB DEFAULT '{}'::jsonb,
  -- Structure: { provider, model, prompt, temperature, reasoning, confidence, tokenUsage, fallbackUsed }
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT decision_audit_log_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Core query patterns
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON decision_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_decision_type ON decision_audit_log(decision_type);
CREATE INDEX IF NOT EXISTS idx_audit_provider ON decision_audit_log(provider);
CREATE INDEX IF NOT EXISTS idx_audit_status ON decision_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_audit_decision_id ON decision_audit_log(decision_id);

-- Confidence filtering
CREATE INDEX IF NOT EXISTS idx_audit_confidence ON decision_audit_log(confidence_score) 
  WHERE confidence_score IS NOT NULL;

-- Sprint 1: Correlation & Tracing indexes
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON decision_audit_log(correlation_id) 
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_trace ON decision_audit_log(trace_id) 
  WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_span ON decision_audit_log(span_id) 
  WHERE span_id IS NOT NULL;

-- GIN indexes for JSONB queries (finding decisions by entity ID in context/output)
CREATE INDEX IF NOT EXISTS idx_audit_input_context ON decision_audit_log USING GIN(input_context);
CREATE INDEX IF NOT EXISTS idx_audit_output ON decision_audit_log USING GIN(output);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_audit_tenant_type_status_created 
  ON decision_audit_log(tenant_id, decision_type, status, created_at DESC);


-- ============================================================================
-- Table: policy_versions
-- Purpose: Version history for policies (enables Time Machine feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_versions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Policy reference (soft foreign key - policy may not exist in DB yet)
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL CHECK (version ~ '^v[0-9]+$'), -- Format: v1, v2, v7, etc.
  
  -- Full policy snapshot (complete definition at this version)
  definition JSONB NOT NULL,
  -- Structure: { name, domain, rules: [], metadata: {}, dependencies: [] }
  
  -- Change tracking
  changelog TEXT, -- Optional: Human-readable description of changes
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Ensure unique policy + version combination
  UNIQUE(policy_id, version)
);

-- Indexes for policy version queries
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_policy_versions_created ON policy_versions(created_at DESC);

-- GIN index for searching within policy definitions
CREATE INDEX IF NOT EXISTS idx_policy_versions_definition ON policy_versions USING GIN(definition);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE decision_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: decision_audit_log
-- ============================================================================

-- Service role: Full access (for API server)
CREATE POLICY "Service role has full access to decision_audit_log"
  ON decision_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Can only view decisions from their tenant
CREATE POLICY "Users can view decisions from their tenant"
  ON decision_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Admin users: Can view all decisions in their tenant
CREATE POLICY "Admins can view all tenant decisions"
  ON decision_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'owner')
    )
  );

-- No direct insert/update/delete for authenticated users (only via service role)
-- This ensures audit log integrity


-- ============================================================================
-- RLS Policies: policy_versions
-- ============================================================================

-- Service role: Full access
CREATE POLICY "Service role has full access to policy_versions"
  ON policy_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- All authenticated users can read policy versions (read-only for now)
CREATE POLICY "Authenticated users can read policy versions"
  ON policy_versions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update policy versions (ensures version integrity)

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get decisions by trace ID (for distributed tracing)
CREATE OR REPLACE FUNCTION get_decisions_by_trace(
  p_trace_id TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  decision_id TEXT,
  decision_type TEXT,
  provider TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  execution_time_ms INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  output JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dal.id,
    dal.decision_id,
    dal.decision_type,
    dal.provider,
    dal.span_id,
    dal.parent_span_id,
    dal.execution_time_ms,
    dal.status,
    dal.created_at,
    dal.output
  FROM decision_audit_log dal
  WHERE dal.trace_id = p_trace_id
    AND (p_tenant_id IS NULL OR dal.tenant_id = p_tenant_id)
  ORDER BY dal.created_at ASC;
END;
$$;

-- Function: Get decision history for an entity (e.g., all decisions for booking_123)
CREATE OR REPLACE FUNCTION get_decision_history_for_entity(
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  decision_id TEXT,
  decision_type TEXT,
  provider TEXT,
  execution_time_ms INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  output JSONB,
  confidence_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dal.id,
    dal.decision_id,
    dal.decision_type,
    dal.provider,
    dal.execution_time_ms,
    dal.status,
    dal.created_at,
    dal.output,
    dal.confidence_score
  FROM decision_audit_log dal
  WHERE dal.tenant_id = p_tenant_id
    AND (
      -- Search in input_context
      dal.input_context::text LIKE '%' || p_entity_id || '%'
      -- Search in output
      OR dal.output::text LIKE '%' || p_entity_id || '%'
    )
  ORDER BY dal.created_at ASC;
END;
$$;

-- Function: Get policy version by policy ID and version
CREATE OR REPLACE FUNCTION get_policy_version(
  p_policy_id TEXT,
  p_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_definition JSONB;
BEGIN
  SELECT definition INTO v_definition
  FROM policy_versions
  WHERE policy_id = p_policy_id
    AND version = p_version;
  
  RETURN v_definition;
END;
$$;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE decision_audit_log IS 'Comprehensive audit trail for Decision Engine executions. Supports replay, tracing, and cost analysis.';
COMMENT ON TABLE policy_versions IS 'Version history for policies. Enables Time Machine feature to replay decisions with different policy versions.';

COMMENT ON COLUMN decision_audit_log.correlation_id IS 'Groups related decisions across workflow (e.g., all decisions for one booking)';
COMMENT ON COLUMN decision_audit_log.trace_id IS 'OpenTelemetry-style trace ID for distributed tracing';
COMMENT ON COLUMN decision_audit_log.span_id IS 'Unique span identifier within trace';
COMMENT ON COLUMN decision_audit_log.parent_span_id IS 'Parent span for nested decision calls';
COMMENT ON COLUMN decision_audit_log.version_snapshot IS 'Snapshot of Engine/Policy/Rule/Provider versions at execution time (enables replay)';
COMMENT ON COLUMN decision_audit_log.resource_metrics IS 'CPU, Memory, DB queries, API calls tracking (enables cost analysis)';
COMMENT ON COLUMN decision_audit_log.business_outcome IS 'Business impact metrics (revenue, cost savings, time saved)';
COMMENT ON COLUMN decision_audit_log.ai_metadata IS 'AI provider details (prompt, model, reasoning, token usage)';

-- ============================================================================
-- Grants
-- ============================================================================

-- Grant service role full access
GRANT ALL ON decision_audit_log TO service_role;
GRANT ALL ON policy_versions TO service_role;

-- Grant authenticated users select access (RLS will filter by tenant)
GRANT SELECT ON decision_audit_log TO authenticated;
GRANT SELECT ON policy_versions TO authenticated;

-- Grant usage on helper functions
GRANT EXECUTE ON FUNCTION get_decisions_by_trace TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_decision_history_for_entity TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_policy_version TO service_role, authenticated;

-- ============================================================================
-- End of Migration
-- ============================================================================
