-- Migration: 20260817010000_finance_invoice_lifecycle_rpcs
-- Component: F3.2 — Invoice Lifecycle Database Procedures
-- Description:
--   Implements Draft Invoice creation, line item addition with DB-authoritative rounding calculations,
--   transactional finalization (accrual posting) with revenue account verification,
--   and idempotent void reversals.
--   Enforces transaction-local GUC settings (SET LOCAL) to restrict mutation privileges.

-- =========================================================================
-- 0. SCHEMA ADDITION: PERSISTENT VOID IDEMPOTENCY TOKEN
-- =========================================================================
ALTER TABLE public.finance_invoices ADD COLUMN IF NOT EXISTS void_posting_attempt_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();

-- =========================================================================
-- 1. CREATE DRAFT INVOICE RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_create_draft_invoice(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_invoice_number VARCHAR,
    p_currency VARCHAR,
    p_issue_date DATE,
    p_due_date DATE
) RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Draft creation restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- Zero-length check
    IF COALESCE(p_invoice_number, '') = '' THEN
        RAISE EXCEPTION 'INVALID_INVOICE_NUMBER: Invoice number cannot be empty.' USING ERRCODE = 'F3016';
    END IF;

    INSERT INTO public.finance_invoices (
        tenant_id, customer_id, invoice_number, status, currency,
        total_pretax_amount_minor, tax_amount_minor, total_invoice_amount_minor,
        issue_date, due_date, posting_status, void_posting_attempt_id
      ) VALUES (
        p_tenant_id, p_customer_id, p_invoice_number, 'DRAFT', p_currency,
        0, 0, 0, p_issue_date, p_due_date, 'PENDING', gen_random_uuid()
      ) RETURNING id INTO v_invoice_id;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 2. ADD INVOICE LINE RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_add_invoice_line(
    p_tenant_id UUID,
    p_invoice_id UUID,
    p_service_id UUID,
    p_description TEXT,
    p_quantity NUMERIC,
    p_unit_price_minor BIGINT,
    p_tax_rate NUMERIC,
    p_revenue_account_code VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_status VARCHAR;
    v_line_id UUID;
    v_line_amount BIGINT;
    v_sum_pretax BIGINT;
    v_sum_tax BIGINT;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Line mutation restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- Row lock invoice header to prevent concurrent line edits
    SELECT status INTO v_status FROM public.finance_invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'F3002';
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_NOT_DRAFT: Lines can only be added to draft invoices.' USING ERRCODE = 'F3003';
    END IF;

    -- DB Authoritative Rounding Calculation (Rule 5)
    v_line_amount := ROUND(p_quantity * p_unit_price_minor);

    -- Insert line
    INSERT INTO public.finance_invoice_lines (
        tenant_id, invoice_id, service_id, description, quantity,
        unit_price_minor, tax_rate, amount_minor, revenue_account_code
    ) VALUES (
        p_tenant_id, p_invoice_id, p_service_id, p_description, p_quantity,
        p_unit_price_minor, p_tax_rate, v_line_amount, p_revenue_account_code
    ) RETURNING id INTO v_line_id;

    -- DB Authoritative Header Recalculation (Rule 6)
    SELECT COALESCE(SUM(amount_minor), 0), COALESCE(SUM(ROUND(amount_minor * tax_rate)), 0)
    INTO v_sum_pretax, v_sum_tax
    FROM public.finance_invoice_lines
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    UPDATE public.finance_invoices
    SET total_pretax_amount_minor = v_sum_pretax,
        tax_amount_minor = v_sum_tax,
        total_invoice_amount_minor = v_sum_pretax + v_sum_tax
    WHERE id = p_invoice_id;

    RETURN v_line_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 3. FINALIZE INVOICE RPC (Atomic Accrual Posting)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_finalize_invoice(
    p_tenant_id UUID,
    p_invoice_id UUID,
    p_idempotency_key VARCHAR,
    p_request_hash VARCHAR,
    p_lines_jsonb JSONB
) RETURNS JSONB AS $$
DECLARE
    v_status VARCHAR;
    v_total_amount BIGINT;
    v_currency VARCHAR;
    v_f1_res JSONB;
    v_tx_id UUID;
    v_is_duplicate BOOLEAN;
    v_sum_lines BIGINT;
    v_issue_date DATE;
    v_posting_attempt_id UUID;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Invoice finalization restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- 1. Lock invoice row
    SELECT status, total_invoice_amount_minor, currency, f1_transaction_id, issue_date, posting_attempt_id
    INTO v_status, v_total_amount, v_currency, v_tx_id, v_issue_date, v_posting_attempt_id
    FROM public.finance_invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'F3002';
    END IF;

    -- Idempotency check: If already finalized, verify if this is a duplicate request
    IF v_status = 'FINALIZED' THEN
        IF EXISTS (
            SELECT 1 FROM public.finance_transactions
            WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key
        ) THEN
            RETURN jsonb_build_object(
                'success', true,
                'transaction_id', v_tx_id,
                'is_duplicate', true
            );
        ELSE
            RAISE EXCEPTION 'INVOICE_ALREADY_FINALIZED_CONFLICT: Invoice status is FINALIZED but F1 transaction idempotency key mismatch.' 
            USING ERRCODE = 'F3009';
        END IF;
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_NOT_DRAFT: Only draft invoices can be finalized.' USING ERRCODE = 'F3003';
    END IF;

    -- Rule 4: Verify persistent posting_attempt_id matches the call parameter
    IF v_posting_attempt_id::VARCHAR <> p_idempotency_key THEN
        RAISE EXCEPTION 'INVALID_POSTING_ATTEMPT_ID: Finalize must use the persistent posting_attempt_id token.' USING ERRCODE = 'F3017';
    END IF;

    -- Verify lines totals exist (Empty check)
    SELECT COALESCE(SUM(amount_minor), 0) INTO v_sum_lines
    FROM public.finance_invoice_lines
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    IF v_sum_lines = 0 THEN
        RAISE EXCEPTION 'INVOICE_EMPTY: Finalized invoice must have at least one line.' USING ERRCODE = 'F3012';
    END IF;

    -- Rule 22: Zero-value invoice policy (rejection)
    IF v_total_amount = 0 THEN
        RAISE EXCEPTION 'ZERO_VALUE_INVOICE: Invoices with total amount of 0 are not allowed.' USING ERRCODE = 'F3018';
    END IF;

    -- Rule 7: Validate revenue account code existence and eligibility
    IF EXISTS (
        SELECT 1 FROM public.finance_invoice_lines l
        LEFT JOIN public.finance_accounts a ON a.tenant_id = p_tenant_id AND a.code = l.revenue_account_code
        WHERE l.invoice_id = p_invoice_id AND (a.id IS NULL OR a.is_active = false OR a.type <> 'REVENUE')
    ) THEN
        RAISE EXCEPTION 'INVALID_REVENUE_ACCOUNT: Line contains invalid or inactive revenue account.' USING ERRCODE = 'F3015';
    END IF;

    -- 2. Call F1 nested post transaction function
    v_f1_res := public.finance_post_transaction(
        p_tenant_id,
        p_idempotency_key,
        p_request_hash,
        'F3_AR_INVOICE',
        p_invoice_id::VARCHAR,
        'ACCRUAL',
        v_issue_date::TIMESTAMPTZ,
        v_currency,
        v_currency, -- functional functional currency equals transaction currency
        1.0, -- exchange_rate
        'SYSTEM',
        'SYSTEM',
        v_issue_date::TIMESTAMPTZ,
        'Invoice finalization accrual posting',
        'INVOICE',
        p_invoice_id::VARCHAR,
        p_lines_jsonb
    );

    v_tx_id := (v_f1_res->>'transaction_id')::UUID;
    v_is_duplicate := (v_f1_res->>'is_duplicate')::BOOLEAN;

    -- Double safety: If F1 reports duplicate but F3 status was DRAFT (due to a previous failed F3 commit/timeout),
    -- proceed to write F3 ledger facts. If subledger fact already exists, skip to prevent duplicates.
    IF v_is_duplicate THEN
        IF EXISTS (
            SELECT 1 FROM public.finance_receivable_ledger
            WHERE tenant_id = p_tenant_id
              AND source_type = 'INVOICE'
              AND source_id = p_invoice_id
              AND entry_type = 'DEBIT_ACCRUAL'
        ) THEN
            -- Update invoice status in case of state mismatch
            UPDATE public.finance_invoices
            SET status = 'FINALIZED',
                f1_transaction_id = v_tx_id,
                posting_status = 'SUCCESS'
            WHERE id = p_invoice_id;

            RETURN jsonb_build_object(
                'success', true,
                'transaction_id', v_tx_id,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- 3. Write DEBIT_ACCRUAL into subledger log (facts are immutable)
    INSERT INTO public.finance_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, p_invoice_id, 'DEBIT_ACCRUAL', v_total_amount, 'INVOICE', p_invoice_id
    );

    -- 4. Initialize derived position cache
    -- Enable mutation temporarily in PL/pgSQL scope
    PERFORM set_config('finance.allow_receivable_mutation', 'true', true);

    INSERT INTO public.finance_receivable_positions (
        tenant_id, invoice_id, customer_id, currency, original_amount_minor
    )
    SELECT tenant_id, id, customer_id, currency, total_invoice_amount_minor
    FROM public.finance_invoices
    WHERE id = p_invoice_id
    ON CONFLICT ON CONSTRAINT uq_receivable_position_per_invoice DO NOTHING;

    -- 5. Transition invoice status
    UPDATE public.finance_invoices
    SET status = 'FINALIZED',
        f1_transaction_id = v_tx_id,
        posting_status = 'SUCCESS'
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'is_duplicate', COALESCE(v_is_duplicate, false)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 4. VOID INVOICE RPC (Atomic Accrual Reversal)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_void_invoice(
    p_tenant_id UUID,
    p_invoice_id UUID
) RETURNS UUID AS $$
DECLARE
    v_status VARCHAR;
    v_original_amount BIGINT;
    v_allocated_amount BIGINT;
    v_adjusted_amount BIGINT;
    v_f1_tx_id UUID;
    v_reversal_tx_id UUID;
    v_void_attempt UUID;
    v_f1_res JSONB;
BEGIN
    -- Strict security check
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Invoice voiding restricted to service_role or admin.' USING ERRCODE = 'F3001';
    END IF;

    -- 1. Lock invoice row
    SELECT status, f1_transaction_id, void_posting_attempt_id INTO v_status, v_f1_tx_id, v_void_attempt
    FROM public.finance_invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'F3002';
    END IF;

    -- Idempotency check for void: If already voided, verify F1 reversal exists and return it
    IF v_status = 'VOIDED' THEN
        SELECT id INTO v_reversal_tx_id FROM public.finance_transactions
        WHERE tenant_id = p_tenant_id AND idempotency_key = v_void_attempt::VARCHAR;
        
        IF v_reversal_tx_id IS NOT NULL THEN
            RETURN v_reversal_tx_id;
        ELSE
            RAISE EXCEPTION 'INVOICE_ALREADY_VOIDED_CONFLICT' USING ERRCODE = 'F3019';
        END IF;
    END IF;

    IF v_status <> 'FINALIZED' THEN
        RAISE EXCEPTION 'INVOICE_NOT_FINALIZED: Only finalized invoices can be voided.' USING ERRCODE = 'F3013';
    END IF;

    -- 2. Lock position and verify no payments allocated (outstanding matches original)
    SELECT original_amount_minor, allocated_amount_minor, adjusted_amount_minor
    INTO v_original_amount, v_allocated_amount, v_adjusted_amount
    FROM public.finance_receivable_positions
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_original_amount IS NULL THEN
        RAISE EXCEPTION 'RECEIVABLE_POSITION_NOT_FOUND' USING ERRCODE = 'F3006';
    END IF;

    IF v_allocated_amount > 0 THEN
        RAISE EXCEPTION 'INVOICE_HAS_ALLOCATIONS: Invoices with allocated payments cannot be voided.' USING ERRCODE = 'F3014';
    END IF;

    -- 3. Call F1 reverse transaction function (performs DR/CR reversal hạch toán đảo)
    -- Rule 9: Dùng void_posting_attempt_id được lưu cứng trong invoice làm key để chống retry race
    v_f1_res := public.finance_reverse_transaction(
        p_tenant_id,
        v_f1_tx_id,
        v_void_attempt::VARCHAR,
        'Invoice void reversal posting'
    );

    v_reversal_tx_id := (v_f1_res->>'transaction_id')::UUID;

    -- 4. Record CREDIT_ADJUSTMENT in subledger log (Rule 2: amount_minor is strictly positive)
    INSERT INTO public.finance_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, p_invoice_id, 'CREDIT_ADJUSTMENT', v_original_amount, 'RECEIVABLE_ADJUSTMENT', p_invoice_id
    );

    -- 5. Update derived position cache
    -- Enable mutation temporarily in PL/pgSQL scope
    PERFORM set_config('finance.allow_receivable_mutation', 'true', true);

    UPDATE public.finance_receivable_positions
    SET adjusted_amount_minor = adjusted_amount_minor + v_original_amount,
        version = version + 1
    WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;

    -- 6. Transition invoice status
    UPDATE public.finance_invoices
    SET status = 'VOIDED'
    WHERE id = p_invoice_id;

    RETURN v_reversal_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 5. GRANTS
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.finance_create_draft_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_add_invoice_line TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_finalize_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_void_invoice TO authenticated;
