-- ============================================================================
-- Bella Auto: Deposit Tracking Table
-- Purpose: Track deposit payment history for bookings
-- Date: 2026-08-04
-- ============================================================================

-- Table: auto_deposits (Lịch sử thanh toán cọc)
CREATE TABLE IF NOT EXISTS public.auto_deposits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id          UUID NOT NULL REFERENCES public.auto_bookings(id) ON DELETE CASCADE,
    
    -- Payment details
    amount              NUMERIC(18,0) NOT NULL CHECK (amount > 0),
    payment_method      TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank_transfer', 'credit_card', 'vnpay', 'momo'
    payment_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    transaction_ref     TEXT, -- Reference number from payment gateway
    
    -- Status
    status              TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'refunded'
    notes               TEXT,
    
    -- Audit
    created_by          UUID REFERENCES public.users(id),
    confirmed_by        UUID REFERENCES public.users(id),
    confirmed_at        TIMESTAMP WITH TIME ZONE,
    
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_deposits_tenant ON public.auto_deposits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_deposits_booking ON public.auto_deposits (booking_id);
CREATE INDEX IF NOT EXISTS idx_auto_deposits_payment_date ON public.auto_deposits (payment_date);

-- Enable RLS
ALTER TABLE public.auto_deposits ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Tenant view auto_deposits" ON public.auto_deposits
    FOR ALL TO authenticated
    USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER trg_auto_deposits_updated_at
    BEFORE UPDATE ON public.auto_deposits
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();

-- Grant permissions
GRANT ALL ON TABLE public.auto_deposits TO authenticated;
GRANT ALL ON TABLE public.auto_deposits TO service_role;
