-- ============================================================================
-- Bella EIP — Bella Auto Phase 13: Business Rule Engine
-- Architectural Invariant 01: Fully Additive. No impact on production tenants.
-- Timestamp: 20260804000000
-- ============================================================================

-- Enable no-code business rule configuration for HQ
-- Rules define dynamic approval workflows, pricing constraints, allocation logic

-- =====================================================================================
-- PART 1: RULE DEFINITIONS
-- =====================================================================================

-- Rule condition operators
CREATE TYPE auto_rule_operator AS ENUM (
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'between'
);

-- Rule action types
CREATE TYPE auto_rule_action_type AS ENUM (
  'require_approval',
  'auto_approve',
  'auto_reject',
  'set_discount_limit',
  'allocate_vehicle',
  'assign_sales_person',
  'trigger_notification',
  'create_task'
);

-- 1. Business Rules Table
CREATE TABLE auto_business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule metadata
  code TEXT NOT NULL,                    -- e.g., 'high_value_approval', 'bmw_2_level'
  name TEXT NOT NULL,
  description TEXT,
  
  -- Rule scope
  entity_type TEXT NOT NULL,             -- 'quotation', 'booking', 'trade_in', 'loan'
  priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority (for conflict resolution)
  
  -- Rule definition (JSON DSL)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of condition objects
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,     -- Array of action objects
  
  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT uq_auto_business_rules_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_auto_business_rules_tenant ON auto_business_rules(tenant_id);
CREATE INDEX idx_auto_business_rules_entity ON auto_business_rules(tenant_id, entity_type);
CREATE INDEX idx_auto_business_rules_active ON auto_business_rules(tenant_id, is_active) WHERE is_active = true;

-- 2. Rule Execution Log (Immutable audit trail)
CREATE TABLE auto_rule_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  rule_id UUID NOT NULL REFERENCES auto_business_rules(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Execution context
  input_data JSONB NOT NULL,             -- Entity data at evaluation time
  matched_conditions JSONB NOT NULL,     -- Which conditions matched
  executed_actions JSONB NOT NULL,       -- Which actions were executed
  
  -- Result
  status TEXT NOT NULL,                  -- 'success', 'failed', 'skipped'
  error_message TEXT,
  execution_time_ms INTEGER,
  
  -- Audit
  executed_by UUID REFERENCES users(id),
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_auto_rule_execution_log_tenant ON auto_rule_execution_log(tenant_id);
CREATE INDEX idx_auto_rule_execution_log_rule ON auto_rule_execution_log(rule_id);
CREATE INDEX idx_auto_rule_execution_log_entity ON auto_rule_execution_log(entity_type, entity_id);

-- 3. Rule Templates (Pre-built rules for quick setup)
CREATE TABLE auto_rule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,               -- 'pricing', 'approval', 'allocation', 'notification'
  
  -- Template definition
  entity_type TEXT NOT NULL,
  conditions_template JSONB NOT NULL,
  actions_template JSONB NOT NULL,
  
  -- Configuration hints
  required_params JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Parameters user must fill
  example_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_auto_rule_templates_category ON auto_rule_templates(category);
CREATE INDEX idx_auto_rule_templates_entity ON auto_rule_templates(entity_type);

-- =====================================================================================
-- PART 2: APPROVAL WORKFLOWS (Dynamic multi-level approvals)
-- =====================================================================================

-- 4. Approval Workflow Definitions
CREATE TABLE auto_approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  
  -- Workflow levels (ordered approval chain)
  levels JSONB NOT NULL,  -- [{ level: 1, role: 'sales_manager', required_count: 1 }, { level: 2, role: 'director', required_count: 1 }]
  
  -- Workflow behavior
  allow_skip BOOLEAN NOT NULL DEFAULT false,
  timeout_hours INTEGER,
  escalation_rule JSONB,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT uq_auto_approval_workflows_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_auto_approval_workflows_tenant ON auto_approval_workflows(tenant_id);

-- 5. Approval Instances (Runtime approval tracking)
CREATE TABLE auto_approval_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  workflow_id UUID NOT NULL REFERENCES auto_approval_workflows(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Current state
  current_level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'timeout'
  
  -- Approval history
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ level: 1, approver_id: 'uuid', approved_at: '2026-08-04', comment: '...' }]
  
  -- Timing
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_auto_approval_instances_tenant ON auto_approval_instances(tenant_id);
CREATE INDEX idx_auto_approval_instances_workflow ON auto_approval_instances(workflow_id);
CREATE INDEX idx_auto_approval_instances_entity ON auto_approval_instances(entity_type, entity_id);
CREATE INDEX idx_auto_approval_instances_status ON auto_approval_instances(tenant_id, status);

-- =====================================================================================
-- PART 3: RPC FUNCTIONS
-- =====================================================================================

-- Evaluate rules for an entity
CREATE OR REPLACE FUNCTION evaluate_business_rules(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_data JSONB,
  p_user_id UUID
)
RETURNS TABLE (
  rule_id UUID,
  rule_code TEXT,
  matched BOOLEAN,
  actions JSONB,
  execution_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule RECORD;
  v_matched BOOLEAN;
  v_condition JSONB;
  v_field TEXT;
  v_operator TEXT;
  v_value JSONB;
  v_actual_value JSONB;
  v_condition_met BOOLEAN;
BEGIN
  -- Find all active rules for this entity type
  FOR v_rule IN
    SELECT r.*
    FROM auto_business_rules r
    WHERE r.tenant_id = p_tenant_id
      AND r.entity_type = p_entity_type
      AND r.is_active = true
      AND (r.effective_from IS NULL OR r.effective_from <= NOW())
      AND (r.effective_until IS NULL OR r.effective_until >= NOW())
    ORDER BY r.priority ASC
  LOOP
    v_matched := true;
    
    -- Evaluate all conditions (AND logic)
    FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
    LOOP
      v_field := v_condition->>'field';
      v_operator := v_condition->>'operator';
      v_value := v_condition->'value';
      v_actual_value := p_entity_data->v_field;
      
      -- Simple operator evaluation (extend as needed)
      v_condition_met := CASE v_operator
        WHEN 'equals' THEN v_actual_value = v_value
        WHEN 'greater_than' THEN (v_actual_value::numeric) > (v_value::numeric)
        WHEN 'less_than' THEN (v_actual_value::numeric) < (v_value::numeric)
        WHEN 'contains' THEN v_actual_value::text ILIKE '%' || (v_value::text) || '%'
        ELSE false
      END;
      
      IF NOT v_condition_met THEN
        v_matched := false;
        EXIT;
      END IF;
    END LOOP;
    
    -- Log execution
    INSERT INTO auto_rule_execution_log (
      tenant_id, rule_id, entity_type, entity_id,
      input_data, matched_conditions, executed_actions,
      status, executed_by
    )
    VALUES (
      p_tenant_id, v_rule.id, p_entity_type, p_entity_id,
      p_entity_data, v_rule.conditions, v_rule.actions,
      CASE WHEN v_matched THEN 'success' ELSE 'skipped' END,
      p_user_id
    );
    
    -- Return matched rule
    RETURN QUERY SELECT
      v_rule.id,
      v_rule.code,
      v_matched,
      v_rule.actions,
      CASE WHEN v_matched THEN 'executed' ELSE 'skipped' END::TEXT;
  END LOOP;
END;
$$;

-- Get active approval instances for user
CREATE OR REPLACE FUNCTION get_pending_approvals(
  p_tenant_id UUID,
  p_user_id UUID,
  p_user_role TEXT
)
RETURNS TABLE (
  instance_id UUID,
  workflow_name TEXT,
  entity_type TEXT,
  entity_id UUID,
  current_level INTEGER,
  requested_at TIMESTAMPTZ,
  age_hours NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ai.id,
    aw.name,
    ai.entity_type,
    ai.entity_id,
    ai.current_level,
    ai.requested_at,
    EXTRACT(EPOCH FROM (NOW() - ai.requested_at)) / 3600 AS age_hours
  FROM auto_approval_instances ai
  JOIN auto_approval_workflows aw ON aw.id = ai.workflow_id
  WHERE ai.tenant_id = p_tenant_id
    AND ai.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(aw.levels) AS level
      WHERE (level->>'level')::int = ai.current_level
        AND level->>'role' = p_user_role
    )
  ORDER BY ai.requested_at ASC;
$$;

-- =====================================================================================
-- PART 4: RLS POLICIES
-- =====================================================================================

ALTER TABLE auto_business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_rule_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_rule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_approval_instances ENABLE ROW LEVEL SECURITY;

-- Policies (tenant isolation)
CREATE POLICY tenant_access_auto_business_rules ON auto_business_rules
  FOR ALL TO authenticated
  USING (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id())
  WITH CHECK (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id());

CREATE POLICY tenant_access_auto_rule_execution_log ON auto_rule_execution_log
  FOR ALL TO authenticated
  USING (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id());

CREATE POLICY public_access_auto_rule_templates ON auto_rule_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tenant_access_auto_approval_workflows ON auto_approval_workflows
  FOR ALL TO authenticated
  USING (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id())
  WITH CHECK (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id());

CREATE POLICY tenant_access_auto_approval_instances ON auto_approval_instances
  FOR ALL TO authenticated
  USING (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id())
  WITH CHECK (get_auth_tenant_id() IS NULL OR tenant_id = get_auth_tenant_id());

-- =====================================================================================
-- PART 5: SEED SYSTEM RULE TEMPLATES
-- =====================================================================================

INSERT INTO auto_rule_templates (code, name, description, category, entity_type, conditions_template, actions_template, required_params, is_system)
VALUES
  (
    'high_value_approval',
    'High Value Transaction Approval',
    'Require 2-level approval for transactions above threshold',
    'approval',
    'quotation',
    '[{"field": "total_price", "operator": "greater_than", "value": 2000000000}]'::jsonb,
    '[{"type": "require_approval", "workflow": "two_level_approval"}]'::jsonb,
    '["price_threshold", "workflow_code"]'::jsonb,
    true
  ),
  (
    'luxury_brand_approval',
    'Luxury Brand Special Approval',
    'Require director approval for luxury brands (BMW, Mercedes, Audi)',
    'approval',
    'quotation',
    '[{"field": "brand", "operator": "in", "value": ["BMW", "Mercedes-Benz", "Audi"]}]'::jsonb,
    '[{"type": "require_approval", "workflow": "director_approval"}]'::jsonb,
    '["brands", "workflow_code"]'::jsonb,
    true
  ),
  (
    'max_discount_limit',
    'Maximum Discount Limit',
    'Set maximum discount percentage based on vehicle price',
    'pricing',
    'quotation',
    '[{"field": "total_price", "operator": "less_than", "value": 1000000000}]'::jsonb,
    '[{"type": "set_discount_limit", "value": 5}]'::jsonb,
    '["price_threshold", "max_discount_percent"]'::jsonb,
    true
  ),
  (
    'auto_allocate_showroom',
    'Auto Allocate to Showroom Vehicle',
    'Automatically allocate showroom vehicle for approved quotations',
    'allocation',
    'quotation',
    '[{"field": "status", "operator": "equals", "value": "approved"}]'::jsonb,
    '[{"type": "allocate_vehicle", "source": "showroom"}]'::jsonb,
    '["vehicle_source"]'::jsonb,
    true
  );

COMMENT ON TABLE auto_business_rules IS 'Phase 13: No-code business rule definitions for dynamic approval workflows';
COMMENT ON TABLE auto_approval_workflows IS 'Phase 13: Multi-level approval workflow configurations';
COMMENT ON TABLE auto_approval_instances IS 'Phase 13: Runtime approval tracking and status';
