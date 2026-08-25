-- Migration: F2 Cash Temporal Contract — Fix finance_get_cash_movements_as_of()
-- Description: Updates finance_get_cash_movements_as_of() to use effective_date and add audit fields
-- Contract: F2_CASH:v1 (updated to v1.2 schema)
-- Invariants: INV-F2-T3 (temporal determinism), INV-F2-O1 (baseline closure support)
-- Prerequisites: Migration 20260824000000_f2_cash_effective_date.sql (effective_date column exists)
-- Date: 2026-08-24
-- Status: ✅ APPROVED (M2)

-- =========================================================================
-- UPDATE: finance_get_cash_movements_as_of() — F2_CASH:v1
-- =========================================================================

-- Drop existing function (signature changed in v1.2)
DROP FUNCTION IF EXISTS public.finance_get_cash_movements_as_of(UUID, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.finance_get_cash_movements_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT DEFAULT 'F2_CASH:v1'
)
RETURNS TABLE (
    movement_id          UUID,
    bank_account_id      UUID,           -- ✅ ADDED v1.2 (F5.6 needs account context)
    direction            VARCHAR,
    amount_minor         NUMERIC(20,0),  -- ✅ FIXED: Match actual table type
    currency             CHAR(3),
    cash_effective_date  TIMESTAMPTZ,
    valuation_rate       NUMERIC(18,6),
    f1_transaction_id    UUID            -- ✅ ADDED v1.2 (F5 audit trail)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Version gate
    IF p_contract_version NOT IN ('F2_CASH:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_get_cash_movements_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    -- Tenant validation
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED' USING ERRCODE = 'F5011';
    END IF;

    -- Temporal boundary required
    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED' USING ERRCODE = 'F5012';
    END IF;

    -- Return movements filtered by effective_date (F2 Temporal Authority)
    -- INV-F2-T3: Temporal determinism — same as_of returns same results regardless of query time
    -- Uses effective_date (business date) NOT recorded_at (projection time)
    RETURN QUERY
    SELECT
        fcm.id                              AS movement_id,
        fcm.bank_account_id                 AS bank_account_id,        -- ✅ v1.2: Account context
        fcm.direction                       AS direction,
        fcm.amount_minor                    AS amount_minor,
        fcm.currency::CHAR(3)               AS currency,
        fcm.effective_date                  AS cash_effective_date,   -- ✅ Temporal authority field
        COALESCE(fcm.valuation_rate, 1.0)::NUMERIC(18,6) AS valuation_rate,
        fcm.f1_transaction_id               AS f1_transaction_id      -- ✅ v1.2: Audit trail
    FROM public.finance_cash_movements fcm
    WHERE fcm.tenant_id = p_tenant_id
      AND fcm.effective_date <= p_as_of     -- ✅ INCLUSIVE boundary (movements AT as_of included)
    ORDER BY fcm.effective_date ASC, fcm.id ASC;  -- ✅ Deterministic ordering
END;
$$;

COMMENT ON FUNCTION public.finance_get_cash_movements_as_of(UUID, TIMESTAMPTZ, TEXT) IS
    'F2 Cash Temporal Contract F2_CASH:v1.2. Returns cash movements with effective_date <= p_as_of. '
    'Temporal authority: finance_cash_movements.effective_date (business/accounting date from F1.posted_at). '
    'INV-F2-T3: Temporal determinism — same as_of always returns same results. '
    'INV-F2-O1: Supports baseline closure semantics (exclusive boundary in F5.6 reconstruction). '
    'Boundary semantics: INCLUSIVE (movements at p_as_of ARE included). '
    'SECURITY DEFINER: F5 uses this contract; MUST NOT query finance_cash_movements directly.';

-- Grant execution to service role (F5 worker access)
GRANT EXECUTE ON FUNCTION public.finance_get_cash_movements_as_of(UUID, TIMESTAMPTZ, TEXT)
    TO service_role;

-- =========================================================================
-- VERIFICATION CHECKLIST
-- =========================================================================

-- Post-migration verification queries:
--
-- 1. Verify function callable:
--    SELECT * FROM finance_get_cash_movements_as_of(
--        'tenant-uuid'::UUID,
--        NOW(),
--        'F2_CASH:v1'
--    ) LIMIT 1;
--    -- Expected: Returns rows (if movements exist) or empty set (if no movements)
--
-- 2. Verify temporal filtering (effective_date used):
--    -- Insert test movement with effective_date in past
--    -- Query with as_of = yesterday → should include movement
--    -- Query with as_of = day before yesterday → should NOT include movement
--
-- 3. Verify inclusive boundary semantics:
--    -- Movement with effective_date = '2026-08-23 14:00:00'
--    -- Query with as_of = '2026-08-23 14:00:00' → SHOULD include movement
--
-- 4. Verify deterministic ordering:
--    SELECT cash_effective_date, movement_id FROM finance_get_cash_movements_as_of(...)
--    ORDER BY cash_effective_date, movement_id;
--    -- Expected: Results ordered by effective_date ASC, then movement_id ASC
--
-- 5. Verify tenant isolation (RLS + explicit filter):
--    -- Query with tenant A → returns only tenant A movements
--    -- Query with tenant B → returns only tenant B movements
--    -- Cross-tenant query → returns zero rows
--
-- 6. Verify schema includes v1.2 fields:
--    SELECT bank_account_id, f1_transaction_id FROM finance_get_cash_movements_as_of(...) LIMIT 1;
--    -- Expected: Columns exist and populated

-- =========================================================================
-- CONTRACT SEMANTICS (v1.2)
-- =========================================================================

-- Temporal Boundary: effective_date <= p_as_of (INCLUSIVE)
--   - Movements AT p_as_of timestamp ARE included
--   - Movements AFTER p_as_of timestamp are excluded
--   - Standard SQL temporal convention
--
-- Ordering: ORDER BY effective_date ASC, id ASC (DETERMINISTIC)
--   - Same query always returns rows in same order
--   - Supports reproducible reconstruction
--
-- RLS & Security:
--   - ✅ SECURITY DEFINER: F5 can call without direct table access
--   - ✅ Explicit WHERE tenant_id = p_tenant_id: Tenant isolation
--   - ✅ Underlying table RLS active: Defense in depth
--
-- Return Schema (v1.2):
--   - movement_id: UUID (primary key)
--   - bank_account_id: UUID (✅ NEW: account context for F5.6)
--   - direction: VARCHAR (INFLOW | OUTFLOW)
--   - amount_minor: BIGINT (amount in minor currency units)
--   - currency: CHAR(3) (ISO currency code)
--   - cash_effective_date: TIMESTAMPTZ (business date, temporal authority)
--   - valuation_rate: NUMERIC(18,6) (FX rate if applicable)
--   - f1_transaction_id: UUID (✅ NEW: F1 lineage for audit trail)

-- Migration complete. F2 cash movements contract operational with temporal authority.
