-- ============================================================
-- Migration: 20260816021000_finance_quarantine_rpc
-- Component: F2.2 — Cash Projection Worker — Quarantine Boundary
-- Description:
--   Creates the trusted internal RPC finance_internal_quarantine_cash_event
--   for recording terminal failure events into the F2 quarantine table.
--   This RPC is the AUTHORITATIVE security/audit evidence for F2.2
--   terminal integrity violations.
--
-- Security Invariants:
--   • SECURITY DEFINER with fixed search_path
--   • REVOKE ALL from PUBLIC, anon, authenticated
--   • GRANT EXECUTE to service_role ONLY (Technical Identity boundary)
--   • SET LOCAL finance.allow_cash_mutation = true is required because
--     the quarantine insert also bypasses the immutable RLS guard on
--     finance_cash_quarantine (same pattern as F2.1 mutation RPCs)
--
-- ADR references: ADR-021, ADR-022, F2.2 Implementation Plan
-- F1 Freeze: Not touched. Pure F2 write path.
-- ============================================================

CREATE OR REPLACE FUNCTION public.finance_internal_quarantine_cash_event(
    p_tenant_id       UUID,
    p_event_id        UUID,
    p_event_type      VARCHAR,
    p_payload         JSONB,
    p_failure_reason  TEXT,
    p_failure_code    VARCHAR  DEFAULT 'UNKNOWN'
)
RETURNS JSONB
SET search_path = public
AS $$
DECLARE
    v_quarantine_id UUID;
BEGIN
    -- 1. Enable trusted mutation bypass for this transaction scope
    --    SET LOCAL ensures this expires when the transaction commits/rolls back.
    PERFORM set_config('finance.allow_cash_mutation', 'true', true);

    -- 2. Validate required fields
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'QUARANTINE_INVALID_TENANT' USING ERRCODE = 'Q0001';
    END IF;

    IF p_event_id IS NULL THEN
        RAISE EXCEPTION 'QUARANTINE_INVALID_EVENT_ID' USING ERRCODE = 'Q0002';
    END IF;

    IF p_failure_reason IS NULL OR length(trim(p_failure_reason)) = 0 THEN
        RAISE EXCEPTION 'QUARANTINE_MISSING_FAILURE_REASON' USING ERRCODE = 'Q0003';
    END IF;

    -- 3. Insert quarantine record
    --    ON CONFLICT DO NOTHING prevents duplicate quarantine entries
    --    for the same event_id (idempotent quarantine insertion).
    v_quarantine_id := gen_random_uuid();

    -- Use 'PENDING' to comply with check constraint: CHECK (status IN ('PENDING', 'RESOLVED'))
    INSERT INTO public.finance_cash_quarantine (
        id,
        tenant_id,
        event_id,
        event_type,
        payload,
        status,
        failure_reason,
        created_at
    ) VALUES (
        v_quarantine_id,
        p_tenant_id,
        p_event_id,
        p_event_type,
        p_payload,
        'PENDING',
        p_failure_reason || COALESCE(' [Code: ' || p_failure_code || ']', ''),
        NOW()
    )
    ON CONFLICT (event_id) DO NOTHING;

    -- If ON CONFLICT fired (duplicate event_id), retrieve the existing record
    IF NOT FOUND THEN
        SELECT id INTO v_quarantine_id
        FROM public.finance_cash_quarantine
        WHERE event_id = p_event_id;

        -- Reset mutation guard before returning
        PERFORM set_config('finance.allow_cash_mutation', 'false', true);

        RETURN jsonb_build_object(
            'success',        true,
            'quarantine_id',  v_quarantine_id,
            'is_duplicate',   true
        );
    END IF;

    -- 4. Reset mutation guard
    PERFORM set_config('finance.allow_cash_mutation', 'false', true);

    RETURN jsonb_build_object(
        'success',        true,
        'quarantine_id',  v_quarantine_id,
        'is_duplicate',   false
    );

EXCEPTION WHEN OTHERS THEN
    -- Ensure mutation guard is always reset, even on error
    PERFORM set_config('finance.allow_cash_mutation', 'false', true);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECURITY: Revoke from all public roles, grant ONLY to service_role
-- This enforces the Technical Identity boundary defined in F2.2
-- ============================================================
REVOKE ALL ON FUNCTION public.finance_internal_quarantine_cash_event(
    UUID, UUID, VARCHAR, JSONB, TEXT, VARCHAR
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.finance_internal_quarantine_cash_event(
    UUID, UUID, VARCHAR, JSONB, TEXT, VARCHAR
) FROM anon;

REVOKE ALL ON FUNCTION public.finance_internal_quarantine_cash_event(
    UUID, UUID, VARCHAR, JSONB, TEXT, VARCHAR
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.finance_internal_quarantine_cash_event(
    UUID, UUID, VARCHAR, JSONB, TEXT, VARCHAR
) TO service_role;


-- ============================================================
-- COMMENT for audit trail
-- ============================================================
COMMENT ON FUNCTION public.finance_internal_quarantine_cash_event(
    UUID, UUID, VARCHAR, JSONB, TEXT, VARCHAR
) IS
'F2.2 TRUSTED INTERNAL RPC — finance_internal_quarantine_cash_event
 PURPOSE: Record terminal F2 cash projection failures into the quarantine table.
 SECURITY: service_role ONLY. Technical Identity boundary enforced.
 AUDIT: The quarantine record is the authoritative security/audit evidence for
        F2.2 terminal integrity violations. Caller MUST emit a [SECURITY_AUDIT_SIGNAL]
        prefix log to stderr BEFORE calling this function.
 F1 IMPACT: None. Pure F2 write path. F1 tables untouched.
 ADR: ADR-021, ADR-022, F2.2 Plan Invariant §F2.2.11';
