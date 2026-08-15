-- Migration: 20260817020000_finance_payment_allocation_rpcs
-- Component: F3.3 — Payment Allocation RPC Procedures
-- Description:
--   Implements the core Payment Allocation Engine for AR Subledger:
--   1. Canonical helper to generate tenant-isolated advisory lock keys.
--   2. Safe read contract function for bank movements.
--   3. Transaction-safe allocate and reverse procedures.
--   4. Subledger-driven reconstruction RPC.
--   Enforces strict lock ordering (Advisory Lock -> Allocation Row Lock -> Position Row Lock).

-- =========================================================================
-- 0. SCHEMA EXTENSION: ALLOCATION FX COGNIZANCE
-- =========================================================================
ALTER TABLE public.finance_receivable_allocations ADD COLUMN IF NOT EXISTS allocated_invoice_amount_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.finance_receivable_allocations ADD COLUMN IF NOT EXISTS rate_direction VARCHAR(30) NOT NULL DEFAULT 'CASH_TO_INVOICE';
ALTER TABLE public.finance_receivable_allocations ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

-- =========================================================================
-- 1. CANONICAL LOCK KEY HELPER
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_cash_allocation_lock_key(
    p_tenant_id UUID,
    p_cash_movement_id UUID
) RETURNS TABLE(tenant_key INT, movement_key INT) AS $$
BEGIN
    RETURN QUERY SELECT
        ('x' || substr(md5(p_tenant_id::text), 1, 8))::bit(32)::int,
        ('x' || substr(md5(p_cash_movement_id::text), 1, 8))::bit(32)::int;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =========================================================================
-- 2. F2 Safe Read Contract Function
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_get_cash_movement(
    p_tenant_id UUID,
    p_cash_movement_id UUID
) RETURNS JSONB 
SET search_path = public
AS $$
DECLARE
    v_movement RECORD;
BEGIN
    SELECT id, tenant_id, direction, amount_minor, currency, recorded_at, valuation_rate
    INTO v_movement
    FROM public.finance_cash_movements
    WHERE id = p_cash_movement_id AND tenant_id = p_tenant_id;

    IF v_movement.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'movement_id', v_movement.id,
        'tenant_id', v_movement.tenant_id,
        'direction', v_movement.direction,
        'amount_minor', v_movement.amount_minor::BIGINT,
        'currency', v_movement.currency,
        'status', 'POSTED',
        'recognition_rate', v_movement.valuation_rate::NUMERIC,
        'recognition_timestamp', v_movement.recorded_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 3. PAYMENT ALLOCATION RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_allocate_payment(
    p_tenant_id UUID,
    p_invoice_id UUID,
    p_cash_movement_id UUID,
    p_allocated_amount_minor BIGINT,
    p_exchange_rate NUMERIC,
    p_rate_source VARCHAR,
    p_rate_timestamp TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
    v_tenant_key INT;
    v_movement_key INT;
    v_cash_json JSONB;
    v_pos_id UUID;
    v_original_amount BIGINT;
    v_allocated_amount BIGINT;
    v_adjusted_amount BIGINT;
    v_inv_currency VARCHAR;
    v_already_allocated BIGINT;
    v_allocated_invoice_amount BIGINT;
    v_outstanding BIGINT;
    v_alloc_id UUID;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Allocation restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- Lock Order 1: Advisory lock on cash movement (Rule 10 Lock ordering)
    SELECT tenant_key, movement_key INTO v_tenant_key, v_movement_key 
    FROM public.finance_cash_allocation_lock_key(p_tenant_id, p_cash_movement_id);
    
    PERFORM pg_advisory_xact_lock(v_tenant_key, v_movement_key);

    -- Lock Order 2: Load and assert F2 cash movement via public contract (no direct query)
    v_cash_json := public.finance_get_cash_movement(p_tenant_id, p_cash_movement_id);
    IF v_cash_json IS NULL THEN
        RAISE EXCEPTION 'CASH_MOVEMENT_NOT_FOUND' USING ERRCODE = 'F3021';
    END IF;

    IF v_cash_json->>'direction' <> 'INFLOW' THEN
        RAISE EXCEPTION 'INVALID_CASH_DIRECTION: Only inflow cash movements can be allocated.' USING ERRCODE = 'F3022';
    END IF;

    -- Lock Order 3: Position row lock (SELECT FOR UPDATE)
    SELECT id, original_amount_minor, allocated_amount_minor, adjusted_amount_minor, currency
    INTO v_pos_id, v_original_amount, v_allocated_amount, v_adjusted_amount, v_inv_currency
    FROM public.finance_receivable_positions
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_pos_id IS NULL THEN
        RAISE EXCEPTION 'RECEIVABLE_POSITION_NOT_FOUND' USING ERRCODE = 'F3006';
    END IF;

    -- Validate cash availability limit (Rule 20 / check over-allocation)
    SELECT COALESCE(SUM(
        CASE WHEN allocation_type = 'STANDARD' THEN allocated_amount_minor
             WHEN allocation_type = 'REVERSAL' THEN -allocated_amount_minor
        END
    ), 0) INTO v_already_allocated
    FROM public.finance_receivable_allocations
    WHERE cash_movement_id = p_cash_movement_id AND tenant_id = p_tenant_id;

    IF v_already_allocated + p_allocated_amount_minor > (v_cash_json->>'amount_minor')::BIGINT THEN
        RAISE EXCEPTION 'OVER_ALLOCATION: Allocation exceeds remaining cash amount.' USING ERRCODE = 'F3020';
    END IF;

    -- Calculate invoice reduction amount in invoice currency using CASH_TO_INVOICE direction
    v_allocated_invoice_amount := ROUND(p_allocated_amount_minor * p_exchange_rate);

    -- Validate outstanding balance limit
    v_outstanding := v_original_amount - v_allocated_amount - v_adjusted_amount;
    IF v_outstanding < v_allocated_invoice_amount THEN
        RAISE EXCEPTION 'ALLOCATION_EXCEEDS_OUTSTANDING: Allocation amount is greater than outstanding invoice balance.' 
        USING ERRCODE = 'F3023';
    END IF;

    -- Record standard allocation details
    INSERT INTO public.finance_receivable_allocations (
        tenant_id, invoice_id, cash_movement_id, allocated_amount_minor,
        allocated_invoice_amount_minor, allocation_type, rate_source, rate_timestamp, rate_direction, exchange_rate
    ) VALUES (
        p_tenant_id, p_invoice_id, p_cash_movement_id, p_allocated_amount_minor,
        v_allocated_invoice_amount, 'STANDARD', p_rate_source, p_rate_timestamp, 'CASH_TO_INVOICE', p_exchange_rate
    ) RETURNING id INTO v_alloc_id;

    -- Record CREDIT_ALLOCATION positive log fact in AR subledger
    INSERT INTO public.finance_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, p_invoice_id, 'CREDIT_ALLOCATION', v_allocated_invoice_amount, 'ALLOCATION', v_alloc_id
    );

    -- Update positions projection cache
    PERFORM set_config('finance.allow_receivable_mutation', 'true', true);

    UPDATE public.finance_receivable_positions
    SET allocated_amount_minor = allocated_amount_minor + v_allocated_invoice_amount,
        version = version + 1
    WHERE id = v_pos_id;

    PERFORM set_config('finance.allow_receivable_mutation', 'false', true);

    RETURN v_alloc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 4. ALLOCATION REVERSAL RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_reverse_allocation(
    p_tenant_id UUID,
    p_allocation_id UUID
) RETURNS UUID AS $$
DECLARE
    v_tenant_key INT;
    v_movement_key INT;
    v_pos_id UUID;
    v_rev_alloc_id UUID;
    
    -- Original row details
    v_orig_cash_movement_id UUID;
    v_orig_invoice_id UUID;
    v_orig_cash_amount BIGINT;
    v_orig_invoice_amount BIGINT;
    v_orig_type VARCHAR;
    v_orig_rate NUMERIC;
    v_orig_rate_src VARCHAR;
    v_orig_rate_ts TIMESTAMPTZ;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Allocation reversal restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- Lock Order 1: Allocation Row Lock (SELECT FOR UPDATE)
    SELECT cash_movement_id, invoice_id, allocated_amount_minor, allocated_invoice_amount_minor,
           allocation_type, exchange_rate, rate_source, rate_timestamp
    INTO v_orig_cash_movement_id, v_orig_invoice_id, v_orig_cash_amount, v_orig_invoice_amount,
         v_orig_type, v_orig_rate, v_orig_rate_src, v_orig_rate_ts
    FROM public.finance_receivable_allocations
    WHERE id = p_allocation_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_orig_invoice_id IS NULL THEN
        RAISE EXCEPTION 'ALLOCATION_NOT_FOUND' USING ERRCODE = 'F3024';
    END IF;

    IF v_orig_type = 'REVERSAL' THEN
        RAISE EXCEPTION 'CANNOT_REVERSE_REVERSAL: Reversal allocations cannot be reversed.' USING ERRCODE = 'F3025';
    END IF;

    -- Check if already reversed (Rule 7 concurrency check)
    IF EXISTS (
        SELECT 1 FROM public.finance_receivable_allocations
        WHERE reversal_ref_id = p_allocation_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'ALLOCATION_ALREADY_REVERSED: This allocation has already been reversed.' USING ERRCODE = 'F3026';
    END IF;

    -- Lock Order 2: Advisory lock on cash movement (Rule 10 Lock ordering)
    SELECT tenant_key, movement_key INTO v_tenant_key, v_movement_key 
    FROM public.finance_cash_allocation_lock_key(p_tenant_id, v_orig_cash_movement_id);
    
    PERFORM pg_advisory_xact_lock(v_tenant_key, v_movement_key);

    -- Lock Order 3: Position Row Lock (SELECT FOR UPDATE)
    SELECT id INTO v_pos_id FROM public.finance_receivable_positions
    WHERE invoice_id = v_orig_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- Insert REVERSAL allocation row referencing the original allocation
    INSERT INTO public.finance_receivable_allocations (
        tenant_id, invoice_id, cash_movement_id, allocated_amount_minor,
        allocated_invoice_amount_minor, allocation_type, rate_source, rate_timestamp, rate_direction, exchange_rate, reversal_ref_id
    ) VALUES (
        p_tenant_id, v_orig_invoice_id, v_orig_cash_movement_id, v_orig_cash_amount,
        v_orig_invoice_amount, 'REVERSAL', v_orig_rate_src, NOW(), 'CASH_TO_INVOICE', v_orig_rate, p_allocation_id
    ) RETURNING id INTO v_rev_alloc_id;

    -- Record positive DEBIT_ADJUSTMENT subledger fact log (Rule 4: linked via source_id)
    INSERT INTO public.finance_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, v_orig_invoice_id, 'DEBIT_ADJUSTMENT', v_orig_invoice_amount, 'ALLOCATION', v_rev_alloc_id
    );

    -- Update derived position cache
    PERFORM set_config('finance.allow_receivable_mutation', 'true', true);

    UPDATE public.finance_receivable_positions
    SET allocated_amount_minor = allocated_amount_minor - v_orig_invoice_amount,
        version = version + 1
    WHERE id = v_pos_id;

    PERFORM set_config('finance.allow_receivable_mutation', 'false', true);

    RETURN v_rev_alloc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 5. RECONSTRUCTION RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_reconstruct_receivable_position(
    p_tenant_id UUID,
    p_invoice_id UUID
) RETURNS VOID 
SET search_path = public
AS $$
DECLARE
    v_orig BIGINT;
    v_alloc BIGINT;
    v_adj BIGINT;
    v_pos_exists BOOLEAN;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Position reconstruction restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- Assert position placeholder exists
    SELECT EXISTS (
        SELECT 1 FROM public.finance_receivable_positions
        WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id
    ) INTO v_pos_exists;

    IF NOT v_pos_exists THEN
        RAISE EXCEPTION 'RECEIVABLE_POSITION_NOT_FOUND' USING ERRCODE = 'F3006';
    END IF;

    -- Calculate original invoice accrual (DEBIT_ACCRUAL)
    SELECT COALESCE(SUM(amount_minor), 0) INTO v_orig
    FROM public.finance_receivable_ledger
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id AND entry_type = 'DEBIT_ACCRUAL';

    -- Calculate allocated amounts (CREDIT_ALLOCATION minus DEBIT_ADJUSTMENT from allocation reversals)
    SELECT COALESCE(SUM(
        CASE WHEN entry_type = 'CREDIT_ALLOCATION' THEN amount_minor
             WHEN entry_type = 'DEBIT_ADJUSTMENT' AND source_type = 'ALLOCATION' THEN -amount_minor
             ELSE 0
        END
    ), 0) INTO v_alloc
    FROM public.finance_receivable_ledger
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    -- Calculate adjusted amounts (CREDIT_ADJUSTMENT minus DEBIT_ADJUSTMENT from adjustments)
    SELECT COALESCE(SUM(
        CASE WHEN entry_type = 'CREDIT_ADJUSTMENT' THEN amount_minor
             WHEN entry_type = 'DEBIT_ADJUSTMENT' AND source_type = 'RECEIVABLE_ADJUSTMENT' THEN -amount_minor
             ELSE 0
        END
    ), 0) INTO v_adj
    FROM public.finance_receivable_ledger
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    -- Mutate positions cache
    PERFORM set_config('finance.allow_receivable_mutation', 'true', true);

    UPDATE public.finance_receivable_positions
    SET original_amount_minor = v_orig,
        allocated_amount_minor = v_alloc,
        adjusted_amount_minor = v_adj,
        last_reconstructed_at = NOW(),
        version = version + 1
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    PERFORM set_config('finance.allow_receivable_mutation', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 6. GRANTS
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.finance_cash_allocation_lock_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_get_cash_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_allocate_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_allocation TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reconstruct_receivable_position TO authenticated;
