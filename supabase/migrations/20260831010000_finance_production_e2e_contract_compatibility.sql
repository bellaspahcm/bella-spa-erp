-- Migration: finance_production_e2e_contract_compatibility
-- Purpose: Keep existing F4 AP lifecycle RPCs compatible with the current F1
-- ledger contract while production-hardening E2E proof runs on test/pre-prod.
--
-- Scope is intentionally narrow:
--   1. finance_validate_period_for_date reads finance_accounting_periods.
--   2. Legacy 6-argument finance_post_transaction delegates to the canonical
--      18-argument F1 posting RPC.
--   3. Legacy 3-argument finance_reverse_transaction delegates to the
--      canonical 5-argument reversal RPC.

CREATE OR REPLACE FUNCTION public.finance_validate_period_for_date(
    p_tenant_id UUID,
    p_date TIMESTAMPTZ
) RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.finance_accounting_periods
        WHERE tenant_id = p_tenant_id
          AND period_start <= p_date
          AND period_end >= p_date
          AND status = 'OPEN'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_post_transaction(
    p_tenant_id UUID,
    p_transaction_type VARCHAR,
    p_posted_at TIMESTAMPTZ,
    p_description TEXT,
    p_idempotency_key VARCHAR,
    p_legacy_lines JSONB
) RETURNS UUID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_line RECORD;
    v_lines JSONB := '[]'::JSONB;
    v_currency VARCHAR := 'VND';
    v_result JSONB;
BEGIN
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_legacy_lines) AS x(
        account_code VARCHAR,
        direction VARCHAR,
        amount_minor NUMERIC,
        currency VARCHAR
    ) LOOP
        v_currency := COALESCE(v_line.currency, v_currency);

        v_lines := v_lines || jsonb_build_array(
            jsonb_build_object(
                'account_code', v_line.account_code,
                'debit_amount_minor', CASE WHEN v_line.direction = 'DEBIT' THEN v_line.amount_minor ELSE 0 END,
                'debit_currency', COALESCE(v_line.currency, v_currency),
                'credit_amount_minor', CASE WHEN v_line.direction = 'CREDIT' THEN v_line.amount_minor ELSE 0 END,
                'credit_currency', COALESCE(v_line.currency, v_currency),
                'debit_functional_amount', CASE WHEN v_line.direction = 'DEBIT' THEN v_line.amount_minor ELSE 0 END,
                'debit_functional_currency', 'VND',
                'credit_functional_amount', CASE WHEN v_line.direction = 'CREDIT' THEN v_line.amount_minor ELSE 0 END,
                'credit_functional_currency', 'VND',
                'memo', p_description
            )
        );
    END LOOP;

    v_result := public.finance_post_transaction(
        p_tenant_id,
        p_idempotency_key,
        md5(v_lines::TEXT)::VARCHAR,
        p_transaction_type,
        p_idempotency_key,
        p_transaction_type,
        p_posted_at,
        v_currency,
        'VND',
        1,
        'IDENTITY',
        'VND',
        p_posted_at,
        p_description,
        p_transaction_type,
        p_idempotency_key,
        v_lines,
        p_posted_at::DATE
    );

    RETURN (v_result->>'transaction_id')::UUID;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(
    p_tenant_id UUID,
    p_transaction_id UUID,
    p_idempotency_key VARCHAR
) RETURNS UUID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_result JSONB;
BEGIN
    v_result := public.finance_reverse_transaction(
        p_tenant_id,
        p_transaction_id,
        p_idempotency_key,
        'Legacy F4 AP reversal compatibility bridge',
        NOW()
    );

    RETURN (v_result->>'transaction_id')::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_validate_period_for_date(UUID, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_post_transaction(UUID, VARCHAR, TIMESTAMPTZ, TEXT, VARCHAR, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, VARCHAR) TO authenticated, service_role;
