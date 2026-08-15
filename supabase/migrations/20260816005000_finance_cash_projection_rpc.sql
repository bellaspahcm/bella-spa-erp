-- Migration: finance_cash_projection_rpc
-- Description: Creates the trusted database entry point for recording cash movements.
-- Security: SECURITY DEFINER, fixed search_path, SET LOCAL session guard, input validation.

CREATE OR REPLACE FUNCTION public.finance_internal_record_cash_movement(
    p_tenant_id UUID,
    p_bank_account_id UUID,
    p_idempotency_key VARCHAR,
    p_direction VARCHAR,
    p_amount_minor NUMERIC,
    p_currency VARCHAR,
    p_functional_amount_minor NUMERIC,
    p_functional_currency VARCHAR,
    p_valuation_rate NUMERIC,
    p_f1_transaction_id UUID,
    p_cash_leg_reference VARCHAR,
    p_source_type VARCHAR,
    p_source_id VARCHAR,
    p_description TEXT
) RETURNS JSONB 
SET search_path = public -- Hardened search path to prevent search_path hijacking
AS $$
DECLARE
    v_movement_id UUID;
    v_account_exists BOOLEAN;
    v_f1_exists BOOLEAN;
    v_existing_movement_id UUID;
BEGIN
    -- 1. Disable mutation bypass inside the trusted function block using local session transaction scope
    -- SET LOCAL ensures the setting expires automatically when the current transaction ends (commit/rollback)
    PERFORM set_config('finance.allow_cash_mutation', 'true', true);

    -- 2. Validate Idempotency at F2 level (prevent duplicate cash projection processing)
    SELECT id INTO v_existing_movement_id
    FROM public.finance_cash_movements
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_existing_movement_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'movement_id', v_existing_movement_id,
            'is_duplicate', true
        );
    END IF;

    -- 3. Assert Bank Account active and tenant consistency
    SELECT EXISTS (
        SELECT 1 FROM public.finance_bank_accounts
        WHERE id = p_bank_account_id 
          AND tenant_id = p_tenant_id 
          AND is_active = true
    ) INTO v_account_exists;

    IF NOT v_account_exists THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_NOT_FOUND_OR_INACTIVE' USING ERRCODE = 'F2010';
    END IF;

    -- 4. Assert F1 transaction exists, posted, and matches tenant (P0-1 and P0-4)
    SELECT EXISTS (
        SELECT 1 FROM public.finance_transactions
        WHERE id = p_f1_transaction_id
          AND tenant_id = p_tenant_id
          AND status = 'POSTED'
    ) INTO v_f1_exists;

    IF NOT v_f1_exists THEN
        RAISE EXCEPTION 'F1_TRANSACTION_NOT_FOUND_OR_UNPOSTED' USING ERRCODE = 'F2011';
    END IF;

    -- 5. Insert cash movement record (uniqueness constraint on f1_transaction_id + cash_leg_reference protects duplicate leg insertions)
    v_movement_id := gen_random_uuid();
    INSERT INTO public.finance_cash_movements (
        id, tenant_id, bank_account_id, idempotency_key, direction, amount_minor, currency,
        functional_amount_minor, functional_currency, valuation_rate,
        f1_transaction_id, cash_leg_reference, source_type, source_id, description, recorded_at, created_at
    ) VALUES (
        v_movement_id, p_tenant_id, p_bank_account_id, p_idempotency_key, p_direction, p_amount_minor, p_currency,
        p_functional_amount_minor, p_functional_currency, p_valuation_rate,
        p_f1_transaction_id, p_cash_leg_reference, p_source_type, p_source_id, p_description, NOW(), NOW()
    );

    -- 6. Update or Initialize Bank Account Cash Position
    -- Enforce row-level serialization via INSERT ... ON CONFLICT
    INSERT INTO public.finance_cash_positions (
        tenant_id, bank_account_id, balance_minor, currency,
        functional_balance_minor, functional_currency, valuation_rate, valuation_as_of, valuation_source, version, last_movement_id, as_of
    ) VALUES (
        p_tenant_id, p_bank_account_id,
        CASE WHEN p_direction = 'INFLOW' THEN p_amount_minor ELSE -p_amount_minor END,
        p_currency,
        CASE WHEN p_direction = 'INFLOW' THEN p_functional_amount_minor ELSE -p_functional_amount_minor END,
        p_functional_currency,
        p_valuation_rate,
        NOW(),
        'F1_POST',
        0,
        v_movement_id,
        NOW()
    )
    ON CONFLICT (tenant_id, bank_account_id) DO UPDATE
    SET balance_minor = finance_cash_positions.balance_minor + EXCLUDED.balance_minor,
        functional_balance_minor = finance_cash_positions.functional_balance_minor + EXCLUDED.functional_balance_minor,
        valuation_rate = EXCLUDED.valuation_rate,
        valuation_as_of = NOW(),
        last_movement_id = v_movement_id,
        version = finance_cash_positions.version + 1,
        as_of = NOW(),
        updated_at = NOW();

    -- 7. Reset session setting back to false
    PERFORM set_config('finance.allow_cash_mutation', 'false', true);

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'is_duplicate', false
    );
EXCEPTION WHEN OTHERS THEN
    -- Ensure setting is disabled even in error blocks to prevent pollution
    PERFORM set_config('finance.allow_cash_mutation', 'false', true);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
