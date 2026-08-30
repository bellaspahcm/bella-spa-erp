-- Migration: 20260818000000_finance_ap_engine_v1
-- Component: F4 — Accounts Payable Engine v1
-- Description:
--   Implements the F4 Accounts Payable (AP) subledger as part of the Finance Kernel.
--   Architecture: Vertical OS → Capability Contract → F4 AP → F1 GL / F2 Cash (via contracts)
--
-- Migration Order:
--   1. F1 Public Contract Extensions (validate_account_code, validate_account_id, validate_period_for_date)
--   2. Canonical finance_financial_lock_key + F3 compatibility bridge
--   3. F4 Core Tables with composite tenant FKs
--   4. Check constraints, unique indexes
--   5. Immutability & state transition triggers
--   6. Row-Level Security policies
--   7. SECURITY DEFINER RPC contracts (approve, disburse, reverse, prepayments, calculate, rebuild)
--   8. finance_vendor_bill_status dynamic view (security_invoker = true)
--   9. Verification assertions

-- =========================================================================
-- 1. F1 PUBLIC CONTRACT EXTENSIONS
--    F4 validates COA and fiscal periods ONLY through these public contracts.
--    Direct query of F1 tables (finance_accounts, finance_periods) is prohibited.
-- =========================================================================

-- 1.1 Validate account by code: returns F1 account UUID or NULL
CREATE OR REPLACE FUNCTION public.finance_validate_account_code(
    p_tenant_id UUID,
    p_account_code VARCHAR,
    p_expected_type VARCHAR  -- 'EXPENSE', 'ASSET', 'LIABILITY', etc.
) RETURNS UUID
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT id INTO v_account_id
    FROM public.finance_accounts
    WHERE tenant_id = p_tenant_id
      AND code = p_account_code
      AND is_active = TRUE
      AND (type = p_expected_type OR p_expected_type IS NULL);

    RETURN v_account_id; -- NULL if not found or inactive
END;
$$;

-- 1.2 Validate account by ID: returns TRUE if active and type-matched
CREATE OR REPLACE FUNCTION public.finance_validate_account_id(
    p_tenant_id UUID,
    p_account_id UUID,
    p_expected_type VARCHAR  -- 'ASSET', 'EXPENSE', etc.
) RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.finance_accounts
        WHERE tenant_id = p_tenant_id
          AND id = p_account_id
          AND is_active = TRUE
          AND (type = p_expected_type OR p_expected_type IS NULL)
    );
END;
$$;

-- 1.2a Resolve active account code by ID through the F1 public contract surface
CREATE OR REPLACE FUNCTION public.finance_get_account_code_by_id(
    p_tenant_id UUID,
    p_account_id UUID,
    p_expected_type VARCHAR
) RETURNS VARCHAR
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_account_code VARCHAR;
BEGIN
    SELECT code INTO v_account_code
    FROM public.finance_accounts
    WHERE tenant_id = p_tenant_id
      AND id = p_account_id
      AND is_active = TRUE
      AND (type = p_expected_type OR p_expected_type IS NULL);

    RETURN v_account_code;
END;
$$;

-- 1.3 Validate fiscal period for a given date: returns TRUE if period is OPEN
CREATE OR REPLACE FUNCTION public.finance_validate_period_for_date(
    p_tenant_id UUID,
    p_date TIMESTAMPTZ
) RETURNS BOOLEAN
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.finance_periods
        WHERE tenant_id = p_tenant_id
          AND start_date <= p_date::DATE
          AND end_date >= p_date::DATE
          AND status = 'OPEN'
    );
END;
$$;

-- =========================================================================
-- 2. CANONICAL FINANCE-WIDE LOCK KEY + F3 COMPATIBILITY BRIDGE
--    finance_financial_lock_key: tenant-namespaced hash for advisory locks.
--    Reproduces EXACTLY the legacy (tenant_key, movement_key) pair for CASH_MOVEMENT,
--    ensuring byte-for-byte compatibility with F3's finance_cash_allocation_lock_key.
-- =========================================================================

-- 2.1 Canonical lock key function
CREATE OR REPLACE FUNCTION public.finance_financial_lock_key(
    p_tenant_id     UUID,
    p_resource_type TEXT,  -- 'CASH_MOVEMENT' | 'VENDOR_BILL' | 'VENDOR' | 'INVOICE'
    p_resource_id   UUID
) RETURNS TABLE(key1 INT, key2 INT)
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    -- For CASH_MOVEMENT: must reproduce the EXACT same key pair as the legacy
    -- finance_cash_allocation_lock_key function to maintain F3 lock compatibility.
    -- key1 = hash(tenant_id) — same as legacy tenant_key
    -- key2 = hash(resource_id) — same as legacy movement_key
    IF p_resource_type = 'CASH_MOVEMENT' THEN
        RETURN QUERY SELECT
            ('x' || substr(md5(p_tenant_id::text), 1, 8))::bit(32)::int AS key1,
            ('x' || substr(md5(p_resource_id::text), 1, 8))::bit(32)::int AS key2;
    ELSE
        -- For other namespaces: prefix tenant_id with resource type for isolation
        RETURN QUERY SELECT
            ('x' || substr(md5(p_tenant_id::text || '.' || p_resource_type), 1, 8))::bit(32)::int AS key1,
            ('x' || substr(md5(p_resource_id::text), 1, 8))::bit(32)::int AS key2;
    END IF;
END;
$$;

-- 2.2 F3 Compatibility Bridge (change-controlled)
--   F3 Core Domain: FROZEN. This wrapper redirects to the canonical function.
--   F3 RPCs require zero edits. Both produce identical lock integers.
CREATE OR REPLACE FUNCTION public.finance_cash_allocation_lock_key(
    p_tenant_id        UUID,
    p_cash_movement_id UUID
) RETURNS TABLE(tenant_key INT, movement_key INT)
LANGUAGE sql IMMUTABLE AS $$
    SELECT key1 AS tenant_key, key2 AS movement_key
    FROM public.finance_financial_lock_key(p_tenant_id, 'CASH_MOVEMENT', p_cash_movement_id);
$$;

-- =========================================================================
-- 3. F4 CORE TABLES
--    All tables use composite (tenant_id, id) unique constraints to enable
--    tenant-consistent FK references (F4-I-4: Tenant FK Consistency).
-- =========================================================================

-- 3.1 Vendor Bills: invoice liability records from vendors
CREATE TABLE public.finance_vendor_bills (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vendor_id           UUID         NOT NULL,
    bill_number         VARCHAR(100) NOT NULL CHECK (bill_number <> ''),
    bill_date           TIMESTAMPTZ  NOT NULL,
    due_date            TIMESTAMPTZ  NOT NULL,
    currency            VARCHAR(3)   NOT NULL CHECK (currency <> ''),
    total_amount_minor  BIGINT       NOT NULL CHECK (total_amount_minor > 0),  -- F4-I-1: no zero/negative
    status              VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT', 'RECEIVED', 'APPROVED', 'REVERSED')),
    approved_by         UUID         NULL,
    posting_attempt_id  UUID         NULL,
    f1_transaction_id   UUID         NULL,
    description         TEXT,
    reference_type      VARCHAR(100),
    reference_id        VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Prevent duplicate bills
    CONSTRAINT uq_finance_vendor_bills_number   UNIQUE (tenant_id, vendor_id, bill_number),
    -- Tenant-scoped idempotency
    CONSTRAINT uq_finance_vendor_bills_attempt  UNIQUE (tenant_id, posting_attempt_id),
    -- Allow composite FK referencing from child tables (F4-I-4)
    CONSTRAINT uq_finance_vendor_bills_composite UNIQUE (tenant_id, id)
);

ALTER TABLE public.finance_vendor_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_vendor_bills" ON public.finance_vendor_bills
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.2 Vendor Bill Lines: itemized expense lines (no hard FK to F1 finance_accounts)
CREATE TABLE public.finance_vendor_bill_lines (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    vendor_bill_id       UUID        NOT NULL,
    expense_account_code VARCHAR(50) NOT NULL CHECK (expense_account_code <> ''),
    amount_minor         BIGINT      NOT NULL CHECK (amount_minor > 0),  -- F4-I-1
    cost_center_id       UUID        NULL,
    memo                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tenant-consistent FK (F4-I-4)
    CONSTRAINT fk_vendor_bill_lines_bill
        FOREIGN KEY (tenant_id, vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)
        ON DELETE CASCADE
);

ALTER TABLE public.finance_vendor_bill_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_vendor_bill_lines" ON public.finance_vendor_bill_lines
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.3 Payable Ledger: authoritative AP-domain facts log (NOT a replacement for F1 GL)
--   DEBIT_ADJUSTMENT / CREDIT_ADJUSTMENT are reserved for F4 v2; cannot be
--   inserted directly by clients in v1.
CREATE TABLE public.finance_payable_ledger (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL,
    vendor_bill_id    UUID        NOT NULL,
    entry_type        VARCHAR(30) NOT NULL
                          CHECK (entry_type IN (
                              'PAYABLE_ACCRUAL',
                              'DISBURSEMENT_ALLOCATION',
                              'DEBIT_ADJUSTMENT',    -- reserved F4 v2
                              'CREDIT_ADJUSTMENT',   -- reserved F4 v2
                              'REVERSAL'
                          )),
    amount_minor      BIGINT      NOT NULL CHECK (amount_minor > 0),  -- F4-I-1
    f1_transaction_id UUID        NOT NULL,
    source_type       VARCHAR(100),
    source_id         VARCHAR(255),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tenant-consistent FK (F4-I-4)
    CONSTRAINT fk_payable_ledger_bill
        FOREIGN KEY (tenant_id, vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)
        ON DELETE RESTRICT
);

ALTER TABLE public.finance_payable_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_payable_ledger" ON public.finance_payable_ledger
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.4 Payable Allocations: matches F2 cash outflows to vendor bills with full FX provenance
CREATE TABLE public.finance_payable_allocations (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID          NOT NULL,
    vendor_bill_id          UUID          NOT NULL,
    cash_outflow_id         UUID          NOT NULL,
    allocated_amount_minor  BIGINT        NOT NULL CHECK (allocated_amount_minor > 0),  -- F4-I-1
    cash_amount_minor       BIGINT        NOT NULL CHECK (cash_amount_minor > 0),        -- F4-I-1
    exchange_rate           NUMERIC(18,6) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    rate_source             VARCHAR(30)   NOT NULL
                                CHECK (rate_source IN ('SYSTEM', 'TREASURY', 'CENTRAL_BANK', 'MANUAL_AUTHORIZED')),
    rate_timestamp          TIMESTAMPTZ   NOT NULL,
    rate_direction          VARCHAR(30)   NOT NULL DEFAULT 'BILL_TO_CASH'
                                CHECK (rate_direction = 'BILL_TO_CASH'),
    posting_attempt_id      UUID          NOT NULL,
    allocation_type         VARCHAR(20)   NOT NULL
                                CHECK (allocation_type IN ('DISBURSEMENT', 'REVERSAL')),
    reversal_ref_id         UUID          NULL,
    f1_transaction_id       UUID          NOT NULL,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- Tenant-scoped idempotency
    CONSTRAINT uq_payable_allocations_attempt   UNIQUE (tenant_id, posting_attempt_id),
    -- One-time reversal: each DISBURSEMENT can be reversed at most once (F4-I-3)
    CONSTRAINT uq_payable_allocations_reversal  UNIQUE (reversal_ref_id) DEFERRABLE INITIALLY DEFERRED,
    -- Tenant-consistent FK to bills (F4-I-4)
    CONSTRAINT fk_payable_allocations_bill
        FOREIGN KEY (tenant_id, vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)
        ON DELETE RESTRICT,
    -- Allow composite FK self-referencing for reversal (F4-I-4)
    CONSTRAINT uq_payable_allocations_composite UNIQUE (tenant_id, id)
);

-- Reversal must reference an allocation within the same tenant (F4-I-4)
ALTER TABLE public.finance_payable_allocations
    ADD CONSTRAINT fk_payable_allocations_reversal
        FOREIGN KEY (tenant_id, reversal_ref_id)
        REFERENCES public.finance_payable_allocations(tenant_id, id)
        ON DELETE RESTRICT
        DEFERRABLE INITIALLY DEFERRED;

-- Reversal amount symmetry invariant (F4-I-3) enforced in RPC; also enforce NOT NULL uniqueness
CREATE UNIQUE INDEX idx_payable_alloc_reversal_ref
    ON public.finance_payable_allocations(reversal_ref_id)
    WHERE reversal_ref_id IS NOT NULL;

ALTER TABLE public.finance_payable_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_payable_allocations" ON public.finance_payable_allocations
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.5 Payable Positions: rebuildable projection cache (bill-level only)
--   Formula:
--     disbursed_amount_minor = SUM(DISBURSEMENT) - SUM(REVERSAL)
--     adjusted_amount_minor  = SUM(DEBIT_ADJUSTMENT) - SUM(CREDIT_ADJUSTMENT) [reserved v2]
--     outstanding_amount_minor = original - disbursed - adjusted
--   Position cache is NOT authoritative; it is always fully rebuildable from facts.
CREATE TABLE public.finance_payable_positions (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID        NOT NULL,
    vendor_bill_id           UUID        NOT NULL,
    original_amount_minor    BIGINT      NOT NULL CHECK (original_amount_minor > 0),
    disbursed_amount_minor   BIGINT      NOT NULL DEFAULT 0 CHECK (disbursed_amount_minor >= 0),
    adjusted_amount_minor    BIGINT      NOT NULL DEFAULT 0,
    outstanding_amount_minor BIGINT      NOT NULL,
    version                  INT         NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One position row per bill per tenant
    CONSTRAINT uq_payable_positions_bill UNIQUE (tenant_id, vendor_bill_id),
    -- Tenant-consistent FK (F4-I-4)
    CONSTRAINT fk_payable_positions_bill
        FOREIGN KEY (tenant_id, vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)
        ON DELETE RESTRICT
);

ALTER TABLE public.finance_payable_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_payable_positions" ON public.finance_payable_positions
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.5a Prepayment Posting Policy Mapping
--   F4 owns lifecycle mechanics. Tenant accounting policy owns account treatment.
CREATE TABLE public.finance_prepayment_posting_policy_mappings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type          VARCHAR(50) NOT NULL CHECK (event_type IN (
                            'VENDOR_PREPAYMENT_RECORDED',
                            'VENDOR_PREPAYMENT_APPLIED',
                            'VENDOR_PREPAYMENT_REFUNDED'
                        )),
    debit_account_code  VARCHAR(50) NOT NULL,
    credit_account_code VARCHAR(50) NULL,
    valid_from          TIMESTAMPTZ NOT NULL,
    valid_to            TIMESTAMPTZ NULL,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_prepayment_policy_valid_window
        CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT uq_prepayment_policy_mapping
        UNIQUE (tenant_id, event_type, valid_from)
);

CREATE INDEX idx_prepayment_policy_lookup
    ON public.finance_prepayment_posting_policy_mappings(tenant_id, event_type, valid_from, valid_to)
    WHERE is_active = TRUE;

ALTER TABLE public.finance_prepayment_posting_policy_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_prepayment_posting_policy_mappings"
    ON public.finance_prepayment_posting_policy_mappings
    FOR ALL TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE OR REPLACE FUNCTION public.finance_prevent_prepayment_policy_overlap()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_active = FALSE THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.finance_prepayment_posting_policy_mappings existing
        WHERE existing.tenant_id = NEW.tenant_id
          AND existing.event_type = NEW.event_type
          AND existing.is_active = TRUE
          AND existing.id <> NEW.id
          AND tstzrange(existing.valid_from, existing.valid_to, '[)')
              && tstzrange(NEW.valid_from, NEW.valid_to, '[)')
    ) THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_OVERLAP: tenant %, event %, valid_from %, valid_to %',
            NEW.tenant_id, NEW.event_type, NEW.valid_from, NEW.valid_to
            USING ERRCODE = 'F4077';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_prepayment_policy_overlap
    BEFORE INSERT OR UPDATE ON public.finance_prepayment_posting_policy_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_prevent_prepayment_policy_overlap();

-- 3.6 Vendor Prepayments: append-only prepayment event log
--   Prepayment balance:
--     available = SUM(RECORDED) - SUM(APPLIED) - SUM(REFUNDED)
--   PREPAYMENT_APPLIED must not exceed available balance.
--   PREPAYMENT_REFUNDED must not exceed available balance.
CREATE TABLE public.finance_vendor_prepayments (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vendor_id             UUID        NOT NULL,
    fact_type             VARCHAR(30) NOT NULL
                              CHECK (fact_type IN (
                                  'PREPAYMENT_RECORDED',
                                  'PREPAYMENT_APPLIED',
                                  'PREPAYMENT_REFUNDED'
                              )),
    amount_minor          BIGINT      NOT NULL CHECK (amount_minor > 0),  -- F4-I-1
    posting_attempt_id    UUID        NOT NULL,
    f1_transaction_id     UUID        NOT NULL,
    matched_vendor_bill_id UUID       NULL,
    source_type           VARCHAR(100),
    source_id             VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Tenant-scoped idempotency
    CONSTRAINT uq_vendor_prepayments_attempt UNIQUE (tenant_id, posting_attempt_id),
    -- Tenant-consistent FK for matched bill (F4-I-4)
    CONSTRAINT uq_vendor_prepayments_composite UNIQUE (tenant_id, id)
);

-- Tenant-consistent FK on matched_vendor_bill_id
ALTER TABLE public.finance_vendor_prepayments
    ADD CONSTRAINT fk_vendor_prepayments_bill
        FOREIGN KEY (tenant_id, matched_vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)
        ON DELETE RESTRICT;

ALTER TABLE public.finance_vendor_prepayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_vendor_prepayments" ON public.finance_vendor_prepayments
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. IMMUTABILITY & STATE TRANSITION TRIGGERS
-- =========================================================================

-- 4.1 Bill lines guard: prevent mutation of lines after APPROVED/REVERSED
CREATE OR REPLACE FUNCTION public.finance_ap_bill_lines_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_bill_status VARCHAR(20);
BEGIN
    SELECT status INTO v_bill_status
    FROM public.finance_vendor_bills
    WHERE id = COALESCE(NEW.vendor_bill_id, OLD.vendor_bill_id)
      AND tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id);

    IF v_bill_status IN ('APPROVED', 'REVERSED') THEN
        RAISE EXCEPTION 'BILL_LINES_IMMUTABLE: Cannot mutate lines of an APPROVED or REVERSED vendor bill.'
            USING ERRCODE = 'F4101';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_finance_vendor_bill_lines_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.finance_vendor_bill_lines
    FOR EACH ROW EXECUTE FUNCTION public.finance_ap_bill_lines_guard();

-- 4.2 Bill header immutability guard: prevent mutation of financial fields after approval
CREATE OR REPLACE FUNCTION public.finance_ap_bill_header_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_allowed_statuses VARCHAR[] := ARRAY['DRAFT', 'RECEIVED', 'APPROVED', 'REVERSED'];
    -- Valid forward-only state transitions
    v_transitions JSONB := '{
        "DRAFT":     ["RECEIVED"],
        "RECEIVED":  ["APPROVED"],
        "APPROVED":  ["REVERSED"],
        "REVERSED":  []
    }'::JSONB;
BEGIN
    -- Guard against invalid status values
    IF NEW.status IS NOT NULL AND NOT (NEW.status = ANY(v_allowed_statuses)) THEN
        RAISE EXCEPTION 'INVALID_BILL_STATUS: status must be DRAFT, RECEIVED, APPROVED, or REVERSED. Got: %', NEW.status
            USING ERRCODE = 'F4102';
    END IF;

    -- Guard against backward status transitions
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NOT (v_transitions->>OLD.status)::JSONB ? NEW.status THEN
            RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: Cannot transition from % to %', OLD.status, NEW.status
                USING ERRCODE = 'F4103';
        END IF;
    END IF;

    -- Guard immutable financial fields after APPROVED/REVERSED
    IF OLD.status IN ('APPROVED', 'REVERSED') THEN
        IF (NEW.vendor_id            IS DISTINCT FROM OLD.vendor_id         OR
            NEW.currency             IS DISTINCT FROM OLD.currency           OR
            NEW.total_amount_minor   IS DISTINCT FROM OLD.total_amount_minor OR
            NEW.bill_number          IS DISTINCT FROM OLD.bill_number        OR
            NEW.bill_date            IS DISTINCT FROM OLD.bill_date          OR
            NEW.due_date             IS DISTINCT FROM OLD.due_date) THEN
            RAISE EXCEPTION 'BILL_FINANCIAL_IMMUTABLE: Cannot modify financial fields of an APPROVED or REVERSED vendor bill.'
                USING ERRCODE = 'F4104';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_finance_vendor_bill_header_guard
    BEFORE UPDATE ON public.finance_vendor_bills
    FOR EACH ROW EXECUTE FUNCTION public.finance_ap_bill_header_guard();

-- =========================================================================
-- 5. SECURITY DEFINER POSTING RPCs
-- =========================================================================

-- 5.1 Approve vendor bill
CREATE OR REPLACE FUNCTION public.finance_approve_vendor_bill(
    p_tenant_id         UUID,
    p_bill_id           UUID,
    p_approved_by       UUID,
    p_posting_attempt_id UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_bill              RECORD;
    v_line              RECORD;
    v_lines_sum         BIGINT := 0;
    v_account_id        UUID;
    v_f1_tx_id          UUID;
    v_is_duplicate      BOOLEAN := FALSE;
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    -- IDEMPOTENCY CHECK FIRST (before any validation)
    SELECT id INTO v_f1_tx_id
    FROM public.finance_vendor_bills
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_f1_tx_id IS NOT NULL THEN
        -- Return canonical result without re-executing
        SELECT f1_transaction_id INTO v_f1_tx_id
        FROM public.finance_vendor_bills
        WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

        RETURN jsonb_build_object(
            'success',        TRUE,
            'transaction_id', v_f1_tx_id,
            'bill_id',        p_bill_id,
            'status',         'APPROVED',
            'is_duplicate',   TRUE
        );
    END IF;

    -- Lock and read bill
    SELECT * INTO v_bill
    FROM public.finance_vendor_bills
    WHERE id = p_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'BILL_NOT_FOUND' USING ERRCODE = 'F4010';
    END IF;

    IF v_bill.status <> 'RECEIVED' THEN
        RAISE EXCEPTION 'INVALID_BILL_STATUS: Bill must be in RECEIVED status to approve. Current: %', v_bill.status
            USING ERRCODE = 'F4011';
    END IF;

    -- Fiscal period validation via F1 public contract
    IF NOT public.finance_validate_period_for_date(p_tenant_id, v_bill.bill_date) THEN
        RAISE EXCEPTION 'PERIOD_CLOSED_OR_LOCKED: Fiscal period for bill date is not OPEN.'
            USING ERRCODE = 'F4012';
    END IF;

    -- Validate lines and sum (I-AP-8)
    FOR v_line IN
        SELECT * FROM public.finance_vendor_bill_lines
        WHERE tenant_id = p_tenant_id AND vendor_bill_id = p_bill_id
    LOOP
        -- Validate expense account via F1 contract (no direct F1 table query)
        v_account_id := public.finance_validate_account_code(p_tenant_id, v_line.expense_account_code, 'EXPENSE');
        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'EXPENSE_ACCOUNT_NOT_FOUND_OR_INACTIVE: Account code % is invalid or inactive.', v_line.expense_account_code
                USING ERRCODE = 'F4013';
        END IF;

        v_lines_sum := v_lines_sum + v_line.amount_minor;
    END LOOP;

    IF v_lines_sum = 0 THEN
        RAISE EXCEPTION 'BILL_HAS_NO_LINES: Cannot approve a bill with no line items.'
            USING ERRCODE = 'F4014';
    END IF;

    IF v_lines_sum <> v_bill.total_amount_minor THEN
        RAISE EXCEPTION 'DOUBLE_ENTRY_IMBALANCE: Lines sum (%) does not match bill total (%).',
            v_lines_sum, v_bill.total_amount_minor
            USING ERRCODE = 'F4015';
    END IF;

    -- Post to F1 General Ledger (Debit Expense / Credit AP Control 331)
    v_f1_tx_id := public.finance_post_transaction(
        p_tenant_id,
        'ACCRUAL',
        v_bill.bill_date,
        'AP_BILL_APPROVAL: ' || COALESCE(v_bill.description, v_bill.bill_number),
        p_posting_attempt_id::TEXT,
        jsonb_build_array(
            jsonb_build_object('account_code', 'EXPENSE', 'direction', 'DEBIT',  'amount_minor', v_bill.total_amount_minor, 'currency', v_bill.currency),
            jsonb_build_object('account_code', '331',     'direction', 'CREDIT', 'amount_minor', v_bill.total_amount_minor, 'currency', v_bill.currency)
        )
    );

    -- Update bill header to APPROVED
    UPDATE public.finance_vendor_bills SET
        status              = 'APPROVED',
        approved_by         = p_approved_by,
        posting_attempt_id  = p_posting_attempt_id,
        f1_transaction_id   = v_f1_tx_id
    WHERE id = p_bill_id AND tenant_id = p_tenant_id;

    -- Append PAYABLE_ACCRUAL fact to AP subledger
    INSERT INTO public.finance_payable_ledger (
        tenant_id, vendor_bill_id, entry_type, amount_minor, f1_transaction_id, source_type, source_id
    ) VALUES (
        p_tenant_id, p_bill_id, 'PAYABLE_ACCRUAL', v_bill.total_amount_minor, v_f1_tx_id, 'VENDOR_BILL', p_bill_id
    );

    -- Initialize position cache
    INSERT INTO public.finance_payable_positions (
        tenant_id, vendor_bill_id, original_amount_minor, disbursed_amount_minor,
        adjusted_amount_minor, outstanding_amount_minor
    ) VALUES (
        p_tenant_id, p_bill_id, v_bill.total_amount_minor, 0, 0, v_bill.total_amount_minor
    )
    ON CONFLICT (tenant_id, vendor_bill_id) DO UPDATE SET
        original_amount_minor    = EXCLUDED.original_amount_minor,
        outstanding_amount_minor = EXCLUDED.original_amount_minor,
        version = finance_payable_positions.version + 1,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success',        TRUE,
        'transaction_id', v_f1_tx_id,
        'bill_id',        p_bill_id,
        'status',         'APPROVED',
        'is_duplicate',   FALSE
    );
END;
$$;

-- 5.2 Disburse payment: allocate F2 cash outflow to vendor bill
CREATE OR REPLACE FUNCTION public.finance_disburse_payment(
    p_tenant_id              UUID,
    p_bill_id                UUID,
    p_cash_outflow_id        UUID,
    p_allocated_amount_minor BIGINT,
    p_cash_amount_minor      BIGINT,
    p_exchange_rate          NUMERIC,
    p_rate_source            VARCHAR,
    p_rate_timestamp         TIMESTAMPTZ,
    p_posting_attempt_id     UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1              INT;
    v_key2              INT;
    v_cash_json         JSONB;
    v_bill              RECORD;
    v_pos               RECORD;
    v_already_allocated BIGINT;
    v_outflow_ceiling   BIGINT;
    v_outstanding       BIGINT;
    v_alloc_id          UUID;
    v_f1_tx_id          UUID;
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    -- F4-I-1: positive amounts required
    IF p_allocated_amount_minor <= 0 OR p_cash_amount_minor <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Allocated amounts must be positive.' USING ERRCODE = 'F4030';
    END IF;

    -- F4-I-2: rate_source whitelist enforced by CHECK constraint; rate defaults
    IF p_exchange_rate <= 0 THEN
        RAISE EXCEPTION 'INVALID_EXCHANGE_RATE' USING ERRCODE = 'F4031';
    END IF;

    -- IDEMPOTENCY CHECK FIRST
    SELECT id, f1_transaction_id INTO v_alloc_id, v_f1_tx_id
    FROM public.finance_payable_allocations
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_alloc_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',       TRUE,
            'allocation_id', v_alloc_id,
            'transaction_id', v_f1_tx_id,
            'is_duplicate',  TRUE
        );
    END IF;

    -- GLOBAL LOCK ORDER 1: Advisory lock on CASH_MOVEMENT (I-AP-21)
    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'CASH_MOVEMENT', p_cash_outflow_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    -- GLOBAL LOCK ORDER 2: Bill row lock
    SELECT * INTO v_bill
    FROM public.finance_vendor_bills
    WHERE id = p_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'BILL_NOT_FOUND' USING ERRCODE = 'F4010';
    END IF;
    IF v_bill.status <> 'APPROVED' THEN
        RAISE EXCEPTION 'INVALID_BILL_STATUS: Bill must be APPROVED to disburse.' USING ERRCODE = 'F4011';
    END IF;

    -- GLOBAL LOCK ORDER 3: Position row lock
    SELECT * INTO v_pos
    FROM public.finance_payable_positions
    WHERE vendor_bill_id = p_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_pos.id IS NULL THEN
        RAISE EXCEPTION 'PAYABLE_POSITION_NOT_FOUND' USING ERRCODE = 'F4020';
    END IF;

    -- F2 read contract (zero direct F2 table queries)
    v_cash_json := public.finance_get_cash_movement(p_tenant_id, p_cash_outflow_id);
    IF v_cash_json IS NULL THEN
        RAISE EXCEPTION 'CASH_MOVEMENT_NOT_FOUND' USING ERRCODE = 'F4021';
    END IF;
    IF v_cash_json->>'direction' <> 'OUTFLOW' THEN
        RAISE EXCEPTION 'INVALID_CASH_DIRECTION: Only OUTFLOW movements can be used for AP disbursement.' USING ERRCODE = 'F4022';
    END IF;

    -- F4-I-2: Currency consistency check
    IF v_bill.currency <> (v_cash_json->>'currency') AND p_exchange_rate = 1.0 THEN
        RAISE EXCEPTION 'FX_RATE_REQUIRED: Bill currency (%) differs from cash currency (%). Provide exchange_rate != 1.',
            v_bill.currency, v_cash_json->>'currency'
            USING ERRCODE = 'F4023';
    END IF;

    -- I-AP-21: Check outflow ceiling (prevent double-spending across multiple bills)
    SELECT COALESCE(SUM(
        CASE WHEN allocation_type = 'DISBURSEMENT' THEN cash_amount_minor
             WHEN allocation_type = 'REVERSAL'     THEN -cash_amount_minor
        END
    ), 0) INTO v_already_allocated
    FROM public.finance_payable_allocations
    WHERE cash_outflow_id = p_cash_outflow_id AND tenant_id = p_tenant_id;

    v_outflow_ceiling := (v_cash_json->>'amount_minor')::BIGINT;

    IF v_already_allocated + p_cash_amount_minor > v_outflow_ceiling THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_OUTFLOW_CEILING: Allocation (%) exceeds remaining outflow capacity (%).',
            p_cash_amount_minor, v_outflow_ceiling - v_already_allocated
            USING ERRCODE = 'F4024';
    END IF;

    -- I-AP-2: Check bill outstanding balance ceiling
    v_outstanding := v_pos.outstanding_amount_minor;
    IF p_allocated_amount_minor > v_outstanding THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_BILL_BALANCE: Allocation (%) exceeds outstanding balance (%).',
            p_allocated_amount_minor, v_outstanding
            USING ERRCODE = 'F4025';
    END IF;

    -- Post to F1 GL (Debit AP Control 331 / Credit Bank)
    v_f1_tx_id := public.finance_post_transaction(
        p_tenant_id,
        'CASH',
        NOW(),
        'AP_DISBURSEMENT: Bill ' || p_bill_id::TEXT,
        p_posting_attempt_id::TEXT,
        jsonb_build_array(
            jsonb_build_object('account_code', '331',  'direction', 'DEBIT',  'amount_minor', p_allocated_amount_minor, 'currency', v_bill.currency),
            jsonb_build_object('account_code', 'BANK', 'direction', 'CREDIT', 'amount_minor', p_cash_amount_minor,      'currency', v_cash_json->>'currency')
        )
    );

    -- Insert allocation fact (DISBURSEMENT)
    INSERT INTO public.finance_payable_allocations (
        tenant_id, vendor_bill_id, cash_outflow_id,
        allocated_amount_minor, cash_amount_minor,
        exchange_rate, rate_source, rate_timestamp, rate_direction,
        posting_attempt_id, allocation_type, f1_transaction_id
    ) VALUES (
        p_tenant_id, p_bill_id, p_cash_outflow_id,
        p_allocated_amount_minor, p_cash_amount_minor,
        p_exchange_rate, p_rate_source, p_rate_timestamp, 'BILL_TO_CASH',
        p_posting_attempt_id, 'DISBURSEMENT', v_f1_tx_id
    ) RETURNING id INTO v_alloc_id;

    -- Append DISBURSEMENT_ALLOCATION ledger fact
    INSERT INTO public.finance_payable_ledger (
        tenant_id, vendor_bill_id, entry_type, amount_minor, f1_transaction_id, source_type, source_id
    ) VALUES (
        p_tenant_id, p_bill_id, 'DISBURSEMENT_ALLOCATION', p_allocated_amount_minor, v_f1_tx_id, 'ALLOCATION', v_alloc_id
    );

    -- Update position cache
    UPDATE public.finance_payable_positions SET
        disbursed_amount_minor   = disbursed_amount_minor + p_allocated_amount_minor,
        outstanding_amount_minor = outstanding_amount_minor - p_allocated_amount_minor,
        version                  = version + 1,
        updated_at               = NOW()
    WHERE id = v_pos.id;

    RETURN jsonb_build_object(
        'success',       TRUE,
        'allocation_id', v_alloc_id,
        'transaction_id', v_f1_tx_id,
        'is_duplicate',  FALSE
    );
END;
$$;

-- 5.3 Reverse disbursement: append-only reversal with canonical lock ordering
CREATE OR REPLACE FUNCTION public.finance_reverse_disbursement(
    p_tenant_id          UUID,
    p_allocation_id      UUID,
    p_posting_attempt_id UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1          INT;
    v_key2          INT;
    v_orig          RECORD;
    v_bill          RECORD;
    v_pos           RECORD;
    v_rev_alloc_id  UUID;
    v_f1_tx_id      UUID;
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    -- IDEMPOTENCY CHECK FIRST
    SELECT id, f1_transaction_id INTO v_rev_alloc_id, v_f1_tx_id
    FROM public.finance_payable_allocations
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_rev_alloc_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success',              TRUE,
            'reversal_allocation_id', v_rev_alloc_id,
            'transaction_id',       v_f1_tx_id,
            'is_duplicate',         TRUE
        );
    END IF;

    -- Read original allocation details (before locking)
    SELECT * INTO v_orig
    FROM public.finance_payable_allocations
    WHERE id = p_allocation_id AND tenant_id = p_tenant_id;

    IF v_orig.id IS NULL THEN
        RAISE EXCEPTION 'ALLOCATION_NOT_FOUND' USING ERRCODE = 'F4040';
    END IF;
    IF v_orig.allocation_type <> 'DISBURSEMENT' THEN
        RAISE EXCEPTION 'CANNOT_REVERSE_NON_DISBURSEMENT' USING ERRCODE = 'F4041';
    END IF;
    IF v_orig.reversal_ref_id IS NOT NULL THEN
        RAISE EXCEPTION 'ALLOCATION_ALREADY_REVERSED' USING ERRCODE = 'F4042';
    END IF;
    -- Double-check via UNIQUE index
    IF EXISTS (
        SELECT 1 FROM public.finance_payable_allocations
        WHERE reversal_ref_id = p_allocation_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'ALLOCATION_ALREADY_REVERSED' USING ERRCODE = 'F4042';
    END IF;

    -- GLOBAL LOCK ORDER 1: Advisory lock on CASH_MOVEMENT
    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'CASH_MOVEMENT', v_orig.cash_outflow_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    -- GLOBAL LOCK ORDER 2: Bill row lock
    SELECT * INTO v_bill
    FROM public.finance_vendor_bills
    WHERE id = v_orig.vendor_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- GLOBAL LOCK ORDER 3: Position row lock
    SELECT * INTO v_pos
    FROM public.finance_payable_positions
    WHERE vendor_bill_id = v_orig.vendor_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- GLOBAL LOCK ORDER 4: Allocation row lock
    PERFORM 1 FROM public.finance_payable_allocations
    WHERE id = p_allocation_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- F1 reversal (F4-I-3: symmetric amount and FX semantics)
    v_f1_tx_id := public.finance_reverse_transaction(
        p_tenant_id,
        v_orig.f1_transaction_id,
        p_posting_attempt_id::TEXT
    );

    -- Insert REVERSAL allocation (F4-I-3: amount symmetry with original)
    INSERT INTO public.finance_payable_allocations (
        tenant_id, vendor_bill_id, cash_outflow_id,
        allocated_amount_minor, cash_amount_minor,
        exchange_rate, rate_source, rate_timestamp, rate_direction,
        posting_attempt_id, allocation_type, reversal_ref_id, f1_transaction_id
    ) VALUES (
        p_tenant_id, v_orig.vendor_bill_id, v_orig.cash_outflow_id,
        v_orig.allocated_amount_minor, v_orig.cash_amount_minor,  -- exact symmetric amount (F4-I-3)
        v_orig.exchange_rate, v_orig.rate_source, NOW(), v_orig.rate_direction,
        p_posting_attempt_id, 'REVERSAL', p_allocation_id, v_f1_tx_id
    ) RETURNING id INTO v_rev_alloc_id;

    -- Append REVERSAL ledger fact
    INSERT INTO public.finance_payable_ledger (
        tenant_id, vendor_bill_id, entry_type, amount_minor, f1_transaction_id, source_type, source_id
    ) VALUES (
        p_tenant_id, v_orig.vendor_bill_id, 'REVERSAL', v_orig.allocated_amount_minor,
        v_f1_tx_id, 'ALLOCATION', v_rev_alloc_id
    );

    -- Update position cache (restore outstanding balance)
    UPDATE public.finance_payable_positions SET
        disbursed_amount_minor   = disbursed_amount_minor - v_orig.allocated_amount_minor,
        outstanding_amount_minor = outstanding_amount_minor + v_orig.allocated_amount_minor,
        version                  = version + 1,
        updated_at               = NOW()
    WHERE id = v_pos.id;

    RETURN jsonb_build_object(
        'success',              TRUE,
        'reversal_allocation_id', v_rev_alloc_id,
        'transaction_id',       v_f1_tx_id,
        'is_duplicate',         FALSE
    );
END;
$$;

-- 5.3a Resolve prepayment posting accounts from tenant accounting policy
CREATE OR REPLACE FUNCTION public.finance_resolve_prepayment_posting_accounts(
    p_tenant_id       UUID,
    p_event_type      VARCHAR,
    p_effective_date  TIMESTAMPTZ
) RETURNS TABLE (
    debit_account_code  VARCHAR,
    credit_account_code VARCHAR
)
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mapping RECORD;
    v_overlap_count INT;
BEGIN
    IF p_tenant_id IS NULL OR p_event_type IS NULL OR p_effective_date IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_RESOLUTION_NULL_INPUT' USING ERRCODE = 'F4070';
    END IF;

    IF p_event_type NOT IN (
        'VENDOR_PREPAYMENT_RECORDED',
        'VENDOR_PREPAYMENT_APPLIED',
        'VENDOR_PREPAYMENT_REFUNDED'
    ) THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_EVENT_UNSUPPORTED: %', p_event_type USING ERRCODE = 'F4071';
    END IF;

    SELECT COUNT(*) INTO v_overlap_count
    FROM public.finance_prepayment_posting_policy_mappings
    WHERE tenant_id = p_tenant_id
      AND event_type = p_event_type
      AND is_active = TRUE
      AND valid_from <= p_effective_date
      AND (valid_to IS NULL OR valid_to > p_effective_date);

    IF v_overlap_count = 0 THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_NOT_FOUND: tenant %, event %, effective_date %',
            p_tenant_id, p_event_type, p_effective_date
            USING ERRCODE = 'F4072';
    ELSIF v_overlap_count > 1 THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_MAPPING_AMBIGUOUS: tenant %, event %, effective_date %',
            p_tenant_id, p_event_type, p_effective_date
            USING ERRCODE = 'F4073';
    END IF;

    SELECT * INTO v_mapping
    FROM public.finance_prepayment_posting_policy_mappings
    WHERE tenant_id = p_tenant_id
      AND event_type = p_event_type
      AND is_active = TRUE
      AND valid_from <= p_effective_date
      AND (valid_to IS NULL OR valid_to > p_effective_date)
    LIMIT 1;

    IF public.finance_validate_account_code(p_tenant_id, v_mapping.debit_account_code, NULL) IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_DEBIT_ACCOUNT_INVALID: %', v_mapping.debit_account_code
            USING ERRCODE = 'F4074';
    END IF;

    IF v_mapping.credit_account_code IS NOT NULL
       AND public.finance_validate_account_code(p_tenant_id, v_mapping.credit_account_code, NULL) IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_CREDIT_ACCOUNT_INVALID: %', v_mapping.credit_account_code
            USING ERRCODE = 'F4075';
    END IF;

    RETURN QUERY SELECT v_mapping.debit_account_code, v_mapping.credit_account_code;
END;
$$;

-- 5.4 Record prepayment
CREATE OR REPLACE FUNCTION public.finance_record_prepayment(
    p_tenant_id              UUID,
    p_vendor_id              UUID,
    p_amount_minor           BIGINT,
    p_bank_finance_account_id UUID,
    p_posting_attempt_id     UUID,
    p_source_type            VARCHAR,
    p_source_id              VARCHAR
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1         INT;
    v_key2         INT;
    v_fact_id      UUID;
    v_f1_tx_id     UUID;
    v_policy       RECORD;
    v_effective_date TIMESTAMPTZ;
    v_bank_account_code VARCHAR;
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    IF p_amount_minor <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'F4030';
    END IF;

    -- IDEMPOTENCY CHECK FIRST
    SELECT id, f1_transaction_id INTO v_fact_id, v_f1_tx_id
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_fact_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', TRUE, 'prepayment_fact_id', v_fact_id,
            'transaction_id', v_f1_tx_id, 'is_duplicate', TRUE);
    END IF;

    -- LOCK ORDER 1: Advisory lock on VENDOR (no direct finance_vendors query)
    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'VENDOR', p_vendor_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    -- Validate bank account via F1 contract (no direct F2 bank account query)
    IF NOT public.finance_validate_account_id(p_tenant_id, p_bank_finance_account_id, 'ASSET') THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_INVALID_OR_INACTIVE' USING ERRCODE = 'F4050';
    END IF;

    v_bank_account_code := public.finance_get_account_code_by_id(
        p_tenant_id,
        p_bank_finance_account_id,
        'ASSET'
    );
    IF v_bank_account_code IS NULL THEN
        RAISE EXCEPTION 'BANK_ACCOUNT_INVALID_OR_INACTIVE' USING ERRCODE = 'F4050';
    END IF;

    v_effective_date := NOW();
    SELECT * INTO v_policy
    FROM public.finance_resolve_prepayment_posting_accounts(
        p_tenant_id,
        'VENDOR_PREPAYMENT_RECORDED',
        v_effective_date
    );

    IF v_policy.credit_account_code IS NOT NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_RECORDED_CREDIT_UNSUPPORTED: event %',
            'VENDOR_PREPAYMENT_RECORDED'
            USING ERRCODE = 'F4078';
    END IF;

    -- Post to F1 GL using tenant policy-resolved treatment
    v_f1_tx_id := public.finance_post_transaction(
        p_tenant_id, 'CASH', v_effective_date,
        'AP_PREPAYMENT_RECORDED: Vendor ' || p_vendor_id::TEXT,
        p_posting_attempt_id::TEXT,
        jsonb_build_array(
            jsonb_build_object('account_code', v_policy.debit_account_code, 'direction', 'DEBIT',  'amount_minor', p_amount_minor),
            jsonb_build_object('account_code', v_bank_account_code, 'direction', 'CREDIT', 'amount_minor', p_amount_minor)
        )
    );

    -- Append PREPAYMENT_RECORDED fact
    INSERT INTO public.finance_vendor_prepayments (
        tenant_id, vendor_id, fact_type, amount_minor,
        posting_attempt_id, f1_transaction_id, source_type, source_id
    ) VALUES (
        p_tenant_id, p_vendor_id, 'PREPAYMENT_RECORDED', p_amount_minor,
        p_posting_attempt_id, v_f1_tx_id, p_source_type, p_source_id
    ) RETURNING id INTO v_fact_id;

    RETURN jsonb_build_object('success', TRUE, 'prepayment_fact_id', v_fact_id,
        'transaction_id', v_f1_tx_id, 'is_duplicate', FALSE);
END;
$$;

-- 5.5 Apply prepayment to a vendor bill
CREATE OR REPLACE FUNCTION public.finance_apply_prepayment(
    p_tenant_id           UUID,
    p_bill_id             UUID,
    p_prepayment_fact_id  UUID,
    p_amount_minor        BIGINT,
    p_posting_attempt_id  UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_key1              INT;
    v_key2              INT;
    v_bill              RECORD;
    v_prepayment        RECORD;
    v_available         BIGINT;
    v_outstanding       BIGINT;
    v_fact_id           UUID;
    v_f1_tx_id          UUID;
    v_policy            RECORD;
    v_effective_date    TIMESTAMPTZ;
BEGIN
    -- Security guard
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    IF p_amount_minor <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'F4030';
    END IF;

    -- IDEMPOTENCY CHECK FIRST
    SELECT id, f1_transaction_id INTO v_fact_id, v_f1_tx_id
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND posting_attempt_id = p_posting_attempt_id;

    IF v_fact_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', TRUE, 'prepayment_fact_id', v_fact_id,
            'transaction_id', v_f1_tx_id, 'is_duplicate', TRUE);
    END IF;

    -- Read original prepayment fact
    SELECT * INTO v_prepayment
    FROM public.finance_vendor_prepayments
    WHERE id = p_prepayment_fact_id AND tenant_id = p_tenant_id
      AND fact_type = 'PREPAYMENT_RECORDED';

    IF v_prepayment.id IS NULL THEN
        RAISE EXCEPTION 'PREPAYMENT_NOT_FOUND' USING ERRCODE = 'F4060';
    END IF;

    -- LOCK ORDER 1: Advisory lock on VENDOR
    SELECT key1, key2 INTO v_key1, v_key2
    FROM public.finance_financial_lock_key(p_tenant_id, 'VENDOR', v_prepayment.vendor_id);
    PERFORM pg_advisory_xact_lock(v_key1, v_key2);

    -- LOCK ORDER 2: Bill row lock
    SELECT * INTO v_bill
    FROM public.finance_vendor_bills
    WHERE id = p_bill_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_bill.id IS NULL THEN
        RAISE EXCEPTION 'BILL_NOT_FOUND' USING ERRCODE = 'F4010';
    END IF;

    -- P0: Cross-vendor prepayment validation
    IF v_prepayment.vendor_id <> v_bill.vendor_id THEN
        RAISE EXCEPTION 'ERROR_AP_CROSS_VENDOR_PREPAYMENT: Prepayment vendor (%) does not match bill vendor (%).',
            v_prepayment.vendor_id, v_bill.vendor_id
            USING ERRCODE = 'F4061';
    END IF;

    -- LOCK ORDER 3: Prepayment fact row lock (lock on vendor_id scoped facts)
    PERFORM 1 FROM public.finance_vendor_prepayments
    WHERE id = p_prepayment_fact_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- Calculate available prepayment balance for this vendor
    SELECT COALESCE(SUM(
        CASE fact_type
            WHEN 'PREPAYMENT_RECORDED' THEN  amount_minor
            WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor
            WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor
        END
    ), 0) INTO v_available
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND vendor_id = v_prepayment.vendor_id;

    IF p_amount_minor > v_available THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_PREPAYMENT_BALANCE: Application (%) exceeds available prepayment (%).',
            p_amount_minor, v_available
            USING ERRCODE = 'F4062';
    END IF;

    -- Check outstanding balance on bill position
    SELECT outstanding_amount_minor INTO v_outstanding
    FROM public.finance_payable_positions
    WHERE vendor_bill_id = p_bill_id AND tenant_id = p_tenant_id;

    IF p_amount_minor > v_outstanding THEN
        RAISE EXCEPTION 'ERROR_AP_EXCEEDS_BILL_BALANCE: Application (%) exceeds bill outstanding (%).',
            p_amount_minor, v_outstanding
            USING ERRCODE = 'F4025';
    END IF;

    v_effective_date := NOW();
    SELECT * INTO v_policy
    FROM public.finance_resolve_prepayment_posting_accounts(
        p_tenant_id,
        'VENDOR_PREPAYMENT_APPLIED',
        v_effective_date
    );

    IF v_policy.credit_account_code IS NULL THEN
        RAISE EXCEPTION 'F4_PREPAYMENT_POLICY_CREDIT_ACCOUNT_REQUIRED: event %',
            'VENDOR_PREPAYMENT_APPLIED'
            USING ERRCODE = 'F4076';
    END IF;

    -- Post to F1 GL using tenant policy-resolved treatment
    v_f1_tx_id := public.finance_post_transaction(
        p_tenant_id, 'ACCRUAL', v_effective_date,
        'AP_PREPAYMENT_APPLIED: Bill ' || p_bill_id::TEXT,
        p_posting_attempt_id::TEXT,
        jsonb_build_array(
            jsonb_build_object('account_code', v_policy.debit_account_code,  'direction', 'DEBIT',  'amount_minor', p_amount_minor),
            jsonb_build_object('account_code', v_policy.credit_account_code, 'direction', 'CREDIT', 'amount_minor', p_amount_minor)
        )
    );

    -- Append PREPAYMENT_APPLIED fact (linked to bill)
    INSERT INTO public.finance_vendor_prepayments (
        tenant_id, vendor_id, fact_type, amount_minor,
        posting_attempt_id, f1_transaction_id, matched_vendor_bill_id
    ) VALUES (
        p_tenant_id, v_prepayment.vendor_id, 'PREPAYMENT_APPLIED', p_amount_minor,
        p_posting_attempt_id, v_f1_tx_id, p_bill_id
    ) RETURNING id INTO v_fact_id;

    RETURN jsonb_build_object('success', TRUE, 'prepayment_fact_id', v_fact_id,
        'transaction_id', v_f1_tx_id, 'is_duplicate', FALSE);
END;
$$;

-- 5.6 Calculate payable position (pure read — zero side effects)
CREATE OR REPLACE FUNCTION public.finance_calculate_payable_position(
    p_tenant_id UUID,
    p_vendor_id UUID,
    p_bill_id   UUID DEFAULT NULL
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_gross_payable       BIGINT := 0;
    v_unapplied_prepayment BIGINT := 0;
BEGIN
    -- Gross payable from AP ledger facts
    -- = PAYABLE_ACCRUAL - DISBURSEMENT_ALLOCATION + DEBIT_ADJUSTMENT - CREDIT_ADJUSTMENT
    SELECT COALESCE(SUM(
        CASE entry_type
            WHEN 'PAYABLE_ACCRUAL'         THEN  amount_minor
            WHEN 'DISBURSEMENT_ALLOCATION' THEN -amount_minor
            WHEN 'REVERSAL'                THEN  amount_minor
            WHEN 'DEBIT_ADJUSTMENT'        THEN  amount_minor
            WHEN 'CREDIT_ADJUSTMENT'       THEN -amount_minor
            ELSE 0
        END
    ), 0) INTO v_gross_payable
    FROM public.finance_payable_ledger pl
    JOIN public.finance_vendor_bills b
        ON b.id = pl.vendor_bill_id AND b.tenant_id = pl.tenant_id
    WHERE pl.tenant_id = p_tenant_id
      AND b.vendor_id = p_vendor_id
      AND (p_bill_id IS NULL OR pl.vendor_bill_id = p_bill_id);

    -- Unapplied prepayment = recorded - applied - refunded
    SELECT COALESCE(SUM(
        CASE fact_type
            WHEN 'PREPAYMENT_RECORDED' THEN  amount_minor
            WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor
            WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor
        END
    ), 0) INTO v_unapplied_prepayment
    FROM public.finance_vendor_prepayments
    WHERE tenant_id = p_tenant_id AND vendor_id = p_vendor_id;

    RETURN jsonb_build_object(
        'gross_payable_minor',       GREATEST(v_gross_payable, 0),
        'unapplied_prepayment_minor', GREATEST(v_unapplied_prepayment, 0),
        'net_vendor_exposure_minor',  GREATEST(v_gross_payable - v_unapplied_prepayment, 0)
    );
END;
$$;

-- 5.7 Rebuild payable position (cache rebuild from facts)
CREATE OR REPLACE FUNCTION public.finance_rebuild_payable_position(
    p_tenant_id UUID,
    p_bill_id   UUID
) RETURNS JSONB
SET search_path = public
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_disbursed  BIGINT := 0;
    v_adjusted   BIGINT := 0;
    v_original   BIGINT := 0;
    v_outstanding BIGINT := 0;
    v_version    INT;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'F4001';
    END IF;

    -- Original amount from PAYABLE_ACCRUAL facts
    SELECT COALESCE(SUM(amount_minor), 0) INTO v_original
    FROM public.finance_payable_ledger
    WHERE tenant_id = p_tenant_id AND vendor_bill_id = p_bill_id
      AND entry_type = 'PAYABLE_ACCRUAL';

    -- Disbursed amount (DISBURSEMENT - REVERSAL)
    SELECT COALESCE(SUM(
        CASE entry_type
            WHEN 'DISBURSEMENT_ALLOCATION' THEN  amount_minor
            WHEN 'REVERSAL'                THEN -amount_minor
            ELSE 0
        END
    ), 0) INTO v_disbursed
    FROM public.finance_payable_ledger
    WHERE tenant_id = p_tenant_id AND vendor_bill_id = p_bill_id;

    -- Adjusted amount (DEBIT_ADJUSTMENT - CREDIT_ADJUSTMENT, reserved v2)
    SELECT COALESCE(SUM(
        CASE entry_type
            WHEN 'DEBIT_ADJUSTMENT'  THEN  amount_minor
            WHEN 'CREDIT_ADJUSTMENT' THEN -amount_minor
            ELSE 0
        END
    ), 0) INTO v_adjusted
    FROM public.finance_payable_ledger
    WHERE tenant_id = p_tenant_id AND vendor_bill_id = p_bill_id;

    v_outstanding := v_original - v_disbursed + v_adjusted;

    UPDATE public.finance_payable_positions SET
        original_amount_minor    = v_original,
        disbursed_amount_minor   = GREATEST(v_disbursed, 0),
        adjusted_amount_minor    = v_adjusted,
        outstanding_amount_minor = GREATEST(v_outstanding, 0),
        version                  = version + 1,
        updated_at               = NOW()
    WHERE tenant_id = p_tenant_id AND vendor_bill_id = p_bill_id
    RETURNING version INTO v_version;

    RETURN jsonb_build_object(
        'success',                TRUE,
        'bill_id',               p_bill_id,
        'disbursed_amount_minor', GREATEST(v_disbursed, 0),
        'version',               v_version
    );
END;
$$;

-- =========================================================================
-- 6. DYNAMIC STATUS VIEW (security_invoker = true for tenant isolation P0)
-- =========================================================================

CREATE OR REPLACE VIEW public.finance_vendor_bill_status
WITH (security_invoker = true) AS
SELECT
    b.id,
    b.tenant_id,
    b.vendor_id,
    b.bill_number,
    b.bill_date,
    b.due_date,
    b.currency,
    b.total_amount_minor,
    b.status                                                               AS lifecycle_status,
    b.approved_by,
    b.f1_transaction_id,
    b.created_at,
    b.updated_at,
    COALESCE(SUM(
        CASE
            WHEN a.allocation_type = 'DISBURSEMENT' THEN a.allocated_amount_minor
            WHEN a.allocation_type = 'REVERSAL'     THEN -a.allocated_amount_minor
            ELSE 0
        END
    ), 0)                                                                   AS disbursed_amount_minor,
    b.total_amount_minor - COALESCE(SUM(
        CASE
            WHEN a.allocation_type = 'DISBURSEMENT' THEN a.allocated_amount_minor
            WHEN a.allocation_type = 'REVERSAL'     THEN -a.allocated_amount_minor
            ELSE 0
        END
    ), 0)                                                                   AS outstanding_amount_minor,
    CASE
        WHEN b.status = 'REVERSED' THEN 'REVERSED'
        WHEN b.status = 'DRAFT'    THEN 'DRAFT'
        WHEN b.status = 'RECEIVED' THEN 'RECEIVED'
        WHEN b.status = 'APPROVED' AND (
            b.total_amount_minor - COALESCE(SUM(
                CASE
                    WHEN a.allocation_type = 'DISBURSEMENT' THEN a.allocated_amount_minor
                    WHEN a.allocation_type = 'REVERSAL'     THEN -a.allocated_amount_minor
                    ELSE 0
                END
            ), 0)
        ) <= 0 THEN 'PAID'  -- derived only; never stored in bills.status
        ELSE 'APPROVED'
    END                                                                     AS effective_status
FROM public.finance_vendor_bills b
LEFT JOIN public.finance_payable_allocations a
    ON a.vendor_bill_id = b.id AND a.tenant_id = b.tenant_id
GROUP BY b.id, b.tenant_id, b.vendor_id, b.bill_number, b.bill_date, b.due_date,
         b.currency, b.total_amount_minor, b.status, b.approved_by,
         b.f1_transaction_id, b.created_at, b.updated_at;

-- =========================================================================
-- 7. GRANTS
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.finance_validate_account_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_validate_account_id   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_get_account_code_by_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_validate_period_for_date TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_resolve_prepayment_posting_accounts TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_financial_lock_key    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_cash_allocation_lock_key TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_approve_vendor_bill   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_disburse_payment      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_reverse_disbursement  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_record_prepayment     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_apply_prepayment      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_calculate_payable_position TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_rebuild_payable_position   TO authenticated, service_role;

GRANT SELECT ON public.finance_vendor_bill_status TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_vendor_bills       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_vendor_bill_lines  TO service_role;
GRANT SELECT, INSERT              ON public.finance_payable_ledger        TO service_role;
GRANT SELECT, INSERT              ON public.finance_payable_allocations   TO service_role;
GRANT SELECT, INSERT, UPDATE      ON public.finance_payable_positions     TO service_role;
GRANT SELECT, INSERT              ON public.finance_vendor_prepayments    TO service_role;
GRANT SELECT, INSERT, UPDATE      ON public.finance_prepayment_posting_policy_mappings TO service_role;

GRANT SELECT ON public.finance_vendor_bills       TO authenticated;
GRANT SELECT ON public.finance_vendor_bill_lines  TO authenticated;
GRANT SELECT ON public.finance_payable_ledger     TO authenticated;
GRANT SELECT ON public.finance_payable_allocations TO authenticated;
GRANT SELECT ON public.finance_payable_positions  TO authenticated;
GRANT SELECT ON public.finance_vendor_prepayments TO authenticated;
GRANT SELECT ON public.finance_prepayment_posting_policy_mappings TO authenticated;

-- =========================================================================
-- 8. VERIFICATION ASSERTIONS
--    Runs inline to ensure schema invariants are correct before migration commits.
-- =========================================================================

DO $$
DECLARE
    v_key1_canonical INT;
    v_key2_canonical INT;
    v_key1_legacy    INT;
    v_key2_legacy    INT;
    v_test_tenant    UUID := '11111111-1111-1111-1111-111111111111';
    v_test_movement  UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- ASSERT 1: Canonical lock key byte-for-byte matches F3 legacy for CASH_MOVEMENT
    SELECT key1, key2 INTO v_key1_canonical, v_key2_canonical
    FROM public.finance_financial_lock_key(v_test_tenant, 'CASH_MOVEMENT', v_test_movement);

    SELECT tenant_key, movement_key INTO v_key1_legacy, v_key2_legacy
    FROM public.finance_cash_allocation_lock_key(v_test_tenant, v_test_movement);

    IF v_key1_canonical <> v_key1_legacy OR v_key2_canonical <> v_key2_legacy THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: finance_financial_lock_key CASH_MOVEMENT does not match legacy bridge. canonical=(%, %) legacy=(%, %)',
            v_key1_canonical, v_key2_canonical, v_key1_legacy, v_key2_legacy;
    END IF;

    -- ASSERT 2: VENDOR namespace produces different keys from CASH_MOVEMENT
    SELECT key1, key2 INTO v_key1_canonical, v_key2_canonical
    FROM public.finance_financial_lock_key(v_test_tenant, 'VENDOR', v_test_movement);

    IF v_key1_canonical = v_key1_legacy THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: VENDOR namespace key1 must differ from CASH_MOVEMENT key1.';
    END IF;

    -- ASSERT 3: finance_vendor_bills.status CHECK constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage cu
            ON cc.constraint_name = cu.constraint_name
        WHERE cu.table_name = 'finance_vendor_bills'
          AND cc.check_clause LIKE '%REVERSED%'
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: finance_vendor_bills CHECK constraint on status is missing.';
    END IF;

    -- ASSERT 4: security_invoker view exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_name = 'finance_vendor_bill_status'
          AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: finance_vendor_bill_status view is missing.';
    END IF;

    RAISE NOTICE 'F4 AP ENGINE: All % verification assertions passed.', 4;
END;
$$;
