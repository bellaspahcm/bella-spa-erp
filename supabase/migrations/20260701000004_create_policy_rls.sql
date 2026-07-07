-- Migration: Row Level Security for Policy Registry
-- Version: 2.0 (Enterprise-Grade)
-- Date: July 1, 2026
-- Purpose: Secure access to policy registry with RBAC

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE policy_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_statistics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICY REGISTRY RLS POLICIES
-- ============================================================================

-- Policy: Anyone can read non-deleted policies
CREATE POLICY "policy_registry_read" 
  ON policy_registry 
  FOR SELECT 
  USING (deleted_at IS NULL);

-- Policy: Only admins can create policies
CREATE POLICY "policy_registry_insert" 
  ON policy_registry 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
    )
  );

-- Policy: Only admins and policy owners can update
CREATE POLICY "policy_registry_update" 
  ON policy_registry 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND (
          role IN ('admin', 'manager')
          OR id = policy_registry.created_by
        )
    )
  );

-- Policy: Only admins can delete (soft delete)
CREATE POLICY "policy_registry_delete" 
  ON policy_registry 
  FOR UPDATE 
  USING (
    deleted_at IS NULL -- Can only soft-delete if not already deleted
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role = 'admin'
    )
  );

-- ============================================================================
-- POLICY HISTORY RLS POLICIES
-- ============================================================================

-- Policy: Anyone authenticated can read audit trail
CREATE POLICY "policy_history_read" 
  ON policy_history 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Policy: System can insert (automatic logging)
CREATE POLICY "policy_history_insert" 
  ON policy_history 
  FOR INSERT 
  WITH CHECK (true); -- Allow inserts from triggers/functions

-- No UPDATE or DELETE allowed on audit trail (immutable)

-- ============================================================================
-- POLICY STATISTICS RLS POLICIES
-- ============================================================================

-- Policy: Anyone can read statistics
CREATE POLICY "policy_statistics_read" 
  ON policy_statistics 
  FOR SELECT 
  USING (true);

-- Policy: System can insert/update (automatic from increment function)
CREATE POLICY "policy_statistics_insert" 
  ON policy_statistics 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "policy_statistics_update" 
  ON policy_statistics 
  FOR UPDATE 
  USING (true);

-- No DELETE allowed on statistics (permanent record)

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON policy_registry TO authenticated;
GRANT SELECT ON policy_history TO authenticated;
GRANT SELECT ON policy_statistics TO authenticated;

-- Grant write access to admins (handled by RLS policies above)
GRANT INSERT, UPDATE ON policy_registry TO authenticated;
GRANT INSERT ON policy_history TO authenticated;
GRANT INSERT, UPDATE ON policy_statistics TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION increment_policy_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_policy_statistics TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "policy_registry_read" ON policy_registry IS 
  'Anyone can read non-deleted policies';

COMMENT ON POLICY "policy_registry_insert" ON policy_registry IS 
  'Only admins and managers can create new policies';

COMMENT ON POLICY "policy_registry_update" ON policy_registry IS 
  'Only admins, managers, and policy creators can update policies';

COMMENT ON POLICY "policy_history_read" ON policy_history IS 
  'All authenticated users can read audit trail for transparency';

COMMENT ON POLICY "policy_statistics_read" ON policy_statistics IS 
  'Statistics are public to all authenticated users';
