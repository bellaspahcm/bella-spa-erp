-- Migration: 20260816040000_finance_cash_concurrency_locks
-- Component: F2.5 — Concurrency Hardening
-- Description:
--   Implements Bank Account Lock Protocol with deterministic lock ordering (id ASC)
--   to prevent deadlocks, enforces cash movement absolute immutability, and hardens triggers.

-- =========================================================================
-- 1. UPDATE MUTATION TRIGGER GUARD (Strict role check + immutable movements)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_cash_mutation_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Enforce absolute immutability on cash movements (no UPDATE or DELETE allowed under any circumstances)
    IF TG_TABLE_NAME = 'finance_cash_movements' AND TG_OP IN ('UPDATE', 'DELETE') THEN
        RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Cash movements are strictly immutable and cannot be updated or deleted.'
        USING ERRCODE = 'F2001';
    END IF;

    -- 2. Authorization check: Only service_role, postgres, and supabase_admin are allowed to mutate cash tables
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Direct mutation of cash engine tables is restricted to service_role or admin.'
        USING ERRCODE = 'F2001';
    END IF;

    -- 3. Trigger bypass gates (restricted to authorized roles by step 2)
    IF TG_TABLE_NAME = 'finance_cash_positions' THEN
        -- Allow mutations during reconstruction or normal projection
        IF current_setting('finance.allow_position_reconstruction', true) = 'true' OR
           current_setting('finance.allow_cash_mutation', true) = 'true' THEN
            -- Allowed
        ELSE
            RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Positions can only be updated via the official projection or reconstruction RPCs.'
            USING ERRCODE = 'F2001';
        END IF;
    ELSIF TG_TABLE_NAME = 'finance_cash_movements' THEN
        -- Only allow INSERT during normal projection
        IF TG_OP = 'INSERT' AND current_setting('finance.allow_cash_mutation', true) = 'true' THEN
            -- Allowed
        ELSE
            RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Movements can only be inserted via the official projection RPC.'
            USING ERRCODE = 'F2001';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 2. REDEFINE PROJECT CASH LEG RPC WITH BANK ACCOUNT SHARE LOCK
-- =========================================================================
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
SET search_path = public
AS $$
DECLARE
    v_movement_id UUID;
    v_account_active BOOLEAN;
    v_f1_exists BOOLEAN;
    v_existing_movement_id UUID;
BEGIN
    -- 1. Disable mutation bypass inside the trusted function block using local session transaction scope
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

    -- 3. Assert Bank Account active and tenant consistency, acquiring SHARE lock (Bank Account Lock Protocol)
    SELECT is_active INTO v_account_active FROM public.finance_bank_accounts
    WHERE id = p_bank_account_id AND tenant_id = p_tenant_id
    FOR SHARE;

    IF v_account_active IS NULL OR v_account_active = false THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_NOT_FOUND_OR_INACTIVE' USING ERRCODE = 'F2010';
    END IF;

    -- 4. Assert F1 transaction exists, posted, and matches tenant
    SELECT EXISTS (
        SELECT 1 FROM public.finance_transactions
        WHERE id = p_f1_transaction_id
          AND tenant_id = p_tenant_id
          AND status = 'POSTED'
    ) INTO v_f1_exists;

    IF NOT v_f1_exists THEN
        RAISE EXCEPTION 'F1_TRANSACTION_NOT_FOUND_OR_UNPOSTED' USING ERRCODE = 'F2011';
    END IF;

    -- 5. Insert cash movement record (wrapped in block to handle concurrent duplicate insert races)
    v_movement_id := gen_random_uuid();
    BEGIN
        INSERT INTO public.finance_cash_movements (
            id, tenant_id, bank_account_id, idempotency_key, direction, amount_minor, currency,
            functional_amount_minor, functional_currency, valuation_rate,
            f1_transaction_id, cash_leg_reference, source_type, source_id, description, recorded_at, created_at
        ) VALUES (
            v_movement_id, p_tenant_id, p_bank_account_id, p_idempotency_key, p_direction, p_amount_minor, p_currency,
            p_functional_amount_minor, p_functional_currency, p_valuation_rate,
            p_f1_transaction_id, p_cash_leg_reference, p_source_type, p_source_id, p_description, NOW(), NOW()
        );
    EXCEPTION WHEN unique_violation THEN
        -- Distinguish idempotency-key duplicates (safe to return) from
        -- cash_leg_reference duplicates (architectural violation — must raise).
        -- Re-query by idempotency_key to determine which constraint was hit.
        SELECT id INTO v_existing_movement_id
        FROM public.finance_cash_movements
        WHERE tenant_id = p_tenant_id
          AND idempotency_key = p_idempotency_key;

        IF v_existing_movement_id IS NOT NULL THEN
            -- Safe idempotent duplicate: same idempotency_key, already recorded
            RETURN jsonb_build_object(
                'success', true,
                'movement_id', v_existing_movement_id,
                'is_duplicate', true
            );
        ELSE
            -- Violation was on uq_finance_cash_movements_leg (tenant_id, f1_transaction_id, cash_leg_reference):
            -- a different idempotency_key is attempting to project the same F1 leg reference — hard error.
            RAISE EXCEPTION 'DUPLICATE_CASH_LEG_REFERENCE: F1 leg reference already projected under a different idempotency key. f1_transaction_id=%, cash_leg_reference=%',
                p_f1_transaction_id, p_cash_leg_reference
            USING ERRCODE = 'F2030';
        END IF;
    END;

    -- 6. Update or Initialize Bank Account Cash Position (Upsert Lock)
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
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 3. REDEFINE RECONSTRUCTION RPC WITH DETERMINISTIC BANK ACCOUNT UPDATE LOCK
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_reconstruct_cash_positions(
    p_tenant_id UUID,
    p_bank_account_id UUID DEFAULT NULL
) RETURNS JSONB
SET search_path = public
AS $$
DECLARE
    v_account_rec RECORD;
    v_movement_count BIGINT;
    v_balance_minor NUMERIC(20,0);
    v_functional_balance_minor NUMERIC(20,0);
    v_last_movement_id UUID;
    v_last_valuation_rate NUMERIC(18,6);
    v_last_recorded_at TIMESTAMPTZ;
    v_reconstructed_count INTEGER := 0;
BEGIN
    -- 0. Authorization Check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_RECONSTRUCTION_EXECUTION: Only service_role or admin can execute this RPC.'
        USING ERRCODE = 'F2013';
    END IF;

    -- 1. Database-Level Tenant Validation
    IF p_bank_account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.finance_bank_accounts
            WHERE id = p_bank_account_id AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'BANK_ACCOUNT_TENANT_MISMATCH: Specified bank account does not belong to the tenant.'
            USING ERRCODE = 'F2012';
        END IF;
    END IF;

    -- 2. Enable derived position mutation bypass
    PERFORM set_config('finance.allow_position_reconstruction', 'true', true);

    -- 3. Iterate over active bank accounts for the tenant matching criteria
    -- Lock records in deterministic ascending id order to prevent deadlocks (Bank Account Lock Protocol)
    FOR v_account_rec IN 
        SELECT id, currency 
        FROM public.finance_bank_accounts 
        WHERE tenant_id = p_tenant_id
          AND (p_bank_account_id IS NULL OR id = p_bank_account_id)
          AND is_active = true
        ORDER BY id ASC -- Strict deterministic deadlock prevention
        FOR UPDATE      -- Lock row exclusively
    LOOP
        -- 4. Clear the existing cash position for this bank account (mutation bypass active)
        DELETE FROM public.finance_cash_positions 
        WHERE tenant_id = p_tenant_id 
          AND bank_account_id = v_account_rec.id;

        -- 5. Count movements and fetch the aggregate sums
        SELECT 
            COUNT(*),
            COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN amount_minor ELSE -amount_minor END), 0),
            COALESCE(SUM(CASE WHEN direction = 'INFLOW' THEN functional_amount_minor ELSE -functional_amount_minor END), 0)
        INTO 
            v_movement_count,
            v_balance_minor,
            v_functional_balance_minor
        FROM public.finance_cash_movements
        WHERE tenant_id = p_tenant_id 
          AND bank_account_id = v_account_rec.id;

        -- 6. Rebuild derived record
        IF v_movement_count > 0 THEN
            SELECT id, valuation_rate, recorded_at
            INTO v_last_movement_id, v_last_valuation_rate, v_last_recorded_at
            FROM public.finance_cash_movements
            WHERE tenant_id = p_tenant_id 
              AND bank_account_id = v_account_rec.id
            ORDER BY recorded_at DESC, created_at DESC, id DESC
            LIMIT 1;

            INSERT INTO public.finance_cash_positions (
                tenant_id,
                bank_account_id,
                balance_minor,
                currency,
                functional_balance_minor,
                functional_currency,
                valuation_rate,
                valuation_as_of,
                valuation_source,
                version,
                last_movement_id,
                as_of,
                created_at,
                updated_at
            ) VALUES (
                p_tenant_id,
                v_account_rec.id,
                v_balance_minor,
                v_account_rec.currency,
                v_functional_balance_minor,
                'VND',
                COALESCE(v_last_valuation_rate, 1.000000),
                COALESCE(v_last_recorded_at, NOW()),
                'RECONSTRUCTION',
                v_movement_count,
                v_last_movement_id,
                NOW(),
                NOW(),
                NOW()
            );
        ELSE
            -- Fallback: Zero-balance position for active bank account with no movements
            INSERT INTO public.finance_cash_positions (
                tenant_id,
                bank_account_id,
                balance_minor,
                currency,
                functional_balance_minor,
                functional_currency,
                valuation_rate,
                valuation_as_of,
                valuation_source,
                version,
                last_movement_id,
                as_of,
                created_at,
                updated_at
            ) VALUES (
                p_tenant_id,
                v_account_rec.id,
                0,
                v_account_rec.currency,
                0,
                'VND',
                1.000000,
                NOW(),
                'RECONSTRUCTION',
                0,
                NULL,
                NOW(),
                NOW(),
                NOW()
            );
        END IF;

        v_reconstructed_count := v_reconstructed_count + 1;
    END LOOP;

    -- 7. Reset session setting back to false
    PERFORM set_config('finance.allow_position_reconstruction', 'false', true);

    RETURN jsonb_build_object(
        'success', true,
        'reconstructed_count', v_reconstructed_count
    );
END;
$$ LANGUAGE plpgsql;
