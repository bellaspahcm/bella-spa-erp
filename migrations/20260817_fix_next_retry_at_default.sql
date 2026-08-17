-- H1.2 Schema Fix: Remove incorrect DEFAULT from next_retry_at
-- Date: 2026-08-17
-- Issue: O1 Schema Defect Investigation
-- Root Cause: Column created with DEFAULT now() when should have NO DEFAULT
-- Impact: O1 retry policy tests fail; new events have incorrect initial state

-- ============================================================================
-- Fix: Remove DEFAULT from next_retry_at
-- ============================================================================

ALTER TABLE finance_outbox_events 
ALTER COLUMN next_retry_at DROP DEFAULT;

COMMENT ON COLUMN finance_outbox_events.next_retry_at IS 
  'Next retry timestamp (exponential backoff, O1). NULL for new events, set on first failure.';

-- ============================================================================
-- Verification Query (run manually after migration)
-- ============================================================================

-- Check column default removed:
-- SELECT column_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'finance_outbox_events' AND column_name = 'next_retry_at';
-- Expected: column_default = NULL (or empty)

-- Test new event behavior:
-- INSERT INTO finance_outbox_events (event_id, tenant_id, event_type, payload, status, created_at)
-- VALUES (gen_random_uuid(), '<test-tenant-id>', 'TEST', '{}', 'PENDING', now());
-- SELECT retry_count, next_retry_at, next_retry_at IS NULL FROM finance_outbox_events WHERE event_id = '<inserted-id>';
-- Expected: retry_count = 0, next_retry_at = NULL, is_null = true

-- ============================================================================
-- END OF FIX
-- ============================================================================
