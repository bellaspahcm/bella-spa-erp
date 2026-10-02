-- =========================================================================
-- Migration: 20261002030000_reapply_f5_f1_read_contract_source_id_cast
-- Component: F5 read contract restore — F1_GL:v1 source_id type alignment
-- =========================================================================
--
-- ROOT CAUSE:
--   The isolated Real DB E2E database stores finance_transactions.source_id as
--   VARCHAR(255), while the existing frozen F5 F1_GL:v1 read contract declares
--   source_id UUID. PostgreSQL does not implicitly cast that column in a
--   RETURNS TABLE function, causing AR_GL_BALANCE to fail before reconciliation.
--
-- AUTHORITY:
--   Re-applies the existing F5-owned SECURITY DEFINER read contract with an
--   explicit cast to its declared UUID surface. No F1/F2/F3 engine, Beauty H8
--   core, product runtime table, or new Finance subsystem is modified.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_journal_entries_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F1_GL:v1'
)
RETURNS TABLE (
    transaction_id      UUID,
    journal_line_id     UUID,
    account_id          UUID,
    account_code        VARCHAR,
    debit_amount        NUMERIC(20,4),
    credit_amount       NUMERIC(20,4),
    currency            CHAR(3),
    posting_date        TIMESTAMPTZ,
    source_type         VARCHAR,
    source_id           UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF p_contract_version NOT IN ('F1_GL:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_journal_entries_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED: p_tenant_id cannot be NULL'
            USING ERRCODE = 'F5011';
    END IF;

    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED: p_as_of cannot be NULL - all F5 reads must be temporally bounded'
            USING ERRCODE = 'F5012';
    END IF;

    RETURN QUERY
    SELECT
        ft.id                                          AS transaction_id,
        ftl.id                                         AS journal_line_id,
        ftl.account_id                                 AS account_id,
        fa.code                                        AS account_code,
        ftl.debit_functional_amount::NUMERIC(20,4)     AS debit_amount,
        ftl.credit_functional_amount::NUMERIC(20,4)    AS credit_amount,
        ft.functional_currency::CHAR(3)                AS currency,
        ft.posted_at                                   AS posting_date,
        ft.source_type                                 AS source_type,
        ft.source_id::UUID                             AS source_id
    FROM public.finance_transactions ft
    JOIN public.finance_transaction_lines ftl
        ON ftl.transaction_id = ft.id
        AND ftl.tenant_id     = ft.tenant_id
    JOIN public.finance_accounts fa
        ON fa.id        = ftl.account_id
        AND fa.tenant_id = ft.tenant_id
    WHERE ft.tenant_id = p_tenant_id
      AND ft.status    = 'POSTED'
      AND ft.posted_at <= p_as_of
    ORDER BY ft.posted_at ASC, ft.id ASC, ftl.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_journal_entries_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F1_GL:v1. Returns POSTED journal lines with posted_at <= p_as_of. '
    'source_id is explicitly cast to UUID to match the frozen F5 contract surface.';

GRANT EXECUTE ON FUNCTION public.finance_journal_entries_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;

NOTIFY pgrst, 'reload schema';
