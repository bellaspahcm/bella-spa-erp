-- Migration: F2 Opening Balance Contract — Schema & Function
-- Description: Creates finance_cash_opening_balances table and finance_cash_opening_balance_as_of() function
-- Contract: F2_OPENING:v1
-- Invariants: INV-F2-O1 (baseline closure), INV-F2-O2 (provenance), INV-F2-O3 (no reinterpretation), INV-F2-O4 (baseline coverage)
-- Date: 2026-08-24
-- Status: ✅ APPROVED (M3)
-- Critical: NO DATA SEEDING — schema and contract only

-- =========================================================================
-- 1. CREATE TABLE: finance_cash_opening_balances
-- =========================================================================

CREATE TABLE public.finance_cash_opening_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL,
    
    -- Balance Data
    balance_minor NUMERIC(20,0) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    
    -- Temporal Authority (INV-F2-O1: Baseline Closure)
    effective_date TIMESTAMPTZ NOT NULL,
    
    -- Audit Trail & Provenance (INV-F2-O2: Baseline Provenance)
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID,
    source_type VARCHAR(100) NOT NULL,
    source_id VARCHAR(255),
    notes TEXT,
    
    -- Constraints
    CONSTRAINT fk_opening_balance_bank 
        FOREIGN KEY (tenant_id, bank_account_id) 
        REFERENCES public.finance_bank_accounts(tenant_id, id) ON DELETE RESTRICT,
    
    -- One opening balance per (tenant, account, effective_date)
    CONSTRAINT uq_opening_balance_per_account_date 
        UNIQUE (tenant_id, bank_account_id, effective_date),
    
    -- Composite for circular FK support (if needed)
    CONSTRAINT uq_opening_balance_composite 
        UNIQUE (tenant_id, id),
    
    -- INV-F2-O2: source_type validation (provenance required)
    CONSTRAINT chk_opening_balance_source_type
        CHECK (source_type IN (
            'MIGRATION_SEED',
            'MANUAL_ADJUSTMENT', 
            'PERIOD_CLOSING',
            'EXTERNAL_IMPORT',
            'RECONCILIATION_CORRECTION'
        ))
);

-- =========================================================================
-- 2. TABLE COMMENTS (Invariant Documentation)
-- =========================================================================

COMMENT ON TABLE public.finance_cash_opening_balances IS
    'F2 Opening Balance Contract v1.2: Authoritative opening cash positions per bank account. '
    'INV-F2-O1 (Baseline Closure): Opening balance at effective_date D represents position AFTER all movements <= D. '
    'INV-F2-O2 (Provenance): Every opening balance MUST have source_type, recorded_by (when applicable), notes. '
    'INV-F2-O3 (No Reinterpretation): Current finance_cash_positions MUST NOT be backdated without verification. '
    'INV-F2-O4 (Baseline Coverage): Contract signals baseline_found to prevent false zero interpretation.';

COMMENT ON COLUMN public.finance_cash_opening_balances.effective_date IS
    'INV-F2-O1: Business date when this baseline is valid. Opening balance at date D reflects position AFTER all movements with effective_date <= D. '
    'Reconstruction from this baseline includes only movements with effective_date > D (exclusive boundary).';

COMMENT ON COLUMN public.finance_cash_opening_balances.source_type IS
    'INV-F2-O2: Provenance classification. MANDATORY. Indicates how this opening balance was established. '
    'Valid values: MIGRATION_SEED | MANUAL_ADJUSTMENT | PERIOD_CLOSING | EXTERNAL_IMPORT | RECONCILIATION_CORRECTION';

COMMENT ON COLUMN public.finance_cash_opening_balances.balance_minor IS
    'Opening balance in minor currency units (e.g., cents, VND đồng). Represents authoritative cash position at effective_date.';

COMMENT ON COLUMN public.finance_cash_opening_balances.notes IS
    'INV-F2-O2: Human-readable provenance notes. Should contain evidence reference, reasoning, or source documentation.';

-- =========================================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================================

ALTER TABLE public.finance_cash_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_cash_opening_balances" 
    ON public.finance_cash_opening_balances
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. PERFORMANCE INDEX
-- =========================================================================

CREATE INDEX idx_cash_opening_balances_lookup 
    ON public.finance_cash_opening_balances(tenant_id, bank_account_id, effective_date DESC);

COMMENT ON INDEX idx_cash_opening_balances_lookup IS
    'F2 Opening Balance Contract: Supports finance_cash_opening_balance_as_of() lookup. '
    'Query pattern: MAX(effective_date WHERE effective_date <= as_of) per (tenant, account).';

-- =========================================================================
-- 5. IMMUTABILITY ENFORCEMENT (INV-F2-D3)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_cash_opening_balance_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'OPENING_BALANCE_IMMUTABLE: Opening balances are immutable audit records and cannot be updated or deleted. '
                    'To correct an opening balance, insert a new record with appropriate source_type and notes documenting the correction.'
        USING ERRCODE = 'F2040',
              HINT = 'Opening balances are append-only. Use source_type=MANUAL_ADJUSTMENT or RECONCILIATION_CORRECTION for corrections.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.finance_cash_opening_balance_immutability_guard() IS
    'INV-F2-D3: Enforces opening balance immutability. Blocks UPDATE and DELETE operations. '
    'Opening balances are append-only audit records. Corrections must be new INSERT records.';

CREATE TRIGGER trg_opening_balance_immutability
    BEFORE UPDATE OR DELETE ON public.finance_cash_opening_balances
    FOR EACH ROW EXECUTE FUNCTION public.finance_cash_opening_balance_immutability_guard();

-- =========================================================================
-- 6. CONTRACT FUNCTION: finance_cash_opening_balance_as_of()
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_cash_opening_balance_as_of(
    p_tenant_id         UUID,
    p_bank_account_id   UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT DEFAULT 'F2_OPENING:v1'
)
RETURNS TABLE (
    opening_balance_minor   NUMERIC(20,0),
    opening_currency        VARCHAR(10),
    baseline_effective_date TIMESTAMPTZ,
    opening_balance_id      UUID,
    baseline_found          BOOLEAN  -- ✅ INV-F2-O4: Baseline Coverage signal
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Version gate
    IF p_contract_version NOT IN ('F2_OPENING:v1') THEN
        RAISE EXCEPTION 'UNKNOWN_CONTRACT_VERSION: finance_cash_opening_balance_as_of does not support version %',
            p_contract_version
            USING ERRCODE = 'F5010';
    END IF;

    -- Validation
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_ID_REQUIRED' USING ERRCODE = 'F5011';
    END IF;

    IF p_bank_account_id IS NULL THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_ID_REQUIRED' USING ERRCODE = 'F2041';
    END IF;

    IF p_as_of IS NULL THEN
        RAISE EXCEPTION 'AS_OF_REQUIRED' USING ERRCODE = 'F5012';
    END IF;

    -- Return latest opening balance effective ON OR BEFORE as_of
    -- INV-F2-O4: baseline_found signals whether authoritative baseline exists
    RETURN QUERY
    SELECT
        COALESCE(ob.balance_minor, 0)::NUMERIC(20,0) AS opening_balance_minor,
        COALESCE(ob.currency, ba.currency)::VARCHAR(10) AS opening_currency,
        COALESCE(ob.effective_date, p_as_of) AS baseline_effective_date,
        ob.id AS opening_balance_id,
        (ob.id IS NOT NULL)::BOOLEAN AS baseline_found  -- ✅ INV-F2-O4: TRUE if baseline exists
    FROM public.finance_bank_accounts ba
    LEFT JOIN LATERAL (
        SELECT id, balance_minor, currency, effective_date
        FROM public.finance_cash_opening_balances
        WHERE tenant_id = p_tenant_id
          AND bank_account_id = p_bank_account_id
          AND effective_date <= p_as_of
        ORDER BY effective_date DESC
        LIMIT 1
    ) ob ON TRUE
    WHERE ba.tenant_id = p_tenant_id
      AND ba.id = p_bank_account_id;
END;
$$;

COMMENT ON FUNCTION public.finance_cash_opening_balance_as_of(UUID, UUID, TIMESTAMPTZ, TEXT) IS
    'F2 Opening Balance Contract F2_OPENING:v1. Returns latest opening balance effective at or before p_as_of. '
    'INV-F2-O1 (Baseline Closure): Baseline at date D represents position AFTER all movements <= D. '
    'INV-F2-O4 (Baseline Coverage): baseline_found indicates whether authoritative baseline exists. '
    'If baseline_found = FALSE, opening_balance_minor = 0 means NO_BASELINE (not verified zero balance). '
    'SECURITY DEFINER: F5 uses this contract; MUST NOT query finance_cash_opening_balances directly.';

-- Grant execution to service role (F5 worker access)
GRANT EXECUTE ON FUNCTION public.finance_cash_opening_balance_as_of(UUID, UUID, TIMESTAMPTZ, TEXT)
    TO service_role;

-- =========================================================================
-- 7. CONTRACT SEMANTICS DOCUMENTATION
-- =========================================================================

-- Baseline Selection:
--   MAX(effective_date WHERE effective_date <= p_as_of)
--
-- Zero Default (baseline_found = FALSE):
--   - If no opening balance exists before as_of, returns 0
--   - baseline_effective_date = as_of (signals zero-from-start)
--   - baseline_found = FALSE (NOT_RECONSTRUCTABLE state)
--
-- Four Baseline States:
--   1. VERIFIED_BASELINE: baseline_found = TRUE, balance > 0 (authoritative, reconstructable)
--   2. VERIFIED_ZERO: baseline_found = TRUE, balance = 0 (explicitly recorded zero)
--   3. NO_BASELINE: baseline_found = FALSE, balance = 0 (no baseline exists, NOT reconstructable)
--   4. CURRENT_POSITION_BASELINE: baseline_found = TRUE, balance > 0 (safe window baseline)
--
-- Replacement Semantics Example:
--   Timeline:
--     2026-01-01: Opening = 100M
--     2026-01-15: Movement +20M
--     2026-02-01: New Opening = 500M (baseline replacement)
--     2026-02-15: Movement -30M
--
--   Query as_of = 2026-02-20:
--     Baseline: 2026-02-01 opening = 500M
--     Movements: Only after 2026-02-01 → (-30M)
--     Result: 500M - 30M = 470M
--     NOT: 100M + 20M + 500M - 30M = 590M (double-count prevented)

-- =========================================================================
-- VERIFICATION CHECKLIST
-- =========================================================================

-- Post-migration verification queries:
--
-- 1. Verify table exists:
--    SELECT COUNT(*) FROM finance_cash_opening_balances;
--    -- Expected: 0 (no data seeded yet)
--
-- 2. Verify function callable:
--    SELECT * FROM finance_cash_opening_balance_as_of(
--        'tenant-uuid'::UUID,
--        'account-uuid'::UUID,
--        NOW(),
--        'F2_OPENING:v1'
--    );
--    -- Expected: Returns row with baseline_found = FALSE (no baseline exists yet)
--
-- 3. Verify immutability (after INSERT test record):
--    -- INSERT test opening balance
--    -- Try UPDATE → should raise OPENING_BALANCE_IMMUTABLE exception
--    -- Try DELETE → should raise OPENING_BALANCE_IMMUTABLE exception
--
-- 4. Verify unique constraint:
--    -- INSERT same (tenant, account, effective_date) twice
--    -- Expected: Second INSERT fails with unique violation
--
-- 5. Verify RLS:
--    -- Query with tenant A → returns only tenant A opening balances
--    -- Cross-tenant query → returns zero rows
--
-- 6. Verify baseline_found signal:
--    -- Query with no opening balance → baseline_found = FALSE
--    -- INSERT opening balance
--    -- Query again → baseline_found = TRUE
--
-- 7. Verify source_type constraint:
--    -- Try INSERT with invalid source_type → should fail CHECK constraint
--    -- Try INSERT without source_type → should fail NOT NULL constraint

-- =========================================================================
-- ARCHITECTURAL BOUNDARIES (v1.2)
-- =========================================================================

-- ✅ Schema created (no data seeding)
-- ✅ Immutability enforced (trigger blocks UPDATE/DELETE)
-- ✅ RLS enabled (tenant isolation)
-- ✅ Contract function operational (baseline_found signal)
-- ✅ Provenance fields mandatory (source_type NOT NULL)
-- ✅ SECURITY DEFINER (F5 boundary compliance)
--
-- 🔴 BLOCKED: Data seeding (Migration 4b awaits baseline provenance decision)
-- 🔴 BLOCKED: F5.6 reconstruction (depends on F2 contracts verified)

-- Migration complete. F2 Opening Balance Contract schema and function ready.
-- NO DATA INSERTED. Awaiting baseline provenance decision before M4b.
