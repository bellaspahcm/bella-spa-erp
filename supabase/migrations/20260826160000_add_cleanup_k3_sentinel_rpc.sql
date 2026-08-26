-- ============================================================================
-- Migration: Add cleanup_k3_sentinel_encounter RPC (TEST-ONLY)
--
-- Purpose: Allows the K3 Clinic integration test to clean up sentinel encounters
-- that have associated hc_clinical_decisions records. Because clinical_decisions
-- is immutable (tr_block_mutation_decisions trigger raises on UPDATE/DELETE),
-- the test cannot directly cascade-delete an encounter that has decisions.
--
-- This SECURITY DEFINER function executes as the table owner, temporarily
-- disabling the trigger, deleting in FK-safe order, then re-enabling.
--
-- MUST NEVER be called in production application code.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_k3_sentinel_encounter(p_encounter_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable the immutable-guard trigger temporarily for test cleanup
  ALTER TABLE public.hc_clinical_decisions DISABLE TRIGGER tr_block_mutation_decisions;

  -- Delete in FK-safe order (children before parent)
  DELETE FROM public.hc_clinical_decisions   WHERE encounter_id = p_encounter_id;
  DELETE FROM public.hc_nursing_vital_signs  WHERE encounter_id = p_encounter_id;
  DELETE FROM public.hc_clinical_orders      WHERE encounter_id = p_encounter_id;
  DELETE FROM public.hc_encounters           WHERE id           = p_encounter_id;

  -- Re-enable the immutable-guard trigger
  ALTER TABLE public.hc_clinical_decisions ENABLE TRIGGER tr_block_mutation_decisions;

EXCEPTION WHEN OTHERS THEN
  -- Always re-enable the trigger even if cleanup fails
  ALTER TABLE public.hc_clinical_decisions ENABLE TRIGGER tr_block_mutation_decisions;
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.cleanup_k3_sentinel_encounter(UUID) IS
'TEST-ONLY: Cleans up K3 sentinel encounter data, bypassing the immutable clinical_decisions trigger. Must never be called in production.';
