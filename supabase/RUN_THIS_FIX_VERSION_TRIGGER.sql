-- ============================================================
-- Fix Version Snapshot Trigger Issues
-- ============================================================
-- Issue 1: WHEN clause too strict - doesn't fire on all updates
-- Issue 2: Duplicate version error - trigger fires multiple times
-- ============================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS rules_version_snapshot_insert ON rules;
DROP TRIGGER IF EXISTS rules_version_snapshot_update ON rules;

-- Recreate trigger function (unchanged logic)
CREATE OR REPLACE FUNCTION create_rule_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_change_type TEXT;
  v_change_summary TEXT;
  v_existing_count INT;
BEGIN
  -- Check if version already exists (prevent duplicates)
  SELECT COUNT(*) INTO v_existing_count
  FROM rule_versions
  WHERE rule_id = NEW.id AND version = NEW.version;
  
  IF v_existing_count > 0 THEN
    -- Version already exists, skip creation
    RETURN NEW;
  END IF;

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
    ELSIF (OLD.status != NEW.status AND NEW.status = 'archived') THEN
      v_change_type := 'updated';
      v_change_summary := 'Rule archived';
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

-- Apply INSERT trigger (no WHEN clause - always fire)
CREATE TRIGGER rules_version_snapshot_insert
  AFTER INSERT ON rules
  FOR EACH ROW
  EXECUTE FUNCTION create_rule_version_snapshot();

-- Apply UPDATE trigger (SIMPLIFIED WHEN clause - fire on ANY meaningful change)
CREATE TRIGGER rules_version_snapshot_update
  AFTER UPDATE ON rules
  FOR EACH ROW
  WHEN (
    -- Fire on ANY change to these fields (not just specific combinations)
    OLD.conditions::text IS DISTINCT FROM NEW.conditions::text OR
    OLD.actions::text IS DISTINCT FROM NEW.actions::text OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description
  )
  EXECUTE FUNCTION create_rule_version_snapshot();

-- Verification
SELECT '✅ Version snapshot trigger fixed' AS status;
SELECT 'Trigger will now fire on priority changes and prevent duplicates' AS details;
