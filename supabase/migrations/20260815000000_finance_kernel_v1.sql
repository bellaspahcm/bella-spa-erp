-- Migration: finance_kernel_v1
-- Description: Sets up the initial database schema for Finance OS Kernel (F1 Ledger)
-- Rules: Additive only, tenant isolation (RLS), integer-safe NUMERIC types, and general dimensions.

-- =========================================================================
-- 1. FINANCE_ACCOUNTING_PERIODS
-- =========================================================================
CREATE TABLE public.finance_accounting_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    closed_by UUID,
    closed_at TIMESTAMPTZ,
    locked_by UUID,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_finance_periods_tenant_name ON public.finance_accounting_periods(tenant_id, name);
CREATE INDEX idx_finance_periods_dates ON public.finance_accounting_periods(tenant_id, period_start, period_end);

ALTER TABLE public.finance_accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_accounting_periods" ON public.finance_accounting_periods
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 2. FINANCE_ACCOUNTS (Chart of Accounts)
-- =========================================================================
CREATE TABLE public.finance_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    currency VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_finance_accounts_tenant_code ON public.finance_accounts(tenant_id, code);

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_accounts" ON public.finance_accounts
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 3. FINANCE_TRANSACTIONS
-- =========================================================================
CREATE TABLE public.finance_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    source_type VARCHAR(255) NOT NULL CHECK (source_type <> ''),
    source_id VARCHAR(255) NOT NULL CHECK (source_id <> ''),
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'VOIDED')),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('ACCRUAL', 'CASH', 'ADJUSTMENT', 'REVERSAL', 'OPENING_BALANCE')),
    accounting_period_id UUID NOT NULL REFERENCES public.finance_accounting_periods(id),
    posted_at TIMESTAMPTZ,
    transaction_currency VARCHAR(10) NOT NULL,
    functional_currency VARCHAR(10) NOT NULL,
    -- Exchange rate components
    exchange_rate_rate NUMERIC(38, 6) NOT NULL,
    exchange_rate_source VARCHAR(10) NOT NULL,
    exchange_rate_target VARCHAR(10) NOT NULL,
    exchange_rate_effective TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    reference_type VARCHAR(255) NOT NULL,
    reference_id VARCHAR(255) NOT NULL,
    reversal_of UUID REFERENCES public.finance_transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_finance_txs_tenant_idempotency ON public.finance_transactions(tenant_id, idempotency_key);
CREATE INDEX idx_finance_txs_period ON public.finance_transactions(tenant_id, accounting_period_id);
CREATE INDEX idx_finance_txs_source ON public.finance_transactions(tenant_id, source_type, source_id);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_transactions" ON public.finance_transactions
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. FINANCE_TRANSACTION_LINES
-- =========================================================================
CREATE TABLE public.finance_transaction_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.finance_accounts(id),
    -- Transaction currency amounts (stored as minor units / integers in numeric(38,0))
    debit_amount NUMERIC(38, 0) NOT NULL CHECK (debit_amount >= 0),
    debit_currency VARCHAR(10) NOT NULL,
    credit_amount NUMERIC(38, 0) NOT NULL CHECK (credit_amount >= 0),
    credit_currency VARCHAR(10) NOT NULL,
    -- Functional currency amounts
    debit_functional_amount NUMERIC(38, 0) NOT NULL CHECK (debit_functional_amount >= 0),
    debit_functional_currency VARCHAR(10) NOT NULL,
    credit_functional_amount NUMERIC(38, 0) NOT NULL CHECK (credit_functional_amount >= 0),
    credit_functional_currency VARCHAR(10) NOT NULL,
    -- Financial Dimensions
    cost_center_id UUID,
    business_unit_id UUID,
    location_id UUID,
    project_id UUID,
    department_id UUID,
    custom_dimension_type VARCHAR(100),
    custom_dimension_id VARCHAR(255),
    memo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Invariants
    CONSTRAINT chk_debit_credit_mutual_exclusive CHECK (NOT (debit_amount > 0 AND credit_amount > 0))
);

CREATE INDEX idx_finance_lines_tx ON public.finance_transaction_lines(transaction_id);
CREATE INDEX idx_finance_lines_account ON public.finance_transaction_lines(tenant_id, account_id);

ALTER TABLE public.finance_transaction_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_transaction_lines" ON public.finance_transaction_lines
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 5. FINANCE_OUTBOX_EVENTS
-- =========================================================================
CREATE TABLE public.finance_outbox_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DISPATCHED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finance_outbox_pending ON public.finance_outbox_events(tenant_id, status) WHERE status = 'PENDING';

ALTER TABLE public.finance_outbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_outbox_events" ON public.finance_outbox_events
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 6. FINANCE_AUDIT_TRAIL
-- =========================================================================
CREATE TABLE public.finance_audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    actor_id UUID,
    reference_type VARCHAR(100) NOT NULL,
    reference_id VARCHAR(255) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finance_audit_ref ON public.finance_audit_trail(tenant_id, reference_type, reference_id);

ALTER TABLE public.finance_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_audit_trail" ON public.finance_audit_trail
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 7. ROLES & GRANTS
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounting_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transaction_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_outbox_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_audit_trail TO authenticated;
