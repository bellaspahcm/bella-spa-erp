-- Migration: finance_security_definer_privilege_boundary
-- Purpose: close Phase 4A SECURITY DEFINER production blockers by removing
-- direct authenticated EXECUTE from privileged F1/F2 ledger/cash mutators.
--
-- These functions remain callable by service_role through server-side routes
-- and trusted RPC orchestration. Authenticated clients must not be able to call
-- raw ledger posting, reversal, or internal cash projection primitives directly.

REVOKE EXECUTE ON FUNCTION public.finance_internal_record_cash_movement(
    UUID, UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, NUMERIC, VARCHAR, NUMERIC,
    UUID, VARCHAR, VARCHAR, VARCHAR, TEXT
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finance_post_transaction(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR,
    VARCHAR, NUMERIC, VARCHAR, VARCHAR, TIMESTAMPTZ, TEXT, VARCHAR, VARCHAR,
    JSONB, DATE
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finance_post_transaction(
    UUID, VARCHAR, TIMESTAMPTZ, TEXT, VARCHAR, JSONB
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finance_reverse_transaction(
    UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finance_reverse_transaction(
    UUID, UUID, VARCHAR
) FROM authenticated;
