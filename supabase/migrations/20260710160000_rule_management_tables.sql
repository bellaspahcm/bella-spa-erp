-- ============================================================
-- Rule Management UI - Database Schema
-- ============================================================
-- Created: 2026-07-10
-- Purpose: Create tables for visual rule builder, test simulator, 
--          version control, and approval workflow
-- Dependencies: tenants, users tables
-- ============================================================

-- ============================================================
-- 1. Create rules table (Individual Business Rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,  -- 'booking', 'discount', 'payroll', 'commission', 'inventory'
  category TEXT,           -- Provider-specific category (e.g., 'assignment', 'capacity', 'waitlist')
  
  -- Rule definition (stored as JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of condition objects
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,     -- Array of action objects
  priority INTEGER NOT NULL DEFAULT 100,          -- Higher priority = executed first
  
  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Being edited
    'pending_approval',   -- Submitted for review
    'approved',           -- Approved but not active
    'active',             -- Currently in use
    'disabled',           -- Temporarily disabled
    'archived'            -- Permanently archived
  )),
  
  -- Version tracking
  version INTEGER NOT NULL DEFAULT 1,
  parent_rule_id UUID REFERENCES rules(id) ON DELETE SET NULL,  -- Original rule if this is a new version
  
  -- Approval workflow
  approval_required BOOLEAN NOT NULL DEFAULT false,
  submitted_for_approval_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approval_comment TEXT,
  
  -- Activation scheduling
  scheduled_activation_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT rules_name_provider_unique UNIQUE(tenant_id, name, provider, status)
);

-- ============================================================
-- 2. Create rule_versions table (Complete Version History)
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  
  -- Version metadata
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,  -- Complete rule configuration at this version
  
  -- Change tracking
  change_type TEXT NOT NULL CHECK (change_type IN (
    'created',
    'conditions_changed',
    'actions_changed',
    'priority_changed',
    'enabled',
    'disabled',
    'approved',
    'rejected'
  )),
  change_summary TEXT,      -- Brief description of what changed
  diff JSONB,               -- Structured diff (added/removed/modified fields)
  
  -- Metadata
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT rule_versions_unique UNIQUE(rule_id, version)
);

-- ============================================================
-- 3. Create rule_approvals table (Approval Workflow)
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  
  -- Approval metadata
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Reviewer assignment
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- Approval decision
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  )),
  
  -- Review comments
  comments TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Create rule_test_results table (Test Simulator History)
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  
  -- Test metadata
  test_type TEXT NOT NULL CHECK (test_type IN ('single', 'batch')),
  test_name TEXT,
  
  -- Test input/output
  input_data JSONB NOT NULL,
  expected_output JSONB,
  actual_output JSONB,
  
  -- Test result
  passed BOOLEAN NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  
  -- Execution trace (for debugging)
  trace JSONB,              -- Step-by-step execution log
  matched_conditions JSONB, -- Which conditions matched
  executed_actions JSONB,   -- Which actions executed
  
  -- Metadata
  tested_by UUID REFERENCES users(id),
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Create indexes for performance
-- ============================================================

-- rules table indexes
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_provider ON rules(provider);
CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_rules_created_at ON rules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rules_parent ON rules(parent_rule_id);

-- rule_versions table indexes
CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_changed_at ON rule_versions(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_versions_changed_by ON rule_versions(changed_by);

-- rule_approvals table indexes
CREATE INDEX IF NOT EXISTS idx_rule_approvals_rule ON rule_approvals(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_approvals_status ON rule_approvals(status);
CREATE INDEX IF NOT EXISTS idx_rule_approvals_reviewer ON rule_approvals(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_rule_approvals_requested_at ON rule_approvals(requested_at DESC);

-- rule_test_results table indexes
CREATE INDEX IF NOT EXISTS idx_rule_test_results_rule ON rule_test_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_test_results_passed ON rule_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_rule_test_results_tested_at ON rule_test_results(tested_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_test_results_tested_by ON rule_test_results(tested_by);

-- ============================================================
-- 6. Create updated_at triggers
-- ============================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_rule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS rules_updated_at ON rules;
CREATE TRIGGER rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW
  EXECUTE FUNCTION update_rule_updated_at();

DROP TRIGGER IF EXISTS rule_approvals_updated_at ON rule_approvals;
CREATE TRIGGER rule_approvals_updated_at
  BEFORE UPDATE ON rule_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_rule_updated_at();

-- ============================================================
-- 7. Create version snapshot trigger
-- ============================================================

-- Trigger function to auto-create version snapshot on rule change
CREATE OR REPLACE FUNCTION create_rule_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_change_type TEXT;
  v_change_summary TEXT;
BEGIN
  -- Determine change type
  IF (TG_OP = 'INSERT') THEN
    v_change_type := 'created';
    v_change_summary := 'Rule created';
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Compare OLD and NEW for UPDATE operations
    IF (OLD.status != NEW.status AND NEW.status = 'active') THEN
      v_change_type := 'enabled';
      v_change_summary := 'Rule activated';
    ELSIF (OLD.status != NEW.status AND NEW.status = 'disabled') THEN
      v_change_type := 'disabled';
      v_change_summary := 'Rule disabled';
    ELSIF (OLD.status != NEW.status AND NEW.status = 'approved') THEN
      v_change_type := 'approved';
      v_change_summary := 'Rule approved';
    ELSIF (OLD.conditions::text != NEW.conditions::text) THEN
      v_change_type := 'conditions_changed';
      v_change_summary := 'Conditions modified';
    ELSIF (OLD.actions::text != NEW.actions::text) THEN
      v_change_type := 'actions_changed';
      v_change_summary := 'Actions modified';
    ELSIF (OLD.priority != NEW.priority) THEN
      v_change_type := 'priority_changed';
      v_change_summary := format('Priority changed from %s to %s', OLD.priority, NEW.priority);
    ELSE
      v_change_type := 'updated';
      v_change_summary := 'Rule updated';
    END IF;
  ELSE
    v_change_type := 'updated';
    v_change_summary := 'Rule updated';
  END IF;

  -- Create version snapshot
  INSERT INTO rule_versions (
    tenant_id,
    rule_id,
    version,
    snapshot,
    change_type,
    change_summary,
    changed_by,
    changed_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.version,
    jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'description', NEW.description,
      'provider', NEW.provider,
      'category', NEW.category,
      'conditions', NEW.conditions,
      'actions', NEW.actions,
      'priority', NEW.priority,
      'status', NEW.status,
      'version', NEW.version
    ),
    v_change_type,
    v_change_summary,
    NEW.updated_by,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (separate triggers for INSERT and UPDATE to avoid OLD reference on INSERT)
DROP TRIGGER IF EXISTS rules_version_snapshot_insert ON rules;
CREATE TRIGGER rules_version_snapshot_insert
  AFTER INSERT ON rules
  FOR EACH ROW
  EXECUTE FUNCTION create_rule_version_snapshot();

DROP TRIGGER IF EXISTS rules_version_snapshot_update ON rules;
CREATE TRIGGER rules_version_snapshot_update
  AFTER UPDATE ON rules
  FOR EACH ROW
  WHEN (
    OLD.conditions::text IS DISTINCT FROM NEW.conditions::text OR
    OLD.actions::text IS DISTINCT FROM NEW.actions::text OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION create_rule_version_snapshot();

-- ============================================================
-- 8. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_test_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see rules from their tenant
CREATE POLICY rules_tenant_isolation ON rules
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY rule_versions_tenant_isolation ON rule_versions
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY rule_approvals_tenant_isolation ON rule_approvals
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY rule_test_results_tenant_isolation ON rule_test_results
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

-- Service role bypass (for server-side operations)
CREATE POLICY rules_service_role ON rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY rule_versions_service_role ON rule_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY rule_approvals_service_role ON rule_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY rule_test_results_service_role ON rule_test_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 9. Grant permissions
-- ============================================================

-- Grant authenticated users access
GRANT SELECT, INSERT, UPDATE, DELETE ON rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rule_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rule_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rule_test_results TO authenticated;

-- Grant service role full access
GRANT ALL ON rules TO service_role;
GRANT ALL ON rule_versions TO service_role;
GRANT ALL ON rule_approvals TO service_role;
GRANT ALL ON rule_test_results TO service_role;

-- ============================================================
-- 10. Helper RPC functions
-- ============================================================

-- Function: Get rule with version history
CREATE OR REPLACE FUNCTION get_rule_with_history(
  p_rule_id UUID
)
RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  rule_description TEXT,
  rule_provider TEXT,
  rule_category TEXT,
  rule_conditions JSONB,
  rule_actions JSONB,
  rule_priority INTEGER,
  rule_status TEXT,
  rule_version INTEGER,
  version_history JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.description,
    r.provider,
    r.category,
    r.conditions,
    r.actions,
    r.priority,
    r.status,
    r.version,
    -- Aggregate version history as JSONB array
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'version', rv.version,
          'changeType', rv.change_type,
          'changeSummary', rv.change_summary,
          'changedBy', u.name,
          'changedAt', rv.changed_at
        )
        ORDER BY rv.version DESC
      ) FILTER (WHERE rv.id IS NOT NULL),
      '[]'::jsonb
    ) AS version_history
  FROM rules r
  LEFT JOIN rule_versions rv ON rv.rule_id = r.id
  LEFT JOIN users u ON u.id = rv.changed_by
  WHERE r.id = p_rule_id
  GROUP BY r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_rule_with_history(UUID) TO authenticated, service_role;

-- Function: Get pending approvals
CREATE OR REPLACE FUNCTION get_pending_rule_approvals(
  p_tenant_id UUID
)
RETURNS TABLE (
  approval_id UUID,
  rule_id UUID,
  rule_name TEXT,
  rule_provider TEXT,
  requested_by_name TEXT,
  requested_at TIMESTAMPTZ,
  reviewer_name TEXT,
  status TEXT,
  comments TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    r.id,
    r.name,
    r.provider,
    u1.name AS requested_by_name,
    ra.requested_at,
    u2.name AS reviewer_name,
    ra.status,
    ra.comments
  FROM rule_approvals ra
  JOIN rules r ON r.id = ra.rule_id
  LEFT JOIN users u1 ON u1.id = ra.requested_by
  LEFT JOIN users u2 ON u2.id = ra.reviewer_id
  WHERE ra.tenant_id = p_tenant_id
    AND ra.status = 'pending'
  ORDER BY ra.requested_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pending_rule_approvals(UUID) TO authenticated, service_role;

-- Function: Get rule test statistics
CREATE OR REPLACE FUNCTION get_rule_test_stats(
  p_rule_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_tests BIGINT,
  passed_tests BIGINT,
  failed_tests BIGINT,
  avg_execution_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_tests,
    COUNT(*) FILTER (WHERE rtr.passed = true)::BIGINT AS passed_tests,
    COUNT(*) FILTER (WHERE rtr.passed = false)::BIGINT AS failed_tests,
    AVG(rtr.execution_time_ms)::NUMERIC AS avg_execution_time_ms,
    (
      COUNT(*) FILTER (WHERE rtr.passed = true)::NUMERIC / 
      NULLIF(COUNT(*)::NUMERIC, 0) * 100
    ) AS success_rate
  FROM rule_test_results rtr
  WHERE rtr.rule_id = p_rule_id
    AND rtr.tested_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_rule_test_stats(UUID, INTEGER) TO authenticated, service_role;

-- Function: Rollback rule to previous version
CREATE OR REPLACE FUNCTION rollback_rule_to_version(
  p_rule_id UUID,
  p_target_version INTEGER,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_snapshot JSONB;
  v_current_version INTEGER;
BEGIN
  -- Get target version snapshot
  SELECT snapshot, version
  INTO v_snapshot, v_current_version
  FROM rule_versions
  WHERE rule_id = p_rule_id AND version = p_target_version;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Version not found'
    );
  END IF;

  -- Update rule with snapshot data
  UPDATE rules
  SET
    name = v_snapshot->>'name',
    description = v_snapshot->>'description',
    provider = v_snapshot->>'provider',
    category = v_snapshot->>'category',
    conditions = v_snapshot->'conditions',
    actions = v_snapshot->'actions',
    priority = (v_snapshot->>'priority')::INTEGER,
    version = version + 1,  -- Increment version
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_rule_id;

  RETURN jsonb_build_object(
    'success', true,
    'rolledBackToVersion', p_target_version,
    'newVersion', (SELECT version FROM rules WHERE id = p_rule_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rollback_rule_to_version(UUID, INTEGER, UUID) TO authenticated, service_role;

-- ============================================================
-- 11. Add comments for documentation
-- ============================================================

COMMENT ON TABLE rules IS 
'Individual business rules created via visual rule builder. Each rule has conditions and actions.';

COMMENT ON TABLE rule_versions IS 
'Complete version history for rules. Auto-created on every rule change. Enables rollback.';

COMMENT ON TABLE rule_approvals IS 
'Approval workflow for rules. Tracks who requested, reviewed, approved, or rejected rule changes.';

COMMENT ON TABLE rule_test_results IS 
'Test execution history for rules. Stores results from test simulator (single + batch tests).';

COMMENT ON COLUMN rules.conditions IS 
'Array of condition objects as JSONB. Example: [{"field": "customer.tier", "operator": "equals", "value": "VIP"}]';

COMMENT ON COLUMN rules.actions IS 
'Array of action objects as JSONB. Example: [{"type": "modify", "field": "priorityScore", "operation": "add", "value": 50}]';

COMMENT ON COLUMN rule_versions.snapshot IS 
'Complete snapshot of rule configuration at the time of version creation. Used for rollback.';

COMMENT ON COLUMN rule_test_results.trace IS 
'Step-by-step execution trace as JSONB. Shows which conditions matched, which actions executed, and in what order.';

-- ============================================================
-- Migration complete
-- ============================================================

