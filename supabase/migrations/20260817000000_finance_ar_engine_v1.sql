-- Migration: 20260817000000_finance_ar_engine_v1
-- Component: F3.1 — Database Schema & RLS Hardening
-- Description:
--   Creates the schema for F3 Accounts Receivable & Invoicing,
--   including the 6 core tables, strict check constraints, unique indexes,
--   immutability triggers, and Row Level Security (RLS) tenant isolation policies.
--   Enforces that no write privileges are granted to public/authenticated roles.

-- =========================================================================
-- 1. TABLE CREATION
-- =========================================================================

-- Table 1: Invoice Headers
CREATE TABLE public.finance_invoices (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id                 UUID NOT NULL, -- Logical reference to vertical customer
    invoice_number              VARCHAR(50) NOT NULL CHECK (invoice_number <> ''),
    status                      VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT', 'FINALIZED', 'ADJUSTED', 'VOIDED')),
    issue_date                  DATE NOT NULL,
    due_date                    DATE NOT NULL,
    currency                    VARCHAR(10) NOT NULL CHECK (currency <> ''),
    total_pretax_amount_minor   BIGINT NOT NULL CHECK (total_pretax_amount_minor >= 0),
    tax_amount_minor            BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
    total_invoice_amount_minor  BIGINT NOT NULL,
    f1_transaction_id           UUID UNIQUE, -- Populated atomically on finalization
    posting_status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                  CHECK (posting_status IN ('PENDING', 'SUCCESS', 'FAILED')),
    posting_attempt_id          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- Idempotency key source
    metadata                    JSONB DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_due_after_issue CHECK (due_date >= issue_date),
    CONSTRAINT chk_total_sum CHECK (total_invoice_amount_minor = total_pretax_amount_minor + tax_amount_minor),
    CONSTRAINT uq_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)
);

-- Table 2: Invoice Lines
CREATE TABLE public.finance_invoice_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    service_id              UUID, -- Logical reference to vertical service/product
    description             TEXT NOT NULL CHECK (description <> ''),
    quantity                NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price_minor        BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    tax_rate                NUMERIC NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    amount_minor            BIGINT NOT NULL CHECK (amount_minor = FLOOR(quantity * unit_price_minor)),
    revenue_account_code    VARCHAR(20) NOT NULL CHECK (revenue_account_code <> ''),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 3: AR Subledger Log (Absolute Immutability)
CREATE TABLE public.finance_receivable_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id      UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    entry_type      VARCHAR(30) NOT NULL
                      CHECK (entry_type IN ('DEBIT_ACCRUAL', 'CREDIT_ALLOCATION',
                                            'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0), -- Must be strictly positive
    source_type     VARCHAR(30) NOT NULL
                      CHECK (source_type IN ('INVOICE', 'ALLOCATION', 'RECEIVABLE_ADJUSTMENT')),
    source_id       UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 4: Derived Receivable Positions (Materialized Projection Cache)
CREATE TABLE public.finance_receivable_positions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
    customer_id             UUID NOT NULL,
    currency                VARCHAR(10) NOT NULL CHECK (currency <> ''),
    original_amount_minor   BIGINT NOT NULL CHECK (original_amount_minor >= 0),
    allocated_amount_minor  BIGINT NOT NULL DEFAULT 0 CHECK (allocated_amount_minor >= 0),
    adjusted_amount_minor   BIGINT NOT NULL DEFAULT 0,
    outstanding_amount_minor BIGINT GENERATED ALWAYS AS
                              (original_amount_minor - allocated_amount_minor - adjusted_amount_minor)
                              STORED,
    last_reconstructed_at   TIMESTAMPTZ,
    version                 INT NOT NULL DEFAULT 0 CHECK (version >= 0),
    metadata                JSONB DEFAULT '{}',
    CONSTRAINT uq_receivable_position_per_invoice UNIQUE (tenant_id, invoice_id)
);

-- Table 5: Allocation Ledger (Append-only)
CREATE TABLE public.finance_receivable_allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    cash_movement_id        UUID NOT NULL, -- Logical FK to F2
    allocated_amount_minor  BIGINT NOT NULL CHECK (allocated_amount_minor > 0),
    allocation_type         VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
                              CHECK (allocation_type IN ('STANDARD', 'REVERSAL')),
    reversal_ref_id         UUID REFERENCES public.finance_receivable_allocations(id) ON DELETE RESTRICT,
    rate_source             VARCHAR(50) NOT NULL
                              CHECK (rate_source IN ('CENTRAL_BANK', 'TREASURY', 'MANUAL_AUTHORIZED')),
    rate_timestamp          TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: Adjustment Memos
CREATE TABLE public.finance_receivable_adjustments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id          UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    adjustment_type     VARCHAR(20) NOT NULL
                          CHECK (adjustment_type IN ('CREDIT_MEMO', 'DEBIT_MEMO')),
    amount_minor        BIGINT NOT NULL CHECK (amount_minor > 0),
    reason              TEXT NOT NULL CHECK (reason <> ''),
    f1_transaction_id   UUID UNIQUE,
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'FINALIZED', 'CANCELLED')),
    posting_attempt_id  UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata            JSONB DEFAULT '{}'
);

-- =========================================================================
-- 2. INDEXES & CONSTRAINTS (P0)
-- =========================================================================

-- Allocation Reversal Limit: each standard allocation can be reversed at most once
CREATE UNIQUE INDEX uq_reversal_once_per_allocation
  ON public.finance_receivable_allocations(reversal_ref_id)
  WHERE reversal_ref_id IS NOT NULL;

-- Subledger Log Idempotency Key Constraint
CREATE UNIQUE INDEX uq_receivable_ledger_fact
  ON public.finance_receivable_ledger (tenant_id, source_type, source_id, entry_type);

-- Allocation Traceability Indexes
CREATE INDEX idx_allocations_by_invoice ON public.finance_receivable_allocations(tenant_id, invoice_id);
CREATE INDEX idx_allocations_by_movement ON public.finance_receivable_allocations(tenant_id, cash_movement_id);

-- Invoice lines foreign key index
CREATE INDEX idx_invoice_lines_header ON public.finance_invoice_lines(invoice_id);

-- =========================================================================
-- 3. MUTATION GUARDS (Triggers)
-- =========================================================================

-- Mutation guard function: blocks direct INSERT, UPDATE, DELETE on strict tables
CREATE OR REPLACE FUNCTION public.finance_receivable_mutation_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Enforce absolute immutability on subledger log and allocations (no UPDATE or DELETE)
    IF TG_TABLE_NAME IN ('finance_receivable_ledger', 'finance_receivable_allocations') AND TG_OP IN ('UPDATE', 'DELETE') THEN
        RAISE EXCEPTION 'DIRECT_AR_MUTATION_PROHIBITED: Subledger logs and allocations are strictly immutable.'
        USING ERRCODE = 'F3001';
    END IF;

    -- 2. Strict role authorization: only service_role, postgres, and supabase_admin are allowed to mutate F3 tables
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'DIRECT_AR_MUTATION_PROHIBITED: Write access restricted to service_role or admin.'
        USING ERRCODE = 'F3001';
    END IF;

    -- 3. Position update guard: must occur under trusted transaction context
    IF TG_TABLE_NAME = 'finance_receivable_positions' AND TG_OP = 'UPDATE' THEN
        IF current_setting('finance.allow_receivable_mutation', true) = 'true' THEN
            -- Allowed
        ELSE
            RAISE EXCEPTION 'DIRECT_AR_MUTATION_PROHIBITED: Positions can only be updated via authorized payment allocation or reconstruction RPCs.'
            USING ERRCODE = 'F3001';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger applications
CREATE TRIGGER trg_finance_receivable_ledger_guard
BEFORE UPDATE OR DELETE ON public.finance_receivable_ledger
FOR EACH ROW EXECUTE FUNCTION public.finance_receivable_mutation_guard();

CREATE TRIGGER trg_finance_receivable_allocations_guard
BEFORE UPDATE OR DELETE ON public.finance_receivable_allocations
FOR EACH ROW EXECUTE FUNCTION public.finance_receivable_mutation_guard();

CREATE TRIGGER trg_finance_receivable_positions_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_receivable_positions
FOR EACH ROW EXECUTE FUNCTION public.finance_receivable_mutation_guard();

-- Invoice Immutability trigger: blocks changes to financial columns once status = 'FINALIZED'
CREATE OR REPLACE FUNCTION public.finance_invoice_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('FINALIZED', 'VOIDED', 'ADJUSTED') THEN
        -- Prevent changing any financial fields (currency, amounts, dates, accounts)
        IF NEW.total_invoice_amount_minor <> OLD.total_invoice_amount_minor OR
           NEW.total_pretax_amount_minor <> OLD.total_pretax_amount_minor OR
           NEW.tax_amount_minor <> OLD.tax_amount_minor OR
           NEW.currency <> OLD.currency OR
           NEW.issue_date <> OLD.issue_date OR
           NEW.due_date <> OLD.due_date OR
           NEW.f1_transaction_id <> OLD.f1_transaction_id OR
           NEW.tenant_id <> OLD.tenant_id OR
           NEW.customer_id <> OLD.customer_id OR
           NEW.invoice_number <> OLD.invoice_number THEN
            RAISE EXCEPTION 'INVOICE_IMMUTABLE: Financial fields of a finalized invoice cannot be updated.'
            USING ERRCODE = 'F3010';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_invoice_immutability
BEFORE UPDATE ON public.finance_invoices
FOR EACH ROW EXECUTE FUNCTION public.finance_invoice_immutability_guard();

-- Invoice Status Transition guard trigger
CREATE OR REPLACE FUNCTION public.finance_invoice_status_transition_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate transition flow
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('FINALIZED') THEN
        RAISE EXCEPTION 'INVALID_INVOICE_STATUS_TRANSITION: DRAFT invoices can only transition to FINALIZED.'
        USING ERRCODE = 'F3011';
    END IF;

    IF OLD.status = 'FINALIZED' AND NEW.status NOT IN ('ADJUSTED', 'VOIDED') THEN
        RAISE EXCEPTION 'INVALID_INVOICE_STATUS_TRANSITION: FINALIZED invoices can only transition to ADJUSTED or VOIDED.'
        USING ERRCODE = 'F3011';
    END IF;

    IF OLD.status IN ('VOIDED', 'ADJUSTED') THEN
        RAISE EXCEPTION 'INVALID_INVOICE_STATUS_TRANSITION: Invoices in terminal status (VOIDED/ADJUSTED) cannot transition.'
        USING ERRCODE = 'F3011';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_invoice_status_transition
BEFORE UPDATE ON public.finance_invoices
FOR EACH ROW EXECUTE FUNCTION public.finance_invoice_status_transition_guard();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- =========================================================================

-- Enable RLS
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivable_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivable_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivable_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivable_adjustments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies (Read-only access for authenticated users)
CREATE POLICY "Tenant isolation for finance_invoices" ON public.finance_invoices
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant isolation for finance_invoice_lines" ON public.finance_invoice_lines
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant isolation for finance_receivable_ledger" ON public.finance_receivable_ledger
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant isolation for finance_receivable_positions" ON public.finance_receivable_positions
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant isolation for finance_receivable_allocations" ON public.finance_receivable_allocations
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant isolation for finance_receivable_adjustments" ON public.finance_receivable_adjustments
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- Grant / Revoke Boundaries
-- Authenticated can SELECT only. No direct write operations.
REVOKE ALL ON public.finance_invoices FROM authenticated, anon;
REVOKE ALL ON public.finance_invoice_lines FROM authenticated, anon;
REVOKE ALL ON public.finance_receivable_ledger FROM authenticated, anon;
REVOKE ALL ON public.finance_receivable_positions FROM authenticated, anon;
REVOKE ALL ON public.finance_receivable_allocations FROM authenticated, anon;
REVOKE ALL ON public.finance_receivable_adjustments FROM authenticated, anon;

GRANT SELECT ON public.finance_invoices TO authenticated;
GRANT SELECT ON public.finance_invoice_lines TO authenticated;
GRANT SELECT ON public.finance_receivable_ledger TO authenticated;
GRANT SELECT ON public.finance_receivable_positions TO authenticated;
GRANT SELECT ON public.finance_receivable_allocations TO authenticated;
GRANT SELECT ON public.finance_receivable_adjustments TO authenticated;
