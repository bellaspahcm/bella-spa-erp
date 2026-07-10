-- ============================================================
-- CRITICAL FIX: Rule Management RPCs - Column Name Corrections
-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR IMMEDIATELY
-- 
-- Issue: Tests failing with "column u.name does not exist"
-- Cause: RPCs reference u.name but actual column is u.full_name
-- Also: Missing 'updated' and 'archived' in check constraints
-- ============================================================

-- Fix 1: Update get_rule_with_history RPC
DROP FUNCTION IF EXISTS get_rule_with_history(UUID);

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
          'changedBy', u.full_name, -- FIXED: u.name → u.full_name
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

-- Fix 2: Update get_pending_rule_approvals RPC
DROP FUNCTION IF EXISTS get_pending_rule_approvals(UUID);

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
    u1.full_name AS requested_by_name, -- FIXED: u1.name → u1.full_name
    ra.requested_at,
    u2.full_name AS reviewer_name,    -- FIXED: u2.name → u2.full_name
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

-- Fix 3: Update rule_versions.change_type check constraint to include 'updated'
ALTER TABLE rule_versions DROP CONSTRAINT IF EXISTS rule_versions_change_type_check;
ALTER TABLE rule_versions ADD CONSTRAINT rule_versions_change_type_check
  CHECK (change_type IN (
    'created', 
    'updated',          -- ADDED: Allow generic 'updated' change type
    'enabled', 
    'disabled', 
    'conditions_changed', 
    'actions_changed', 
    'priority_changed',
    'approved', 
    'rolled_back'
  ));

-- Fix 4: Update rules.status check constraint to include 'archived'
ALTER TABLE rules DROP CONSTRAINT IF EXISTS rules_status_check;
ALTER TABLE rules ADD CONSTRAINT rules_status_check
  CHECK (status IN (
    'draft', 
    'active', 
    'disabled', 
    'pending_approval', 
    'approved', 
    'rejected',
    'archived'          -- ADDED: Allow archiving rules (soft delete)
  ));

-- Verification
SELECT '✅ Rule Management RPC fixes applied successfully' AS status;
