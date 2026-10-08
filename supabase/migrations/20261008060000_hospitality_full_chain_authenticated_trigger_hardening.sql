-- ============================================================================
-- Bella Hospitality - Hotel Core Full Chain Authenticated Trigger Hardening
-- ============================================================================
-- Product: Bella Hospitality
-- Purpose:
--   Let authenticated Hospitality runtime validate canonical Party identity while
--   preserving Party ownership and RLS. The trigger validates only tenant/type;
--   it does not create a Hospitality-owned Party copy or a shared Resource kernel.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hospitality_validate_guest_party_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party_tenant_id UUID;
  v_party_type TEXT;
BEGIN
  SELECT tenant_id, party_type
  INTO v_party_tenant_id, v_party_type
  FROM public.party_parties
  WHERE id = NEW.party_id
    AND deleted_at IS NULL;

  IF v_party_tenant_id IS NULL THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_NOT_FOUND';
  END IF;

  IF v_party_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_TENANT_MISMATCH';
  END IF;

  IF v_party_type <> 'person' THEN
    RAISE EXCEPTION 'HOSPITALITY_GUEST_PARTY_MUST_BE_PERSON';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.hospitality_validate_guest_party_tenant()
IS 'Hospitality Phase 2 trigger hardening for authenticated Hotel Core full-chain proof: validates Party tenant/type under definer privileges while preserving Party ownership.';
