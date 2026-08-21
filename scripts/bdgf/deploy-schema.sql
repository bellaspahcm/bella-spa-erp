-- ============================================================================
-- BDGF PRODUCTION SCHEMA DEPLOYMENT
-- ============================================================================
-- 
-- This script deploys all BDGF tables to production.
-- Run this with bella_migration_executor role.
-- 
-- Date: 2026-08-20
-- Phase: BDGF MVP Deployment
-- 
-- ============================================================================

-- ============================================================================
-- R4.2: APPROVAL GATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_gate_approvals (
  approval_id TEXT PRIMARY KEY,
  migration_hash TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  target_schema TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('human', 'automated', 'emergency')),
  approval_notes TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_hash 
  ON bella_gate_approvals(migration_hash);
CREATE INDEX IF NOT EXISTS idx_approvals_environment 
  ON bella_gate_approvals(target_environment);
CREATE INDEX IF NOT EXISTS idx_approvals_approved_at 
  ON bella_gate_approvals(approved_at DESC);

COMMENT ON TABLE bella_gate_approvals IS 
  'R4.2 Approval Gate: Records migration approvals before token issuance';

-- ============================================================================
-- R4.3: EXECUTION AUTHORITY (Gate Tokens)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_gate_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id TEXT NOT NULL,
  migration_id UUID NOT NULL,
  migration_hash TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  target_schema TEXT NOT NULL,
  executor_identity TEXT NOT NULL,
  execution_attempt_id UUID NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_by TEXT,
  execution_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_approval 
  ON bella_gate_tokens(approval_id);
CREATE INDEX IF NOT EXISTS idx_tokens_migration 
  ON bella_gate_tokens(migration_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash 
  ON bella_gate_tokens(migration_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_used 
  ON bella_gate_tokens(used, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_issued_at 
  ON bella_gate_tokens(issued_at DESC);

-- Foreign key to approvals (if approval table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bella_gate_approvals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'bella_gate_tokens' 
      AND constraint_name = 'fk_token_approval'
    ) THEN
      ALTER TABLE bella_gate_tokens 
        ADD CONSTRAINT fk_token_approval 
        FOREIGN KEY (approval_id) 
        REFERENCES bella_gate_approvals(approval_id);
    END IF;
  END IF;
END $$;

COMMENT ON TABLE bella_gate_tokens IS 
  'R4.3 Execution Authority: Cryptographically signed single-use gate tokens';

-- ============================================================================
-- R4.4.1: SECURITY MONITORING (Incidents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_security_incidents (
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO')),
  token_id UUID,
  approval_id TEXT,
  migration_id UUID,
  migration_hash TEXT,
  executor_identity TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_latency_ms INTEGER GENERATED ALWAYS AS 
    (EXTRACT(EPOCH FROM (detected_at - occurred_at)) * 1000) STORED,
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  recovery_required BOOLEAN DEFAULT FALSE,
  recovery_status TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_type 
  ON bella_security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity 
  ON bella_security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_token 
  ON bella_security_incidents(token_id);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred 
  ON bella_security_incidents(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_unresolved 
  ON bella_security_incidents(recovery_required, resolved_at) 
  WHERE resolved_at IS NULL;

COMMENT ON TABLE bella_security_incidents IS 
  'R4.4.1 Security Monitoring: Detected security incidents and failures';

-- ============================================================================
-- R4.4.2: RECOVERY CONTROL (Recovery Actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_recovery_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('verify', 'rollback', 'forward_fix', 'cleanup', 'inspect')),
  action_description TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by TEXT NOT NULL,
  execution_result TEXT CHECK (execution_result IN ('success', 'failure', 'pending', 'skipped')),
  execution_details JSONB,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_incident 
  ON bella_recovery_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_recovery_type 
  ON bella_recovery_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_recovery_result 
  ON bella_recovery_actions(execution_result);
CREATE INDEX IF NOT EXISTS idx_recovery_executed 
  ON bella_recovery_actions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_unverified 
  ON bella_recovery_actions(verified, verified_at) 
  WHERE verified = FALSE;

-- Foreign key to incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'bella_recovery_actions' 
    AND constraint_name = 'fk_recovery_incident'
  ) THEN
    ALTER TABLE bella_recovery_actions 
      ADD CONSTRAINT fk_recovery_incident 
      FOREIGN KEY (incident_id) 
      REFERENCES bella_security_incidents(incident_id);
  END IF;
END $$;

COMMENT ON TABLE bella_recovery_actions IS 
  'R4.4.2 Recovery Control: Recovery procedures executed for incidents';

-- ============================================================================
-- DEPLOYMENT VERIFICATION
-- ============================================================================

-- Verify all tables exist
DO $$
DECLARE
  tables TEXT[] := ARRAY['bella_gate_approvals', 'bella_gate_tokens', 
                         'bella_security_incidents', 'bella_recovery_actions'];
  tbl TEXT;
  missing_count INTEGER := 0;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE NOTICE 'MISSING: %', tbl;
      missing_count := missing_count + 1;
    ELSE
      RAISE NOTICE 'OK: %', tbl;
    END IF;
  END LOOP;
  
  IF missing_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ BDGF SCHEMA DEPLOYMENT COMPLETE';
    RAISE NOTICE 'All 4 tables deployed successfully.';
  ELSE
    RAISE EXCEPTION 'Schema deployment incomplete: % tables missing', missing_count;
  END IF;
END $$;
