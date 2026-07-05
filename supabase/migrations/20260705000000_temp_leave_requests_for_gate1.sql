-- ============================================================================
-- Temporary Leave Requests Table for Gate 1 Validation
-- Sprint 1 Decision Engine - Testing Only
-- 
-- NOTE: This is a temporary table for validating Decision Engine integration.
-- Will be removed or migrated to real HR module in future sprints.
-- ============================================================================

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'maternity', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL CHECK (days > 0),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  
  -- Approval metadata
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  approved_at TIMESTAMPTZ,
  
  -- Decision Engine metadata
  decision_id TEXT,
  decision_confidence NUMERIC(3,2),
  
  -- Tenant
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id, created_at DESC);

-- RLS policies (allow service role full access)
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to leave_requests"
  ON leave_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own leave requests"
  ON leave_requests
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid() 
    OR approved_by = auth.uid()
  );

-- Add comment
COMMENT ON TABLE leave_requests IS 'Temporary table for Decision Engine Gate 1 validation. Will be migrated or removed in future sprints.';
