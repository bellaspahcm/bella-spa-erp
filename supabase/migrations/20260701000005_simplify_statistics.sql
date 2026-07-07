-- ============================================================================
-- Simplify Statistics: Merge into policy_registry table
-- ============================================================================
-- 
-- Rationale:
-- Separate policy_statistics table with Postgres functions is premature
-- optimization for Phase 1. Statistics can live in policy_registry until
-- we exceed ~1M decisions/month.
-- 
-- Migration path:
-- When statistics become bottleneck (>1M decisions/month), extract back to
-- separate table with proper partitioning and aggregation.
-- ============================================================================

-- Add statistics columns to policy_registry
ALTER TABLE policy_registry ADD COLUMN IF NOT EXISTS
  total_decisions INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  avg_confidence NUMERIC(3,2),
  last_decision_at TIMESTAMPTZ;

-- Add index for statistics queries
CREATE INDEX IF NOT EXISTS idx_policy_registry_statistics 
ON policy_registry (total_decisions DESC, last_decision_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Migration: Copy existing statistics data (if any)
-- ============================================================================

-- Copy data from policy_statistics to policy_registry (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'policy_statistics') THEN
    UPDATE policy_registry pr
    SET
      total_decisions = ps.total_decisions,
      total_approvals = ps.total_approvals,
      total_rejections = ps.total_rejections,
      avg_confidence = CASE 
        WHEN ps.confidence_count > 0 
        THEN ROUND((ps.confidence_sum / ps.confidence_count)::numeric, 2)
        ELSE NULL
      END,
      last_decision_at = ps.last_decision_at
    FROM policy_statistics ps
    WHERE pr.policy_id = ps.policy_id 
      AND pr.version = ps.version;
  END IF;
END $$;

-- ============================================================================
-- Cleanup: Drop old statistics infrastructure
-- ============================================================================

-- Drop old Postgres functions
DROP FUNCTION IF EXISTS increment_policy_statistics(TEXT, TEXT, TEXT, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS get_policy_statistics(TEXT, TEXT);

-- Drop old statistics table
DROP TABLE IF EXISTS policy_statistics;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN policy_registry.total_decisions IS 
  'Total number of decisions made using this policy version';

COMMENT ON COLUMN policy_registry.total_approvals IS 
  'Number of decisions that resulted in approval';

COMMENT ON COLUMN policy_registry.total_rejections IS 
  'Number of decisions that resulted in rejection';

COMMENT ON COLUMN policy_registry.avg_confidence IS 
  'Average confidence score (0-1) across all decisions';

COMMENT ON COLUMN policy_registry.last_decision_at IS 
  'Timestamp of the most recent decision using this policy';
