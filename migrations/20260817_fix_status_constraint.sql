-- H1.2 Schema Fix #2: Add QUARANTINED to status CHECK constraint
-- Date: 2026-08-17
-- Issue: O1 tests fail - status constraint missing QUARANTINED
-- Root Cause: H1.2 migration added quarantine columns but didn't update status constraint
-- Impact: Cannot INSERT/UPDATE events to QUARANTINED status

-- ============================================================================
-- Fix: Update status CHECK constraint to include QUARANTINED
-- ============================================================================

-- Drop existing constraint
ALTER TABLE finance_outbox_events 
DROP CONSTRAINT IF EXISTS finance_outbox_events_status_check;

-- Add updated constraint with QUARANTINED
-- Note: Keeping DISPATCHED for H1.1 backward compatibility (if used)
-- H1.2 states: PENDING, PROCESSING, PROCESSED, FAILED, QUARANTINED
ALTER TABLE finance_outbox_events 
ADD CONSTRAINT finance_outbox_events_status_check 
CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'QUARANTINED', 'DISPATCHED'));

COMMENT ON CONSTRAINT finance_outbox_events_status_check ON finance_outbox_events IS 
  'Valid outbox event states. H1.2 adds QUARANTINED for operational resilience (O1, O3, O5, O6).';

-- ============================================================================
-- Verification Query (run manually after migration)
-- ============================================================================

-- Check constraint updated:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'finance_outbox_events'::regclass
--   AND contype = 'c'
--   AND conname LIKE '%status%';
-- Expected: CHECK constraint includes QUARANTINED

-- Test QUARANTINED insert:
-- INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at, quarantine_reason, quarantined_at)
-- VALUES (gen_random_uuid(), '<test-tenant-id>', 'TEST', '{}', 'QUARANTINED', now(), 'TEST', now());
-- Expected: Success (no constraint violation)

-- ============================================================================
-- END OF FIX
-- ============================================================================
