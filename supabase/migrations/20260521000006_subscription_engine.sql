-- Migration: Add Subscription Engine tables and helper functions
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free_trial',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
ADD COLUMN IF NOT EXISTS sms_allotment_used INTEGER DEFAULT 0;

-- Create subscription_invoices table
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
    tier VARCHAR(50) NOT NULL, -- free_trial, basic, pro, enterprise
    duration_months INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50)
);

-- Enable Row-Level Security
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin quản lý invoices" ON public.subscription_invoices;
CREATE POLICY "Admin quản lý invoices"
    ON public.subscription_invoices
    FOR ALL
    TO authenticated
    USING (public.is_admin() AND tenant_id = public.get_auth_tenant_id());

-- Security Definer function to renew tenant subscriptions
CREATE OR REPLACE FUNCTION public.renew_tenant_subscription(
    p_invoice_number TEXT,
    p_payment_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_tier VARCHAR;
    v_duration_months INTEGER;
    v_status VARCHAR;
BEGIN
    -- 1. Find invoice
    SELECT tenant_id, tier, duration_months, status 
    INTO v_tenant_id, v_tier, v_duration_months, v_status
    FROM public.subscription_invoices
    WHERE invoice_number = p_invoice_number;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn %', p_invoice_number;
    END IF;

    IF v_status = 'paid' THEN
        RETURN TRUE; -- Already processed
    END IF;

    -- 2. Update invoice status
    UPDATE public.subscription_invoices
    SET status = 'paid',
        paid_at = NOW(),
        payment_method = p_payment_method
    WHERE invoice_number = p_invoice_number;

    -- 3. Renew tenant plan
    UPDATE public.tenants
    SET subscription_tier = v_tier,
        subscription_expires_at = CASE 
            WHEN subscription_expires_at > NOW() THEN subscription_expires_at + (v_duration_months || ' month')::interval
            ELSE NOW() + (v_duration_months || ' month')::interval
        END,
        sms_allotment_used = 0 -- Reset SMS limit count on renewal
    WHERE id = v_tenant_id;

    RETURN TRUE;
END;
$$;

-- Security Definer function to safely increment tenant sms count
CREATE OR REPLACE FUNCTION public.increment_tenant_sms(
    p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.tenants
    SET sms_allotment_used = COALESCE(sms_allotment_used, 0) + 1
    WHERE id = p_tenant_id
    RETURNING sms_allotment_used INTO v_count;
    
    RETURN v_count;
END;
$$;
