-- ============================================================================
-- R4.3 — Execution Gate Token Table
-- ============================================================================
-- Purpose: Store and enforce single-use gate tokens for migration execution
-- Contract: docs/architecture/R4_3_EXECUTION_CONTRACT_SPECIFICATION.md v1.0.0
-- Depends On: 20260820150000_r4_approval_contract.sql
-- ============================================================================

-- Gate Token Table
CREATE TABLE IF NOT EXISTS bella_gate_tokens (
  -- Identity
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Binding to Approval (E2)
  approval_id UUID NOT NULL REFERENCES bella_migration_approval(approval_id),
  migration_id VARCHAR(255) NOT NULL,
  migration_hash VARCHAR(64) NOT NULL, -- SHA-256 of migration content
  
  -- Environment/Scope Binding (E2, E6)
  target_environment VARCHAR(50) NOT NULL,
  target_schema VARCHAR(255), -- NULL = all schemas
  
  -- Executor Binding (E2)
  executor_identity TEXT NOT NULL, -- Who is authorized to execute with this token
  execution_attempt_id UUID NOT NULL DEFAULT gen_random_uuid(), -- Unique per execution attempt
  
  -- Token Security (E2)
  nonce VARCHAR(64) NOT NULL UNIQUE, -- Replay prevention
  token_signature VARCHAR(128) NOT NULL, -- HMAC-SHA256 signature
  
  -- Temporal (E2)
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Lifecycle (E2, single-use)
  status VARCHAR(20) NOT NULL DEFAULT 'issued' 
    CHECK (status IN ('issued', 'used', 'expired', 'revoked')),
  used_at TIMESTAMPTZ, -- When token was consumed
  
  -- Execution Result (E5 - Audit)
  execution_result VARCHAR(20) CHECK (execution_result IN ('success', 'failed', 'rollback')),
  execution_error TEXT, -- Error message if failed
  
  -- Audit (E5)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  
  -- Constraints
  CONSTRAINT token_expiry_valid CHECK (expires_at > issued_at),
  CONSTRAINT token_expiry_max_ttl CHECK (expires_at <= issued_at + INTERVAL '60 seconds'),
  CONSTRAINT token_used_at_valid CHECK (used_at IS NULL OR used_at >= issued_at),
  CONSTRAINT token_used_when_status_used CHECK (
    (status = 'used' AND used_at IS NOT NULL) OR 
    (status != 'used' AND used_at IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_gate_token_approval ON bella_gate_tokens(approval_id);
CREATE INDEX idx_gate_token_nonce ON bella_gate_tokens(nonce); -- Fast replay check
CREATE INDEX idx_gate_token_status ON bella_gate_tokens(status);
CREATE INDEX idx_gate_token_expires ON bella_gate_tokens(expires_at) WHERE status = 'issued';
CREATE INDEX idx_gate_token_migration ON bella_gate_tokens(migration_id, migration_hash);

-- Unique Constraint: One token per execution attempt (E2 - single-use)
CREATE UNIQUE INDEX idx_gate_token_execution_attempt 
  ON bella_gate_tokens(execution_attempt_id);

-- ============================================================================
-- Approval State Machine Extension (E4)
-- ============================================================================
-- Add new states: 'executing', 'executed', 'execution_failed'

-- Drop existing constraint
ALTER TABLE bella_migration_approval 
  DROP CONSTRAINT IF EXISTS status_valid;

-- Add new constraint with extended states
ALTER TABLE bella_migration_approval 
  ADD CONSTRAINT status_valid CHECK (
    status IN (
      'requested',      -- Initial state
      'approved',       -- Ready for execution
      'executing',      -- Gate opened, token issued (NEW)
      'executed',       -- Successfully executed (NEW)
      'execution_failed', -- Execution failed, rollback occurred (NEW)
      'revoked',        -- Approval cancelled
      'expired',        -- Time expired before use
      'rejected'        -- Approval denied
    )
  );

-- Add execution tracking fields
ALTER TABLE bella_migration_approval 
  ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_error TEXT;

-- ============================================================================
-- Execution Audit Log (E5 - Immutability)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bella_execution_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Execution Context
  token_id UUID REFERENCES bella_gate_tokens(token_id),
  approval_id UUID REFERENCES bella_migration_approval(approval_id),
  migration_id VARCHAR(255) NOT NULL,
  migration_hash VARCHAR(64) NOT NULL,
  
  -- Environment
  target_environment VARCHAR(50) NOT NULL,
  target_schema VARCHAR(255),
  
  -- Gate Decision
  gate_decision VARCHAR(10) NOT NULL CHECK (gate_decision IN ('PASS', 'BLOCK')),
  block_reason VARCHAR(100), -- If BLOCK, why?
  
  -- Execution Result
  execution_result VARCHAR(20) CHECK (execution_result IN ('success', 'failed', 'not_attempted')),
  execution_error TEXT,
  execution_duration_ms INTEGER,
  
  -- Transaction
  transaction_committed BOOLEAN,
  
  -- Identity
  executor_identity TEXT NOT NULL,
  executor_role TEXT,
  
  -- Audit Metadata (immutable)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  
  -- Additional Context
  metadata JSONB
);

-- Append-only: NO UPDATE or DELETE allowed (E5)
CREATE INDEX idx_execution_audit_timestamp ON bella_execution_audit(timestamp DESC);
CREATE INDEX idx_execution_audit_migration ON bella_execution_audit(migration_id);
CREATE INDEX idx_execution_audit_token ON bella_execution_audit(token_id);
CREATE INDEX idx_execution_audit_decision ON bella_execution_audit(gate_decision);

-- Prevent UPDATE/DELETE on audit table (E5 - Immutability)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'bella_execution_audit is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_update_execution_audit
  BEFORE UPDATE ON bella_execution_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_delete_execution_audit
  BEFORE DELETE ON bella_execution_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================================
-- Row Level Security (RLS) - Defense in Depth
-- ============================================================================

-- Enable RLS
ALTER TABLE bella_gate_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bella_execution_audit ENABLE ROW LEVEL SECURITY;

-- Gate tokens: Only bella_migration_executor can read/write
CREATE POLICY gate_tokens_executor_only 
  ON bella_gate_tokens
  FOR ALL
  USING (current_user = 'bella_migration_executor')
  WITH CHECK (current_user = 'bella_migration_executor');

-- Audit: Everyone can read (for transparency), but only executor can insert
CREATE POLICY execution_audit_read_all
  ON bella_execution_audit
  FOR SELECT
  USING (true); -- Anyone can read audit logs

CREATE POLICY execution_audit_insert_executor_only
  ON bella_execution_audit
  FOR INSERT
  WITH CHECK (current_user = 'bella_migration_executor');

-- ============================================================================
-- Grants (Explicit Permissions)
-- ============================================================================

-- bella_migration_executor: Full access to gate tokens and audit
GRANT SELECT, INSERT, UPDATE ON bella_gate_tokens TO bella_migration_executor;
GRANT SELECT, INSERT ON bella_execution_audit TO bella_migration_executor;

-- bella_developer: Read-only audit logs (transparency)
GRANT SELECT ON bella_execution_audit TO bella_developer;

-- bella_developer: NO access to gate tokens (E1 - No Direct Executor Access)
-- (No grant means no access)

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE bella_gate_tokens IS 
  'R4.3 E2: Gate tokens for execution authorization. Single-use, short-lived (60s max), signed by secrets manager.';

COMMENT ON COLUMN bella_gate_tokens.nonce IS 
  'Unique value for replay prevention. UNIQUE constraint enforces single-use.';

COMMENT ON COLUMN bella_gate_tokens.token_signature IS 
  'HMAC-SHA256 signature of token fields using secrets manager key (not in database).';

COMMENT ON COLUMN bella_gate_tokens.executor_identity IS 
  'Who is authorized to execute with this token. Must match actual executor at runtime.';

COMMENT ON COLUMN bella_gate_tokens.execution_attempt_id IS 
  'Unique identifier for this execution attempt. Prevents token reuse across attempts.';

COMMENT ON TABLE bella_execution_audit IS 
  'R4.3 E5: Immutable audit log of all execution attempts. No UPDATE or DELETE allowed.';

COMMENT ON COLUMN bella_migration_approval.execution_started_at IS 
  'R4.3 E4: When execution began (status → executing).';

COMMENT ON COLUMN bella_migration_approval.execution_completed_at IS 
  'R4.3 E4: When execution completed (status → executed | execution_failed).';

-- ============================================================================
-- Migration Verification
-- ============================================================================

-- Verify tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bella_gate_tokens') THEN
    RAISE EXCEPTION 'bella_gate_tokens table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bella_execution_audit') THEN
    RAISE EXCEPTION 'bella_execution_audit table not created';
  END IF;
  
  RAISE NOTICE '✅ R4.3 schema migration complete';
END $$;
