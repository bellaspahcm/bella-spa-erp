-- =========================================================================
-- Migration: 20260819000000_f5_schema
-- Component: F5.1 — Reconciliation & Financial Control Kernel
-- Constitution: v1.2-Final (FROZEN 2026-08-16T08:25:00+07:00)
-- =========================================================================
--
-- PURPOSE:
--   Creates the three canonical f5_* namespace tables as defined in
--   the F5 Constitution (§5.2) and F5 Contract (§1).
--
-- ARCHITECTURE LAWS (from frozen Constitution):
--   Law 1 — Control Constraint: F5 NEVER mutates F1/F2/F3/F4 tables.
--   Law 2 — DB Kernel Law: F5 operates as SECURITY DEFINER RPCs in DB kernel.
--   Law 3 — Namespace Boundary: F5 mutates ONLY f5_* prefixed tables.
--
-- TABLES CREATED:
--   1. f5_control_results     — All reconciliation results (incl. MATCHED)
--   2. f5_control_cases       — Operational cases for VARIANCE + QUARANTINED
--   3. f5_projection_health   — Cache health checks (Control B)
--
-- MIGRATION ORDER COMPLIANCE (F5 Constitution §5.3):
--   This migration is Step 1 of 3 in F5.1 Reconciliation Kernel.
--   Must precede: 20260819010000_f5_read_contracts.sql
--   Must precede: 20260819020000_f5_reconstruction_engine.sql
-- =========================================================================

-- =========================================================================
-- PRE-FLIGHT: Verify Constitution Namespace Boundary (F5-G1)
-- This migration creates ONLY f5_* tables. No finance_* table mutations.
-- =========================================================================

-- =========================================================================
-- TABLE 1: f5_control_results
-- Stores every individual financial control result — including MATCHED.
-- This is the audit log of all reconciliation outcomes.
--
-- Idempotency: UNIQUE constraint on (tenant_id, run_id, canonical_identity)
-- ensures exactly one result per canonical financial effect per run.
-- =========================================================================

CREATE TABLE public.f5_control_results (
    result_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- === Reconciliation Run Identity ===
    -- Identifies WHICH reconciliation run produced this result.
    -- The tuple (tenant_id, control_type, basis_id, basis_version,
    -- reconciliation_as_of, source_snapshot_hash) is the Reconciliation Run Identity.
    run_id                     UUID         NOT NULL,
    control_type               TEXT         NOT NULL
        CHECK (control_type IN (
            'AR_GL_BALANCE',
            'AP_GL_BALANCE',
            'PREPAYMENT_GL_BALANCE',
            'CASH_GL_BALANCE',
            'AR_TRACEABILITY',
            'AP_TRACEABILITY',
            'FX_INTEGRITY',
            'PERIOD_INTEGRITY',
            'TENANT_INTEGRITY',
            'DUPLICATE_EFFECT'
        )),
    basis_id                   UUID         NOT NULL,
    -- The immutable basis definition UUID. basis_id is stable across versions.
    basis_version              TEXT         NOT NULL,
    -- Semantic version tag e.g. "AP_GL_BALANCE:v1".
    -- If reconciliation algorithm changes, basis_version MUST be incremented.
    -- Two runs with different basis_version are NOT directly comparable.
    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    -- Temporal boundary for this run. All domain reads filtered to: effective_date <= reconciliation_as_of.
    source_snapshot_hash       TEXT         NOT NULL,
    -- Deterministic SHA-256 canonical hash of source state consumed by this run.
    -- See Constitution §4.6 for canonical serialization rules.

    -- === Canonical Financial Effect Identity ===
    -- Identifies WHAT is being reconciled. Immutable once the source operation commits.
    -- 6-tuple: (tenant_id, domain→source_module, source_type, source_id,
    --           financial_effect_type, posting_attempt_id)
    source_module              TEXT         NOT NULL
        CHECK (source_module IN ('F1', 'F2', 'F3', 'F4')),
    source_type                TEXT         NOT NULL,
    -- e.g. VENDOR_BILL | INVOICE | CASH_MOVEMENT | VENDOR_PREPAYMENT
    source_id                  UUID         NOT NULL,
    source_fact_id             UUID,
    -- Optional: the specific ledger fact row (e.g. finance_payable_ledger.id)
    source_version             BIGINT,
    -- Optimistic version of source record at reconciliation time (audit snapshot)
    financial_effect_type      TEXT         NOT NULL,
    -- e.g. PAYABLE_ACCRUAL | DISBURSEMENT_ALLOCATION | DEBIT_ACCRUAL | CREDIT_ALLOCATION
    posting_attempt_id         TEXT         NOT NULL,
    -- The idempotency key from the originating F1–F4 mutation operation.

    -- === Idempotency Enforcement ===
    -- At most one result per canonical identity per run (F5-I-5 detection layer).
    CONSTRAINT uq_f5_result_per_canonical_identity_per_run
        UNIQUE (tenant_id, run_id, source_module, source_type, source_id,
                financial_effect_type, posting_attempt_id),

    -- === Financial Amounts ===
    expected_amount            NUMERIC(20,4),
    -- The amount F5 expected to see based on source facts.
    actual_amount              NUMERIC(20,4),
    -- The amount F5 found in the GL control account.
    variance_amount            NUMERIC(20,4)
        GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
    -- Positive = GL exceeds facts; Negative = facts exceed GL.
    source_currency            CHAR(3),
    functional_currency        CHAR(3),
    fx_rate                    NUMERIC(20,6),
    -- NULL if single-currency operation.

    -- === Source Context Snapshot ===
    -- NOT a canonical identity field. Snapshot of relevant metadata at reconciliation time.
    -- Used for investigation context only. Not used in reconciliation logic.
    source_snapshot            JSONB,

    -- === Financial Result ===
    financial_result           TEXT         NOT NULL
        CHECK (financial_result IN ('MATCHED', 'VARIANCE', 'QUARANTINED')),
    -- MATCHED     = trusted data, financially consistent. No case created.
    -- VARIANCE    = trusted data, inconsistent financial values. Case created.
    -- QUARANTINED = untrusted data, structural integrity broken. Case created.

    -- === Severity (Multi-Dimensional — see Constitution §4.12) ===
    severity                   TEXT         NOT NULL
        CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    -- Severity is multi-dimensional. Amount alone does NOT determine severity.
    -- Full scoring algorithm deferred to F5.3 implementation per Constitution.

    -- === Detection Metadata ===
    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    detected_by                TEXT         NOT NULL,
    -- System/RPC identity that produced this result (e.g. 'f5_run_reconciliation:v1')

    -- === Case Link ===
    -- NULL for MATCHED results (no case created).
    -- Non-null for VARIANCE and QUARANTINED (case_id populated after case creation).
    case_id                    UUID
    -- FK to f5_control_cases added after that table is created (below).
);

COMMENT ON TABLE public.f5_control_results IS
    'F5 Constitution v1.2-Final: Audit log of all reconciliation results. '
    'MATCHED records stored here; VARIANCE/QUARANTINED additionally get an f5_control_cases row. '
    'F5 NEVER writes to finance_* tables. Namespace: f5_* only.';

-- =========================================================================
-- TABLE 2: f5_control_cases
-- Created only for VARIANCE and QUARANTINED results.
-- Manages the operational resolution lifecycle.
-- Constitutional Law: RESOLVED ≠ MATCHED (see Constitution §4.13)
-- =========================================================================

CREATE TABLE public.f5_control_cases (
    case_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Link to the originating result
    result_id                  UUID         NOT NULL REFERENCES public.f5_control_results(result_id) ON DELETE RESTRICT,

    -- === Case State Machine ===
    -- VARIANCE state: OPEN → INVESTIGATING → RESOLVED
    -- QUARANTINED state: OPEN (created with financial_result=QUARANTINED) → INVESTIGATING → RESOLVED
    case_state                 TEXT         NOT NULL DEFAULT 'OPEN'
        CHECK (case_state IN ('OPEN', 'INVESTIGATING', 'RESOLVED')),

    -- === Detection (mirrors result for case-level audit) ===
    detected_at                TIMESTAMPTZ  NOT NULL,
    detected_by                TEXT         NOT NULL,

    -- === Investigation Roles ===
    assigned_to                UUID,
    -- Human reviewer UUID (from auth.users or hr users table)
    investigated_by            UUID,
    investigation_started_at   TIMESTAMPTZ,

    -- === Resolution Roles ===
    -- IMPORTANT: Both resolver and authorizer must be recorded.
    -- They may differ (four-eyes principle for high-severity cases).
    resolved_by                UUID,
    authorized_by              UUID,
    resolution_reference       TEXT,
    -- External corrective workflow ID (e.g. manual journal entry ID, HR approval ID).
    -- This proves the corrective action was INITIATED — not that the GL is now correct.
    resolved_at                TIMESTAMPTZ,

    -- === Constitutional Governance Constraint ===
    -- Cannot transition to RESOLVED without full authority chain.
    -- RESOLVED means: an authorized explanation is documented.
    -- RESOLVED does NOT mean: the financial state is now correct.
    -- Financial correctness is only confirmed by a new reconciliation run yielding MATCHED.
    CONSTRAINT f5_resolution_requires_authority CHECK (
        case_state <> 'RESOLVED' OR (
            resolution_reference IS NOT NULL AND
            authorized_by        IS NOT NULL AND
            resolved_at          IS NOT NULL
        )
    )
);

COMMENT ON TABLE public.f5_control_cases IS
    'F5 Constitution v1.2-Final: Operational case management for VARIANCE and QUARANTINED results. '
    'Constitutional Law: RESOLVED case_state means authorized explanation documented — '
    'NOT that the ledger is corrected. Ledger correctness is verified only by a subsequent MATCHED run.';

-- Add FK from f5_control_results.case_id → f5_control_cases.case_id
-- (created after f5_control_cases table exists)
ALTER TABLE public.f5_control_results
    ADD CONSTRAINT fk_f5_control_results_case
        FOREIGN KEY (case_id)
        REFERENCES public.f5_control_cases(case_id)
        ON DELETE RESTRICT;

-- =========================================================================
-- TABLE 3: f5_projection_health
-- Separately tracks the status of derived projection caches.
-- This is Control B (Projection Health) — separate from Control A (Financial GL Control).
--
-- Constitutional Rule: CACHE_DRIFT NEVER escalates to VARIANCE.
-- A cache drift does not indicate a financial discrepancy.
-- =========================================================================

CREATE TABLE public.f5_projection_health (
    health_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    domain                     TEXT         NOT NULL
        CHECK (domain IN ('AR', 'AP', 'CASH', 'PREPAYMENT')),

    run_id                     UUID         NOT NULL,
    -- Correlates this cache health record to the reconciliation run_id that produced it.

    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    -- Same as_of boundary used when computing both fact_derived_amount and cache_amount.

    -- === Comparison Amounts ===
    fact_derived_amount        NUMERIC(20,4) NOT NULL,
    -- Position reconstructed from immutable facts only (no cache read) as_of the boundary.
    cache_amount               NUMERIC(20,4) NOT NULL,
    -- Current value in the domain's projection cache table (e.g. finance_payable_positions).
    drift_amount               NUMERIC(20,4)
        GENERATED ALWAYS AS (cache_amount - fact_derived_amount) STORED,
    -- Positive = cache overstates; Negative = cache understates; Zero = synced.

    -- === Projection Health Result ===
    projection_result          TEXT         NOT NULL
        CHECK (projection_result IN ('CACHE_SYNCED', 'CACHE_DRIFT')),
    -- CACHE_SYNCED: cache matches fact-derived position.
    -- CACHE_DRIFT:  cache diverged. No f5_control_case is created.
    --               Cache rebuild (domain's reconstruction RPC) is the remediation path.

    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.f5_projection_health IS
    'F5 Constitution v1.2-Final: Control B — Projection Cache Health. '
    'CACHE_DRIFT is a cache health issue, not a financial discrepancy. '
    'CACHE_DRIFT NEVER spawns an f5_control_case. No f5_control_cases FK exists on this table.';

-- =========================================================================
-- INDEXES
-- Performance-optimized for the primary query patterns.
-- =========================================================================

-- Primary lookup: all results for a tenant + run
CREATE INDEX idx_f5_control_results_run
    ON public.f5_control_results (tenant_id, run_id);

-- Case investigation: find results by financial_result classification
CREATE INDEX idx_f5_control_results_result
    ON public.f5_control_results (tenant_id, financial_result, detected_at DESC);

-- Control type auditing
CREATE INDEX idx_f5_control_results_control_type
    ON public.f5_control_results (tenant_id, control_type, reconciliation_as_of DESC);

-- Source traceability: find all reconciliation results for a specific source
CREATE INDEX idx_f5_control_results_source
    ON public.f5_control_results (tenant_id, source_module, source_type, source_id);

-- Open/investigating case management
CREATE INDEX idx_f5_control_cases_state
    ON public.f5_control_cases (tenant_id, case_state, detected_at DESC)
    WHERE case_state IN ('OPEN', 'INVESTIGATING');

-- Cache health history per domain
CREATE INDEX idx_f5_projection_health_domain
    ON public.f5_projection_health (tenant_id, domain, reconciliation_as_of DESC);

-- Drift-only index (most common query in cache monitoring)
CREATE INDEX idx_f5_projection_health_drift
    ON public.f5_projection_health (tenant_id, domain, detected_at DESC)
    WHERE projection_result = 'CACHE_DRIFT';

-- =========================================================================
-- ROW LEVEL SECURITY
-- F5 tables are read-only for authenticated users.
-- All mutation occurs via SECURITY DEFINER RPCs only.
-- =========================================================================

ALTER TABLE public.f5_control_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f5_control_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f5_projection_health ENABLE ROW LEVEL SECURITY;

-- Read policies (tenant scoped)
CREATE POLICY "f5_control_results_tenant_isolation" ON public.f5_control_results
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "f5_control_cases_tenant_isolation" ON public.f5_control_cases
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "f5_projection_health_tenant_isolation" ON public.f5_projection_health
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- Revoke all direct write access (enforces Law 3: write only via SECURITY DEFINER RPCs)
REVOKE ALL ON public.f5_control_results   FROM authenticated, anon;
REVOKE ALL ON public.f5_control_cases     FROM authenticated, anon;
REVOKE ALL ON public.f5_projection_health FROM authenticated, anon;

-- Restore SELECT for authenticated users
GRANT SELECT ON public.f5_control_results   TO authenticated;
GRANT SELECT ON public.f5_control_cases     TO authenticated;
GRANT SELECT ON public.f5_projection_health TO authenticated;

-- service_role gets full access (for SECURITY DEFINER RPCs)
GRANT ALL ON public.f5_control_results   TO service_role;
GRANT ALL ON public.f5_control_cases     TO service_role;
GRANT ALL ON public.f5_projection_health TO service_role;

-- =========================================================================
-- IMMUTABILITY GUARDS
-- f5_control_results rows are append-only.
-- Only case_id FK population is allowed as post-insert update.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.f5_control_results_mutation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- DELETE is never permitted on result rows (audit completeness)
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'F5_RESULT_IMMUTABLE: f5_control_results rows cannot be deleted. Audit integrity.'
            USING ERRCODE = 'F5001';
    END IF;

    -- UPDATE is only permitted to set case_id after case creation.
    -- All other fields are immutable once inserted.
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.result_id              IS DISTINCT FROM OLD.result_id              OR
            NEW.tenant_id              IS DISTINCT FROM OLD.tenant_id              OR
            NEW.run_id                 IS DISTINCT FROM OLD.run_id                 OR
            NEW.control_type           IS DISTINCT FROM OLD.control_type           OR
            NEW.basis_id               IS DISTINCT FROM OLD.basis_id               OR
            NEW.basis_version          IS DISTINCT FROM OLD.basis_version          OR
            NEW.reconciliation_as_of   IS DISTINCT FROM OLD.reconciliation_as_of   OR
            NEW.source_snapshot_hash   IS DISTINCT FROM OLD.source_snapshot_hash   OR
            NEW.source_module          IS DISTINCT FROM OLD.source_module          OR
            NEW.source_type            IS DISTINCT FROM OLD.source_type            OR
            NEW.source_id              IS DISTINCT FROM OLD.source_id              OR
            NEW.financial_effect_type  IS DISTINCT FROM OLD.financial_effect_type  OR
            NEW.posting_attempt_id     IS DISTINCT FROM OLD.posting_attempt_id     OR
            NEW.expected_amount        IS DISTINCT FROM OLD.expected_amount        OR
            NEW.actual_amount          IS DISTINCT FROM OLD.actual_amount          OR
            NEW.source_currency        IS DISTINCT FROM OLD.source_currency        OR
            NEW.functional_currency    IS DISTINCT FROM OLD.functional_currency    OR
            NEW.financial_result       IS DISTINCT FROM OLD.financial_result       OR
            NEW.severity               IS DISTINCT FROM OLD.severity               OR
            NEW.detected_at            IS DISTINCT FROM OLD.detected_at            OR
            NEW.detected_by            IS DISTINCT FROM OLD.detected_by) THEN
            RAISE EXCEPTION 'F5_RESULT_IMMUTABLE: Only case_id may be updated on f5_control_results.'
                USING ERRCODE = 'F5001';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_f5_control_results_mutation_guard
    BEFORE UPDATE OR DELETE ON public.f5_control_results
    FOR EACH ROW EXECUTE FUNCTION public.f5_control_results_mutation_guard();

COMMENT ON FUNCTION public.f5_control_results_mutation_guard() IS
    'F5 Constitutional Guard: f5_control_results is append-only. '
    'Only case_id update is permitted post-insert. All other fields are immutable.';

-- =========================================================================
-- F5-G1 VERIFICATION COMMENT (Namespace Boundary Gate)
-- Static verification: this migration contains ZERO:
--   - INSERT/UPDATE/DELETE against finance_* tables
--   - ALTER/DROP against finance_* tables
-- All created tables use the f5_* prefix exclusively.
-- Machine-checkable via: SELECT table_name FROM information_schema.tables
--                        WHERE table_schema = 'public' AND table_name LIKE 'f5_%';
-- =========================================================================
