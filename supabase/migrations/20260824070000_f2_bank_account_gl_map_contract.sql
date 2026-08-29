-- =========================================================================
-- Migration: F2 Bank Account GL Map Contract
-- Contract: F2_BANK_ACCOUNT_GL_MAP:v1
-- Purpose: Read-only mapping contract for F5.6 CASH_GL_BALANCE.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_bank_account_gl_map(
    p_tenant_id         UUID,
    p_bank_account_id   UUID DEFAULT NULL,
    p_contract_version  TEXT DEFAULT 'F2_BANK_ACCOUNT_GL_MAP:v1'
)
RETURNS TABLE (
    bank_account_id           UUID,
    linked_finance_account_id UUID,
    linked_account_code       VARCHAR,
    currency                  VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF p_contract_version NOT IN ('F2_BANK_ACCOUNT_GL_MAP:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_bank_account_gl_map does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED'
            USING ERRCODE = 'F5011';
    END IF;

    RETURN QUERY
    SELECT
        ba.id                         AS bank_account_id,
        ba.linked_finance_account_id  AS linked_finance_account_id,
        fa.code                       AS linked_account_code,
        ba.currency                   AS currency
    FROM public.finance_bank_accounts ba
    JOIN public.finance_accounts fa
      ON fa.tenant_id = ba.tenant_id
     AND fa.id = ba.linked_finance_account_id
     AND fa.is_active = TRUE
    WHERE ba.tenant_id = p_tenant_id
      AND ba.is_active = TRUE
      AND ba.linked_finance_account_id IS NOT NULL
      AND (p_bank_account_id IS NULL OR ba.id = p_bank_account_id)
    ORDER BY ba.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_bank_account_gl_map(UUID, UUID, TEXT) IS
    'F2_BANK_ACCOUNT_GL_MAP:v1. Read-only F2 contract exposing the minimal bank_account_id to linked GL account mapping required by F5.6 CASH_GL_BALANCE. '
    'Does not modify F2_CASH:v1, F2_OPENING:v1, effective_date semantics, or any F1/F4 contract.';

GRANT EXECUTE ON FUNCTION public.finance_bank_account_gl_map(UUID, UUID, TEXT)
    TO service_role;

