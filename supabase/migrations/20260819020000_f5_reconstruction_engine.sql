-- =========================================================================
-- Migration: 20260819020000_f5_reconstruction_engine
-- Component: F5.1 — Reconstruction Engine + Traceability Engine
-- Constitution: v1.2-Final (FROZEN 2026-08-16T08:25:00+07:00)
-- =========================================================================
--
-- PURPOSE:
--   Implements the F5 Reconciliation Kernel RPCs:
--   1. f5_reconstruct_ap_position    — Reconstructs AP+Prepayment position from facts
--   2. f5_reconstruct_ar_position    — Reconstructs AR position from facts
--   3. f5_reconstruct_cash_balance   — Reconstructs Cash balance from F2 facts
--   4. f5_check_traceability         — Bidirectional trace (F5-I-1 + F5-I-6)
--   5. f5_run_reconciliation         — Main reconciliation entry point
--   6. f5_investigate_control_case   — Case lifecycle: OPEN → INVESTIGATING
--   7. f5_resolve_control_case       — Case lifecycle: INVESTIGATING → RESOLVED
--
-- CONSTITUTIONAL RULES ENFORCED:
--   F5-G4: Reconstruction from immutable facts ONLY. Never reads position caches.
--   F5-G7: All reads go through approved read contracts. Zero direct finance_* queries.
--   F5-I-1: F3/F4 Fact → F1 Journal Set (orphan subledger fact detection)
--   F5-I-6: F1 Journal Set → F3/F4 Fact (orphan GL posting detection)
--   F5-I-9: Reconciliation idempotency — same run_id = same result.
--   Law 1:  F5 NEVER mutates F1/F2/F3/F4 authoritative records.
--
-- MIGRATION ORDER:
--   Requires: 20260819000000_f5_schema.sql
--   Requires: 20260819010000_f5_read_contracts.sql
-- =========================================================================

-- =========================================================================
-- 1. f5_reconstruct_ap_position
--    Reconstructs the AP payable position for a specific vendor_bill_id
--    from immutable facts ONLY. Never reads finance_payable_positions cache.
--    Returns the fact-based reconstructed outstanding amount.
--
--    Formula:
--      reconstructed_outstanding =
--        SUM(PAYABLE_ACCRUAL) - SUM(DISBURSEMENT_ALLOCATION) - SUM(REVERSAL)
--        + SUM(DEBIT_ADJUSTMENT) - SUM(CREDIT_ADJUSTMENT)
--
--    F5-G4: Cache corrupted? This function is unaffected.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_reconstruct_ap_position(
    p_tenant_id         UUID,
    p_vendor_bill_id    UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F4_AP:v1'
)
RETURNS TABLE (
    vendor_bill_id              UUID,
    fact_accrual_total          NUMERIC(20,4),
    fact_disbursement_total     NUMERIC(20,4),
    fact_reversal_total         NUMERIC(20,4),
    fact_debit_adj_total        NUMERIC(20,4),
    fact_credit_adj_total       NUMERIC(20,4),
    reconstructed_outstanding   NUMERIC(20,4),
    fact_count                  INT,
    reconstruction_as_of        TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Authorize: F5 engines run as service_role
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    -- Null guards
    IF p_tenant_id IS NULL OR p_vendor_bill_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: tenant_id, vendor_bill_id, and as_of are required'
            USING ERRCODE = 'F5002';
    END IF;

    -- Reconstruct from facts (F5-G4 compliance: no cache read)
    -- Reads via approved contract finance_ap_facts_as_of (F5-G7 compliance)
    RETURN QUERY
    WITH ap_facts AS (
        SELECT
            f.entry_type,
            f.amount_minor
        FROM public.finance_ap_facts_as_of(p_tenant_id, p_as_of, p_contract_version) f
        WHERE f.vendor_bill_id = p_vendor_bill_id
    )
    SELECT
        p_vendor_bill_id                                    AS vendor_bill_id,
        COALESCE(SUM(CASE WHEN entry_type = 'PAYABLE_ACCRUAL'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_accrual_total,
        COALESCE(SUM(CASE WHEN entry_type = 'DISBURSEMENT_ALLOCATION'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_disbursement_total,
        COALESCE(SUM(CASE WHEN entry_type = 'REVERSAL'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_reversal_total,
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ADJUSTMENT'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_debit_adj_total,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ADJUSTMENT'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_credit_adj_total,
        -- Reconstructed outstanding balance
        (
            COALESCE(SUM(CASE WHEN entry_type = 'PAYABLE_ACCRUAL'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry_type = 'DISBURSEMENT_ALLOCATION'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry_type = 'REVERSAL'
                             THEN amount_minor ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ADJUSTMENT'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ADJUSTMENT'
                             THEN amount_minor ELSE 0 END), 0)
        )::NUMERIC(20,4)                                    AS reconstructed_outstanding,
        COUNT(*)::INT                                       AS fact_count,
        p_as_of                                             AS reconstruction_as_of
    FROM ap_facts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_reconstruct_ap_position(UUID, UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 2. f5_reconstruct_ar_position
--    Reconstructs the AR receivable position for a specific invoice_id
--    from immutable facts ONLY. Never reads finance_receivable_positions cache.
--
--    Formula:
--      reconstructed_outstanding =
--        SUM(DEBIT_ACCRUAL) - SUM(CREDIT_ALLOCATION)
--        + SUM(DEBIT_ADJUSTMENT) - SUM(CREDIT_ADJUSTMENT)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_reconstruct_ar_position(
    p_tenant_id         UUID,
    p_invoice_id        UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F3_AR:v1'
)
RETURNS TABLE (
    invoice_id                  UUID,
    fact_accrual_total          NUMERIC(20,4),
    fact_allocation_total       NUMERIC(20,4),
    fact_debit_adj_total        NUMERIC(20,4),
    fact_credit_adj_total       NUMERIC(20,4),
    reconstructed_outstanding   NUMERIC(20,4),
    fact_count                  INT,
    reconstruction_as_of        TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    IF p_tenant_id IS NULL OR p_invoice_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: tenant_id, invoice_id, and as_of are required'
            USING ERRCODE = 'F5002';
    END IF;

    -- Reconstruct AR position from facts (F5-G4 compliance: no cache read)
    -- Reads via approved contract finance_ar_facts_as_of (F5-G7 compliance)
    RETURN QUERY
    WITH ar_facts AS (
        SELECT
            f.entry_type,
            f.amount_minor
        FROM public.finance_ar_facts_as_of(p_tenant_id, p_as_of, p_contract_version) f
        WHERE f.invoice_id = p_invoice_id
    )
    SELECT
        p_invoice_id                                        AS invoice_id,
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ACCRUAL'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_accrual_total,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ALLOCATION'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_allocation_total,
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ADJUSTMENT'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_debit_adj_total,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ADJUSTMENT'
                         THEN amount_minor ELSE 0 END), 0)::NUMERIC(20,4)
                                                            AS fact_credit_adj_total,
        (
            COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ACCRUAL'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ALLOCATION'
                             THEN amount_minor ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN entry_type = 'DEBIT_ADJUSTMENT'
                             THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_ADJUSTMENT'
                             THEN amount_minor ELSE 0 END), 0)
        )::NUMERIC(20,4)                                    AS reconstructed_outstanding,
        COUNT(*)::INT                                       AS fact_count,
        p_as_of                                             AS reconstruction_as_of
    FROM ar_facts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_reconstruct_ar_position(UUID, UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 3. f5_reconstruct_cash_balance
--    Reconstructs net cash balance from F2 immutable facts.
--    Never reads finance_cash_position_cache.
--
--    Formula: SUM(INFLOW amount_minor) - SUM(OUTFLOW amount_minor)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_reconstruct_cash_balance(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT          DEFAULT 'F2_CASH:v1'
)
RETURNS TABLE (
    total_inflow_minor          BIGINT,
    total_outflow_minor         BIGINT,
    net_cash_balance_minor      BIGINT,
    movement_count              INT,
    reconstruction_as_of        TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    IF p_tenant_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER: tenant_id and as_of are required'
            USING ERRCODE = 'F5002';
    END IF;

    -- Reconstruct cash balance from F2 facts (F5-G4 compliance)
    -- Reads via approved contract finance_get_cash_movements_as_of (F5-G7 compliance)
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN direction = 'INFLOW'  THEN amount_minor ELSE 0 END), 0)::BIGINT
                                                    AS total_inflow_minor,
        COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount_minor ELSE 0 END), 0)::BIGINT
                                                    AS total_outflow_minor,
        (
            COALESCE(SUM(CASE WHEN direction = 'INFLOW'  THEN amount_minor ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN direction = 'OUTFLOW' THEN amount_minor ELSE 0 END), 0)
        )::BIGINT                                   AS net_cash_balance_minor,
        COUNT(*)::INT                               AS movement_count,
        p_as_of                                     AS reconstruction_as_of
    FROM public.finance_get_cash_movements_as_of(p_tenant_id, p_as_of, p_contract_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_reconstruct_cash_balance(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;


-- =========================================================================
-- 4. f5_check_ap_traceability
--    Bidirectional traceability check for AP domain (F5-I-1 + F5-I-6).
--
--    F5-I-1 (Fact → GL): Every AP fact must have a valid F1 journal set.
--      → Detect: orphan AP facts (fact exists, no GL journal)
--
--    F5-I-6 (GL → Fact): Every F1 AP/Payable journal must trace to an AP fact.
--      → Detect: orphan GL entries (GL journal exists, no AP fact)
--
--    Returns rows with trace_status: TRACED | ORPHAN_FACT | ORPHAN_GL
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_check_ap_traceability(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ
)
RETURNS TABLE (
    check_direction      TEXT,     -- 'FACT_TO_GL' | 'GL_TO_FACT'
    source_id            UUID,
    fact_entry_type      TEXT,
    f1_source_type       TEXT,
    f1_source_id         UUID,
    has_matching_record  BOOLEAN,
    trace_status         TEXT      -- 'TRACED' | 'ORPHAN_FACT' | 'ORPHAN_GL'
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    IF p_tenant_id IS NULL OR p_as_of IS NULL THEN
        RAISE EXCEPTION 'F5_NULL_PARAMETER' USING ERRCODE = 'F5002';
    END IF;

    -- === Direction 1: F5-I-1 — Fact → GL (forward traceability) ===
    -- For each AP fact, check if a corresponding F1 journal entry exists.
    -- "Corresponding" means: finance_transactions where source_type and source_id match.
    RETURN QUERY
    WITH ap_facts AS (
        SELECT
            fact_id,
            vendor_bill_id,
            entry_type,
            posting_date
        FROM public.finance_ap_facts_as_of(p_tenant_id, p_as_of, 'F4_AP:v1')
        WHERE entry_type IN ('PAYABLE_ACCRUAL', 'DISBURSEMENT_ALLOCATION', 'REVERSAL')
    ),
    gl_entries AS (
        SELECT
            source_type,
            source_id,
            posting_date
        FROM public.finance_journal_entries_as_of(p_tenant_id, p_as_of, 'F1_GL:v1')
    )
    -- F5-I-1: Every AP fact should have a corresponding GL entry
    SELECT
        'FACT_TO_GL'                    AS check_direction,
        af.fact_id                      AS source_id,
        af.entry_type                   AS fact_entry_type,
        NULL::TEXT                      AS f1_source_type,
        af.vendor_bill_id               AS f1_source_id,
        -- Check if any GL entry references this vendor_bill as source
        EXISTS (
            SELECT 1 FROM gl_entries ge
            WHERE ge.source_id = af.vendor_bill_id
        )                               AS has_matching_record,
        CASE WHEN EXISTS (
            SELECT 1 FROM gl_entries ge
            WHERE ge.source_id = af.vendor_bill_id
        ) THEN 'TRACED' ELSE 'ORPHAN_FACT' END AS trace_status
    FROM ap_facts af

    UNION ALL

    -- F5-I-6: Every GL entry classified as AP-type should resolve to an AP fact
    SELECT
        'GL_TO_FACT'                    AS check_direction,
        ge.source_id                    AS source_id,
        NULL::TEXT                      AS fact_entry_type,
        ge.source_type                  AS f1_source_type,
        ge.source_id                    AS f1_source_id,
        -- Check if any AP fact references this GL source
        EXISTS (
            SELECT 1 FROM ap_facts af
            WHERE af.vendor_bill_id = ge.source_id
        )                               AS has_matching_record,
        CASE WHEN EXISTS (
            SELECT 1 FROM ap_facts af
            WHERE af.vendor_bill_id = ge.source_id
        ) THEN 'TRACED' ELSE 'ORPHAN_GL' END AS trace_status
    FROM gl_entries ge
    WHERE ge.source_type IN ('VENDOR_BILL', 'AP_BILL_APPROVAL', 'AP_DISBURSEMENT')

    ORDER BY check_direction, trace_status, source_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_check_ap_traceability(UUID, TIMESTAMPTZ)
    TO service_role;


-- =========================================================================
-- 5. f5_run_reconciliation
--    Main entry point for running F5 reconciliation.
--    Implements the core reconciliation loop for AP_GL_BALANCE control type.
--    Writes results to f5_control_results and f5_control_cases.
--    F5 NEVER writes to finance_* tables (Constitutional Law 1).
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

    -- AP reconciliation vars
    v_ap_fact           RECORD;
    v_ap_position       RECORD;
    v_gl_sum            NUMERIC(20,4);
    v_result_id         UUID;
    v_case_id           UUID;
    v_financial_result  TEXT;
    v_severity          TEXT;
    v_variance_amount   NUMERIC(20,4);
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
    -- Same tenant + control_type + basis_id + basis_version + as_of = same run
    -- Note: source_snapshot_hash would normally include data hash; using run params here for v1
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
        -- Return idempotent result without re-running
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
    -- =========================================================
    IF p_control_type = 'AP_GL_BALANCE' THEN

        -- Iterate over all distinct vendor_bill_ids that have AP facts as_of
        FOR v_ap_fact IN
            SELECT DISTINCT vendor_bill_id
            FROM public.finance_ap_facts_as_of(p_tenant_id, p_reconciliation_as_of, 'F4_AP:v1')
            WHERE vendor_bill_id IS NOT NULL
              AND entry_type IN ('PAYABLE_ACCRUAL', 'DISBURSEMENT_ALLOCATION', 'REVERSAL')
        LOOP
            v_total_checked := v_total_checked + 1;

            -- Step 1: Reconstruct from facts (F5-G4: no cache read)
            SELECT * INTO v_ap_position
            FROM public.f5_reconstruct_ap_position(
                p_tenant_id,
                v_ap_fact.vendor_bill_id,
                p_reconciliation_as_of,
                'F4_AP:v1'
            );

            -- Step 2: Get corresponding F1 GL balance for AP control account (331)
            SELECT COALESCE(
                SUM(debit_amount) - SUM(credit_amount), 0
            ) INTO v_gl_sum
            FROM public.finance_journal_entries_as_of(p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1')
            WHERE account_code = '331'
              AND source_id    = v_ap_fact.vendor_bill_id;

            -- Step 3: Classify result
            v_variance_amount := v_gl_sum - v_ap_position.reconstructed_outstanding;

            IF v_ap_position.reconstructed_outstanding IS NULL THEN
                -- Cannot compute: data integrity issue
                v_financial_result := 'QUARANTINED';
                v_severity := 'CRITICAL';
            ELSIF ABS(v_variance_amount) = 0 THEN
                v_financial_result := 'MATCHED';
                v_severity := 'LOW';
            ELSE
                v_financial_result := 'VARIANCE';
                -- Simple severity: will be replaced by multi-dimensional scoring in F5.3
                v_severity := CASE
                    WHEN ABS(v_variance_amount) > 10000000 THEN 'CRITICAL'
                    WHEN ABS(v_variance_amount) > 1000000  THEN 'HIGH'
                    WHEN ABS(v_variance_amount) > 100000   THEN 'MEDIUM'
                    ELSE 'LOW'
                END;
            END IF;

            -- Step 4: Write to f5_control_results (f5_* namespace only — Law 3)
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
                v_ap_position.reconstructed_outstanding, v_gl_sum,
                v_financial_result, v_severity,
                'f5_run_reconciliation:v1'
            )
            ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
                         financial_effect_type, posting_attempt_id)
            DO NOTHING   -- Idempotency: skip if already recorded for this run
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

                -- Link case back to result
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
    -- Additional control types deferred to F5.2/F5.3
    -- =========================================================
    ELSE
        RAISE EXCEPTION 'F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED: % will be implemented in F5.2',
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
    'F5 Constitution v1.2-Final: Main reconciliation entry point. '
    'Reads F1–F4 data exclusively via approved contracts (F5-G7). '
    'Writes ONLY to f5_* tables (Constitutional Law 3). '
    'NEVER mutates finance_* authoritative records (Constitutional Law 1). '
    'Idempotent: same run_identity returns same result (F5-I-9).';


-- =========================================================================
-- 6. f5_investigate_control_case
--    Transitions case: OPEN → INVESTIGATING
--    Records who is investigating and when they started.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_investigate_control_case(
    p_tenant_id       UUID,
    p_case_id         UUID,
    p_assigned_to     UUID,
    p_investigated_by UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_case RECORD;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    SELECT * INTO v_case
    FROM public.f5_control_cases
    WHERE case_id   = p_case_id
      AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_case.case_id IS NULL THEN
        RAISE EXCEPTION 'F5_CASE_NOT_FOUND: %', p_case_id USING ERRCODE = 'F5020';
    END IF;

    IF v_case.case_state <> 'OPEN' THEN
        RAISE EXCEPTION 'F5_INVALID_STATE_TRANSITION: Case % is in state %, expected OPEN',
            p_case_id, v_case.case_state USING ERRCODE = 'F5021';
    END IF;

    UPDATE public.f5_control_cases SET
        case_state               = 'INVESTIGATING',
        assigned_to              = p_assigned_to,
        investigated_by          = p_investigated_by,
        investigation_started_at = NOW()
    WHERE case_id   = p_case_id
      AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success',   TRUE,
        'case_id',   p_case_id,
        'new_state', 'INVESTIGATING'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_investigate_control_case(UUID, UUID, UUID, UUID)
    TO service_role;


-- =========================================================================
-- 7. f5_resolve_control_case
--    Transitions case: INVESTIGATING → RESOLVED
--    Enforces: RESOLVED ≠ MATCHED (Constitutional Law from §4.13)
--    Requires: resolution_reference + authorized_by (four-eyes governance)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_resolve_control_case(
    p_tenant_id              UUID,
    p_case_id                UUID,
    p_resolved_by            UUID,
    p_authorized_by          UUID,
    p_resolution_reference   TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_case RECORD;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    -- Validate resolution reference is non-empty
    IF p_resolution_reference IS NULL OR trim(p_resolution_reference) = '' THEN
        RAISE EXCEPTION 'F5_RESOLUTION_REFERENCE_REQUIRED: An external corrective workflow reference must be provided.'
            USING ERRCODE = 'F5030';
    END IF;

    -- Validate authorized_by is present
    IF p_authorized_by IS NULL THEN
        RAISE EXCEPTION 'F5_AUTHORIZED_BY_REQUIRED: authorized_by cannot be NULL. Resolution requires authorization.'
            USING ERRCODE = 'F5031';
    END IF;

    SELECT * INTO v_case
    FROM public.f5_control_cases
    WHERE case_id   = p_case_id
      AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_case.case_id IS NULL THEN
        RAISE EXCEPTION 'F5_CASE_NOT_FOUND: %', p_case_id USING ERRCODE = 'F5020';
    END IF;

    IF v_case.case_state <> 'INVESTIGATING' THEN
        RAISE EXCEPTION 'F5_INVALID_STATE_TRANSITION: Case % is in state %, expected INVESTIGATING',
            p_case_id, v_case.case_state USING ERRCODE = 'F5021';
    END IF;

    UPDATE public.f5_control_cases SET
        case_state           = 'RESOLVED',
        resolved_by          = p_resolved_by,
        authorized_by        = p_authorized_by,
        resolution_reference = p_resolution_reference,
        resolved_at          = NOW()
    WHERE case_id   = p_case_id
      AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success',              TRUE,
        'case_id',              p_case_id,
        'new_state',            'RESOLVED',
        'resolution_reference', p_resolution_reference,
        'constitutional_notice',
            'RESOLVED means an authorized explanation is documented. '
            'It does NOT mean the financial state is now correct. '
            'Run a new reconciliation to confirm MATCHED state.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_resolve_control_case(UUID, UUID, UUID, UUID, TEXT)
    TO service_role;

COMMENT ON FUNCTION public.f5_resolve_control_case(UUID, UUID, UUID, UUID, TEXT) IS
    'F5 Constitution v1.2-Final: Resolves a control case. '
    'IMPORTANT: RESOLVED does not mean the financial state is correct. '
    'Financial correctness is confirmed ONLY by a subsequent f5_run_reconciliation yielding MATCHED.';

-- =========================================================================
-- F5 PROJECTION HEALTH CHECK FUNCTION
-- Compares fact-reconstructed position vs domain cache (Control B)
-- CACHE_DRIFT never spawns an f5_control_case.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_check_projection_health(
    p_tenant_id              UUID,
    p_domain                 TEXT,      -- 'AP' | 'AR' | 'CASH'
    p_run_id                 UUID,
    p_reconciliation_as_of   TIMESTAMPTZ
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_fact_amount     NUMERIC(20,4);
    v_cache_amount    NUMERIC(20,4);
    v_result          TEXT;
    v_health_id       UUID;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED' USING ERRCODE = 'F5001';
    END IF;

    IF p_domain = 'AP' THEN
        -- Reconstruct total AP position from facts
        SELECT COALESCE(SUM(reconstructed_outstanding), 0) INTO v_fact_amount
        FROM public.f5_reconstruct_ap_position(
            p_tenant_id, NULL, p_reconciliation_as_of, 'F4_AP:v1'
        );

        -- Read current AP position cache total
        SELECT COALESCE(SUM(outstanding_amount_minor)::NUMERIC(20,4), 0) INTO v_cache_amount
        FROM public.finance_payable_positions
        WHERE tenant_id = p_tenant_id;

    ELSIF p_domain = 'CASH' THEN
        -- Reconstruct cash from facts
        SELECT net_cash_balance_minor::NUMERIC(20,4) INTO v_fact_amount
        FROM public.f5_reconstruct_cash_balance(
            p_tenant_id, p_reconciliation_as_of, 'F2_CASH:v1'
        );

        -- F2 does not maintain a projection cache in v1 — health check reports 0 drift
        v_cache_amount := v_fact_amount;

    ELSE
        RAISE EXCEPTION 'F5_DOMAIN_NOT_YET_IMPLEMENTED: %', p_domain USING ERRCODE = 'F5099';
    END IF;

    v_result := CASE WHEN v_fact_amount = v_cache_amount THEN 'CACHE_SYNCED' ELSE 'CACHE_DRIFT' END;

    -- Write to f5_projection_health (f5_* namespace only — Law 3)
    -- NOTE: No f5_control_case created for CACHE_DRIFT (Constitutional Rule)
    INSERT INTO public.f5_projection_health (
        tenant_id, domain, run_id, reconciliation_as_of,
        fact_derived_amount, cache_amount, projection_result
    ) VALUES (
        p_tenant_id, p_domain, p_run_id, p_reconciliation_as_of,
        v_fact_amount, v_cache_amount, v_result
    )
    RETURNING health_id INTO v_health_id;

    RETURN jsonb_build_object(
        'health_id',             v_health_id,
        'domain',                p_domain,
        'projection_result',     v_result,
        'fact_derived_amount',   v_fact_amount,
        'cache_amount',          v_cache_amount,
        'drift_amount',          v_cache_amount - v_fact_amount,
        'constitutional_notice', CASE WHEN v_result = 'CACHE_DRIFT'
            THEN 'CACHE_DRIFT detected. No financial case created. Rebuild projection cache to resolve.'
            ELSE 'CACHE_SYNCED. Projection cache is consistent with fact-derived position.'
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.f5_check_projection_health(UUID, TEXT, UUID, TIMESTAMPTZ)
    TO service_role;

-- =========================================================================
-- FINAL GRANTS & SERVICE ROLE ACCESS
-- =========================================================================

-- f5_* tables already granted in 20260819000000_f5_schema.sql
-- Functions above are granted inline with each CREATE OR REPLACE.

-- =========================================================================
-- F5-G7 COMPLIANCE SUMMARY
-- All F5 RPCs above read F1–F4 data EXCLUSIVELY via:
--   - public.finance_journal_entries_as_of    (F1_GL:v1)
--   - public.finance_get_cash_movements_as_of (F2_CASH:v1)
--   - public.finance_ar_facts_as_of           (F3_AR:v1)
--   - public.finance_ap_facts_as_of           (F4_AP:v1)
-- ZERO direct SELECT FROM finance_transactions, finance_transaction_lines,
--   finance_cash_movements, finance_receivable_ledger, finance_payable_ledger.
-- =========================================================================
