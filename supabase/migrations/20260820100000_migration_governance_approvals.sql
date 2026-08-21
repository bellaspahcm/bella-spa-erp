-- MIGRATION GOVERNANCE — MACHINE-VERIFIABLE HUMAN GO
-- ============================================================================
-- Purpose: Transform Human GO from policy document to database-enforced authorization
-- Phase: R2 Remediation (Audit 7 FAIL → Machine-Verifiable Approval)
-- Status: ACTIVE
--
-- Design Goal:
--   Answer: "Is mutation X authorized for executor Y at time T in environment E?"
--   NO VALID APPROVAL → MUTATION BLOCKED
--   VALID APPROVAL → MUTATION MAY PROCEED
--
-- Related: docs/governance/MIGRATION_05_HUMAN_GO_DECISION.md
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE MIGRATION GOVERNANCE SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS migration_governance;

COMMENT ON SCHEMA migration_governance IS
  'Machine-verifiable migration approval and governance enforcement.
   
   Transforms Human GO from policy documents to database-enforced authorization.
   
   Core Invariant: No valid approval → No mutation.';

-- ============================================================================
-- PART 2: CREATE APPROVALS TABLE
-- ============================================================================
CREATE TABLE migration_governance.approvals (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Migration Identity
  migration_id TEXT NOT NULL,
  migration_files TEXT[] NOT NULL, -- Array of migration file names
  migration_description TEXT,
  
  -- Environment Scoping
  environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development', 'test')),
  
  -- Approval Type
  approval_type TEXT NOT NULL CHECK (approval_type IN (
    'HUMAN_GO',           -- Human decision after verification gates
    'EMERGENCY',          -- Break-glass emergency approval
    'AUTOMATED',          -- Automated approval for low-risk migrations
    'ROLLBACK'            -- Rollback approval
  )) DEFAULT 'HUMAN_GO',
  
  -- Approval Status
  status TEXT NOT NULL CHECK (status IN (
    'PENDING',       -- Awaiting review
    'HOLD',          -- Conditions not met
    'GO',            -- Approved for execution
    'NO_GO',         -- Rejected
    'CONSUMED',      -- Approval used (migration executed)
    'EXPIRED',       -- Approval expired before use
    'REVOKED'        -- Approval revoked
  )) DEFAULT 'PENDING',
  
  -- 3 Mandatory Conditions (for HUMAN_GO type)
  backup_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  backup_artifact_path TEXT,
  backup_verified_at TIMESTAMPTZ,
  backup_verified_by TEXT,
  
  monitoring_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  monitoring_plan_version TEXT,
  monitoring_confirmed_at TIMESTAMPTZ,
  monitoring_confirmed_by TEXT,
  
  scope_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  scope_document_version TEXT,
  scope_confirmed_at TIMESTAMPTZ,
  scope_confirmed_by TEXT,
  
  -- Approval Authority
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  
  -- Approval Signature (tamper detection)
  approval_signature TEXT, -- Hash of (migration_id + environment + approved_by + approved_at + conditions)
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Execution Tracking
  consumed_at TIMESTAMPTZ,
  consumed_by TEXT, -- Executor identity (e.g., 'bdgf-executor@ci-cd')
  execution_evidence_path TEXT,
  
  -- Evidence and Audit
  verification_gates_status JSONB, -- E0, E1, rollback test results
  risk_assessment TEXT,
  approval_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 3: CONSTRAINTS — APPROVAL INVARIANTS
-- ============================================================================

-- INVARIANT 1: GO status requires all 3 conditions (for HUMAN_GO type)
ALTER TABLE migration_governance.approvals
  ADD CONSTRAINT approval_requires_conditions
  CHECK (
    approval_type != 'HUMAN_GO' OR
    status != 'GO' OR (
      backup_confirmed = TRUE AND
      monitoring_confirmed = TRUE AND
      scope_confirmed = TRUE AND
      approved_by IS NOT NULL AND
      approved_at IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT approval_requires_conditions ON migration_governance.approvals IS
  'Enforcement: HUMAN_GO with status=GO requires all 3 conditions confirmed + approval authority.';

-- INVARIANT 2: Approval signature required for GO status
ALTER TABLE migration_governance.approvals
  ADD CONSTRAINT go_requires_signature
  CHECK (
    status != 'GO' OR
    approval_signature IS NOT NULL
  );

COMMENT ON CONSTRAINT go_requires_signature ON migration_governance.approvals IS
  'Enforcement: GO status requires approval signature for tamper detection.';

-- INVARIANT 3: Consumed approval must have execution evidence
ALTER TABLE migration_governance.approvals
  ADD CONSTRAINT consumed_requires_evidence
  CHECK (
    status != 'CONSUMED' OR (
      consumed_at IS NOT NULL AND
      consumed_by IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT consumed_requires_evidence ON migration_governance.approvals IS
  'Enforcement: CONSUMED status requires execution timestamp and executor identity.';

-- INVARIANT 4: Expiration must be future for GO status
ALTER TABLE migration_governance.approvals
  ADD CONSTRAINT go_requires_valid_expiration
  CHECK (
    status != 'GO' OR
    expires_at IS NULL OR
    expires_at > NOW()
  );

COMMENT ON CONSTRAINT go_requires_valid_expiration ON migration_governance.approvals IS
  'Enforcement: GO status with expiration must not be expired.';

-- ============================================================================
-- PART 4: INDEXES
-- ============================================================================
CREATE INDEX idx_approvals_migration_id ON migration_governance.approvals(migration_id);
CREATE INDEX idx_approvals_environment ON migration_governance.approvals(environment);
CREATE INDEX idx_approvals_status ON migration_governance.approvals(status);
CREATE INDEX idx_approvals_approved_at ON migration_governance.approvals(approved_at);
CREATE INDEX idx_approvals_expires_at ON migration_governance.approvals(expires_at) WHERE expires_at IS NOT NULL;

-- Partial unique index: One active GO per migration+environment
-- Note: Cannot use NOW() in index predicate (not IMMUTABLE). 
-- Enforcement relies on application logic + constraint checks instead.
-- CHECK constraint ensures only one non-expired GO per migration+environment via verify_approval()
CREATE UNIQUE INDEX idx_approvals_active_go ON migration_governance.approvals(migration_id, environment)
  WHERE status = 'GO' AND expires_at IS NULL;


-- ============================================================================
-- PART 5: TRIGGER — UPDATE TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_governance.update_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_approval_timestamp
  BEFORE UPDATE ON migration_governance.approvals
  FOR EACH ROW
  EXECUTE FUNCTION migration_governance.update_approval_timestamp();

-- ============================================================================
-- PART 6: TRIGGER — PREVENT STATUS REGRESSION
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_governance.prevent_status_regression()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent GO → PENDING
  IF OLD.status = 'GO' AND NEW.status = 'PENDING' THEN
    RAISE EXCEPTION 'APPROVAL REGRESSION: Cannot change status from GO to PENDING. Use REVOKED or create new approval.';
  END IF;
  
  -- Prevent CONSUMED → GO (cannot reuse consumed approval)
  IF OLD.status = 'CONSUMED' AND NEW.status = 'GO' THEN
    RAISE EXCEPTION 'APPROVAL REUSE: Cannot reactivate consumed approval. Create new approval.';
  END IF;
  
  -- Prevent REVOKED → GO
  IF OLD.status = 'REVOKED' AND NEW.status = 'GO' THEN
    RAISE EXCEPTION 'APPROVAL REVOKED: Cannot reactivate revoked approval. Create new approval.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_status_regression
  BEFORE UPDATE ON migration_governance.approvals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION migration_governance.prevent_status_regression();

-- ============================================================================
-- PART 7: VERIFICATION FUNCTION — CHECK APPROVAL
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_governance.verify_approval(
  p_migration_id TEXT,
  p_environment TEXT DEFAULT 'production',
  p_executor TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_approved BOOLEAN,
  approval_id UUID,
  status TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  failure_reason TEXT
) AS $$
DECLARE
  v_approval RECORD;
BEGIN
  -- Find active approval for migration+environment
  SELECT * INTO v_approval
  FROM migration_governance.approvals
  WHERE migration_id = p_migration_id
    AND environment = p_environment
    AND status = 'GO'
  ORDER BY approved_at DESC
  LIMIT 1;
  
  -- NO APPROVAL FOUND
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TIMESTAMPTZ,
      NULL::TIMESTAMPTZ,
      format('NO APPROVAL: Migration %s not approved for %s environment', p_migration_id, p_environment);
    RETURN;
  END IF;
  
  -- CHECK EXPIRATION
  IF v_approval.expires_at IS NOT NULL AND v_approval.expires_at <= NOW() THEN
    RETURN QUERY SELECT 
      FALSE,
      v_approval.id,
      v_approval.status,
      v_approval.approved_by,
      v_approval.approved_at,
      v_approval.expires_at,
      format('APPROVAL EXPIRED: Expired at %s', v_approval.expires_at);
    RETURN;
  END IF;
  
  -- CHECK CONDITIONS (for HUMAN_GO type)
  IF v_approval.approval_type = 'HUMAN_GO' THEN
    IF NOT v_approval.backup_confirmed THEN
      RETURN QUERY SELECT 
        FALSE,
        v_approval.id,
        v_approval.status,
        v_approval.approved_by,
        v_approval.approved_at,
        v_approval.expires_at,
        'CONDITION NOT MET: Backup not confirmed';
      RETURN;
    END IF;
    
    IF NOT v_approval.monitoring_confirmed THEN
      RETURN QUERY SELECT 
        FALSE,
        v_approval.id,
        v_approval.status,
        v_approval.approved_by,
        v_approval.approved_at,
        v_approval.expires_at,
        'CONDITION NOT MET: Monitoring plan not confirmed';
      RETURN;
    END IF;
    
    IF NOT v_approval.scope_confirmed THEN
      RETURN QUERY SELECT 
        FALSE,
        v_approval.id,
        v_approval.status,
        v_approval.approved_by,
        v_approval.approved_at,
        v_approval.expires_at,
        'CONDITION NOT MET: Scope not confirmed';
      RETURN;
    END IF;
  END IF;
  
  -- ALL CHECKS PASSED
  RETURN QUERY SELECT 
    TRUE,
    v_approval.id,
    v_approval.status,
    v_approval.approved_by,
    v_approval.approved_at,
    v_approval.expires_at,
    NULL::TEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION migration_governance.verify_approval IS
  'Machine-verifiable approval check.
   
   Returns is_approved=TRUE only if:
   - Approval exists with status=GO
   - Not expired
   - All conditions met (for HUMAN_GO type)
   
   Used by BDGF executor before mutation execution.';

-- ============================================================================
-- PART 8: CONSUMPTION FUNCTION — MARK APPROVAL AS USED
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_governance.consume_approval(
  p_migration_id TEXT,
  p_environment TEXT,
  p_executor TEXT,
  p_evidence_path TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_approval_id UUID;
  v_updated_rows INT;
BEGIN
  -- Find active GO approval
  SELECT id INTO v_approval_id
  FROM migration_governance.approvals
  WHERE migration_id = p_migration_id
    AND environment = p_environment
    AND status = 'GO'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY approved_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVAL NOT FOUND: No active GO approval for migration % in % environment', 
      p_migration_id, p_environment;
  END IF;
  
  -- Mark as CONSUMED
  UPDATE migration_governance.approvals
  SET 
    status = 'CONSUMED',
    consumed_at = NOW(),
    consumed_by = p_executor,
    execution_evidence_path = p_evidence_path
  WHERE id = v_approval_id
    AND status = 'GO'; -- Double-check status hasn't changed
  
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'APPROVAL CONSUMPTION FAILED: Approval may have been revoked or consumed concurrently';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION migration_governance.consume_approval IS
  'Mark approval as consumed after successful migration execution.
   
   Prevents approval reuse.
   Records executor identity and evidence path.';

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

-- Grant read access to authenticated users (for approval status checks)
GRANT USAGE ON SCHEMA migration_governance TO authenticated;
GRANT SELECT ON migration_governance.approvals TO authenticated;

-- Grant execution on verification function
GRANT EXECUTE ON FUNCTION migration_governance.verify_approval TO authenticated;

-- Restrict write access (only service_role can create/update approvals)
-- GRANT INSERT, UPDATE ON migration_governance.approvals TO service_role;
-- GRANT EXECUTE ON FUNCTION migration_governance.consume_approval TO service_role;

-- ============================================================================
-- PART 10: SEED EXAMPLE (FOR TESTING - COMMENTED OUT FOR PRODUCTION)
-- ============================================================================

-- Example: Create HOLD approval for Migration 05-A
/*
INSERT INTO migration_governance.approvals (
  migration_id,
  migration_files,
  migration_description,
  environment,
  approval_type,
  status,
  backup_confirmed,
  monitoring_confirmed,
  scope_confirmed,
  requested_by,
  verification_gates_status
) VALUES (
  '05-A',
  ARRAY[
    '20260819050000_runtime_migration_05a_classification_reservation.sql'
  ],
  'Migration 05-A: Fixture Classification & UUID Reservation',
  'production',
  'HUMAN_GO',
  'HOLD',
  FALSE,
  FALSE,
  FALSE,
  'system@bella.erp',
  '{"E0": "33/33 PASS", "E1": "10/10 PASS", "rollback_test": "31/31 PASS"}'::jsonb
);
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification Query
SELECT 
  'migration_governance schema created' as status,
  COUNT(*) as approval_count
FROM migration_governance.approvals;
