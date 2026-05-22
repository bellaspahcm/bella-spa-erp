-- Migration: Add Inter-branch Redemption & Internal Financial Clearing system

-- 1. Add internal_clearing_rate to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS internal_clearing_rate NUMERIC(12,2) DEFAULT 150000.00;

-- 2. Create the inter_branch_clearing_records table
CREATE TABLE IF NOT EXISTS public.inter_branch_clearing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearing_number VARCHAR(50) UNIQUE NOT NULL,
    month_year DATE NOT NULL,
    debtor_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    creditor_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_count INTEGER NOT NULL DEFAULT 0,
    clearing_rate NUMERIC(12,2) NOT NULL DEFAULT 150000.00,
    calculated_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cleared_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    notes TEXT,
    CONSTRAINT chk_different_tenants CHECK (debtor_tenant_id <> creditor_tenant_id),
    CONSTRAINT unique_monthly_clearing UNIQUE (month_year, debtor_tenant_id, creditor_tenant_id)
);

-- 3. Enable Row-Level Security
ALTER TABLE public.inter_branch_clearing_records ENABLE ROW LEVEL SECURITY;

-- 4. Establish isolated RLS Policies
DROP POLICY IF EXISTS "Branch Admin quản lý clearing records" ON public.inter_branch_clearing_records;
CREATE POLICY "Branch Admin quản lý clearing records"
    ON public.inter_branch_clearing_records
    FOR ALL
    TO authenticated
    USING (
        (debtor_tenant_id = public.get_auth_tenant_id() OR creditor_tenant_id = public.get_auth_tenant_id()) 
        AND public.is_admin()
    );

DROP POLICY IF EXISTS "HQ Admin quản lý toàn bộ clearing records" ON public.inter_branch_clearing_records;
CREATE POLICY "HQ Admin quản lý toàn bộ clearing records"
    ON public.inter_branch_clearing_records
    FOR ALL
    TO authenticated
    USING (public.is_hq_admin());
