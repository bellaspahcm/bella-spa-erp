-- Migration: Create Policy History Table (Audit Trail)
-- Version: 2.0 (Enterprise-Grade)
-- Date: July 1, 2026
-- Purpose: Full audit trail for compliance (SOC 2, GDPR)

-- ============================================================================
-- 2. POLICY HISTORY TABLE (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Policy Reference
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  
  -- Audit Information
  action TEXT NOT NULL, -- 'created', 'updated', 'published', 'deprecated', 'archived', 'deleted'
  field_changed TEXT, -- Which field was changed (e.g., 'status', 'business_owner', 'review_date')
  old_value JSONB, -- Previous value (NULL for 'created' action)
  new_value JSONB, -- New value
  reason TEXT, -- Why the change was made (required for status changes)
  
  -- Actor Information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- IP Address (optional, for security audit)
  ip_address INET,
  user_agent TEXT,
  
  -- Constraints
  CONSTRAINT valid_action CHECK (
    action IN ('created', 'updated', 'published', 'deprecated', 'archived', 'deleted', 'restored')
  ),
  
  -- Foreign Key to Policy Registry
  FOREIGN KEY (policy_id, version) REFERENCES policy_registry(policy_id, version) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_policy_history_policy 
  ON policy_history(policy_id, version);

CREATE INDEX idx_policy_history_created_at 
  ON policy_history(created_at DESC);

CREATE INDEX idx_policy_history_action 
  ON policy_history(action);

CREATE INDEX idx_policy_history_created_by 
  ON policy_history(created_by);

-- Table Comments
COMMENT ON TABLE policy_history IS 'Full audit trail of all policy changes for compliance';
COMMENT ON COLUMN policy_history.action IS 'Type of change (created, updated, published, etc.)';
COMMENT ON COLUMN policy_history.field_changed IS 'Specific field that was modified';
COMMENT ON COLUMN policy_history.old_value IS 'Value before change (NULL for new records)';
COMMENT ON COLUMN policy_history.new_value IS 'Value after change';
COMMENT ON COLUMN policy_history.reason IS 'Business justification for the change';
