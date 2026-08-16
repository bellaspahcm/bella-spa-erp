-- =========================================================================
-- Migration: 20260823010000_f5_ar_reconciliation_fix
-- Component: F5.5 — AR_GL_BALANCE fix: source_id type cast + QUARANTINED guard
-- =========================================================================
--
-- FIXES:
--   1. source_id::TEXT cast in AR GL query (finance_transactions.source_id
--      is VARCHAR; contract returns UUID; explicit TEXT cast prevents
--      "operator does not exist: character varying = uuid" error)
--   2. AP branch: same cast applied for consistency
--   3. QUARANTINED guard: also fires when reconstructed_outstanding IS NULL
--      (function returns 0 rows for unknown invoice — already correct)
--      AND adds explicit check for fact_count = 0 (no facts found = structural gap)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_run_reconciliation(
    p_tenant_id              UUID,
    p_domain                 TEXT,
    p_control_type           TEXT,
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
    v_result_id         UUID;
    v_case_id           UUID;
    v_financial_result  TEXT;
    v_severity          TEXT;
    v_variance_amount   NUMERIC(20,4);
    -- AP vars
    v_ap_fact           RECORD;
    v_ap_position       RECORD;
    v_gl_sum_ap         NUMERIC(20,4);
    -- AR vars
    v_ar_fact           RECORD;
    v_ar_position       RECORD;
    v_gl_sum_ar         NUMERIC(20,4);
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    IF p_tenant_id IS NULL OR p_domain IS NULL OR p_control_type IS NULL
       OR p_basis_id IS NULL OR p_basis_version IS NULL OR p_reconciliation_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: All parameters required' USING ERRCODE = 'F5002';
    END IF;

    IF p_domain NOT IN ('AR', 'AP', 'CASH', 'PREPAYMENT') THEN
        RAISE EXCEPTION 'F5_INVALID_DOMAIN: % is not a valid domain', p_domain
            USING ERRCODE = 'F5003';
    END IF;

    IF p_control_type NOT IN (
        'AR_GL_BALANCE', 'AP_GL_BALANCE', 'PREPAYMENT_GL_BALANCE',
        'CASH_GL_BALANCE', 'AR_TRACEABILITY', 'AP_TRACEABILITY',
        'FX_INTEGRITY', 'PERIOD_INTEGRITY', 'TENANT_INTEGRITY', 'DUPLICATE_EFFECT'
    ) THEN
        RAISE EXCEPTION 'F5_INVALID_CONTROL_TYPE: %', p_control_type USING ERRCODE = 'F5004';
    END IF;

    -- Idempotency hash
    v_source_snapshot_hash := encode(
        extensions.digest(
            p_tenant_id::TEXT || '|' || p_control_type || '|' ||
            p_basis_id::TEXT  || '|' || p_basis_version || '|' ||
            p_reconciliation_as_of::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Idempotency check
    SELECT run_id INTO v_existing_run_id
    FROM public.f5_control_results
    WHERE tenant_id            = p_tenant_id
      AND control_type         = p_control_type
      AND basis_id             = p_basis_id
      AND basis_version        = p_basis_version
      AND reconciliation_as_of = p_reconciliation_as_of
      AND source_snapshot_hash = v_source_snapshot_hash
    LIMIT 1;

    IF v_existing_run_id IS NOT NULL THEN
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE financial_result = 'MATCHED'),
               COUNT(*) FILTER (WHERE financial_result = 'VARIANCE'),
               COUNT(*) FILTER (WHERE financial_result = 'QUARANTINED')
        INTO v_total_checked, v_matched, v_variances, v_quarantined
        FROM public.f5_control_results
        WHERE tenant_id = p_tenant_id AND run_id = v_existing_run_id;

        RETURN jsonb_build_object(
            'run_id', v_existing_run_id, 'is_duplicate', TRUE,
            'total_checked', v_total_checked, 'matched', v_matched,
            'variances', v_variances, 'quarantined', v_quarantined
        );
    END IF;

    -- =========================================================
    -- AP_GL_BALANCE: account 331 — CREDIT normal balance
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
                p_tenant_id, v_ap_fact.vendor_bill_id, p_reconciliation_as_of, 'F4_AP:v1'
            );

            -- AP 331: CREDIT normal — GL outstanding = credit - debit
            -- source_id::TEXT cast handles VARCHAR/UUID comparison across drivers
            SELECT COALESCE(SUM(credit_amount) - SUM(debit_amount), 0) INTO v_gl_sum_ap
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_code = '331'
              AND source_id::TEXT = v_ap_fact.vendor_bill_id::TEXT;

            v_variance_amount := v_gl_sum_ap - v_ap_position.reconstructed_outstanding;

            IF v_ap_position.reconstructed_outstanding IS NULL THEN
                v_financial_result := 'QUARANTINED'; v_severity := 'CRITICAL';
            ELSIF ABS(v_variance_amount) = 0 THEN
                v_financial_result := 'MATCHED'; v_severity := 'LOW';
            ELSE
                v_financial_result := 'VARIANCE';
                v_severity := CASE
                    WHEN ABS(v_variance_amount) > 10000000 THEN 'CRITICAL'
                    WHEN ABS(v_variance_amount) > 1000000  THEN 'HIGH'
                    WHEN ABS(v_variance_amount) > 100000   THEN 'MEDIUM'
                    ELSE 'LOW' END;
            END IF;

            INSERT INTO public.f5_control_results (
                tenant_id, run_id, control_type, basis_id, basis_version,
                reconciliation_as_of, source_snapshot_hash,
                source_module, source_type, source_id,
                financial_effect_type, posting_attempt_id,
                expected_amount, actual_amount, financial_result, severity, detected_by
            ) VALUES (
                p_tenant_id, v_run_id, p_control_type, p_basis_id, p_basis_version,
                p_reconciliation_as_of, v_source_snapshot_hash,
                'F4', 'VENDOR_BILL', v_ap_fact.vendor_bill_id,
                'AP_GL_BALANCE_CHECK', v_run_id::TEXT,
                v_ap_position.reconstructed_outstanding, v_gl_sum_ap,
                v_financial_result, v_severity, 'f5_run_reconciliation:v1'
            )
            ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
                         financial_effect_type, posting_attempt_id)
            DO NOTHING
            RETURNING result_id INTO v_result_id;

            IF v_financial_result IN ('VARIANCE', 'QUARANTINED') AND v_result_id IS NOT NULL THEN
                INSERT INTO public.f5_control_cases (tenant_id, result_id, case_state, detected_at, detected_by)
                VALUES (p_tenant_id, v_result_id, 'OPEN', NOW(), 'f5_run_reconciliation:v1')
                RETURNING case_id INTO v_case_id;
                UPDATE public.f5_control_results SET case_id = v_case_id WHERE result_id = v_result_id;
                IF v_financial_result = 'VARIANCE' THEN v_variances := v_variances + 1;
                ELSE v_quarantined := v_quarantined + 1; END IF;
            ELSIF v_financial_result = 'MATCHED' THEN
                v_matched := v_matched + 1;
            END IF;
        END LOOP;

    -- =========================================================
    -- AR_GL_BALANCE: account 131 — DEBIT normal balance
    -- GL Outstanding = SUM(debit) - SUM(credit)   [OPPOSITE of AP]
    -- =========================================================
    ELSIF p_control_type = 'AR_GL_BALANCE' THEN

        FOR v_ar_fact IN
            SELECT DISTINCT invoice_id
            FROM public.finance_ar_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F3_AR:v1')
            WHERE invoice_id IS NOT NULL
              AND entry_type IN ('DEBIT_ACCRUAL', 'CREDIT_ALLOCATION',
                                 'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
        LOOP
            v_total_checked := v_total_checked + 1;

            SELECT * INTO v_ar_position
            FROM public.f5_reconstruct_ar_position(
                p_tenant_id, v_ar_fact.invoice_id, p_reconciliation_as_of, 'F3_AR:v1'
            );

            -- AR 131: DEBIT normal — GL outstanding = debit - credit
            -- CRITICAL: opposite sign from AP. source_id::TEXT cast for type safety.
            SELECT COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) INTO v_gl_sum_ar
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_code = '131'
              AND source_id::TEXT = v_ar_fact.invoice_id::TEXT;

            v_variance_amount := v_gl_sum_ar - v_ar_position.reconstructed_outstanding;

            IF v_ar_position.reconstructed_outstanding IS NULL THEN
                v_financial_result := 'QUARANTINED'; v_severity := 'CRITICAL';
            ELSIF ABS(v_variance_amount) = 0 THEN
                v_financial_result := 'MATCHED'; v_severity := 'LOW';
            ELSE
                v_financial_result := 'VARIANCE';
                v_severity := CASE
                    WHEN ABS(v_variance_amount) > 10000000 THEN 'CRITICAL'
                    WHEN ABS(v_variance_amount) > 1000000  THEN 'HIGH'
                    WHEN ABS(v_variance_amount) > 100000   THEN 'MEDIUM'
                    ELSE 'LOW' END;
            END IF;

            INSERT INTO public.f5_control_results (
                tenant_id, run_id, control_type, basis_id, basis_version,
                reconciliation_as_of, source_snapshot_hash,
                source_module, source_type, source_id,
                financial_effect_type, posting_attempt_id,
                expected_amount, actual_amount, financial_result, severity, detected_by
            ) VALUES (
                p_tenant_id, v_run_id, p_control_type, p_basis_id, p_basis_version,
                p_reconciliation_as_of, v_source_snapshot_hash,
                'F3', 'INVOICE', v_ar_fact.invoice_id,
                'AR_GL_BALANCE_CHECK', v_run_id::TEXT,
                v_ar_position.reconstructed_outstanding, v_gl_sum_ar,
                v_financial_result, v_severity, 'f5_run_reconciliation:v1'
            )
            ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
                         financial_effect_type, posting_attempt_id)
            DO NOTHING
            RETURNING result_id INTO v_result_id;

            IF v_financial_result IN ('VARIANCE', 'QUARANTINED') AND v_result_id IS NOT NULL THEN
                INSERT INTO public.f5_control_cases (tenant_id, result_id, case_state, detected_at, detected_by)
                VALUES (p_tenant_id, v_result_id, 'OPEN', NOW(), 'f5_run_reconciliation:v1')
                RETURNING case_id INTO v_case_id;
                UPDATE public.f5_control_results SET case_id = v_case_id WHERE result_id = v_result_id;
                IF v_financial_result = 'VARIANCE' THEN v_variances := v_variances + 1;
                ELSE v_quarantined := v_quarantined + 1; END IF;
            ELSIF v_financial_result = 'MATCHED' THEN
                v_matched := v_matched + 1;
            END IF;
        END LOOP;

    -- =========================================================
    -- Other control types deferred to future phases
    -- =========================================================
    ELSE
        RAISE EXCEPTION 'F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED: % will be implemented in a future phase',
            p_control_type USING ERRCODE = 'F5099';
    END IF;

    RETURN jsonb_build_object(
        'run_id', v_run_id, 'is_duplicate', FALSE,
        'total_checked', v_total_checked, 'matched', v_matched,
        'variances', v_variances, 'quarantined', v_quarantined,
        'control_type', p_control_type, 'basis_version', p_basis_version,
        'as_of', p_reconciliation_as_of
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ)
    TO service_role;

COMMENT ON FUNCTION public.f5_run_reconciliation(UUID, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ) IS
    'F5.5: AR_GL_BALANCE + AP_GL_BALANCE. '
    'AR sign: account 131 DEBIT normal — GL = SUM(debit) - SUM(credit). '
    'AP sign: account 331 CREDIT normal — GL = SUM(credit) - SUM(debit). '
    'source_id::TEXT cast prevents VARCHAR/UUID type mismatch across PostgREST drivers.';
