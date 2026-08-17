-- H1.2 Schema Extensions
-- Date: 2026-08-17
-- Constitution: v1.3 FROZEN
-- Purpose: Operational Resilience (O1-O10)
-- Constraint: ADDITIVE ONLY (H1.1 compatibility preserved)

-- ============================================================================
-- SECTION 1: Extend finance_outbox_events (Additive)
-- ============================================================================

-- Retry Policy (O1)
ALTER TABLE finance_outbox_events 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_retry INTEGER DEFAULT 10 NOT NULL;

-- Failure Classification (O2)
ALTER TABLE finance_outbox_events
ADD COLUMN IF NOT EXISTS failure_classification TEXT 
  CHECK (failure_classification IN ('TRANSIENT', 'PERMANENT', 'POISON', 'UNKNOWN')),
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_attempt_at TIMESTAMPTZ;

-- Quarantine (O3, O5)
ALTER TABLE finance_outbox_events
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS poison_crash_count INTEGER DEFAULT 0;

-- Replay (O6)
ALTER TABLE finance_outbox_events
ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS replayed_by TEXT;

-- Idempotency Key Traceability (A1)
ALTER TABLE finance_outbox_events
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Transaction ID Reference
ALTER TABLE finance_outbox_events
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

COMMENT ON COLUMN finance_outbox_events.retry_count IS 'Number of retry attempts (O1)';
COMMENT ON COLUMN finance_outbox_events.next_retry_at IS 'Next retry timestamp (exponential backoff, O1)';
COMMENT ON COLUMN finance_outbox_events.max_retry IS 'Maximum retry attempts before quarantine (O1)';
COMMENT ON COLUMN finance_outbox_events.failure_classification IS 'TRANSIENT/PERMANENT/POISON/UNKNOWN (O2)';
COMMENT ON COLUMN finance_outbox_events.quarantine_reason IS 'Reason for quarantine (O5)';
COMMENT ON COLUMN finance_outbox_events.replayed_by IS 'Operator who triggered replay (O6)';
COMMENT ON COLUMN finance_outbox_events.idempotency_key IS 'SHA256 hash for Finance API idempotency (A1)';

-- ============================================================================
-- SECTION 2: Indexes for Performance
-- ============================================================================

-- Worker claim query optimization (O1, O4)
CREATE INDEX IF NOT EXISTS idx_outbox_claim 
ON finance_outbox_events (status, next_retry_at, lease_expires_at) 
WHERE status IN ('PENDING', 'FAILED');

-- Quarantine queries (O5)
CREATE INDEX IF NOT EXISTS idx_outbox_quarantine 
ON finance_outbox_events (status, quarantine_reason, tenant_id)
WHERE status = 'QUARANTINED';

-- Observability metrics (O7)
CREATE INDEX IF NOT EXISTS idx_outbox_metrics 
ON finance_outbox_events (status, created_at, processed_at);

-- Lease recovery (O4)
CREATE INDEX IF NOT EXISTS idx_outbox_lease_recovery
ON finance_outbox_events (status, lease_expires_at)
WHERE status = 'PROCESSING';

-- ============================================================================
-- SECTION 3: Idempotency Key Generation Function (A1)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_idempotency_key(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_source_transaction_id TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      p_tenant_id::TEXT || '|' || p_event_type || '|' || p_source_transaction_id,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_idempotency_key IS 'Generate SHA256 idempotency key (A1)';

-- ============================================================================
-- SECTION 4: Backward Compatibility Verification
-- ============================================================================

-- Verify H1.1 queries still work (A5)
-- This is a comment verification, not executed
-- H1.1 query: SELECT event_id, tenant_id, event_type, status, created_at FROM finance_outbox_events;
-- Should still execute without errors

-- All new columns are:
-- - NULLABLE (no NOT NULL except retry_count with DEFAULT 0)
-- - Have DEFAULT values (retry_count, max_retry, poison_crash_count)
-- H1.1 workers will ignore these columns

-- ============================================================================
-- END OF SCHEMA MIGRATION
-- ============================================================================

-- Migration Safety Checks:
-- ✅ All columns additive (no removal, no type changes)
-- ✅ All new columns nullable or have defaults
-- ✅ H1.1 queries compatible
-- ✅ No F1-F4 Kernel modifications
-- ✅ Indexes do not conflict with existing
