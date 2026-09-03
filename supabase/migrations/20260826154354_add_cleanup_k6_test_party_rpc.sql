-- ============================================================================
-- Migration: Add cleanup_k6_test_party RPC (TEST-ONLY)
--
-- Purpose: Allows the K6 integration test to clean up patient parties
-- that have associated timeline_events records. Because timeline_events
-- is immutable (timeline_events_no_delete rule does INSTEAD NOTHING),
-- the test cannot directly delete a party if it has cascade deletes
-- defined on timeline_events (PostgreSQL throws an unexpected result error).
--
-- This SECURITY DEFINER function executes as the table owner, temporarily
-- disabling the rule, deleting the party and its timeline events, and re-enabling it.
--
-- MUST NEVER be called in production application code.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_k6_test_party(p_party_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable the immutable-guard rule temporarily for test cleanup
  ALTER TABLE public.timeline_events DISABLE RULE timeline_events_no_delete;

  -- Delete referencing timeline events
  DELETE FROM public.timeline_events WHERE primary_party_id = p_party_id;

  -- Delete the party itself
  DELETE FROM public.party_parties WHERE id = p_party_id;

  -- Re-enable the rule
  ALTER TABLE public.timeline_events ENABLE RULE timeline_events_no_delete;

EXCEPTION WHEN OTHERS THEN
  -- Always re-enable the rule even if cleanup fails
  ALTER TABLE public.timeline_events ENABLE RULE timeline_events_no_delete;
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.cleanup_k6_test_party(UUID) IS
'TEST-ONLY: Cleans up K6 test party data, bypassing the immutable timeline_events delete rule. Must never be called in production.';
