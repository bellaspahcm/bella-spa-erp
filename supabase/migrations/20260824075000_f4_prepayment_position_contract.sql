-- =========================================================================
-- Migration: F4 Prepayment Position Contract
-- Contract: F4_PREPAYMENT_POSITION:v1
-- Purpose:
--   Expose aggregate prepayment position by tenant/currency/as_of for F5.6.
--   Currency authority is F1 finance_transactions.functional_currency.
-- Scope:
--   - Additive F4 read contract only.
--   - No PREPAYMENT_GL_BALANCE runner implementation.
--   - No account-code semantic change or platform fallback.
--   - No direct F5 access to finance_vendor_prepayments.
-- =========================================================================

ALTER TABLE public.finance_vendor_prepayments
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

UPDATE public.finance_vendor_prepayments fvp
SET currency = ft.functional_currency
FROM public.finance_transactions ft
WHERE fvp.tenant_id = ft.tenant_id
  AND fvp.f1_transaction_id = ft.id
  AND ft.status = 'POSTED'
  AND fvp.currency IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'finance_vendor_prepayments_currency_chk'
          AND conrelid = 'public.finance_vendor_prepayments'::regclass
    ) THEN
        ALTER TABLE public.finance_vendor_prepayments
            ADD CONSTRAINT finance_vendor_prepayments_currency_chk
            CHECK (currency IS NULL OR currency <> '');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_vendor_prepayment_currency_guard()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_functional_currency VARCHAR(10);
BEGIN
    SELECT ft.functional_currency INTO v_functional_currency
    FROM public.finance_transactions ft
    WHERE ft.tenant_id = NEW.tenant_id
      AND ft.id = NEW.f1_transaction_id
      AND ft.status = 'POSTED';

    IF v_functional_currency IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_F1_TRANSACTION_NOT_POSTED'
            USING ERRCODE = 'F5032';
    END IF;

    IF NEW.currency IS NULL THEN
        NEW.currency := v_functional_currency;
    END IF;

    IF NEW.currency <> v_functional_currency THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_CURRENCY_MISMATCH: fact currency % does not match F1 functional currency %',
            NEW.currency,
            v_functional_currency
            USING ERRCODE = 'F5033';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_vendor_prepayment_currency_guard
    ON public.finance_vendor_prepayments;

CREATE TRIGGER trg_finance_vendor_prepayment_currency_guard
    BEFORE INSERT OR UPDATE OF f1_transaction_id, currency
    ON public.finance_vendor_prepayments
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_vendor_prepayment_currency_guard();

CREATE INDEX IF NOT EXISTS idx_finance_vendor_prepayments_position_as_of
    ON public.finance_vendor_prepayments (tenant_id, currency, created_at);

CREATE OR REPLACE FUNCTION public.finance_prepayment_position_as_of(
    p_tenant_id UUID,
    p_as_of TIMESTAMPTZ,
    p_contract_version TEXT DEFAULT 'F4_PREPAYMENT_POSITION:v1'
)
RETURNS TABLE (
    tenant_id UUID,
    currency VARCHAR,
    position_amount_minor NUMERIC(20,4),
    as_of TIMESTAMPTZ,
    fact_count INT,
    contract_version TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_unauthorized_fact_count INTEGER;
BEGIN
    IF p_contract_version NOT IN ('F4_PREPAYMENT_POSITION:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_prepayment_position_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5034';
    END IF;

    IF p_tenant_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POSITION_NULL_PARAMETER: tenant_id and as_of are required'
            USING ERRCODE = 'F5035';
    END IF;

    SELECT COUNT(*) INTO v_unauthorized_fact_count
    FROM public.finance_vendor_prepayments fvp
    LEFT JOIN public.finance_transactions ft
      ON ft.tenant_id = fvp.tenant_id
     AND ft.id = fvp.f1_transaction_id
     AND ft.status = 'POSTED'
     AND ft.functional_currency = fvp.currency
    WHERE fvp.tenant_id = p_tenant_id
      AND fvp.created_at <= p_as_of
      AND ft.id IS NULL;

    IF v_unauthorized_fact_count > 0 THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POSITION_CURRENCY_AUTHORITY_MISSING: % facts lack POSTED F1 functional_currency authority',
            v_unauthorized_fact_count
            USING ERRCODE = 'F5036';
    END IF;

    RETURN QUERY
    SELECT
        fvp.tenant_id,
        fvp.currency,
        SUM(
            CASE fvp.fact_type
                WHEN 'PREPAYMENT_RECORDED' THEN fvp.amount_minor
                WHEN 'PREPAYMENT_APPLIED' THEN -fvp.amount_minor
                WHEN 'PREPAYMENT_REFUNDED' THEN -fvp.amount_minor
                ELSE 0
            END
        )::NUMERIC(20,4) AS position_amount_minor,
        p_as_of AS as_of,
        COUNT(*)::INT AS fact_count,
        p_contract_version AS contract_version
    FROM public.finance_vendor_prepayments fvp
    WHERE fvp.tenant_id = p_tenant_id
      AND fvp.created_at <= p_as_of
    GROUP BY fvp.tenant_id, fvp.currency
    ORDER BY fvp.currency ASC;
END;
$$;

COMMENT ON COLUMN public.finance_vendor_prepayments.currency IS
    'F4 prepayment fact currency, derived from authoritative F1 finance_transactions.functional_currency for GL reconciliation.';

COMMENT ON FUNCTION public.finance_vendor_prepayment_currency_guard() IS
    'Guards F4 prepayment fact currency against authoritative POSTED F1 functional_currency.';

COMMENT ON FUNCTION public.finance_prepayment_position_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F4_PREPAYMENT_POSITION:v1. Read-only aggregate prepayment position by tenant and F1 functional currency as of a temporal boundary.';

GRANT EXECUTE ON FUNCTION public.finance_prepayment_position_as_of(UUID, TIMESTAMPTZ, TEXT) TO service_role;
