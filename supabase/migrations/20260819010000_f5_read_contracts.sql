-- =========================================================================
-- Migration: 20260819010000_f5_read_contracts
-- Component: F5.1 — Approved Read Contracts (F5-G7 Compliance)
-- Constitution: v1.2-Final (FROZEN 2026-08-16T08:25:00+07:00)
-- =========================================================================
--
-- PURPOSE:
--   Implements the four F1–F4 approved read contracts consumed by F5.
--   Each contract exposes the THREE mandatory fields required by the Constitution:
--     1. p_as_of             TIMESTAMPTZ  — Temporal boundary (F5-T-1 compliance)
--     2. p_tenant_id         UUID         — Tenant scope isolation (F5-I-8)
--     3. p_contract_version  TEXT         — Contract version for audit trail (F5-G7)
--
-- CONSTITUTIONAL RULES ENFORCED:
--   F5-G7: F5 reads F1–F4 EXCLUSIVELY via these contracts. No direct SELECT
--          against internal finance_* tables in F5 RPCs.
--   F5-T-1: Each contract filters using the domain's declared effective-date field.
--            F5 must NOT infer, substitute, or override the effective-date field.
--
-- EFFECTIVE DATE BASIS PER DOMAIN (per Constitution §4.3):
--   F1 GL:         posting_date       (finance_transaction_lines.created_at mapped to posting_date)
--   F2 Cash:       cash_effective_date (finance_cash_movements.effective_date)
--   F3 AR:         posting_date        (finance_receivable_ledger.created_at as posting_date)
--   F4 AP:         posting_date        (finance_payable_ledger.created_at as posting_date)
--   F4 Prepayment: posting_date        (finance_vendor_prepayments.created_at as posting_date)
--
-- CONTRACT VERSION REGISTRY (basis_version format: "DOMAIN:vN"):
--   "F1_GL:v1"          — first version of F1 GL read contract
--   "F2_CASH:v1"        — first version of F2 Cash read contract
--   "F3_AR:v1"          — first version of F3 AR read contract
--   "F4_AP:v1"          — first version of F4 AP + Prepayment read contract
--
-- MIGRATION ORDER:
--   Requires: 20260819000000_f5_schema.sql
--   Precedes: 20260819020000_f5_reconstruction_engine.sql
-- =========================================================================

-- =========================================================================
-- 1. F1 GENERAL LEDGER READ CONTRACT
--    finance_journal_entries_as_of
--
-- Returns all F1 journal transaction lines with posting_date <= p_as_of.
-- Scoped to tenant_id. Filters only POSTED (non-REVERSED) transactions.
--
-- Effective date basis: posting_date = finance_transactions.posted_at (F1 canonical)
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
    -- Contract version gate: F5 must consume only declared contract versions.
    -- If contract is updated and basis_version changes, this guard prevents
    -- F5 from silently consuming an incompatible contract.
    IF p_contract_version NOT IN ('F1_GL:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_journal_entries_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    -- Tenant isolation enforced at function level (F5-I-8)
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED: p_tenant_id cannot be NULL'
            USING ERRCODE = 'F5011';
    END IF;

    -- Temporal boundary required (F5-T-1)
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED: p_as_of cannot be NULL — all F5 reads must be temporally bounded'
            USING ERRCODE = 'F5012';
    END IF;

    -- Return journal lines from POSTED transactions only
    -- Effective date basis: finance_transactions.posted_at (= posting_date)
    -- Filter: posted_at <= p_as_of (records that were effective BEFORE or AT the boundary)
    RETURN QUERY
    SELECT
        ft.id                               AS transaction_id,
        ftl.id                              AS journal_line_id,
        ftl.account_id                      AS account_id,
        fa.code                             AS account_code,
        (ftl.debit_functional_amount)::NUMERIC(20,4)   AS debit_amount,
        (ftl.credit_functional_amount)::NUMERIC(20,4)  AS credit_amount,
        ft.functional_currency::CHAR(3)     AS currency,
        ft.posted_at                        AS posting_date,
        ft.source_type                      AS source_type,
        ft.source_id                        AS source_id
    FROM public.finance_transactions ft
    JOIN public.finance_transaction_lines ftl
        ON ftl.transaction_id = ft.id
        AND ftl.tenant_id     = ft.tenant_id
    JOIN public.finance_accounts fa
        ON fa.id        = ftl.account_id
        AND fa.tenant_id = ft.tenant_id
    WHERE ft.tenant_id = p_tenant_id
      AND ft.status     = 'POSTED'
      -- F5-T-1: Effective-date filtering using F1's declared field: posted_at
      AND ft.posted_at <= p_as_of
    ORDER BY ft.posted_at ASC, ft.id ASC, ftl.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_journal_entries_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F1_GL:v1. Returns POSTED journal lines with posted_at <= p_as_of. '
    'Effective-date basis: finance_transactions.posted_at (F5-T-1 compliance). '
    'SECURITY DEFINER: F5 consumes this contract; it MUST NOT query finance_transactions or '
    'finance_transaction_lines directly.';

GRANT EXECUTE ON FUNCTION public.finance_journal_entries_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 2. F2 CASH READ CONTRACT
--    finance_get_cash_movements_as_of
--
-- Returns F2 cash movements with cash_effective_date <= p_as_of.
-- Scoped to tenant_id.
--
-- Effective date basis: cash_effective_date = finance_cash_movements.effective_date (F2 canonical)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_get_cash_movements_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F2_CASH:v1'
)
RETURNS TABLE (
    movement_id          UUID,
    direction            VARCHAR,
    amount_minor         BIGINT,
    currency             CHAR(3),
    cash_effective_date  TIMESTAMPTZ,
    valuation_rate       NUMERIC(18,6)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Contract version gate
    IF p_contract_version NOT IN ('F2_CASH:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_get_cash_movements_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED' USING ERRCODE = 'F5011';
    END IF;

    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED' USING ERRCODE = 'F5012';
    END IF;

    -- Return cash movements filtered by effective_date (F5-T-1 declared field for F2)
    -- F2 effective date basis: finance_cash_movements.effective_date = cash_effective_date
    RETURN QUERY
    SELECT
        fcm.id                              AS movement_id,
        fcm.direction                       AS direction,
        fcm.amount_minor                    AS amount_minor,
        fcm.currency::CHAR(3)               AS currency,
        fcm.effective_date                  AS cash_effective_date,
        COALESCE(fcm.valuation_rate, 1.0)::NUMERIC(18,6) AS valuation_rate
    FROM public.finance_cash_movements fcm
    WHERE fcm.tenant_id = p_tenant_id
      -- F5-T-1: Effective-date filtering using F2's declared field: effective_date
      AND fcm.effective_date <= p_as_of
    ORDER BY fcm.effective_date ASC, fcm.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_get_cash_movements_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F2_CASH:v1. Returns cash movements with effective_date <= p_as_of. '
    'Effective-date basis: finance_cash_movements.effective_date (F5-T-1 compliance). '
    'SECURITY DEFINER: F5 uses this contract; it MUST NOT query finance_cash_movements directly.';

GRANT EXECUTE ON FUNCTION public.finance_get_cash_movements_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 3. F3 ACCOUNTS RECEIVABLE READ CONTRACT
--    finance_ar_facts_as_of
--
-- Returns all AR subledger (finance_receivable_ledger) facts with
-- posting_date (created_at) <= p_as_of.
-- Scoped to tenant_id.
--
-- Effective date basis: posting_date = finance_receivable_ledger.created_at (F3 canonical)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_ar_facts_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F3_AR:v1'
)
RETURNS TABLE (
    fact_id             UUID,
    invoice_id          UUID,
    entry_type          VARCHAR,
    amount_minor        BIGINT,
    posting_date        TIMESTAMPTZ,
    posting_attempt_id  UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Contract version gate
    IF p_contract_version NOT IN ('F3_AR:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_ar_facts_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED' USING ERRCODE = 'F5011';
    END IF;

    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED' USING ERRCODE = 'F5012';
    END IF;

    -- Return AR facts filtered by posting_date (F5-T-1 declared field for F3)
    -- F3 effective date basis: finance_receivable_ledger.created_at (= posting_date)
    -- Join to finance_invoices to get the posting_attempt_id for canonical identity
    RETURN QUERY
    SELECT
        frl.id              AS fact_id,
        frl.invoice_id      AS invoice_id,
        frl.entry_type      AS entry_type,
        frl.amount_minor    AS amount_minor,
        frl.created_at      AS posting_date,
        -- posting_attempt_id comes from the parent invoice (F3 idempotency anchor)
        fi.posting_attempt_id AS posting_attempt_id
    FROM public.finance_receivable_ledger frl
    JOIN public.finance_invoices fi
        ON fi.id        = frl.invoice_id
        AND fi.tenant_id = frl.tenant_id
    WHERE frl.tenant_id = p_tenant_id
      -- F5-T-1: Effective-date filtering using F3's declared field: created_at (posting_date)
      AND frl.created_at <= p_as_of
    ORDER BY frl.created_at ASC, frl.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_ar_facts_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F3_AR:v1. Returns AR subledger facts with created_at <= p_as_of. '
    'Effective-date basis: finance_receivable_ledger.created_at (F5-T-1 compliance). '
    'SECURITY DEFINER: F5 uses this contract; it MUST NOT query finance_receivable_ledger directly.';

GRANT EXECUTE ON FUNCTION public.finance_ar_facts_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 4. F4 ACCOUNTS PAYABLE & PREPAYMENTS READ CONTRACT
--    finance_ap_facts_as_of
--
-- Returns all AP subledger (finance_payable_ledger) facts AND
-- prepayment events (finance_vendor_prepayments) with
-- posting_date (created_at) <= p_as_of.
-- Scoped to tenant_id.
--
-- Effective date basis: posting_date = finance_payable_ledger.created_at (F4 canonical)
-- Prepayment effective date basis: finance_vendor_prepayments.created_at
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_ap_facts_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F4_AP:v1'
)
RETURNS TABLE (
    fact_id             UUID,
    vendor_bill_id      UUID,
    vendor_id           UUID,
    entry_type          VARCHAR,
    amount_minor        BIGINT,
    posting_date        TIMESTAMPTZ,
    posting_attempt_id  UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Contract version gate
    IF p_contract_version NOT IN ('F4_AP:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_ap_facts_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED' USING ERRCODE = 'F5011';
    END IF;

    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED' USING ERRCODE = 'F5012';
    END IF;

    -- AP Subledger facts from finance_payable_ledger
    -- F4 effective date basis: finance_payable_ledger.created_at (= posting_date)
    -- Join to finance_vendor_bills to get vendor_id and posting_attempt_id
    RETURN QUERY
    SELECT
        fpl.id                          AS fact_id,
        fpl.vendor_bill_id              AS vendor_bill_id,
        fvb.vendor_id                   AS vendor_id,
        fpl.entry_type                  AS entry_type,
        fpl.amount_minor                AS amount_minor,
        fpl.created_at                  AS posting_date,
        -- posting_attempt_id from parent bill (F4 idempotency anchor)
        fvb.posting_attempt_id          AS posting_attempt_id
    FROM public.finance_payable_ledger fpl
    JOIN public.finance_vendor_bills fvb
        ON fvb.id        = fpl.vendor_bill_id
        AND fvb.tenant_id = fpl.tenant_id
    WHERE fpl.tenant_id = p_tenant_id
      -- F5-T-1: Effective-date filtering using F4's declared field: created_at (posting_date)
      AND fpl.created_at <= p_as_of

    UNION ALL

    -- Prepayment facts from finance_vendor_prepayments
    -- F4 Prepayment effective date basis: finance_vendor_prepayments.created_at
    -- vendor_bill_id is NULL for prepayments not yet matched to a bill
    SELECT
        fvp.id                          AS fact_id,
        fvp.matched_vendor_bill_id      AS vendor_bill_id,
        fvp.vendor_id                   AS vendor_id,
        fvp.fact_type                   AS entry_type,
        fvp.amount_minor                AS amount_minor,
        fvp.created_at                  AS posting_date,
        -- posting_attempt_id from the prepayment's own idempotency key
        fvp.posting_attempt_id          AS posting_attempt_id
    FROM public.finance_vendor_prepayments fvp
    WHERE fvp.tenant_id = p_tenant_id
      -- F5-T-1: Effective-date filtering using F4 Prepayment's declared field: created_at
      AND fvp.created_at <= p_as_of

    ORDER BY posting_date ASC, fact_id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_ap_facts_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F4_AP:v1. Returns AP subledger facts AND prepayment events '
    'with created_at <= p_as_of. Effective-date basis: created_at for both AP and Prepayment '
    '(F5-T-1 compliance). SECURITY DEFINER: F5 uses this contract; it MUST NOT query '
    'finance_payable_ledger or finance_vendor_prepayments directly.';

GRANT EXECUTE ON FUNCTION public.finance_ap_facts_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 5. CONTRACT REGISTRY VIEW
--    f5_read_contract_registry
--
-- Read-only catalog of all approved F5 read contracts.
-- Used by F5 RPCs to validate p_contract_version at runtime.
-- =========================================================================

CREATE OR REPLACE VIEW public.f5_read_contract_registry AS
SELECT
    'F1_GL:v1'      AS contract_version,
    'F1'            AS domain,
    'finance_journal_entries_as_of'     AS function_name,
    'posting_date'  AS effective_date_field,
    'finance_transactions.posted_at'    AS effective_date_source,
    TRUE            AS is_active,
    'F5 Constitution v1.2-Final'        AS locked_in_constitution
UNION ALL
SELECT
    'F2_CASH:v1',
    'F2',
    'finance_get_cash_movements_as_of',
    'cash_effective_date',
    'finance_cash_movements.effective_date',
    TRUE,
    'F5 Constitution v1.2-Final'
UNION ALL
SELECT
    'F3_AR:v1',
    'F3',
    'finance_ar_facts_as_of',
    'posting_date',
    'finance_receivable_ledger.created_at',
    TRUE,
    'F5 Constitution v1.2-Final'
UNION ALL
SELECT
    'F4_AP:v1',
    'F4',
    'finance_ap_facts_as_of',
    'posting_date',
    'finance_payable_ledger.created_at AND finance_vendor_prepayments.created_at',
    TRUE,
    'F5 Constitution v1.2-Final';

COMMENT ON VIEW public.f5_read_contract_registry IS
    'F5 Constitution v1.2-Final: Canonical catalog of all approved F5 read contracts. '
    'F5 RPCs MUST validate p_contract_version against this registry. '
    'Any contract not in this registry MUST be rejected (F5-G7).';

GRANT SELECT ON public.f5_read_contract_registry TO service_role, authenticated;

-- =========================================================================
-- F5-G7 VERIFICATION COMMENT (Read Boundary Gate)
-- This migration ONLY creates read-only SELECT functions that wrap
-- internal finance_* tables. F5 RPCs (in next migration) will call
-- ONLY these four functions — NEVER the underlying tables directly.
-- Machine-checkable: grep F5 RPC bodies for direct SELECT FROM finance_*
-- =========================================================================
