-- O10: Reconciliation Support — Journal Idempotency Key
-- Date: 2026-08-17
-- Constitution: v1.3 FROZEN (O10)
-- Purpose: Enable reconciliation between finance_outbox_events and journal_entries
-- Constraint: ADDITIVE ONLY (preserves existing schema)

-- ============================================================================
-- Add idempotency_key to journal_entries
-- ============================================================================

ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_journal_idempotency
ON journal_entries (idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN journal_entries.idempotency_key IS 'Finance Outbox event_id for reconciliation (O10)';

-- ============================================================================
-- Reconciliation Query Template (O10)
-- ============================================================================

-- Detect discrepancies between outbox and journal:
-- 
-- SELECT 
--   o.event_id,
--   o.status AS outbox_status,
--   o.transaction_id,
--   j.id AS journal_id,
--   j.status AS journal_status,
--   CASE 
--     WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
--     WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
--     WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
--     ELSE 'CONSISTENT'
--   END AS discrepancy_type
-- FROM finance_outbox_events o
-- LEFT JOIN journal_entries j ON j.idempotency_key = o.event_id
-- WHERE o.tenant_id = $1
--   AND discrepancy_type != 'CONSISTENT'
-- ORDER BY o.created_at;

-- ============================================================================
-- Manual Resolution Guidance (O10)
-- ============================================================================

-- ORPHANED_JOURNAL: Mark outbox PROCESSED (Finance already succeeded)
--   UPDATE finance_outbox_events 
--   SET status = 'PROCESSED', processed_at = now() 
--   WHERE event_id = $1;

-- MISSING_JOURNAL: Replay event (if Finance idempotency safe)
--   -- Use replay function from finance-outbox-replay.ts

-- DUPLICATE_JOURNAL: Archive duplicate, investigate idempotency bug
--   -- Manual review required

-- TENANT_MISMATCH: Data corruption / security breach
--   -- Escalate to admin immediately

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
