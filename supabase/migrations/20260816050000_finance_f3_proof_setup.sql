-- Migration: 20260816050000_finance_f3_proof_setup
-- Component: F3 Pre-Coding Proof Setup
-- Description:
--   Creates temporary schemas, helper tables, and plpgsql functions to run G1 and G2 runtime tests.
--   Proof runner deletes all created objects during cleanup. No F3 production schema is written.

-- =========================================================================
-- 1. TEMPORARY TABLES (Pre-fixed with tmp_f3_proof_)
-- =========================================================================

CREATE TABLE public.tmp_f3_proof_invoices (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    customer_id                 UUID NOT NULL,
    invoice_number              VARCHAR(50) NOT NULL,
    status                      VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT', 'FINALIZED', 'ADJUSTED', 'VOIDED')),
    currency                    VARCHAR(10) NOT NULL,
    total_pretax_amount_minor   BIGINT NOT NULL CHECK (total_pretax_amount_minor >= 0),
    tax_amount_minor            BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
    total_invoice_amount_minor  BIGINT NOT NULL,
    f1_transaction_id           UUID UNIQUE,
    posting_status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                  CHECK (posting_status IN ('PENDING', 'SUCCESS', 'FAILED')),
    posting_attempt_id          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tmp_f3_invoice_num UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE public.tmp_f3_proof_receivable_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    invoice_id  UUID NOT NULL REFERENCES public.tmp_f3_proof_invoices(id) ON DELETE CASCADE,
    entry_type  VARCHAR(30) NOT NULL
                  CHECK (entry_type IN ('DEBIT_ACCRUAL', 'CREDIT_ALLOCATION',
                                        'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
    source_type     VARCHAR(30) NOT NULL
                      CHECK (source_type IN ('INVOICE', 'ALLOCATION', 'RECEIVABLE_ADJUSTMENT')),
    source_id       UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tmp_f3_ledger_fact UNIQUE (tenant_id, source_type, source_id, entry_type)
);

CREATE TABLE public.tmp_f3_proof_receivable_positions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL REFERENCES public.tmp_f3_proof_invoices(id) ON DELETE CASCADE,
    customer_id             UUID NOT NULL,
    currency                VARCHAR(10) NOT NULL,
    original_amount_minor   BIGINT NOT NULL,
    allocated_amount_minor  BIGINT NOT NULL DEFAULT 0,
    adjusted_amount_minor   BIGINT NOT NULL DEFAULT 0,
    outstanding_amount_minor BIGINT GENERATED ALWAYS AS
                              (original_amount_minor - allocated_amount_minor - adjusted_amount_minor)
                              STORED,
    last_reconstructed_at   TIMESTAMPTZ,
    version                 INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_tmp_f3_position UNIQUE (tenant_id, invoice_id)
);

CREATE TABLE public.tmp_f3_proof_allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL REFERENCES public.tmp_f3_proof_invoices(id) ON DELETE CASCADE,
    cash_movement_id        UUID NOT NULL, -- logically maps to F2
    allocated_amount_minor  BIGINT NOT NULL CHECK (allocated_amount_minor > 0),
    allocation_type         VARCHAR(20) NOT NULL CHECK (allocation_type IN ('STANDARD', 'REVERSAL')),
    reversal_ref_id         UUID REFERENCES public.tmp_f3_proof_allocations(id),
    rate_source             VARCHAR(50) NOT NULL CHECK (rate_source IN ('CENTRAL_BANK', 'TREASURY', 'MANUAL_AUTHORIZED')),
    rate_timestamp          TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: Only one reversal allowed per standard allocation (F3-I-10)
CREATE UNIQUE INDEX idx_tmp_f3_reversal_once
  ON public.tmp_f3_proof_allocations(reversal_ref_id)
  WHERE reversal_ref_id IS NOT NULL;

-- =========================================================================
-- 2. TRIGGER GUARDS (Absolute Immutability)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tmp_f3_proof_mutation_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME IN ('tmp_f3_proof_receivable_ledger', 'tmp_f3_proof_allocations') AND TG_OP IN ('UPDATE', 'DELETE') THEN
        RAISE EXCEPTION 'DIRECT_AR_MUTATION_PROHIBITED: Subledger logs and allocations are strictly append-only.'
        USING ERRCODE = 'F3001';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tmp_f3_ledger_guard
BEFORE UPDATE OR DELETE ON public.tmp_f3_proof_receivable_ledger
FOR EACH ROW EXECUTE FUNCTION public.tmp_f3_proof_mutation_guard();

CREATE TRIGGER trg_tmp_f3_alloc_guard
BEFORE UPDATE OR DELETE ON public.tmp_f3_proof_allocations
FOR EACH ROW EXECUTE FUNCTION public.tmp_f3_proof_mutation_guard();

-- =========================================================================
-- 3. G1 WRAPPER RPC (Atomic Finalization)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tmp_f3_proof_finalize_invoice(
    p_tenant_id UUID,
    p_invoice_id UUID,
    p_idempotency_key VARCHAR,
    p_request_hash VARCHAR,
    p_posted_at TIMESTAMPTZ,
    p_currency VARCHAR,
    p_lines JSONB
) RETURNS JSONB AS $$
DECLARE
    v_status VARCHAR;
    v_total_amount BIGINT;
    v_f1_res JSONB;
    v_tx_id UUID;
    v_is_duplicate BOOLEAN;
BEGIN
    -- 1. Row lock invoice row and validate status
    SELECT status, total_invoice_amount_minor, f1_transaction_id INTO v_status, v_total_amount, v_tx_id
    FROM public.tmp_f3_proof_invoices
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
            RAISE EXCEPTION 'INVOICE_ALREADY_FINALIZED_CONFLICT' USING ERRCODE = 'F3009';
        END IF;
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_NOT_DRAFT' USING ERRCODE = 'F3003';
    END IF;

    -- 2. Call F1 nested post transaction function
    v_f1_res := public.finance_post_transaction(
        p_tenant_id,
        p_idempotency_key,
        p_request_hash,
        'F3_AR_INVOICE',
        p_invoice_id::VARCHAR,
        'ACCRUAL',
        p_posted_at,
        p_currency,
        p_currency, -- functional equals transaction currency for simple proof
        1.0, -- exchange_rate
        'SYSTEM',
        'SYSTEM',
        p_posted_at,
        'Invoice finalization accrual posting',
        'INVOICE',
        p_invoice_id::VARCHAR,
        p_lines
    );

    v_tx_id := (v_f1_res->>'transaction_id')::UUID;
    v_is_duplicate := (v_f1_res->>'is_duplicate')::BOOLEAN;

    -- 3. If duplicate posting, verify subledger is already recorded.
    --    This implements G1-04 crash/retry idempotency:
    --    If F1 tx exists, F3 verifies if subledger log exists.
    IF v_is_duplicate THEN
        IF EXISTS (
            SELECT 1 FROM public.tmp_f3_proof_receivable_ledger
            WHERE tenant_id = p_tenant_id
              AND source_type = 'INVOICE'
              AND source_id = p_invoice_id
              AND entry_type = 'DEBIT_ACCRUAL'
        ) THEN
            -- Idempotent bypass: already fully completed
            RETURN jsonb_build_object(
                'success', true,
                'transaction_id', v_tx_id,
                'is_duplicate', true
            );
        ELSE
            -- Inconsistency: F1 succeeded but F3 was lost. Proceed to record F3 ledger.
        END IF;
    END IF;

    -- 4. Record DEBIT_ACCRUAL in subledger log
    INSERT INTO public.tmp_f3_proof_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, p_invoice_id, 'DEBIT_ACCRUAL', v_total_amount, 'INVOICE', p_invoice_id
    );

    -- 5. Initialize position cache
    INSERT INTO public.tmp_f3_proof_receivable_positions (
        tenant_id, invoice_id, customer_id, currency, original_amount_minor
    )
    SELECT tenant_id, id, customer_id, currency, total_invoice_amount_minor
    FROM public.tmp_f3_proof_invoices
    WHERE id = p_invoice_id
    ON CONFLICT ON CONSTRAINT uq_tmp_f3_position DO NOTHING;

    -- 6. Transition invoice status
    UPDATE public.tmp_f3_proof_invoices
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
-- 4. G2 WRAPPER RPC (Concurrently Safe Allocation)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tmp_f3_proof_allocate_payment(
    p_tenant_id UUID,
    p_invoice_id UUID,
    p_cash_movement_id UUID,
    p_amount BIGINT,
    p_rate_source VARCHAR,
    p_rate_timestamp TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    v_movement_amount BIGINT;
    v_movement_direction VARCHAR;
    v_sum_allocations BIGINT;
    v_outstanding BIGINT;
    v_alloc_id UUID;
BEGIN
    -- Step 1: Advisory lock keyed on tenant + cash_movement (G2 requirement)
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_cash_movement_id::text, 0));

    -- Step 2: Read F2 cash movement (authoritative source check)
    SELECT amount_minor::BIGINT, direction INTO v_movement_amount, v_movement_direction
    FROM public.finance_cash_movements
    WHERE tenant_id = p_tenant_id AND id = p_cash_movement_id;

    IF v_movement_amount IS NULL THEN
        RAISE EXCEPTION 'CASH_MOVEMENT_NOT_FOUND' USING ERRCODE = 'F3004';
    END IF;

    IF v_movement_direction <> 'INFLOW' THEN
        RAISE EXCEPTION 'INVALID_CASH_DIRECTION' USING ERRCODE = 'F3005';
    END IF;

    -- Step 3: Lock F3 target position row
    SELECT outstanding_amount_minor INTO v_outstanding
    FROM public.tmp_f3_proof_receivable_positions
    WHERE tenant_id = p_tenant_id AND invoice_id = p_invoice_id
    FOR UPDATE;

    IF v_outstanding IS NULL THEN
        RAISE EXCEPTION 'RECEIVABLE_POSITION_NOT_FOUND' USING ERRCODE = 'F3006';
    END IF;

    -- Step 4: Validate allocation capacity against F2 movement
    SELECT COALESCE(SUM(CASE WHEN allocation_type = 'STANDARD' THEN allocated_amount_minor ELSE -allocated_amount_minor END), 0)
    INTO v_sum_allocations
    FROM public.tmp_f3_proof_allocations
    WHERE tenant_id = p_tenant_id AND cash_movement_id = p_cash_movement_id;

    IF v_sum_allocations + p_amount > v_movement_amount THEN
        RAISE EXCEPTION 'OVER_ALLOCATION' USING ERRCODE = 'F3007';
    END IF;

    -- Validate against outstanding balance
    IF p_amount > v_outstanding THEN
        RAISE EXCEPTION 'ALLOCATION_EXCEEDS_OUTSTANDING' USING ERRCODE = 'F3008';
    END IF;

    -- Step 5: Insert standard allocation record
    v_alloc_id := gen_random_uuid();
    INSERT INTO public.tmp_f3_proof_allocations (
        id, tenant_id, invoice_id, cash_movement_id, allocated_amount_minor,
        allocation_type, rate_source, rate_timestamp
    ) VALUES (
        v_alloc_id, p_tenant_id, p_invoice_id, p_cash_movement_id, p_amount,
        'STANDARD', p_rate_source, p_rate_timestamp
    );

    -- Step 6: Write CREDIT_ALLOCATION subledger log
    INSERT INTO public.tmp_f3_proof_receivable_ledger (
        tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id
    ) VALUES (
        p_tenant_id, p_invoice_id, 'CREDIT_ALLOCATION', p_amount, 'ALLOCATION', v_alloc_id
    );

    -- Step 7: Update position cache
    UPDATE public.tmp_f3_proof_receivable_positions
    SET allocated_amount_minor = allocated_amount_minor + p_amount,
        version = version + 1
    WHERE tenant_id = p_tenant_id AND invoice_id = p_invoice_id;

    RETURN jsonb_build_object(
        'success', true,
        'allocation_id', v_alloc_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 5. GRANTS
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.tmp_f3_proof_finalize_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.tmp_f3_proof_allocate_payment TO authenticated;
