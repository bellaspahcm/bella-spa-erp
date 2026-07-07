-- ============================================================================
-- Simple Statistics Update Function
-- ============================================================================
-- 
-- Rationale:
-- Simple function to update statistics in policy_registry table.
-- No complex atomic operations needed at current scale (<1M decisions/month).
-- 
-- When to migrate:
-- Extract to separate policy_statistics table when decision volume
-- exceeds ~1M/month or requires real-time aggregation.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_policy_statistics(
  p_policy_id TEXT,
  p_version TEXT,
  p_outcome TEXT,
  p_confidence NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_total INTEGER;
  v_current_confidence_sum NUMERIC;
  v_current_confidence_count INTEGER;
  v_new_avg_confidence NUMERIC;
BEGIN
  -- Get current values
  SELECT
    COALESCE(total_decisions, 0),
    COALESCE((avg_confidence * COALESCE(total_decisions, 0)), 0),
    COALESCE(total_decisions, 0)
  INTO
    v_current_total,
    v_current_confidence_sum,
    v_current_confidence_count
  FROM policy_registry
  WHERE policy_id = p_policy_id
    AND version = p_version
    AND deleted_at IS NULL;

  -- Calculate new average confidence (if confidence provided)
  IF p_confidence IS NOT NULL THEN
    v_new_avg_confidence := ROUND(
      ((v_current_confidence_sum + p_confidence) / (v_current_confidence_count + 1))::numeric,
      2
    );
  ELSE
    v_new_avg_confidence := NULL;
  END IF;

  -- Update statistics
  UPDATE policy_registry
  SET
    total_decisions = total_decisions + 1,
    total_approvals = CASE 
      WHEN p_outcome = 'approve' THEN total_approvals + 1 
      ELSE total_approvals 
    END,
    total_rejections = CASE 
      WHEN p_outcome = 'reject' THEN total_rejections + 1 
      ELSE total_rejections 
    END,
    avg_confidence = COALESCE(v_new_avg_confidence, avg_confidence),
    last_decision_at = NOW(),
    updated_at = NOW()
  WHERE policy_id = p_policy_id
    AND version = p_version
    AND deleted_at IS NULL;

  -- No error handling - failures should be logged but not throw
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION update_policy_statistics IS 
  'Simple statistics update function. Sufficient for Phase 1 scale (<1M decisions/month). Extract to separate table when volume increases.';
