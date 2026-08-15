-- Migration: finance_reversal_period_fix
-- Description: Drops the old finance_reverse_transaction function and creates an updated version.
--   Enforces that the reversal transaction is posted in the accounting period open at the target date
--   (defaulting to NOW() if not specified), rather than posting to the original transaction's period.

DROP FUNCTION IF EXISTS public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(
    p_tenant_id UUID,
    p_transaction_id UUID,
    p_idempotency_key VARCHAR,
    p_reason TEXT,
    p_reversal_date TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_orig_status VARCHAR;
    v_orig_reversal_of UUID;
    v_orig_posted_at TIMESTAMPTZ;
    v_orig_tx_currency VARCHAR;
    v_orig_func_currency VARCHAR;
    v_orig_rate NUMERIC;
    v_orig_rate_src VARCHAR;
    v_orig_rate_tgt VARCHAR;
    v_orig_rate_eff TIMESTAMPTZ;
    v_orig_desc TEXT;
    v_orig_ref_type VARCHAR;
    v_orig_ref_id VARCHAR;
    v_reversal_period_id UUID;
    v_reversal_period_status VARCHAR;
    v_reversal_tx_id UUID;
    v_existing_reversal_id UUID;
    v_existing_status VARCHAR;
    v_event_id UUID;
    v_outbox_payload JSONB;
    v_line RECORD;
    v_target_date TIMESTAMPTZ;
BEGIN
    -- 1. Determine reversal date target (default to NOW() if null)
    v_target_date := COALESCE(p_reversal_date, NOW());

    -- 2. Check if reversal is already posted (idempotency key check)
    SELECT id, status INTO v_existing_reversal_id, v_existing_status
    FROM public.finance_transactions
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_existing_reversal_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'transaction_id', v_existing_reversal_id,
            'status', v_existing_status,
            'is_duplicate', true
        );
    END IF;

    -- 3. Lock original transaction
    SELECT status, reversal_of, posted_at, transaction_currency, functional_currency,
           exchange_rate_rate, exchange_rate_source, exchange_rate_target, exchange_rate_effective,
           description, reference_type, reference_id
    INTO v_orig_status, v_orig_reversal_of, v_orig_posted_at, v_orig_tx_currency, v_orig_func_currency,
         v_orig_rate, v_orig_rate_src, v_orig_rate_tgt, v_orig_rate_eff,
         v_orig_desc, v_orig_ref_type, v_orig_ref_id
    FROM public.finance_transactions
    WHERE tenant_id = p_tenant_id
      AND id = p_transaction_id
    FOR UPDATE;

    IF v_orig_status IS NULL THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'T0001';
    END IF;

    IF v_orig_status <> 'POSTED' OR v_orig_reversal_of IS NOT NULL THEN
        RAISE EXCEPTION 'TRANSACTION_IMMUTABLE' USING ERRCODE = 'T0002';
    END IF;

    -- 4. Lookup and row lock the OPEN accounting period for the reversal target date
    SELECT id, status INTO v_reversal_period_id, v_reversal_period_status
    FROM public.finance_accounting_periods
    WHERE tenant_id = p_tenant_id
      AND period_start <= v_target_date
      AND period_end >= v_target_date
    FOR UPDATE;

    IF v_reversal_period_id IS NULL THEN
        RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_reversal_period_status <> 'OPEN' THEN
        RAISE EXCEPTION 'PERIOD_NOT_OPEN' USING ERRCODE = 'P0002';
    END IF;

    -- 5. Update original transaction status to REVERSED
    UPDATE public.finance_transactions
    SET status = 'REVERSED',
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- 6. Create Reversal Transaction Header
    v_reversal_tx_id := gen_random_uuid();
    INSERT INTO public.finance_transactions (
        id, tenant_id, idempotency_key, request_hash, source_type, source_id, status, transaction_type,
        accounting_period_id, posted_at, transaction_currency, functional_currency,
        exchange_rate_rate, exchange_rate_source, exchange_rate_target, exchange_rate_effective,
        description, reference_type, reference_id, reversal_of, created_at, updated_at
    ) VALUES (
        v_reversal_tx_id, p_tenant_id, p_idempotency_key, 'REVERSAL_HASH', v_orig_ref_type, v_orig_ref_id, 'POSTED', 'REVERSAL',
        v_reversal_period_id, v_target_date, v_orig_tx_currency, v_orig_func_currency,
        v_orig_rate, v_orig_rate_src, v_orig_rate_tgt, v_orig_rate_eff,
        'Reversal of: ' || v_orig_desc || ' (Reason: ' || p_reason || ')', v_orig_ref_type, v_orig_ref_id, p_transaction_id, NOW(), NOW()
    );

    -- 7. Copy lines with swapped debit and credit
    FOR v_line IN 
        SELECT account_id, debit_amount, debit_currency, credit_amount, credit_currency,
               debit_functional_amount, debit_functional_currency, credit_functional_amount, credit_functional_currency,
               cost_center_id, business_unit_id, location_id, project_id, department_id,
               custom_dimension_type, custom_dimension_id, memo
        FROM public.finance_transaction_lines
        WHERE transaction_id = p_transaction_id
    LOOP
        INSERT INTO public.finance_transaction_lines (
            id, tenant_id, transaction_id, account_id,
            debit_amount, debit_currency, credit_amount, credit_currency,
            debit_functional_amount, debit_functional_currency, credit_functional_amount, credit_functional_currency,
            cost_center_id, business_unit_id, location_id, project_id, department_id,
            custom_dimension_type, custom_dimension_id, memo, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), p_tenant_id, v_reversal_tx_id, v_line.account_id,
            -- Swapped amounts: original debit becomes credit, credit becomes debit
            v_line.credit_amount, v_line.credit_currency, v_line.debit_amount, v_line.debit_currency,
            v_line.credit_functional_amount, v_line.credit_functional_currency, v_line.debit_functional_amount, v_line.debit_functional_currency,
            v_line.cost_center_id, v_line.business_unit_id, v_line.location_id, v_line.project_id, v_line.department_id,
            v_line.custom_dimension_type, v_line.custom_dimension_id, 'Reversal: ' || v_line.memo, NOW(), NOW()
        );
    END LOOP;

    -- 8. Insert audit trail row
    INSERT INTO public.finance_audit_trail (
        id, tenant_id, action, actor_id, reference_type, reference_id, before_state, after_state, occurred_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, 'REVERSE_TRANSACTION', NULL, 'finance_transactions', p_transaction_id,
        jsonb_build_object('id', p_transaction_id, 'status', 'POSTED'),
        jsonb_build_object('id', p_transaction_id, 'status', 'REVERSED', 'reversal_id', v_reversal_tx_id, 'reversal_date', v_target_date), NOW()
    );

    -- 9. Insert outbox events for both the state update and reversal creation
    v_event_id := gen_random_uuid();
    v_outbox_payload := jsonb_build_object(
        'transaction_id', p_transaction_id,
        'reversal_id', v_reversal_tx_id,
        'tenant_id', p_tenant_id,
        'reversal_date', v_target_date
    );
    
    INSERT INTO public.finance_outbox_events (
        id, tenant_id, event_id, event_type, payload, status, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, v_event_id, 'finance.transaction.reversed.v1', v_outbox_payload, 'PENDING', NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_reversal_tx_id,
        'status', 'POSTED',
        'is_duplicate', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ) TO service_role;
