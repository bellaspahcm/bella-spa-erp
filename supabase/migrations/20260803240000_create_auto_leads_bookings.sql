-- ============================================================================
-- Bella EIP — Bella Auto Phase 4: Lead & Sales Center
-- Architectural Invariant 01: Fully Additive. No impact on production tenants.
-- Timestamp: 20260803240000
-- ============================================================================

-- 1. Bảng auto_leads (Cơ hội bán hàng ô tô)
CREATE TABLE IF NOT EXISTS public.auto_leads (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id           UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Chi tiết cơ hội
    source                TEXT NOT NULL DEFAULT 'direct', -- 'facebook_ads', 'google_ads', 'website', 'showroom', 'referral', 'direct'
    preferred_variant_id  UUID REFERENCES public.auto_variants(id) ON DELETE RESTRICT,
    preferred_color       TEXT,
    budget_limit          NUMERIC(18,0),
    notes                 TEXT,
    
    -- TVBH được phân bổ (KTV / Sales Consultant)
    assigned_sales_agent_id UUID REFERENCES public.users(id),
    assigned_at           TIMESTAMP WITH TIME ZONE,
    
    -- Trạng thái lead
    status                TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'test_drive', 'negotiating', 'won', 'lost'
    lost_reason           TEXT,
    
    -- Audit
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_leads_tenant ON public.auto_leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_leads_customer ON public.auto_leads (customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_leads_sales_agent ON public.auto_leads (assigned_sales_agent_id);

-- 2. Bảng auto_bookings (Hợp đồng đặt cọc xe / Booking)
CREATE TABLE IF NOT EXISTS public.auto_bookings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id           UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id               UUID REFERENCES public.auto_leads(id) ON DELETE SET NULL,
    
    -- Chi tiết xe và VIN được phân bổ
    variant_id            UUID NOT NULL REFERENCES public.auto_variants(id) ON DELETE RESTRICT,
    vehicle_id            UUID REFERENCES public.auto_vehicles(id) ON DELETE RESTRICT, -- Số VIN được khớp
    color_exterior        TEXT NOT NULL,
    
    -- Chi tiết tài chính đặt cọc
    booking_number        TEXT NOT NULL, -- Số hợp đồng đặt cọc độc nhất
    total_price           NUMERIC(18,0) NOT NULL DEFAULT 0, -- Giá bán thỏa thuận
    deposit_amount        NUMERIC(18,0) NOT NULL DEFAULT 0, -- Số tiền cọc yêu cầu
    deposit_paid          NUMERIC(18,0) NOT NULL DEFAULT 0, -- Số tiền cọc thực tế đã đóng
    
    -- Trạng thái thanh toán & hợp đồng
    payment_status        TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'fully_paid', 'refunded'
    status                TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'completed' (đã bàn giao xe), 'cancelled'
    
    -- Kế toán ghi nhận
    accounting_entry_id   UUID, -- Liên kết sổ cái Outbox (nếu có)
    
    -- Audit
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uq_auto_bookings_number UNIQUE (tenant_id, booking_number)
);

CREATE INDEX IF NOT EXISTS idx_auto_bookings_tenant ON public.auto_bookings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_bookings_customer ON public.auto_bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_bookings_vehicle ON public.auto_bookings (vehicle_id);

-- 3. Enable RLS
ALTER TABLE public.auto_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_bookings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_leads') THEN
    CREATE POLICY "Tenant view auto_leads" ON public.auto_leads
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_bookings') THEN
    CREATE POLICY "Tenant view auto_bookings" ON public.auto_bookings
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- 5. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_leads_updated_at') THEN
    CREATE TRIGGER trg_auto_leads_updated_at
    BEFORE UPDATE ON public.auto_leads
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_bookings_updated_at') THEN
    CREATE TRIGGER trg_auto_bookings_updated_at
    BEFORE UPDATE ON public.auto_bookings
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;
END $$;
