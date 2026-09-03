-- ============================================================================
-- R4.4 — MONITORING & RECOVERY CONTROL
-- Security Incident + Recovery Audit Schema
-- 
-- Purpose: Record all authorization violations and migration failures for
--          detection, alerting, and recovery tracking.
-- 
-- Dependencies: bella_migration_approvals, bella_gate_tokens (R4.2, R4.3)
-- ============================================================================

-- ============================================================================
-- TABLE: bella_security_incidents
-- Records all security events and migration failures
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_security_incidents (
  -- Primary identification
  incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'forged_token',
    'expired_token',
    'replay_attack',
    'binding_mismatch',
    'bypass_attempt',
    'invalid_approval',
    'concurrent_execution',
    'execution_failure'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING')),
  
  -- Authorization chain linkage
  migration_id UUID,
  approval_id UUID,
  token_id UUID,
  executor_identity TEXT,
  
  -- Incident details
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_method TEXT NOT NULL, -- validateToken, consumeToken, verifyApproval, etc.
  
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  
  -- Recovery tracking
  recovery_required BOOLEAN DEFAULT FALSE,
  recovery_status TEXT CHECK (recovery_status IN (
    'none',
    'pending',
    'in_progress',
    'completed',
    'failed'
  )),
  recovery_initiated_at TIMESTAMPTZ,
  recovery_completed_at TIMESTAMPTZ,
  recovery_actions JSONB,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ DEFAULT NOW()
  
  -- Note: FK constraints to bella_migration_approvals and bella_gate_tokens
  -- omitted in MVP. Will add in production when those tables exist.
);

-- Indexes for incident queries
CREATE INDEX idx_incidents_occurred ON bella_security_incidents(occurred_at DESC);
CREATE INDEX idx_incidents_type ON bella_security_incidents(incident_type);
CREATE INDEX idx_incidents_severity ON bella_security_incidents(severity);
CREATE INDEX idx_incidents_token ON bella_security_incidents(token_id) WHERE token_id IS NOT NULL;
CREATE INDEX idx_incidents_approval ON bella_security_incidents(approval_id) WHERE approval_id IS NOT NULL;
CREATE INDEX idx_incidents_recovery_status ON bella_security_incidents(recovery_status) 
  WHERE recovery_status IS NOT NULL AND recovery_status != 'none';

-- ============================================================================
-- TABLE: bella_recovery_actions
-- Records recovery actions for each incident
-- ============================================================================

CREATE TABLE IF NOT EXISTS bella_recovery_actions (
  -- Primary identification
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  
  -- Action sequencing
  action_sequence INT NOT NULL CHECK (action_sequence > 0),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'forward_fix',
    'cleanup',
    'rollback',
    'verify',
    'investigate'
  )),
  action_description TEXT NOT NULL,
  action_sql TEXT, -- SQL for automated recovery actions
  
  -- Execution tracking
  executed_at TIMESTAMPTZ,
  executed_by TEXT NOT NULL, -- human identity or 'system'
  execution_result TEXT CHECK (execution_result IN ('success', 'failure', 'skipped', 'pending')),
  execution_details JSONB,
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_evidence TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_recovery_incident FOREIGN KEY (incident_id) 
    REFERENCES bella_security_incidents(incident_id) ON DELETE CASCADE,
  
  -- Unique constraint for sequence
  CONSTRAINT uq_recovery_sequence UNIQUE (incident_id, action_sequence)
);

-- Indexes for recovery queries
CREATE INDEX idx_recovery_incident ON bella_recovery_actions(incident_id);
CREATE INDEX idx_recovery_sequence ON bella_recovery_actions(incident_id, action_sequence);
CREATE INDEX idx_recovery_executed ON bella_recovery_actions(executed_at DESC) 
  WHERE executed_at IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- Automatically update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_incidents_updated_at
  BEFORE UPDATE ON bella_security_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_incidents_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bella_security_incidents IS 
  'R4.4 Security incident and migration failure tracking for monitoring and recovery';

COMMENT ON COLUMN bella_security_incidents.incident_type IS 
  'Type of security incident: forged_token, replay_attack, binding_mismatch, bypass_attempt, invalid_approval, concurrent_execution, execution_failure';

COMMENT ON COLUMN bella_security_incidents.severity IS 
  'Incident severity: CRITICAL (immediate threat), ERROR (failure), WARNING (suspicious)';

COMMENT ON COLUMN bella_security_incidents.detection_method IS 
  'Method that detected the incident: validateToken, consumeToken, verifyApproval, executeMigration';

COMMENT ON COLUMN bella_security_incidents.recovery_required IS 
  'Whether this incident requires recovery action (true for execution failures, false for authorization rejections)';

COMMENT ON TABLE bella_recovery_actions IS 
  'R4.4 Recovery action tracking for incident resolution';

COMMENT ON COLUMN bella_recovery_actions.action_sequence IS 
  'Sequential order of recovery actions (1, 2, 3...) for multi-step recovery';

COMMENT ON COLUMN bella_recovery_actions.action_type IS 
  'Type of recovery: forward_fix (apply fix), cleanup (remove artifacts), rollback (restore backup), verify (check state)';

-- ============================================================================
-- PRIVILEGES
-- ============================================================================

-- Executor can INSERT incidents (detected during execution)
GRANT SELECT, INSERT ON bella_security_incidents TO bella_migration_executor;
GRANT SELECT, INSERT ON bella_recovery_actions TO bella_migration_executor;

-- Executor needs sequence for generated columns
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO bella_migration_executor;

-- Developer can only READ incidents (for investigation)
GRANT SELECT ON bella_security_incidents TO bella_developer;
GRANT SELECT ON bella_recovery_actions TO bella_developer;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query recent incidents by severity
-- SELECT incident_type, severity, occurred_at, error_message 
-- FROM bella_security_incidents 
-- WHERE severity = 'CRITICAL' 
-- ORDER BY occurred_at DESC 
-- LIMIT 10;

-- Query incidents requiring recovery
-- SELECT incident_id, incident_type, recovery_status, occurred_at
-- FROM bella_security_incidents
-- WHERE recovery_required = TRUE
-- AND recovery_status IN ('pending', 'in_progress')
-- ORDER BY occurred_at DESC;

-- Query full incident → recovery chain
-- SELECT 
--   i.incident_id,
--   i.incident_type,
--   i.severity,
--   i.occurred_at,
--   r.action_sequence,
--   r.action_type,
--   r.execution_result,
--   r.executed_at
-- FROM bella_security_incidents i
-- LEFT JOIN bella_recovery_actions r ON i.incident_id = r.incident_id
-- WHERE i.incident_id = '<uuid>'
-- ORDER BY r.action_sequence;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
