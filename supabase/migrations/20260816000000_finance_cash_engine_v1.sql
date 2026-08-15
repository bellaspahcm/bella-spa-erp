-- Migration: finance_cash_engine_v1
-- Description: Sets up the core database schema for F2 Cash & Treasury Engine (Additive).
-- Enforces: Tenant consistency composite FKs, immutability triggers, and write mutation guards.

-- =========================================================================
-- 1. PRE-FLIGHT SCHEMATIC CHECK (Assert uniqueness before adding F1 constraints)
-- =========================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.finance_transactions GROUP BY tenant_id, id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'PRE_FLIGHT_CHECK_FAILED: Duplicate (tenant_id, id) found in finance_transactions!';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.finance_accounts GROUP BY tenant_id, id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'PRE_FLIGHT_CHECK_FAILED: Duplicate (tenant_id, id) found in finance_accounts!';
    END IF;
END $$;

-- =========================================================================
-- 2. F1 ADDITIVE COMPATIBILITY MIGRATION (ADR-021 Exception)
-- =========================================================================
ALTER TABLE public.finance_transactions 
    ADD CONSTRAINT finance_tx_tenant_id_unique UNIQUE (tenant_id, id);

ALTER TABLE public.finance_accounts 
    ADD CONSTRAINT finance_accounts_tenant_id_unique UNIQUE (tenant_id, id);

-- =========================================================================
-- 3. F2.1 TABLES CREATION
-- =========================================================================

-- 3.1 Tenant configurations (runway thresholds)
CREATE TABLE public.finance_tenant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    warning_threshold_days INTEGER NOT NULL DEFAULT 30 CHECK (warning_threshold_days > 0),
    critical_threshold_days INTEGER NOT NULL DEFAULT 7 CHECK (critical_threshold_days > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_thresholds_order CHECK (warning_threshold_days > critical_threshold_days)
);

ALTER TABLE public.finance_tenant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_tenant_configs" ON public.finance_tenant_configs
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.2 Bank accounts
CREATE TABLE public.finance_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL CHECK (bank_name <> ''),
    account_number TEXT NOT NULL CHECK (account_number <> ''),
    account_name TEXT NOT NULL CHECK (account_name <> ''),
    currency VARCHAR(10) NOT NULL,
    linked_finance_account_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce unique bank account number per tenant
    CONSTRAINT uq_finance_bank_accounts_num UNIQUE (tenant_id, account_number),
    -- Allow composite referencing
    CONSTRAINT uq_finance_bank_accounts_composite UNIQUE (tenant_id, id),
    -- Enforce tenant consistency on linked account reference
    CONSTRAINT fk_linked_finance_account FOREIGN KEY (tenant_id, linked_finance_account_id) 
        REFERENCES public.finance_accounts(tenant_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.finance_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_bank_accounts" ON public.finance_bank_accounts
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.3 Cash positions (materialized derived state)
CREATE TABLE public.finance_cash_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL,
    
    -- Authoritative Native Balance
    balance_minor NUMERIC(20,0) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL,
    
    -- Derived Functional Valuation
    functional_balance_minor NUMERIC(20,0) NOT NULL DEFAULT 0,
    functional_currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    valuation_rate NUMERIC(18,6) NOT NULL DEFAULT 1.000000 CHECK (valuation_rate >= 0),
    valuation_as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valuation_source VARCHAR(50) NOT NULL DEFAULT 'F1_POST',
    
    -- Metadata and concurrency
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    last_movement_id UUID, -- self-referencing check added after cash_movements definition
    as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Invariants and constraints
    CONSTRAINT uq_finance_cash_positions UNIQUE (tenant_id, bank_account_id),
    CONSTRAINT fk_finance_cash_positions_bank FOREIGN KEY (tenant_id, bank_account_id) 
        REFERENCES public.finance_bank_accounts(tenant_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.finance_cash_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_cash_positions" ON public.finance_cash_positions
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 3.4 Cash movements (immutable fact log)
CREATE TABLE public.finance_cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
    amount_minor NUMERIC(20,0) NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(10) NOT NULL,
    
    -- Derived Functional Valuation
    functional_amount_minor NUMERIC(20,0) NOT NULL,
    functional_currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    valuation_rate NUMERIC(18,6) NOT NULL CHECK (valuation_rate >= 0),
    
    -- F1 Transaction Source (strictly validated at database layer)
    f1_transaction_id UUID NOT NULL,
    cash_leg_reference VARCHAR(100) NOT NULL,
    
    source_type VARCHAR(255) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    description TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Invariants and constraints
    CONSTRAINT uq_finance_cash_movements_key UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_finance_cash_movements_leg UNIQUE (tenant_id, f1_transaction_id, cash_leg_reference),
    
    -- Tenant Consistency Composite Foreign Keys
    CONSTRAINT fk_finance_cash_movements_bank FOREIGN KEY (tenant_id, bank_account_id) 
        REFERENCES public.finance_bank_accounts(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_finance_cash_movements_f1 FOREIGN KEY (tenant_id, f1_transaction_id) 
        REFERENCES public.finance_transactions(tenant_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.finance_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_cash_movements" ON public.finance_cash_movements
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- Add foreign key constraint back to cash_positions for safety tracking
ALTER TABLE public.finance_cash_positions 
    ADD CONSTRAINT fk_last_movement FOREIGN KEY (tenant_id, last_movement_id) 
        REFERENCES public.finance_cash_movements(tenant_id, id) ON DELETE SET NULL;

-- 3.5 Cash quarantine (failed event staging)
CREATE TABLE public.finance_cash_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED')),
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_cash_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for finance_cash_quarantine" ON public.finance_cash_quarantine
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. DATABASE INDEXES FOR ENHANCED PERFORMANCE
-- =========================================================================
CREATE INDEX idx_finance_cash_positions_lookup ON public.finance_cash_positions(tenant_id, bank_account_id);
CREATE INDEX idx_finance_cash_movements_history ON public.finance_cash_movements(tenant_id, bank_account_id, recorded_at);
CREATE INDEX idx_finance_cash_movements_f1 ON public.finance_cash_movements(tenant_id, f1_transaction_id);
CREATE INDEX idx_finance_cash_quarantine_pending ON public.finance_cash_quarantine(tenant_id, status) WHERE status = 'PENDING';

-- =========================================================================
-- 5. DATABASE PROTECTION TRIGGERS (Locking Mutability)
-- =========================================================================

-- 5.1 Mutation Guard trigger (Revokes raw mutations on cash engine positions/movements)
CREATE OR REPLACE FUNCTION public.finance_cash_mutation_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('finance.allow_cash_mutation', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'DIRECT_CASH_MUTATION_PROHIBITED: Cash projection tables can only be mutated through the official projection RPC.'
        USING ERRCODE = 'F2001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_cash_movements_mutation_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.finance_cash_movements
    FOR EACH ROW EXECUTE FUNCTION public.finance_cash_mutation_guard();

CREATE TRIGGER trg_finance_cash_positions_mutation_guard
    BEFORE INSERT OR UPDATE OR DELETE ON public.finance_cash_positions
    FOR EACH ROW EXECUTE FUNCTION public.finance_cash_mutation_guard();

-- 5.2 Immutability Guard trigger (Enforces absolute immutability of recorded cash facts)
CREATE OR REPLACE FUNCTION public.finance_cash_movements_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CASH_MOVEMENT_IMMUTABLE: Recorded cash movements are immutable and cannot be updated or deleted.'
    USING ERRCODE = 'F2002';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_cash_movements_immutability
    BEFORE UPDATE OR DELETE ON public.finance_cash_movements
    FOR EACH ROW EXECUTE FUNCTION public.finance_cash_movements_immutability_guard();

-- 5.3 Quarantine Safety trigger (Blocks deletes and controls updates)
CREATE OR REPLACE FUNCTION public.finance_cash_quarantine_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'QUARANTINE_DELETE_PROHIBITED: Quarantine audit records cannot be deleted.'
        USING ERRCODE = 'F2003';
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        -- Allow resolving only
        IF OLD.status = 'RESOLVED' THEN
            RAISE EXCEPTION 'QUARANTINE_RESOLVED_IMMUTABLE: Already resolved quarantine records cannot be edited.'
            USING ERRCODE = 'F2004';
        END IF;
        
        IF NEW.status IS DISTINCT FROM 'RESOLVED' OR
           NEW.id IS DISTINCT FROM OLD.id OR
           NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
           NEW.event_id IS DISTINCT FROM OLD.event_id OR
           NEW.event_type IS DISTINCT FROM OLD.event_type OR
           NEW.payload IS DISTINCT FROM OLD.payload OR
           NEW.failure_reason IS DISTINCT FROM OLD.failure_reason OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'QUARANTINE_UPDATE_PROHIBITED: Only status resolution fields can be updated.'
            USING ERRCODE = 'F2005';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_finance_cash_quarantine_immutability
    BEFORE UPDATE OR DELETE ON public.finance_cash_quarantine
    FOR EACH ROW EXECUTE FUNCTION public.finance_cash_quarantine_immutability_guard();
