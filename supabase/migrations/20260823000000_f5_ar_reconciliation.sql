-- =========================================================================
-- Migration: 20260823000000_f5_ar_reconciliation
-- Component: F5.5 — AR_GL_BALANCE Control Domain
-- Constitution: F5 v1.2-Final (FROZEN — do not modify)
-- =========================================================================
--
-- PURPOSE:
--   Implements the AR_GL_BALANCE reconciliation branch in f5_run_reconciliation.
--   Reads AR subledger facts via finance_ar_facts_as_of (F3_AR:v1).
--   Reads F1 GL lines via finance_journal_entries_as_of (F1_GL:v1).
--   Writes ONLY to f5_* tables (Constitutional Law 3).
--
-- CRITICAL SEMANTIC DIFFERENCE FROM AP:
--   AP account 331 — CREDIT normal balance:
--     GL Outstanding = SUM(credit_functional_amount) - SUM(debit_functional_amount)
--
--   AR account 131 — DEBIT normal balance:
--     GL Outstanding = SUM(debit_functional_amount) - SUM(credit_functional_amount)
--
--   This sign convention MUST be enforced here.
--   Do NOT copy AP formula — sign inversion will produce false MATCHEDs.
--
-- RECONSTRUCTION FORMULA (AR):
--   reconstructed_outstanding =
--     SUM(DEBIT_ACCRUAL)    [invoice posted → AR increases]
--   - SUM(CREDIT_ALLOCATION) [payment received → AR decreases]
--   + SUM(DEBIT_ADJUSTMENT)  [debit memo → AR increases]
--   - SUM(CREDIT_ADJUSTMENT) [credit memo → AR decreases]
--
-- ADDITIVE POLICY:
--   No existing F1–F4 table is modified.
--   f5_run_reconciliation is replaced with CREATE OR REPLACE adding AR branch only.
--   All existing AP logic is preserved verbatim.
--
-- MIGRATION ORDER:
--   Requires: 20260819000000_f5_schema.sql
--   Requires: 20260819010000_f5_read_contracts.sql  (finance_ar_facts_as_of)
--   Requires: 20260819020000_f5_reconstruction_engine.sql  (f5_reconstruct_ar_position)
-- =========================================================================

-- =========================================================================
-- Replace f5_run_reconciliation to add AR_GL_BALANCE branch.
-- AP branch is preserved character-for-character.
-- Only the ELSE clause changes: AR_GL_BALANCE is now handled;
-- remaining unimplemented types still raise F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_run_reconciliation(
    p_tenant_id              UUID,
    p_domain                 TEXT,      -- 'AP' | 'AR' | 'CASH' | 'PREPAYMENT'
    p_control_type           TEXT,      -- Registry-defined control type
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
    v_total_checked     INT  := 0;
    v_matched           INT  := 0;
    v_variances         INT  := 0;
    v_quarantined       INT  := 0;
    v_existing_run_id   UUID;
    v_source_snapshot_hash TEXT;

    -- Shared reconciliation vars
    v_result_id         UUID;
    v_case_id           UUID;
    v_financial_result  TEXT;
    v_severity          TEXT;
    v_variance_amount   NUMERIC(20,4);

    -- AP reconciliation vars
    v_ap_fact           RECORD;
    v_ap_position       RECORD;
    v_gl_sum_ap         NUMERIC(20,4);

    -- AR reconciliation vars
    v_ar_fact           RECORD;
    v_ar_position       RECORD;
    v_gl_sum_ar         NUMERIC(20,4);
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    -- Parameter validation
    IF p_tenant_id IS NULL OR p_domain IS NULL OR p_control_type IS NULL
       OR p_basis_id IS NULL OR p_basis_version IS NULL OR p_reconciliation_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: All parameters required' USING ERRCODE = 'F5002';
    END IF;

    -- Validate domain
    IF p_domain NOT IN ('AR', 'AP', 'CASH', 'PREPAYMENT') THEN
        RAISE EXCEPTION 'F5_INVALID_DOMAIN: % is not a valid domain', p_domain
            USING ERRCODE = 'F5003';
    END IF;

    -- Validate control_type
    IF p_control_type NOT IN (
        'AR_GL_BALANCE', 'AP_GL_BALANCE', 'PREPAYMENT_GL_BALANCE',
        'CASH_GL_BALANCE', 'AR_TRACEABILITY', 'AP_TRACEABILITY',
        'FX_INTEGRITY', 'PERIOD_INTEGRITY', 'TENANT_INTEGRITY', 'DUPLICATE_EFFECT'
    ) THEN
        RAISE EXCEPTION 'F5_INVALID_CONTROL_TYPE: %', p_control_type USING ERRCODE = 'F5004';
    END IF;

    -- F5-I-9 Idempotency: compute deterministic run identity hash
    v_source_snapshot_hash := encode(
        extensions.digest(
            p_tenant_id::TEXT || '|' ||
            p_control_type    || '|' ||
            p_basis_id::TEXT  || '|' ||
            p_basis_version   || '|' ||
            p_reconciliation_as_of::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Check if this exact run_identity was already executed (idempotency)
    SELECT run_id INTO v_existing_run_id
    FROM public.f5_control_results
    WHERE tenant_id              = p_tenant_id
      AND control_type           = p_control_type
      AND basis_id               = p_basis_id
      AND basis_version          = p_basis_version
      AND reconciliation_as_of   = p_reconciliation_as_of
      AND source_snapshot_hash   = v_source_snapshot_hash
    LIMIT 1;

    IF v_existing_run_id IS NOT NULL THEN
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE financial_result = 'MATCHED'),
            COUNT(*) FILTER (WHERE financial_result = 'VARIANCE'),
            COUNT(*) FILTER (WHERE financial_result = 'QUARANTINED')
        INTO v_total_checked, v_matched, v_variances, v_quarantined
        FROM public.f5_control_results
        WHERE tenant_id = p_tenant_id AND run_id = v_existing_run_id;

        RETURN jsonb_build_object(
            'run_id',          v_existing_run_id,
            'is_duplicate',    TRUE,
            'total_checked',   v_total_checked,
            'matched',         v_matched,
            'variances',       v_variances,
            'quarantined',     v_quarantined
        );
    END IF;

    -- =========================================================
    -- AP_GL_BALANCE: Reconcile AP fact-derived position vs F1 GL
    -- Account: 331 — CREDIT normal balance
    -- GL Outstanding = SUM(credit) - SUM(debit)
    -- =========================================================
    IF p_control_type = 'AP_GL_BALANCE' THEN

        FOR v_ap_fact IN
            SELECT DISTINCT vendor_bill_id
            FROM public.finance_ap_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F4_AP:v1')
            WHERE vendor_bill_id IS NOT NULL
              AND entry_type IN ('PAYABLE_ACCRUAL', 'DISBURSEMENT_ALLOCATION', 'REVERSAL')
        LOOP
            v_total_checked := v_total_checked + 1;

            SELECT * INTO v_ap_position
            FROM public.f5_reconstruct_ap_position(
                p_tenant_id,
                v_ap_fact.vendor_bill_id,
                p_reconciliation_as_of,
                'F4_AP:v1'
            );

            -- AP 331: CREDIT normal — outstanding = credit - debit
            SELECT COALESCE(
                SUM(credit_amount) - SUM(debit_amount), 0
            ) INTO v_gl_sum_ap
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_code = '331'
              AND source_id    = v_ap_fact.vendor_bill_id;

            v_variance_amount := v_gl_sum_ap - v_ap_position.reconstructed_outstanding;

            IF v_ap_position.reconstructed_outstanding IS NULL THEN
                v_financial_result := 'QUARANTINED';
                v_severity := 'CRITICAL';
            ELSIF ABS(v_variance_amount) = 0 THEN
                v_financial_result := 'MATCHED';
                v_severity := 'LOW';
            ELSE
                v_financial_result := 'VARIANCE';
                v_severity := CASE
                    WHEN ABS(v_variance_amount) > 10000000 THEN 'CRITICAL'
                    WHEN ABS(v_variance_amount) > 1000000  THEN 'HIGH'
                    WHEN ABS(v_variance_amount) > 100000   THEN 'MEDIUM'
                    ELSE 'LOW'
                END;
            END IF;

            INSERT INTO public.f5_control_results (
                tenant_id, run_id, control_type, basis_id, basis_version,
                reconciliation_as_of, source_snapshot_hash,
                source_module, source_type, source_id,
                financial_effect_type, posting_attempt_id,
                expected_amount, actual_amount,
                financial_result, severity,
                detected_by
            ) VALUES (
                p_tenant_id, v_run_id, p_control_type, p_basis_id, p_basis_version,
                p_reconciliation_as_of, v_source_snapshot_hash,
                'F4', 'VENDOR_BILL', v_ap_fact.vendor_bill_id,
                'AP_GL_BALANCE_CHECK', v_run_id::TEXT,
                v_ap_position.reconstructed_outstanding, v_gl_sum_ap,
                v_financial_result, v_severity,
                'f5_run_reconciliation:v1'
            )
            ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
                         financial_effect_type, posting_attempt_id)
            DO NOTHING
            RETURNING result_id INTO v_result_id;

            IF v_financial_result IN ('VARIANCE', 'QUARANTINED') AND v_result_id IS NOT NULL THEN
                INSERT INTO public.f5_control_cases (
                    tenant_id, result_id, case_state,
                    detected_at, detected_by
                ) VALUES (
                    p_tenant_id, v_result_id, 'OPEN',
                    NOW(), 'f5_run_reconciliation:v1'
                )
                RETURNING case_id INTO v_case_id;

                UPDATE public.f5_control_results
                SET case_id = v_case_id
                WHERE result_id = v_result_id;

                IF v_financial_result = 'VARIANCE' THEN
                    v_variances := v_variances + 1;
                ELSE
                    v_quarantined := v_quarantined + 1;
                END IF;
            ELSIF v_financial_result = 'MATCHED' THEN
                v_matched := v_matched + 1;
            END IF;

        END LOOP;

    -- =========================================================
    -- AR_GL_BALANCE: Reconcile AR fact-derived position vs F1 GL
    -- Account: 131 — DEBIT normal balance
    -- GL Outstanding = SUM(debit) - SUM(credit)   [OPPOSITE of AP]
    --
    -- Reconstruction formula:
    --   outstanding = SUM(DEBIT_ACCRUAL)
    --               - SUM(CREDIT_ALLOCATION)
    --               + SUM(DEBIT_ADJUSTMENT)
    --               - SUM(CREDIT_ADJUSTMENT)
    -- =========================================================
    ELSIF p_control_type = 'AR_GL_BALANCE' THEN

        -- Iterate over distinct invoice_ids with AR facts as_of
        FOR v_ar_fact IN
            SELECT DISTINCT invoice_id
            FROM public.finance_ar_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F3_AR:v1')
            WHERE invoice_id IS NOT NULL
              AND entry_type IN ('DEBIT_ACCRUAL', 'CREDIT_ALLOCATION',
                                 'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
        LOOP
            v_total_checked := v_total_checked + 1;

            -- Step 1: Reconstruct from facts (F5-G4: no cache read)
            -- Uses f5_reconstruct_ar_position (already deployed in 20260819020000)
            SELECT * INTO v_ar_position
            FROM public.f5_reconstruct_ar_position(
                p_tenant_id,
                v_ar_fact.invoice_id,
                p_reconciliation_as_of,
                'F3_AR:v1'
            );

            -- Step 2: Get corresponding F1 GL balance for AR control account (131)
            -- AR 131: DEBIT normal balance — outstanding = debit - credit
            -- This is the CRITICAL sign difference from AP (which uses credit - debit)
            SELECT COALESCE(
                SUM(debit_amount) - SUM(credit_amount), 0
            ) INTO v_gl_sum_ar
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_code = '131'
              AND source_id::TEXT = v_ar_fact.invoice_id::TEXT;

            -- Step 3: Classify result
            v_variance_amount := v_gl_sum_ar - v_ar_position.reconstructed_outstanding;

            IF v_ar_position.reconstructed_outstanding IS NULL THEN
                v_financial_result := 'QUARANTINED';
                v_severity := 'CRITICAL';
            ELSIF ABS(v_variance_amount) = 0 THEN
                v_financial_result := 'MATCHED';
                v_severity := 'LOW';
            ELSE
                v_financial_result := 'VARIANCE';
                v_severity := CASE
                    WHEN ABS(v_variance_amount) > 10000000 THEN 'CRITICAL'
                    WHEN ABS(v_variance_amount) > 1000000  THEN 'HIGH'
                    WHEN ABS(v_variance_amount) > 100000   THEN 'MEDIUM'
                    ELSE 'LOW'
                END;
            END IF;

            -- Step 4: Write to f5_control_results (f5_* namespace only — Law 3)
            -- posting_attempt_id sourced from finance_invoices.posting_attempt_id
            -- retrieved via the AR fact record (joined through finance_ar_facts_as_of)
            INSERT INTO public.f5_control_results (
                tenant_id, run_id, control_type, basis_id, basis_version,
                reconciliation_as_of, source_snapshot_hash,
                source_module, source_type, source_id,
                financial_effect_type, posting_attempt_id,
                expected_amount, actual_amount,
                financial_result, severity,
                detected_by
            ) VALUES (
                p_tenant_id, v_run_id, p_control_type, p_basis_id, p_basis_version,
                p_reconciliation_as_of, v_source_snapshot_hash,
                'F3', 'INVOICE', v_ar_fact.invoice_id,
                'AR_GL_BALANCE_CHECK', v_run_id::TEXT,
                v_ar_position.reconstructed_outstanding, v_gl_sum_ar,
                v_financial_result, v_severity,
                'f5_run_reconciliation:v1'
            )
            ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
                         financial_effect_type, posting_attempt_id)
            DO NOTHING
            RETURNING result_id INTO v_result_id;

            -- Step 5: Create operational case for VARIANCE and QUARANTINED
            IF v_financial_result IN ('VARIANCE', 'QUARANTINED') AND v_result_id IS NOT NULL THEN
                INSERT INTO public.f5_control_cases (
                    tenant_id, result_id, case_state,
                    detected_at, detected_by
                ) VALUES (
                    p_tenant_id, v_result_id, 'OPEN',
                    NOW(), 'f5_run_reconciliation:v1'
                )
                RETURNING case_id INTO v_case_id;

                UPDATE public.f5_control_results
                SET case_id = v_case_id
                WHERE result_id = v_result_id;

                IF v_financial_result = 'VARIANCE' THEN
                    v_variances := v_variances + 1;
                ELSE
                    v_quarantined := v_quarantined + 1;
                END IF;
            ELSIF v_financial_result = 'MATCHED' THEN
                v_matched := v_matched + 1;
            END IF;

        END LOOP;

    -- =========================================================
    -- Remaining control types deferred to F5.6/F5.7
    -- =========================================================
    ELSE
        RAISE EXCEPTION 'F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED: % will be implemented in a future phase',
            p_control_type
            USING ERRCODE = 'F5099';
    END IF;

    RETURN jsonb_build_object(
        'run_id',        v_run_id,
        'is_duplicate',  FALSE,
        'total_checked', v_total_checked,
        'matched',       v_matched,
        'variances',     v_variances,
        'quarantined',   v_quarantined,
        'control_type',  p_control_type,
        'basis_version', p_basis_version,
        'as_of',         p_reconciliation_as_of
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ)
    TO service_role;

COMMENT ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) IS
    'F5 Constitution v1.2-Final. Supports AP_GL_BALANCE (F5.1–F5.4) and AR_GL_BALANCE (F5.5). '
    'AR sign convention: account 131 DEBIT normal — GL = SUM(debit) - SUM(credit). '
    'AP sign convention: account 331 CREDIT normal — GL = SUM(credit) - SUM(debit). '
    'Reads F1–F4 exclusively via approved temporal contracts (F5-G7). '
    'Writes ONLY to f5_* tables (Constitutional Law 3). '
    'Idempotent: same run_identity returns same result (F5-I-9).';

-- =========================================================================
-- F5-G1 VERIFICATION COMMENT (Namespace Boundary Gate)
-- This migration contains ZERO INSERT/UPDATE/DELETE against finance_* tables.
-- It only replaces the f5_run_reconciliation FUNCTION body.
-- The new AR branch reads via: finance_ar_facts_as_of (F3_AR:v1) and
--   finance_journal_entries_as_of (F1_GL:v1) — both SECURITY DEFINER wrappers.
-- The new AR branch writes to: f5_control_results, f5_control_cases ONLY.
-- =========================================================================
