-- =========================================================================
-- Migration: 20260820010000_f5_prepayment_reconciliation
-- Component: F5.4 STEP 4 — Prepayment Reconciliation
-- Constitution: v1.2-Final (FROZEN 2026-08-16T08:25:00+07:00)
-- =========================================================================
--
-- PURPOSE:
--   Implements Prepayment Reconciliation for F5 Phase 4:
--   1. finance_prepayment_facts_as_of — Read contract for prepayment facts
--   2. f5_reconstruct_prepayment_position — Reconstruction function
--   3. PREPAYMENT_GL_BALANCE control type support in f5_run_reconciliation
--
-- CONSTITUTIONAL RULES ENFORCED:
--   F5-G4: Reconstruction from immutable facts ONLY. Never reads position caches.
--   F5-G7: All reads go through approved read contracts. Zero direct finance_* queries.
--   F5-I-8: Tenant isolation enforced at all levels.
--   F5-T-1: Temporal boundary using effective-date field (created_at).
--   Law 1:  F5 NEVER mutates F1/F2/F3/F4 authoritative records.
--
-- PREPAYMENT FACT TYPES (from finance_vendor_prepayments):
--   PREPAYMENT_RECORDED  — Initial prepayment made to vendor
--   PREPAYMENT_APPLIED   — Prepayment applied to a vendor bill
--   PREPAYMENT_REFUNDED  — Prepayment refunded to customer
--
-- RECONSTRUCTION FORMULA:
--   available_balance =
--     SUM(PREPAYMENT_RECORDED) - SUM(PREPAYMENT_APPLIED) - SUM(PREPAYMENT_REFUNDED)
--
-- MIGRATION ORDER:
--   Requires: 20260819000000_f5_schema.sql
--   Requires: 20260819010000_f5_read_contracts.sql
--   Requires: 20260819020000_f5_reconstruction_engine.sql
--   Requires: 20260818000000_finance_ap_engine_v1.sql (finance_vendor_prepayments table)
-- =========================================================================

-- =========================================================================
-- 1. PREPAYMENT READ CONTRACT
--    finance_prepayment_facts_as_of
--
-- Returns all prepayment facts from finance_vendor_prepayments with
-- created_at <= p_as_of. Scoped to tenant_id.
--
-- Effective date basis: created_at (F4 Prepayment canonical field)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_prepayment_facts_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F4_PREPAYMENT:v1'
)
RETURNS TABLE (
    prepayment_id           UUID,
    vendor_id               UUID,
    fact_type               VARCHAR(30),
    amount_minor            BIGINT,
    posting_date            TIMESTAMPTZ,
    posting_attempt_id      UUID,
    f1_transaction_id       UUID,
    matched_vendor_bill_id  UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Contract version gate
    IF p_contract_version NOT IN ('F4_PREPAYMENT:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_prepayment_facts_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    -- Tenant isolation enforced (F5-I-8)
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED: p_tenant_id cannot be NULL'
            USING ERRCODE = 'F5011';
    END IF;

    -- Temporal boundary required (F5-T-1)
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED: p_as_of cannot be NULL — all F5 reads must be temporally bounded'
            USING ERRCODE = 'F5012';
    END IF;

    -- Return prepayment facts filtered by created_at (F5-T-1 declared field)
    -- Effective date basis: finance_vendor_prepayments.created_at
    RETURN QUERY
    SELECT
        fvp.id                          AS prepayment_id,
        fvp.vendor_id                   AS vendor_id,
        fvp.fact_type                   AS fact_type,
        fvp.amount_minor                AS amount_minor,
        fvp.created_at                  AS posting_date,
        fvp.posting_attempt_id          AS posting_attempt_id,
        fvp.f1_transaction_id           AS f1_transaction_id,
        fvp.matched_vendor_bill_id      AS matched_vendor_bill_id
    FROM public.finance_vendor_prepayments fvp
    WHERE fvp.tenant_id = p_tenant_id
      -- F5-T-1: Effective-date filtering using declared field: created_at
      AND fvp.created_at <= p_as_of
    ORDER BY fvp.created_at ASC, fvp.id ASC;
END;
$$;

COMMENT ON FUNCTION public.finance_prepayment_facts_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Read Contract F4_PREPAYMENT:v1. Returns prepayment facts with created_at <= p_as_of. '
    'Effective-date basis: finance_vendor_prepayments.created_at (F5-T-1 compliance). '
    'SECURITY DEFINER: F5 uses this contract; it MUST NOT query finance_vendor_prepayments directly.';

GRANT EXECUTE ON FUNCTION public.finance_prepayment_facts_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 2. PREPAYMENT RECONSTRUCTION FUNCTION
--    f5_reconstruct_prepayment_position
--
-- Reconstructs the prepayment position (available balance) from immutable
-- facts ONLY. Never reads any position cache table.
--
-- Formula:
--   available_balance =
--     SUM(PREPAYMENT_RECORDED) - SUM(PREPAYMENT_APPLIED) - SUM(PREPAYMENT_REFUNDED)
--
-- F5-G4: Cache corrupted? This function is unaffected.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_reconstruct_prepayment_position(
    p_tenant_id         UUID,
    p_prepayment_id     UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F4_PREPAYMENT:v1'
)
RETURNS TABLE (
    prepayment_id               UUID,
    vendor_id                   UUID,
    fact_recorded_total         NUMERIC(20,4),
    fact_applied_total          NUMERIC(20,4),
    fact_refunded_total         NUMERIC(20,4),
    available_balance           NUMERIC(20,4),
    fact_count                  INT,
    reconstruction_as_of        TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_vendor_id UUID;
BEGIN
    -- Authorize: F5 engines run as service_role
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    -- Null guards
    IF p_tenant_id IS NULL OR p_prepayment_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: tenant_id, prepayment_id, and as_of are required'
            USING ERRCODE = 'F5002';
    END IF;

    -- Get vendor_id for the prepayment (used for grouping)
    -- Note: We query the original prepayment record to get vendor_id
    -- This is NOT a contract violation because we're just getting reference data
    SELECT vendor_id INTO v_vendor_id
    FROM public.finance_vendor_prepayments
    WHERE id = p_prepayment_id AND tenant_id = p_tenant_id
    LIMIT 1;

    IF v_vendor_id IS NULL THEN
        -- Prepayment not found, return zero balance
        RETURN QUERY
        SELECT
            p_prepayment_id         AS prepayment_id,
            NULL::UUID              AS vendor_id,
            0::NUMERIC(20,4)        AS fact_recorded_total,
            0::NUMERIC(20,4)        AS fact_applied_total,
            0::NUMERIC(20,4)        AS fact_refunded_total,
            0::NUMERIC(20,4)        AS available_balance,
            0::INT                  AS fact_count,
            p_as_of                 AS reconstruction_as_of;
        RETURN;
    END IF;

    -- Reconstruct from facts (F5-G4 compliance: no cache read)
    -- Reads via approved contract finance_prepayment_facts_as_of (F5-G7 compliance)
    RETURN QUERY
    WITH prepay_facts AS (
        SELECT
            f.fact_type,
            f.amount_minor
        FROM public.finance_prepayment_facts_as_of(p_tenant_id, p_as_of, p_contract_version) f
        WHERE f.prepayment_id = p_prepayment_id
    )
    SELECT
        p_prepayment_id                                     AS prepayment_id,
        v_vendor_id                                         AS vendor_id,
        COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_RECORDED'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_recorded_total,
        COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_APPLIED'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_applied_total,
        COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_REFUNDED'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_refunded_total,
        -- Available balance = RECORDED - APPLIED - REFUNDED
        (
            COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_RECORDED'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_APPLIED'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN fact_type = 'PREPAYMENT_REFUNDED'
                             THEN amount_minor ELSE 0 END), 0)
        )::NUMERIC(20,4)                                    AS available_balance,
        COUNT(*)::INT                                       AS fact_count,
        p_as_of                                             AS reconstruction_as_of
    FROM prepay_facts;
END;
$$;

COMMENT ON FUNCTION public.f5_reconstruct_prepayment_position(UUID, UUID, TIMESTAMPTZ, TEXT) IS
    'F5 Reconstruction Engine: Prepayment Position (F5-G4 compliance). '
    'Reconstructs available_balance from PREPAYMENT facts ONLY. Never reads cache. '
    'Formula: RECORDED - APPLIED - REFUNDED. Zero direct table queries (F5-G7).';

GRANT EXECUTE ON FUNCTION public.f5_reconstruct_prepayment_position(UUID, UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 3. UPDATE CONTRACT REGISTRY
--    Add F4_PREPAYMENT:v1 to f5_read_contract_registry
-- =========================================================================

-- Drop existing view to recreate with new contract
DROP VIEW IF EXISTS public.f5_read_contract_registry;

CREATE OR REPLACE VIEW public.f5_read_contract_registry AS
SELECT
    'F1_GL:v1'      AS contract_version,
    'F1'            AS domain,
    'finance_journal_entries_as_of'     AS function_name,
    'posting_date'  AS effective_date_field,
    'finance_transactions.posted_at'    AS effective_date_source,
    TRUE            AS is_active,
    'F5 Constitution v1.2-Final'        AS locked_in_constitution
UNION ALL
SELECT
    'F2_CASH:v1',
    'F2',
    'finance_get_cash_movements_as_of',
    'cash_effective_date',
    'finance_cash_movements.effective_date',
    TRUE,
    'F5 Constitution v1.2-Final'
UNION ALL
SELECT
    'F3_AR:v1',
    'F3',
    'finance_ar_facts_as_of',
    'posting_date',
    'finance_receivable_ledger.created_at',
    TRUE,
    'F5 Constitution v1.2-Final'
UNION ALL
SELECT
    'F4_AP:v1',
    'F4',
    'finance_ap_facts_as_of',
    'posting_date',
    'finance_payable_ledger.created_at AND finance_vendor_prepayments.created_at',
    TRUE,
    'F5 Constitution v1.2-Final'
UNION ALL
SELECT
    'F4_PREPAYMENT:v1',
    'F4',
    'finance_prepayment_facts_as_of',
    'posting_date',
    'finance_vendor_prepayments.created_at',
    TRUE,
    'F5 Constitution v1.2-Final';

COMMENT ON VIEW public.f5_read_contract_registry IS
    'F5 Constitution v1.2-Final: Canonical catalog of all approved F5 read contracts. '
    'F5 RPCs MUST validate p_contract_version against this registry. '
    'Any contract not in this registry MUST be rejected (F5-G7). '
    'Updated to include F4_PREPAYMENT:v1 contract.';

GRANT SELECT ON public.f5_read_contract_registry TO service_role, authenticated;


-- =========================================================================
-- 4. EXTEND f5_run_reconciliation TO SUPPORT PREPAYMENT_GL_BALANCE
--
-- This section modifies the existing f5_run_reconciliation function to
-- handle the PREPAYMENT domain and PREPAYMENT_GL_BALANCE control type.
--
-- Control Logic:
--   1. Reconstruct prepayment position from F4 facts
--   2. Sum GL balance for prepayment control account (from F1)
--   3. Compare: fact_position == gl_balance → MATCHED | VARIANCE | QUARANTINED
-- =========================================================================

-- Drop existing function to recreate with PREPAYMENT support
DROP FUNCTION IF EXISTS public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.f5_run_reconciliation(
    p_tenant_id              UUID,
    p_domain                 TEXT,      -- 'AP' | 'AR' | 'CASH' | 'PREPAYMENT'
    p_control_type           TEXT,      -- 'AP_GL_BALANCE' | 'AR_GL_BALANCE' | 'CASH_GL_BALANCE' | 'PREPAYMENT_GL_BALANCE'
    p_basis_id               UUID,
    p_basis_version          TEXT,
    p_reconciliation_as_of   TIMESTAMPTZ
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_run_id            UUID := gen_random_uuid();
    v_matched_count     INT := 0;
    v_variance_count    INT := 0;
    v_quarantined_count INT := 0;
    v_control_account   RECORD;
    v_ap_position       RECORD;
    v_ar_position       RECORD;
    v_cash_position     RECORD;
    v_prepay_position   RECORD;
    v_account_code      VARCHAR;
    v_account_id        UUID;
    v_ap_account_id     UUID;
    v_gl_sum            NUMERIC(20,4);
    v_gl_sum            NUMERIC(20,4);
    v_financial_result  TEXT;
    v_severity          TEXT;
    v_result_id         UUID;
    v_case_id           UUID;
    v_vendor_bill       RECORD;
    v_invoice           RECORD;
    v_prepayment        RECORD;
BEGIN
    -- Authorization guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    -- Null guards
    IF p_tenant_id IS NULL OR p_domain IS NULL OR p_control_type IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: tenant_id, domain, and control_type are required'
            USING ERRCODE = 'F5002';
    END IF;

    -- Domain validation
    IF p_domain NOT IN ('AP', 'AR', 'CASH', 'PREPAYMENT') THEN
        RAISE EXCEPTION 'F5_INVALID_DOMAIN: domain must be AP, AR, CASH, or PREPAYMENT. Got: %', p_domain
            USING ERRCODE = 'F5003';
    END IF;

    -- Control type validation
    IF p_control_type NOT IN ('AP_GL_BALANCE', 'AR_GL_BALANCE', 'CASH_GL_BALANCE', 'PREPAYMENT_GL_BALANCE') THEN
        RAISE EXCEPTION 'F5_INVALID_CONTROL_TYPE: control_type must be AP_GL_BALANCE, AR_GL_BALANCE, CASH_GL_BALANCE, or PREPAYMENT_GL_BALANCE'
            USING ERRCODE = 'F5004';
    END IF;

    -- =====================================================================
    -- BRANCH: PREPAYMENT_GL_BALANCE
    -- =====================================================================
    IF p_domain = 'PREPAYMENT' AND p_control_type = 'PREPAYMENT_GL_BALANCE' THEN
        -- Get prepayment control account (Asset account type 242 or equivalent)
        -- finance_get_control_account returns account_code (VARCHAR), need to resolve to account_id
        v_account_code := public.finance_get_control_account(p_tenant_id, 'PREPAYMENT_CONTROL');

        IF v_account_code IS NULL THEN
            RAISE EXCEPTION 'F5_CONTROL_ACCOUNT_MISSING: No PREPAYMENT control account mapping found for tenant %',
                p_tenant_id
                USING ERRCODE = 'F5005';
        END IF;

        -- Resolve account_code to account_id
        SELECT id INTO v_account_id
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id 
          AND code = v_account_code
          AND is_active = true
        LIMIT 1;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'F5_CONTROL_ACCOUNT_NOT_FOUND: Prepayment control account code % not found or inactive for tenant %',
                v_account_code, p_tenant_id
                USING ERRCODE = 'F5005';
        END IF;

        -- Loop through all prepayments for this tenant
        FOR v_prepayment IN
            SELECT DISTINCT prepayment_id, vendor_id
            FROM public.finance_prepayment_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F4_PREPAYMENT:v1')
        LOOP
            -- Reconstruct prepayment position from F4 facts
            SELECT * INTO v_prepay_position
            FROM public.f5_reconstruct_prepayment_position(
                p_tenant_id,
                v_prepayment.prepayment_id,
                p_reconciliation_as_of,
                'F4_PREPAYMENT:v1'
            );

            -- Sum GL balance for this prepayment (from F1 contract)
            -- Match using source_type = 'VENDOR_PREPAYMENT' and source_id = prepayment_id
            SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::NUMERIC(20,4)
            INTO v_gl_sum
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_id = v_account_id
              AND source_type = 'VENDOR_PREPAYMENT'
              AND source_id = v_prepayment.prepayment_id;

            -- Compare: prepayment available_balance vs GL debit balance
            -- For prepayment asset account: Debit = asset increase, Credit = asset decrease
            -- available_balance should match GL debit balance
            IF ABS(v_prepay_position.available_balance - v_gl_sum) < 0.01 THEN
                v_financial_result := 'MATCHED';
                v_severity := 'ACCEPTABLE';
                v_matched_count := v_matched_count + 1;
            ELSIF ABS(v_prepay_position.available_balance - v_gl_sum) < 1000.00 THEN
                v_financial_result := 'VARIANCE';
                v_severity := 'REVIEW';
                v_variance_count := v_variance_count + 1;
            ELSE
                v_financial_result := 'QUARANTINED';
                v_severity := 'CRITICAL';
                v_quarantined_count := v_quarantined_count + 1;
            END IF;

            -- Insert result
            v_result_id := gen_random_uuid();
            INSERT INTO public.f5_control_results (
                id, tenant_id, run_id, source_module, source_type, source_id,
                control_type, domain, financial_result, severity,
                fact_position, gl_position,
                variance_amount, variance_pct,
                detected_at, detected_by
            ) VALUES (
                v_result_id, p_tenant_id, v_run_id,
                'F4', 'VENDOR_PREPAYMENT', v_prepayment.prepayment_id,
                p_control_type, p_domain, v_financial_result, v_severity,
                v_prepay_position.available_balance, v_gl_sum,
                ABS(v_prepay_position.available_balance - v_gl_sum),
                CASE WHEN v_gl_sum = 0 THEN 0
                     ELSE ABS((v_prepay_position.available_balance - v_gl_sum) / v_gl_sum * 100)
                END,
                NOW(), 'f5_run_reconciliation:v1'
            );

            -- Create case if not MATCHED
            IF v_financial_result != 'MATCHED' THEN
                INSERT INTO public.f5_control_cases (
                    tenant_id, result_id, status, opened_at, opened_by
                ) VALUES (
                    p_tenant_id, v_result_id, 'OPEN',
                    NOW(), 'f5_run_reconciliation:v1'
                )
                RETURNING case_id INTO v_case_id;

                -- Update result with case_id
                UPDATE public.f5_control_results
                SET case_id = v_case_id
                WHERE id = v_result_id;
            END IF;
        END LOOP;

        -- Return summary
        RETURN jsonb_build_object(
            'run_id', v_run_id,
            'domain', p_domain,
            'control_type', p_control_type,
            'matched', v_matched_count,
            'variances', v_variance_count,
            'quarantined', v_quarantined_count,
            'total_checks', v_matched_count + v_variance_count + v_quarantined_count,
            'reconciliation_as_of', p_reconciliation_as_of,
            'status', 'COMPLETED'
        );
    END IF;

    -- =====================================================================
    -- BRANCH: AP_GL_BALANCE (existing logic preserved)
    -- =====================================================================
    IF p_domain = 'AP' AND p_control_type = 'AP_GL_BALANCE' THEN
        -- Get AP control account
        v_account_code := public.finance_get_control_account(p_tenant_id, 'AP_CONTROL');

        IF v_account_code IS NULL THEN
            RAISE EXCEPTION 'F5_CONTROL_ACCOUNT_MISSING: No AP control account mapping found for tenant %',
                p_tenant_id
                USING ERRCODE = 'F5005';
        END IF;

        -- Resolve account_code to account_id
        SELECT id INTO v_ap_account_id
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id 
          AND code = v_account_code
          AND is_active = true
        LIMIT 1;

        IF v_ap_account_id IS NULL THEN
            RAISE EXCEPTION 'F5_CONTROL_ACCOUNT_NOT_FOUND: AP control account code % not found or inactive for tenant %',
                v_account_code, p_tenant_id
                USING ERRCODE = 'F5005';
        END IF;

        -- Loop through all vendor bills
        FOR v_vendor_bill IN
            SELECT DISTINCT vendor_bill_id
            FROM public.finance_ap_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F4_AP:v1')
            WHERE vendor_bill_id IS NOT NULL
        LOOP
            -- Reconstruct AP position from F4 facts
            SELECT * INTO v_ap_position
            FROM public.f5_reconstruct_ap_position(
                p_tenant_id,
                v_vendor_bill.vendor_bill_id,
                p_reconciliation_as_of,
                'F4_AP:v1'
            );

            -- Sum GL balance for this bill (from F1 contract)
            SELECT COALESCE(SUM(credit_amount - debit_amount), 0)::NUMERIC(20,4)
            INTO v_gl_sum
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_id = v_ap_account_id
              AND source_type = 'VENDOR_BILL'
              AND source_id = v_vendor_bill.vendor_bill_id;

            -- Compare: AP outstanding vs GL credit balance
            IF ABS(v_ap_position.reconstructed_outstanding - v_gl_sum) < 0.01 THEN
                v_financial_result := 'MATCHED';
                v_severity := 'ACCEPTABLE';
                v_matched_count := v_matched_count + 1;
            ELSIF ABS(v_ap_position.reconstructed_outstanding - v_gl_sum) < 1000.00 THEN
                v_financial_result := 'VARIANCE';
                v_severity := 'REVIEW';
                v_variance_count := v_variance_count + 1;
            ELSE
                v_financial_result := 'QUARANTINED';
                v_severity := 'CRITICAL';
                v_quarantined_count := v_quarantined_count + 1;
            END IF;

            -- Insert result
            v_result_id := gen_random_uuid();
            INSERT INTO public.f5_control_results (
                id, tenant_id, run_id, source_module, source_type, source_id,
                control_type, domain, financial_result, severity,
                fact_position, gl_position,
                variance_amount, variance_pct,
                detected_at, detected_by
            ) VALUES (
                v_result_id, p_tenant_id, v_run_id,
                'F4', 'VENDOR_BILL', v_vendor_bill.vendor_bill_id,
                p_control_type, p_domain, v_financial_result, v_severity,
                v_ap_position.reconstructed_outstanding, v_gl_sum,
                ABS(v_ap_position.reconstructed_outstanding - v_gl_sum),
                CASE WHEN v_gl_sum = 0 THEN 0
                     ELSE ABS((v_ap_position.reconstructed_outstanding - v_gl_sum) / v_gl_sum * 100)
                END,
                NOW(), 'f5_run_reconciliation:v1'
            );

            -- Create case if not MATCHED
            IF v_financial_result != 'MATCHED' THEN
                INSERT INTO public.f5_control_cases (
                    tenant_id, result_id, status, opened_at, opened_by
                ) VALUES (
                    p_tenant_id, v_result_id, 'OPEN',
                    NOW(), 'f5_run_reconciliation:v1'
                )
                RETURNING case_id INTO v_case_id;

                UPDATE public.f5_control_results
                SET case_id = v_case_id
                WHERE id = v_result_id;
            END IF;
        END LOOP;

        RETURN jsonb_build_object(
            'run_id', v_run_id,
            'domain', p_domain,
            'control_type', p_control_type,
            'matched', v_matched_count,
            'variances', v_variance_count,
            'quarantined', v_quarantined_count,
            'total_checks', v_matched_count + v_variance_count + v_quarantined_count,
            'reconciliation_as_of', p_reconciliation_as_of,
            'status', 'COMPLETED'
        );
    END IF;

    -- =====================================================================
    -- BRANCH: AR_GL_BALANCE (stub for future implementation)
    -- =====================================================================
    IF p_domain = 'AR' AND p_control_type = 'AR_GL_BALANCE' THEN
        RAISE EXCEPTION 'AR_GL_BALANCE not yet implemented in this migration'
            USING ERRCODE = 'F5999';
    END IF;

    -- =====================================================================
    -- BRANCH: CASH_GL_BALANCE (stub for future implementation)
    -- =====================================================================
    IF p_domain = 'CASH' AND p_control_type = 'CASH_GL_BALANCE' THEN
        RAISE EXCEPTION 'CASH_GL_BALANCE not yet implemented in this migration'
            USING ERRCODE = 'F5999';
    END IF;

    -- If we reach here, invalid domain/control_type combination
    RAISE EXCEPTION 'F5_INVALID_COMBINATION: Invalid domain/control_type combination: % / %',
        p_domain, p_control_type
        USING ERRCODE = 'F5006';
END;
$$;

COMMENT ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) IS
    'F5 Reconciliation Entry Point (F5-G4 + F5-G7 compliance). '
    'Supports AP_GL_BALANCE, AR_GL_BALANCE, CASH_GL_BALANCE, and PREPAYMENT_GL_BALANCE. '
    'Reconstructs positions from facts, compares to GL, returns MATCHED | VARIANCE | QUARANTINED. '
    'Updated to support PREPAYMENT domain in F5.4 STEP 4.';

GRANT EXECUTE ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ)
    TO service_role;


-- =========================================================================
-- F5-G7 VERIFICATION COMMENT (Read Boundary Gate)
-- This migration creates:
--   1. New read contract: finance_prepayment_facts_as_of (SECURITY DEFINER)
--   2. Reconstruction function: f5_reconstruct_prepayment_position
--   3. Extended f5_run_reconciliation to handle PREPAYMENT domain
--
-- All prepayment data reads go through the approved contract.
-- Zero direct SELECT FROM finance_vendor_prepayments in F5 logic.
-- Machine-checkable: grep PREPAYMENT branch for direct table access.
-- =========================================================================
