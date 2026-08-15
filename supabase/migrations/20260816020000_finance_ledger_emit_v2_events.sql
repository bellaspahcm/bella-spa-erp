-- Migration: finance_ledger_emit_v2_events
-- Description: Replaces F1 ledger post and reverse functions only to emit version 2 outbox events atomically alongside version 1 events.
-- Conformance: F2.2-P0-COMPAT & F1 Freeze
-- Existing accounting logic, balances, periods, and validations remain semantically equivalent.

-- 1. DROP AND RE-CREATE POST TRANSACTION FUNCTION
CREATE OR REPLACE FUNCTION public.finance_post_transaction(
    p_tenant_id UUID,
    p_idempotency_key VARCHAR,
    p_request_hash VARCHAR,
    p_source_type VARCHAR,
    p_source_id VARCHAR,
    p_transaction_type VARCHAR,
    p_posted_at TIMESTAMPTZ,
    p_transaction_currency VARCHAR,
    p_functional_currency VARCHAR,
    p_exchange_rate_rate NUMERIC,
    p_exchange_rate_source VARCHAR,
    p_exchange_rate_target VARCHAR,
    p_exchange_rate_effective TIMESTAMPTZ,
    p_description TEXT,
    p_reference_type VARCHAR,
    p_reference_id VARCHAR,
    p_lines JSONB
) RETURNS JSONB AS $$
DECLARE
    v_period_id UUID;
    v_period_status VARCHAR;
    v_tx_id UUID;
    v_existing_tx_id UUID;
    v_existing_hash VARCHAR;
    v_existing_status VARCHAR;
    v_line RECORD;
    v_total_debit_functional NUMERIC := 0;
    v_total_credit_functional NUMERIC := 0;
    v_account_id UUID;
    v_account_active BOOLEAN;
    v_account_currency VARCHAR;
    v_event_id_v1 UUID;
    v_event_id_v2 UUID;
    v_outbox_payload_v1 JSONB;
    v_outbox_payload_v2 JSONB;
    v_candidate_cash_legs JSONB;
BEGIN
    -- 1. Row Lock on target Accounting Period
    SELECT id, status INTO v_period_id, v_period_status
    FROM public.finance_accounting_periods
    WHERE tenant_id = p_tenant_id
      AND period_start <= p_posted_at
      AND period_end >= p_posted_at
    FOR UPDATE;

    IF v_period_id IS NULL THEN
        RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_period_status <> 'OPEN' THEN
        RAISE EXCEPTION 'PERIOD_NOT_OPEN' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Assert Idempotency (Same key + Same request hash)
    SELECT id, status, request_hash INTO v_existing_tx_id, v_existing_status, v_existing_hash
    FROM public.finance_transactions
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_existing_tx_id IS NOT NULL THEN
        IF v_existing_hash = p_request_hash THEN
            RETURN jsonb_build_object(
                'success', true,
                'transaction_id', v_existing_tx_id,
                'status', v_existing_status,
                'is_duplicate', true
            );
        ELSE
            RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE_CONFLICT' USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- 3. Create Transaction Header
    v_tx_id := gen_random_uuid();
    INSERT INTO public.finance_transactions (
        id, tenant_id, idempotency_key, request_hash, source_type, source_id, status, transaction_type,
        accounting_period_id, posted_at, transaction_currency, functional_currency,
        exchange_rate_rate, exchange_rate_source, exchange_rate_target, exchange_rate_effective,
        description, reference_type, reference_id, created_at, updated_at
    ) VALUES (
        v_tx_id, p_tenant_id, p_idempotency_key, p_request_hash, p_source_type, p_source_id, 'POSTED', p_transaction_type,
        v_period_id, p_posted_at, p_transaction_currency, p_functional_currency,
        p_exchange_rate_rate, p_exchange_rate_source, p_exchange_rate_target, p_exchange_rate_effective,
        p_description, p_reference_type, p_reference_id, NOW(), NOW()
    );

    -- 4. Process Lines & Validate accounts & double-entry
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        account_code VARCHAR,
        debit_amount_minor NUMERIC,
        debit_currency VARCHAR,
        credit_amount_minor NUMERIC,
        credit_currency VARCHAR,
        debit_functional_amount NUMERIC,
        debit_functional_currency VARCHAR,
        credit_functional_amount NUMERIC,
        credit_functional_currency VARCHAR,
        cost_center_id UUID,
        business_unit_id UUID,
        location_id UUID,
        project_id UUID,
        department_id UUID,
        custom_dimension_type VARCHAR,
        custom_dimension_id VARCHAR,
        memo TEXT
    ) LOOP
        -- Resolve account and lock it
        SELECT id, is_active, currency INTO v_account_id, v_account_active, v_account_currency
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id
          AND code = v_line.account_code
        FOR SHARE;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'A0001';
        END IF;

        IF NOT v_account_active THEN
            RAISE EXCEPTION 'ACCOUNT_INACTIVE' USING ERRCODE = 'A0002';
        END IF;

        -- Sum amounts for double-entry checks
        v_total_debit_functional := v_total_debit_functional + v_line.debit_functional_amount;
        v_total_credit_functional := v_total_credit_functional + v_line.credit_functional_amount;

        -- Insert line
        INSERT INTO public.finance_transaction_lines (
            id, tenant_id, transaction_id, account_id,
            debit_amount, debit_currency, credit_amount, credit_currency,
            debit_functional_amount, debit_functional_currency, credit_functional_amount, credit_functional_currency,
            cost_center_id, business_unit_id, location_id, project_id, department_id,
            custom_dimension_type, custom_dimension_id, memo, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), p_tenant_id, v_tx_id, v_account_id,
            v_line.debit_amount_minor, v_line.debit_currency, v_line.credit_amount_minor, v_line.credit_currency,
            v_line.debit_functional_amount, v_line.debit_functional_currency, v_line.credit_functional_amount, v_line.credit_functional_currency,
            v_line.cost_center_id, v_line.business_unit_id, v_line.location_id, v_line.project_id, v_line.department_id,
            v_line.custom_dimension_type, v_line.custom_dimension_id, v_line.memo, NOW(), NOW()
        );
    END LOOP;

    -- 5. Validate Double-Entry Invariant
    IF v_total_debit_functional <> v_total_credit_functional THEN
        RAISE EXCEPTION 'DOUBLE_ENTRY_IMBALANCE' USING ERRCODE = 'D0001';
    END IF;

    -- 6. Insert Audit Trail row
    INSERT INTO public.finance_audit_trail (
        id, tenant_id, action, actor_id, reference_type, reference_id, before_state, after_state, occurred_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, 'POST_TRANSACTION', NULL, 'finance_transactions', v_tx_id, NULL,
        jsonb_build_object('id', v_tx_id, 'status', 'POSTED', 'transaction_type', p_transaction_type), NOW()
    );

    -- 7. Query and construct candidate cash legs (ASSET type accounts)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'account_id', l.account_id,
            'account_code', a.code,
            'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
            'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
            'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
            'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
            'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
            'exchange_rate', p_exchange_rate_rate
        )
    ), '[]'::jsonb) INTO v_candidate_cash_legs
    FROM public.finance_transaction_lines l
    JOIN public.finance_accounts a ON l.account_id = a.id
    WHERE l.transaction_id = v_tx_id
      AND a.type = 'ASSET';

    -- 8. Build Outbox Payloads (Shared transaction metadata)
    v_event_id_v1 := gen_random_uuid();
    v_outbox_payload_v1 := jsonb_build_object(
        'transaction_id', v_tx_id,
        'tenant_id', p_tenant_id,
        'posted_at', p_posted_at,
        'transaction_type', p_transaction_type
    );

    v_event_id_v2 := gen_random_uuid();
    v_outbox_payload_v2 := jsonb_build_object(
        'event_id', v_event_id_v2,
        'event_type', 'finance.transaction.posted.v2',
        'event_version', '2.0',
        'tenant_id', p_tenant_id,
        'transaction_id', v_tx_id,
        'transaction_type', p_transaction_type,
        'posted_at', p_posted_at,
        'source_type', p_source_type,
        'source_id', p_source_id,
        'candidate_cash_legs', v_candidate_cash_legs
    );

    -- 9. Atomic Outbox Insertion (if either fails, transaction rollbacks completely)
    INSERT INTO public.finance_outbox_events (
        id, tenant_id, event_id, event_type, payload, status, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, v_event_id_v1, 'finance.transaction.posted.v1', v_outbox_payload_v1, 'PENDING', NOW()
    );

    INSERT INTO public.finance_outbox_events (
        id, tenant_id, event_id, event_type, payload, status, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, v_event_id_v2, 'finance.transaction.posted.v2', v_outbox_payload_v2, 'PENDING', NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'status', 'POSTED',
        'is_duplicate', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. DROP AND RE-CREATE REVERSE TRANSACTION FUNCTION
DROP FUNCTION IF EXISTS public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ);

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
    v_event_id_v1 UUID;
    v_event_id_v2 UUID;
    v_outbox_payload_v1 JSONB;
    v_outbox_payload_v2 JSONB;
    v_line RECORD;
    v_target_date TIMESTAMPTZ;
    v_candidate_cash_legs JSONB;
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

    -- 9. Construct candidate cash legs for the reversal transaction (from newly copied lines)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'account_id', l.account_id,
            'account_code', a.code,
            -- Swapped direction compared to original lines
            'direction', CASE WHEN l.debit_amount > 0 THEN 'INFLOW' ELSE 'OUTFLOW' END,
            'amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_amount ELSE l.credit_amount END,
            'currency', CASE WHEN l.debit_amount > 0 THEN l.debit_currency ELSE l.credit_currency END,
            'functional_amount_minor', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_amount ELSE l.credit_functional_amount END,
            'functional_currency', CASE WHEN l.debit_amount > 0 THEN l.debit_functional_currency ELSE l.credit_functional_currency END,
            'exchange_rate', v_orig_rate
        )
    ), '[]'::jsonb) INTO v_candidate_cash_legs
    FROM public.finance_transaction_lines l
    JOIN public.finance_accounts a ON l.account_id = a.id
    WHERE l.transaction_id = v_reversal_tx_id
      AND a.type = 'ASSET';

    -- 10. Build Outbox Payloads (Atomic, shared identity)
    v_event_id_v1 := gen_random_uuid();
    v_outbox_payload_v1 := jsonb_build_object(
        'transaction_id', p_transaction_id,
        'reversal_id', v_reversal_tx_id,
        'tenant_id', p_tenant_id,
        'reversal_date', v_target_date
    );

    v_event_id_v2 := gen_random_uuid();
    v_outbox_payload_v2 := jsonb_build_object(
        'event_id', v_event_id_v2,
        'event_type', 'finance.transaction.reversed.v2',
        'event_version', '2.0',
        'tenant_id', p_tenant_id,
        'transaction_id', v_reversal_tx_id,
        'transaction_type', 'REVERSAL',
        'posted_at', v_target_date,
        'reversal_of_transaction_id', p_transaction_id,
        'candidate_cash_legs', v_candidate_cash_legs
    );

    -- 11. Insert outbox events atomically
    INSERT INTO public.finance_outbox_events (
        id, tenant_id, event_id, event_type, payload, status, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, v_event_id_v1, 'finance.transaction.reversed.v1', v_outbox_payload_v1, 'PENDING', NOW()
    );

    INSERT INTO public.finance_outbox_events (
        id, tenant_id, event_id, event_type, payload, status, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, v_event_id_v2, 'finance.transaction.reversed.v2', v_outbox_payload_v2, 'PENDING', NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_reversal_tx_id,
        'status', 'POSTED',
        'is_duplicate', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. APPLY GRANTS
GRANT EXECUTE ON FUNCTION public.finance_post_transaction(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, TIMESTAMPTZ, TEXT, VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_post_transaction(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, TIMESTAMPTZ, TEXT, VARCHAR, VARCHAR, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ) TO service_role;
