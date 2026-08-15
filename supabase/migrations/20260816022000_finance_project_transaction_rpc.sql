-- ============================================================
-- Migration: 20260816022000_finance_project_transaction_rpc
-- Component: F2.2 — Cash Projection Worker — Atomic Multi-Leg Projection
-- Description:
--   Creates the trusted database RPC finance_internal_project_cash_transaction.
--   This is the ONLY entry point for projecting F1 transaction legs into F2
--   cash state. It enforces multi-leg atomicity at the PostgreSQL transaction
--   boundary (F2.2 Invariant §F2.2.12 P0).
--
-- Atomicity Invariant (F2.2.12 P0):
--   All valid cash legs belonging to the same F1 transaction MUST be committed
--   atomically. A terminal failure on ANY leg MUST rollback ALL legs for the
--   same F1 transaction (ZERO cash mutations — no partial projections).
--
-- Security Invariants:
--   • SECURITY DEFINER with fixed search_path
--   • REVOKE ALL from PUBLIC, anon, authenticated
--   • GRANT EXECUTE to service_role ONLY
--   • Calls finance_internal_record_cash_movement internally (also service_role)
--
-- Idempotency Invariant:
--   Per-leg deterministic idempotency key:
--   SHA256( f1_transaction_id || ':' || leg_index || ':' || direction )
--   Reversal legs prefix with 'REV-'.
--
-- ADR references: ADR-021, ADR-022, F2.2 Implementation Plan
-- F1 Freeze: Not touched. Pure F2 write path.
-- ============================================================

CREATE OR REPLACE FUNCTION public.finance_internal_project_cash_transaction(
    p_tenant_id          UUID,
    p_f1_transaction_id  UUID,
    p_base_idempotency   VARCHAR,   -- Deterministic base key from the worker (e.g. eventId)
    p_legs               JSONB      -- Array of legs to project
)
RETURNS JSONB
SET search_path = public
AS $$
DECLARE
    v_leg                   RECORD;
    v_leg_index             INT := 0;
    v_projected_count       INT := 0;
    v_duplicate_count       INT := 0;
    v_leg_idempotency_key   VARCHAR;
    v_leg_result            JSONB;
    v_all_results           JSONB := '[]'::JSONB;
    v_f1_exists             BOOLEAN;
    v_f1_tenant             UUID;
BEGIN
    -- --------------------------------------------------------
    -- 1. Pre-flight: Verify F1 transaction exists, is POSTED,
    --    and belongs to the claimed tenant.
    --    This is the P0-1 tenant isolation cross-check.
    -- --------------------------------------------------------
    SELECT
        EXISTS (
            SELECT 1
            FROM public.finance_transactions
            WHERE id = p_f1_transaction_id
              AND tenant_id = p_tenant_id
              AND status = 'POSTED'
        )
    INTO v_f1_exists;

    IF NOT v_f1_exists THEN
        RAISE EXCEPTION 'F1_TRANSACTION_NOT_FOUND_OR_TENANT_MISMATCH'
            USING ERRCODE = 'F2020',
                  DETAIL = 'transaction_id=' || p_f1_transaction_id::TEXT ||
                           ' tenant_id=' || p_tenant_id::TEXT;
    END IF;

    -- --------------------------------------------------------
    -- 2. Validate legs array is not empty
    -- --------------------------------------------------------
    IF jsonb_array_length(p_legs) = 0 THEN
        RAISE EXCEPTION 'PROJECT_CASH_NO_LEGS'
            USING ERRCODE = 'F2021';
    END IF;

    -- --------------------------------------------------------
    -- 3. Iterate legs and project each one via the trusted
    --    finance_internal_record_cash_movement RPC.
    --
    --    Because this entire function executes within a single
    --    PostgreSQL transaction, any RAISE EXCEPTION from any
    --    leg automatically rolls back ALL prior leg inserts.
    --    This satisfies F2.2.12 P0 multi-leg atomicity.
    -- --------------------------------------------------------
    FOR v_leg IN
        SELECT *
        FROM jsonb_to_recordset(p_legs) AS x(
            bank_account_id         UUID,
            cash_leg_reference      VARCHAR,
            direction               VARCHAR,
            amount_minor            NUMERIC,
            currency                VARCHAR,
            functional_amount_minor NUMERIC,
            functional_currency     VARCHAR,
            valuation_rate          NUMERIC,
            source_type             VARCHAR,
            source_id               VARCHAR,
            description             TEXT
        )
    LOOP
        -- Build deterministic per-leg idempotency key:
        -- base || ':' || leg_index || ':' || direction
        v_leg_idempotency_key :=
            p_base_idempotency || ':' ||
            v_leg_index::TEXT  || ':' ||
            COALESCE(v_leg.direction, 'UNKNOWN');

        -- Validate mandatory leg fields before calling RPC
        IF v_leg.bank_account_id IS NULL THEN
            RAISE EXCEPTION 'PROJECT_CASH_LEG_MISSING_BANK_ACCOUNT'
                USING ERRCODE = 'F2022',
                      DETAIL  = 'leg_index=' || v_leg_index::TEXT;
        END IF;

        IF v_leg.direction NOT IN ('INFLOW', 'OUTFLOW') THEN
            RAISE EXCEPTION 'PROJECT_CASH_LEG_INVALID_DIRECTION'
                USING ERRCODE = 'F2023',
                      DETAIL  = 'leg_index=' || v_leg_index::TEXT ||
                                ' direction=' || COALESCE(v_leg.direction, 'NULL');
        END IF;

        IF v_leg.amount_minor IS NULL OR v_leg.amount_minor <= 0 THEN
            RAISE EXCEPTION 'PROJECT_CASH_LEG_INVALID_AMOUNT'
                USING ERRCODE = 'F2024',
                      DETAIL  = 'leg_index=' || v_leg_index::TEXT;
        END IF;

        -- Delegate to the single-leg trusted recorder
        v_leg_result := public.finance_internal_record_cash_movement(
            p_tenant_id,
            v_leg.bank_account_id,
            v_leg_idempotency_key,
            v_leg.direction,
            v_leg.amount_minor,
            v_leg.currency,
            v_leg.functional_amount_minor,
            v_leg.functional_currency,
            v_leg.valuation_rate,
            p_f1_transaction_id,
            v_leg.cash_leg_reference,
            v_leg.source_type,
            v_leg.source_id,
            v_leg.description
        );

        -- Accumulate results
        v_all_results := v_all_results || jsonb_build_array(
            v_leg_result || jsonb_build_object('leg_index', v_leg_index)
        );

        IF (v_leg_result->>'is_duplicate')::BOOLEAN THEN
            v_duplicate_count := v_duplicate_count + 1;
        ELSE
            v_projected_count := v_projected_count + 1;
        END IF;

        v_leg_index := v_leg_index + 1;
    END LOOP;

    -- --------------------------------------------------------
    -- 4. Return aggregate result
    -- --------------------------------------------------------
    RETURN jsonb_build_object(
        'success',              true,
        'f1_transaction_id',   p_f1_transaction_id,
        'legs_total',          v_leg_index,
        'legs_projected',      v_projected_count,
        'legs_duplicate',      v_duplicate_count,
        'results',             v_all_results
    );

    -- Note: No explicit EXCEPTION handler here.
    -- Any failure from finance_internal_record_cash_movement raises an exception
    -- which PostgreSQL will surface after rolling back ALL leg inserts in this
    -- transaction block — satisfying F2.2.12 P0 multi-leg atomicity invariant.
    -- The caller (CashProjectionWorker) MUST catch and route to quarantine.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECURITY: Revoke from all public roles, grant ONLY to service_role
-- ============================================================
REVOKE ALL ON FUNCTION public.finance_internal_project_cash_transaction(
    UUID, UUID, VARCHAR, JSONB
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.finance_internal_project_cash_transaction(
    UUID, UUID, VARCHAR, JSONB
) FROM anon;

REVOKE ALL ON FUNCTION public.finance_internal_project_cash_transaction(
    UUID, UUID, VARCHAR, JSONB
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.finance_internal_project_cash_transaction(
    UUID, UUID, VARCHAR, JSONB
) TO service_role;


-- ============================================================
-- COMMENT for audit trail
-- ============================================================
COMMENT ON FUNCTION public.finance_internal_project_cash_transaction(
    UUID, UUID, VARCHAR, JSONB
) IS
'F2.2 TRUSTED INTERNAL RPC — finance_internal_project_cash_transaction
 PURPOSE: Atomically project all cash legs of a single F1 transaction into F2 state.
 ATOMICITY: All legs succeed or ALL roll back (PostgreSQL transaction boundary).
            Satisfies F2.2 Invariant F2.2.12 P0 — no partial projections.
 IDEMPOTENCY: Per-leg key = base_idempotency || ":" || leg_index || ":" || direction.
 SECURITY: service_role ONLY. Technical Identity boundary enforced.
 F1 AUTHORITY: Verifies F1 transaction exists and belongs to tenant before ANY projection.
 F1 IMPACT: None. Pure F2 write path. F1 tables untouched.
 ADR: ADR-021, ADR-022, F2.2 Plan Invariants §F2.2.12, §F2.2.9';
