-- Migration: F2 Opening Balance Provenance — Decision Registry
-- Description: Creates audit trail table for opening balance baseline provenance decisions
-- Invariants: INV-F2-O2 (provenance required), INV-F2-O3 (no historical reinterpretation)
-- Purpose: Documents architectural decisions about where opening baselines come from
-- Date: 2026-08-24
-- Status: ✅ APPROVED (M4a)
-- Critical: Decision registry only — NO automatic baseline seeding

-- =========================================================================
-- 1. CREATE TABLE: finance_cash_opening_balance_decisions
-- =========================================================================

CREATE TABLE public.finance_cash_opening_balance_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Decision Metadata
    decision_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by UUID NOT NULL,  -- Human architect/operator who made the decision
    decision_type VARCHAR(100) NOT NULL,
    
    -- Affected Scope
    applies_to_all_accounts BOOLEAN NOT NULL DEFAULT FALSE,
    specific_bank_account_id UUID,  -- NULL if applies_to_all_accounts = TRUE
    
    -- Baseline Details
    baseline_date TIMESTAMPTZ,  -- When the baseline is considered valid
    evidence_source TEXT,  -- Reference to accounting period close, migration doc, etc.
    notes TEXT NOT NULL,  -- Human-readable explanation of decision
    
    -- Audit Trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_decision_scope 
        CHECK (
            (applies_to_all_accounts = TRUE AND specific_bank_account_id IS NULL)
            OR
            (applies_to_all_accounts = FALSE AND specific_bank_account_id IS NOT NULL)
        ),
    
    -- INV-F2-O2: decision_type validation
    CONSTRAINT chk_decision_type
        CHECK (decision_type IN (
            'ZERO_BASELINE',              -- Greenfield account, no prior activity
            'VERIFIED_HISTORICAL',        -- Evidence-based historical baseline (period close, etc.)
            'CURRENT_POSITION_BASELINE',  -- Current position as future-only baseline (safe window)
            'NO_BASELINE_REQUIRED',       -- Account excluded from baseline establishment
            'DEFERRED'                    -- Decision deferred pending evidence
        ))
);

-- =========================================================================
-- 2. TABLE COMMENTS (Invariant Documentation)
-- =========================================================================

COMMENT ON TABLE public.finance_cash_opening_balance_decisions IS
    'INV-F2-O2 & INV-F2-O3: Audit trail for opening balance baseline provenance decisions. '
    'Records architectural decision for where opening baselines come from, preventing '
    'unauthorized historical reinterpretation of current materialized state. '
    'This table documents DECISIONS only — actual opening balance records are in finance_cash_opening_balances.';

COMMENT ON COLUMN public.finance_cash_opening_balance_decisions.decision_type IS
    'Type of baseline provenance decision: '
    'ZERO_BASELINE = greenfield account with no prior activity; '
    'VERIFIED_HISTORICAL = evidence-based baseline from period close or verified accounting data; '
    'CURRENT_POSITION_BASELINE = current state used as future-only baseline (safe window); '
    'NO_BASELINE_REQUIRED = account excluded from baseline establishment; '
    'DEFERRED = decision pending evidence/verification.';

COMMENT ON COLUMN public.finance_cash_opening_balance_decisions.decided_by IS
    'UUID of human architect/operator who made the baseline provenance decision. '
    'Critical architectural decisions MUST NOT be automated without human approval. '
    'INV-F2-O3: Prevents system from silently backdating current positions to arbitrary dates.';

COMMENT ON COLUMN public.finance_cash_opening_balance_decisions.evidence_source IS
    'Reference to evidence supporting this baseline decision. Examples: '
    '- "accounting_period_close_2026_01" (period close report) '
    '- "external_system_export_2026_08_23.csv" (verified import) '
    '- "migration_doc_section_4.2" (migration documentation) '
    '- "finance_cash_positions_current_state" (current position as future baseline)';

COMMENT ON COLUMN public.finance_cash_opening_balance_decisions.baseline_date IS
    'Effective date for the baseline. Semantics depend on decision_type: '
    'ZERO_BASELINE: account activation date or F2 ledger start date; '
    'VERIFIED_HISTORICAL: last day of verified accounting period; '
    'CURRENT_POSITION_BASELINE: date when current position was recorded (typically TODAY); '
    'Must align with effective_date in finance_cash_opening_balances when baseline is created.';

COMMENT ON COLUMN public.finance_cash_opening_balance_decisions.notes IS
    'Human-readable explanation of baseline decision. MANDATORY. Should include: '
    '- Why this decision was made '
    '- What evidence supports it '
    '- What limitations apply (e.g., "reconstruction valid only after 2026-08-23") '
    '- Any assumptions or constraints';

-- =========================================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================================

ALTER TABLE public.finance_cash_opening_balance_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for baseline decisions" 
    ON public.finance_cash_opening_balance_decisions
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. PERFORMANCE INDEX
-- =========================================================================

CREATE INDEX idx_cash_opening_decisions_lookup 
    ON public.finance_cash_opening_balance_decisions(tenant_id, decision_date DESC);

COMMENT ON INDEX idx_cash_opening_decisions_lookup IS
    'Supports audit queries: recent baseline decisions per tenant, chronological decision history.';

-- =========================================================================
-- 5. ARCHITECTURAL BOUNDARY ENFORCEMENT
-- =========================================================================

-- Note: This table is for AUDIT and GOVERNANCE only.
-- It does NOT automatically create opening balance records.
-- 
-- Workflow after decision is recorded here:
--   1. Human architect records decision in this table
--   2. Human architect (or approved automation) creates opening balance records
--      in finance_cash_opening_balances with appropriate source_type and notes
--   3. Opening balance source_type and notes should reference this decision record
--
-- This separation prevents automated systems from making historical accounting
-- claims without explicit human architectural approval.

-- =========================================================================
-- DECISION TYPE USAGE GUIDELINES
-- =========================================================================

-- ZERO_BASELINE:
--   - Use for: New accounts with no transactions before baseline_date
--   - Evidence: Account creation date, no movements in finance_cash_movements
--   - Example: INSERT decision with decision_type='ZERO_BASELINE', baseline_date=account_created_at
--   - Then: INSERT opening balance with balance_minor=0, effective_date=baseline_date
--
-- VERIFIED_HISTORICAL:
--   - Use for: Accounts with verified accounting period close or system export
--   - Evidence: Period close report, external system data, verified accounting records
--   - Example: INSERT decision with evidence_source='period_close_2026_01.pdf'
--   - Then: INSERT opening balance with verified amount, effective_date=period_close_date
--
-- CURRENT_POSITION_BASELINE (✅ RECOMMENDED FOR BELLA):
--   - Use for: Bootstrap with current position as future-only baseline
--   - Evidence: finance_cash_positions.balance_minor as of baseline_date
--   - Example: INSERT decision with baseline_date=NOW(), evidence_source='finance_cash_positions_current_state'
--   - Then: INSERT opening balance with current balance, effective_date=NOW()::DATE
--   - Critical: Notes MUST state "reconstruction valid only after [baseline_date]"
--
-- NO_BASELINE_REQUIRED:
--   - Use for: Accounts excluded from F5.6 reconciliation (inactive, test, etc.)
--   - Evidence: Business decision, account status
--   - Example: INSERT decision for inactive accounts
--   - Then: NO opening balance created
--
-- DEFERRED:
--   - Use for: Decision pending evidence collection or verification
--   - Evidence: Pending items list, required documentation
--   - Example: INSERT decision with notes explaining what evidence is needed
--   - Then: Wait for evidence before creating opening balance

-- =========================================================================
-- VERIFICATION CHECKLIST
-- =========================================================================

-- Post-migration verification queries:
--
-- 1. Verify table exists:
--    SELECT COUNT(*) FROM finance_cash_opening_balance_decisions;
--    -- Expected: 0 (no decisions recorded yet)
--
-- 2. Verify decision_type constraint:
--    -- Try INSERT with invalid decision_type → should fail CHECK constraint
--    INSERT INTO finance_cash_opening_balance_decisions (tenant_id, decided_by, decision_type, notes)
--    VALUES ('tenant-uuid', 'user-uuid', 'INVALID_TYPE', 'test');
--    -- Expected: ERROR: check constraint "chk_decision_type" violated
--
-- 3. Verify scope constraint:
--    -- Try INSERT with applies_to_all_accounts=TRUE and specific_bank_account_id set
--    -- Expected: ERROR: check constraint "chk_decision_scope" violated
--
-- 4. Verify RLS:
--    -- Query with tenant A → returns only tenant A decisions
--    -- Cross-tenant query → returns zero rows
--
-- 5. Verify notes NOT NULL:
--    -- Try INSERT without notes
--    -- Expected: ERROR: null value in column "notes" violates not-null constraint

-- =========================================================================
-- EXAMPLE DECISION RECORDS (for documentation — not executed)
-- =========================================================================

-- Example 1: CURRENT_POSITION_BASELINE decision (recommended for Bella):
/*
INSERT INTO public.finance_cash_opening_balance_decisions (
    tenant_id,
    decided_by,
    decision_type,
    applies_to_all_accounts,
    baseline_date,
    evidence_source,
    notes
) VALUES (
    'tenant-uuid',
    'architect-user-uuid',
    'CURRENT_POSITION_BASELINE',
    TRUE,  -- Applies to all accounts
    '2026-08-24'::DATE,
    'finance_cash_positions_current_state',
    'Bootstrap F2 Opening Balance Contract with current cash positions as future-only baseline. '
    'Reconstruction valid only for dates after 2026-08-24. '
    'No historical accounting claims before this date. '
    'Verified historical baselines may be added later with appropriate evidence. '
    'Approved by: [Architect Name], Date: 2026-08-24'
);
*/

-- Example 2: VERIFIED_HISTORICAL decision (when evidence exists):
/*
INSERT INTO public.finance_cash_opening_balance_decisions (
    tenant_id,
    decided_by,
    decision_type,
    applies_to_all_accounts,
    specific_bank_account_id,
    baseline_date,
    evidence_source,
    notes
) VALUES (
    'tenant-uuid',
    'architect-user-uuid',
    'VERIFIED_HISTORICAL',
    FALSE,  -- Specific account
    'bank-account-uuid',
    '2026-01-31'::DATE,
    'accounting_period_close_2026_01.pdf',
    'Opening balance verified from January 2026 period close. '
    'Closing balance: 50,000,000 VND. '
    'Source: Monthly accounting period close report. '
    'Approved by: [Accountant Name], Date: 2026-08-24'
);
*/

-- Example 3: ZERO_BASELINE decision (greenfield account):
/*
INSERT INTO public.finance_cash_opening_balance_decisions (
    tenant_id,
    decided_by,
    decision_type,
    applies_to_all_accounts,
    specific_bank_account_id,
    baseline_date,
    evidence_source,
    notes
) VALUES (
    'tenant-uuid',
    'architect-user-uuid',
    'ZERO_BASELINE',
    FALSE,  -- Specific account
    'bank-account-uuid',
    '2026-08-24'::DATE,
    'account_creation_record',
    'Greenfield bank account with no prior transactions. '
    'Account created: 2026-08-24. '
    'Zero opening balance is authoritative. '
    'Approved by: [Architect Name], Date: 2026-08-24'
);
*/

-- =========================================================================
-- ARCHITECTURAL BOUNDARIES (v1.2)
-- =========================================================================

-- ✅ Decision registry schema created
-- ✅ RLS enabled (tenant isolation)
-- ✅ Decision type validation enforced
-- ✅ Provenance documentation mandatory (notes NOT NULL)
-- ✅ Scope validation (all accounts vs specific account)
--
-- 🔴 BLOCKED: Baseline data seeding (Migration 4b awaits decision records in this table)
-- 🔴 BLOCKED: F5.6 reconstruction (depends on baselines established)
--
-- NEXT STEP: Human architect must record baseline provenance decision(s) in this table
-- before Migration 4b can execute opening balance seeding.

-- Migration complete. Provenance decision registry operational.
-- NO DECISIONS RECORDED. Awaiting human architectural decision for baseline strategy.
