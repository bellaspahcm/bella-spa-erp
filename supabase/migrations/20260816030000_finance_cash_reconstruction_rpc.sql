-- Migration: 20260816030000_finance_cash_reconstruction_rpc
-- Description: Implements derived cash position reconstruction from movements log.
-- Enforces: Database-level tenant validation, narrow table-scoped mutation bypass, and restricted service_role execution.

-- =========================================================================
-- 1. UPDATE MUTATION TRIGGER GUARD (Narrow Bypass on positions only)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_cash_mutation_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- Permit position updates strictly under position reconstruction flag by authorized roles
    IF TG_TABLE_NAME = 'finance_cash_positions' 
       AND current_setting('finance.allow_position_reconstruction', true) = 'true' 
       AND current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
        -- Allowed for derived state recovery
    ELSIF current_setting('finance.allow_cash_mutation', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Cash projection tables can only be mutated through the official projection RPC.'
        USING ERRCODE = 'F2001';
    END IF;

    -- Fix: DELETE triggers have no NEW row — must return OLD to proceed, not NEW
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 2. CREATE RECONSTRUCTION TRUSTED RPC
-- =========================================================================
CREATE OR REPLACE FUNCTION public.finance_reconstruct_cash_positions(
    p_tenant_id UUID,
    p_bank_account_id UUID DEFAULT NULL
) RETURNS JSONB
SET search_path = public -- Hardened search path to prevent hijack
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
    -- 0. Authorization Check (Fail-closed prevention against direct execution hijack)
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_RECONSTRUCTION_EXECUTION: Only service_role or admin can execute this RPC.'
        USING ERRCODE = 'F2013';
    END IF;

    -- 1. Database-Level Tenant Validation (T13: Mismatched bank account & tenant)
    IF p_bank_account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.finance_bank_accounts
            WHERE id = p_bank_account_id AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'BANK_ACCOUNT_TENANT_MISMATCH: Specified bank account does not belong to the tenant.'
            USING ERRCODE = 'F2012';
        END IF;
    END IF;

    -- 2. Enable derived position mutation bypass inside the trusted function block using local session transaction scope
    -- SET LOCAL ensures the setting expires automatically when the current transaction ends (commit/rollback)
    PERFORM set_config('finance.allow_position_reconstruction', 'true', true);

    -- 3. Iterate over active bank accounts for the tenant matching criteria
    FOR v_account_rec IN 
        SELECT id, currency 
        FROM public.finance_bank_accounts 
        WHERE tenant_id = p_tenant_id
          AND (p_bank_account_id IS NULL OR id = p_bank_account_id)
          AND is_active = true
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
            -- Fetch the last movement details for metadata (ordered descending)
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
                'VND', -- default functional currency
                COALESCE(v_last_valuation_rate, 1.000000),
                COALESCE(v_last_recorded_at, NOW()),
                'RECONSTRUCTION',
                v_movement_count, -- version set to number of movements processed
                v_last_movement_id,
                NOW(),
                NOW(),
                NOW()
            );
        ELSE
            -- Fallback: Zero-balance position for active bank account with no movements (T07)
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
        'reconstructed_accounts_count', v_reconstructed_count
    );
EXCEPTION WHEN OTHERS THEN
    -- Ensure setting is disabled even in error blocks to prevent session leakage
    PERFORM set_config('finance.allow_position_reconstruction', 'false', true);
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 3. LEAST-PRIVILEGE PERMISSION GRANTS (Lock down RPC execution)
-- =========================================================================

-- Revoke execution from public, authenticated, and anonymous roles
REVOKE EXECUTE ON FUNCTION public.finance_reconstruct_cash_positions(UUID, UUID) FROM public, authenticated, anon;

-- Grant execution strictly to the service_role (service context)
GRANT EXECUTE ON FUNCTION public.finance_reconstruct_cash_positions(UUID, UUID) TO service_role;
