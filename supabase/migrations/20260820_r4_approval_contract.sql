-- R4.2 — Approval Contract Implementation
-- Date: 2026-08-20
-- Phase: R4 — Migration Execution Gate Framework
-- Contract: R4_APPROVAL_CONTRACT_SPECIFICATION.md v1.0.0 (FROZEN)

-- ============================================================================
-- APPROVAL CONTRACT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_migration_approval (
  -- Identity
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id VARCHAR(255) NOT NULL,
  migration_hash VARCHAR(64) NOT NULL, -- SHA-256 hex (64 chars)
  
  -- Authorization
  requester_id VARCHAR(255) NOT NULL,  -- Who requested migration
  approver_id VARCHAR(255) NOT NULL,   -- Who approved migration
  approver_role VARCHAR(50) NOT NULL CHECK (approver_role IN ('admin', 'dba', 'tech_lead', 'emergency_override')),
  approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Scope
  target_environment VARCHAR(20) NOT NULL CHECK (target_environment IN ('production', 'staging', 'dev')),
  target_schema VARCHAR(255),          -- Optional schema restriction
  
  -- Validity
  expires_at TIMESTAMP NOT NULL,       -- Approval expiration (required)
  valid_from TIMESTAMP,                -- Optional: earliest execution time
  valid_until TIMESTAMP,               -- Optional: latest execution time
  
  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'revoked', 'used', 'expired', 'rejected')),
  used_at TIMESTAMP,
  used_by VARCHAR(255),
  
  -- Integrity
  approval_hash VARCHAR(64) NOT NULL,  -- Hash of approval record for tamper detection
  signature TEXT,                       -- Optional: cryptographic signature (future)
  
  -- Audit
  created_by VARCHAR(255) NOT NULL,    -- Who created approval request
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,                           -- Human context (why approval needed)
  
  -- Constraints (FROZEN - from R4.1 contract)
  CONSTRAINT no_self_approval CHECK (requester_id <> approver_id),
  CONSTRAINT unique_active_approval UNIQUE (migration_id, target_environment, status) 
    WHERE status = 'approved'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by migration_id + status
CREATE INDEX IF NOT EXISTS idx_approval_migration_status 
  ON bella_migration_approval(migration_id, status)
  WHERE status = 'approved';

-- Fast lookup for expiration checks
CREATE INDEX IF NOT EXISTS idx_approval_expiration 
  ON bella_migration_approval(expires_at, status)
  WHERE status = 'approved';

-- Audit trail by requester
CREATE INDEX IF NOT EXISTS idx_approval_requester 
  ON bella_migration_approval(requester_id, created_at DESC);

-- Audit trail by approver
CREATE INDEX IF NOT EXISTS idx_approval_approver 
  ON bella_migration_approval(approver_id, approved_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bella_migration_approval IS 
  'R4 Approval Contract - Machine-enforceable migration authorization';

COMMENT ON COLUMN bella_migration_approval.migration_hash IS 
  'SHA-256 hash of migration content - binds approval to exact migration (I1)';

COMMENT ON COLUMN bella_migration_approval.approval_hash IS 
  'SHA-256 hash of approval record - tamper detection (I7)';

COMMENT ON CONSTRAINT no_self_approval ON bella_migration_approval IS 
  'Enforces I0: Requester cannot approve their own migration';

COMMENT ON CONSTRAINT unique_active_approval ON bella_migration_approval IS 
  'Enforces I3: Only one active approval per migration+environment';

-- ============================================================================
-- STATE MACHINE DOCUMENTATION
-- ============================================================================

/*
APPROVAL STATE MACHINE:

REQUESTED → APPROVED → CONSUMED (normal path)
REQUESTED → REJECTED (declined)
REQUESTED → EXPIRED (timeout)
APPROVED → REVOKED (cancelled before use)
APPROVED → EXPIRED (not used in time)

TERMINAL STATES: CONSUMED, REJECTED, EXPIRED, REVOKED
*/

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Developer can CREATE requests (status='requested')
-- Developer CANNOT directly INSERT status='approved'
-- Approval workflow enforces requester ≠ approver

-- Migration executor can SELECT for verification
GRANT SELECT ON bella_migration_approval TO bella_migration_executor;

-- Migration executor can UPDATE status to 'used' (atomic single-use)
-- No DELETE permission (audit trail preservation)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'bella_migration_approval'
  ) THEN
    RAISE EXCEPTION 'Migration failed: bella_migration_approval table not created';
  END IF;
  
  -- Verify no_self_approval constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'no_self_approval'
  ) THEN
    RAISE EXCEPTION 'Migration failed: no_self_approval constraint not created';
  END IF;
  
  RAISE NOTICE 'R4.2 Migration: bella_migration_approval table created successfully';
END $$;
