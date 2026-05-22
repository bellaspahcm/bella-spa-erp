-- Migration: Add Franchise Royalty & Invoicing system

-- 1. Add royalty configuration columns to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS royalty_type VARCHAR(20) DEFAULT 'percentage' CHECK (royalty_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS royalty_fixed_amount NUMERIC(12,2) DEFAULT 0.00;

-- 2. Create the franchise_royalty_invoices table
CREATE TABLE IF NOT EXISTS public.franchise_royalty_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    month_year DATE NOT NULL,
    gross_revenue NUMERIC(12,2) NOT NULL,
    royalty_type VARCHAR(20) NOT NULL CHECK (royalty_type IN ('fixed', 'percentage')),
    royalty_rate NUMERIC(5,2),
    royalty_fixed_amount NUMERIC(12,2) DEFAULT 0.00,
    calculated_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    notes TEXT
);

-- 3. Enable Row-Level Security
ALTER TABLE public.franchise_royalty_invoices ENABLE ROW LEVEL SECURITY;

-- 4. Create Helper Security Definer function to check if authenticated user is a HQ Super Admin
CREATE OR REPLACE FUNCTION public.is_hq_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_name VARCHAR;
BEGIN
    SELECT t.name INTO v_tenant_name 
    FROM public.users u
    JOIN public.tenants t ON u.tenant_id = t.id
    WHERE u.id = auth.uid();
    
    RETURN COALESCE(v_tenant_name = 'Bella Spa Headquarter' AND public.is_admin(), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Establish isolated RLS Policies
DROP POLICY IF EXISTS "Branch Admin quản lý royalty invoices" ON public.franchise_royalty_invoices;
CREATE POLICY "Branch Admin quản lý royalty invoices"
    ON public.franchise_royalty_invoices
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id() AND public.is_admin());

DROP POLICY IF EXISTS "HQ Admin quản lý toàn bộ royalty invoices" ON public.franchise_royalty_invoices;
CREATE POLICY "HQ Admin quản lý toàn bộ royalty invoices"
    ON public.franchise_royalty_invoices
    FOR ALL
    TO authenticated
    USING (public.is_hq_admin());
