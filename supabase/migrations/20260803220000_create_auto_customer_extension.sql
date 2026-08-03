-- ============================================================================
-- Bella EIP — Bella Auto Phase 2: auto_vehicle_owners (Customer 360 Extension)
-- Architectural Invariant 01: Fully Additive. No impact on production tenants.
-- Timestamp: 20260803220000
-- ============================================================================

-- 1. Bảng auto_vehicle_owners (Mối quan hệ sở hữu xe giữa Customer và Vehicle)
CREATE TABLE IF NOT EXISTS public.auto_vehicle_owners (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Link tới bảng khách hàng core (customers) và xe (auto_vehicles)
    customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_id     UUID NOT NULL REFERENCES public.auto_vehicles(id) ON DELETE CASCADE,
    
    -- Chi tiết sở hữu
    ownership_type TEXT NOT NULL DEFAULT 'primary', -- primary (chủ sở hữu chính), co_owner (đồng sở hữu), user (người sử dụng chính)
    license_plate  TEXT,                            -- Biển số xe
    registration_date DATE,                         -- Ngày đăng ký xe
    
    -- Lịch sử đổi xe / Trạng thái sở hữu
    is_active      BOOLEAN NOT NULL DEFAULT true,   -- true = đang sở hữu, false = đã chuyển nhượng / bán lại
    transferred_at TIMESTAMP WITH TIME ZONE,       -- Thời điểm chuyển nhượng (nếu không còn sở hữu)
    transfer_notes TEXT,                            -- Ghi chú chuyển nhượng
    
    -- Audit
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Đảm bảo mỗi xe chỉ có 1 chủ sở hữu chính đang kích hoạt tại một thời điểm
    CONSTRAINT uq_primary_owner_per_vehicle UNIQUE (tenant_id, vehicle_id, ownership_type) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_vehicle_owners_tenant    ON public.auto_vehicle_owners (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_vehicle_owners_customer  ON public.auto_vehicle_owners (customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_vehicle_owners_vehicle   ON public.auto_vehicle_owners (vehicle_id);

-- 2. Bảng auto_customer_profiles (Thông tin mở rộng Automotive cho khách hàng)
CREATE TABLE IF NOT EXISTS public.auto_customer_profiles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id           UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Thông tin khảo sát / Sở thích ô tô
    preferred_brands      TEXT[], -- Danh sách thương hiệu xe quan tâm
    preferred_segments    TEXT[], -- MPV, Sedan, SUV, v.v.
    budget_range          TEXT,   -- Khoảng tài chính mong muốn
    purchasing_purpose    TEXT,   -- Mục đích mua xe (Gia đình, kinh doanh, cá nhân...)
    
    -- Tóm tắt lịch sử giao dịch ô tô (tính toán nhanh)
    total_vehicles_owned  INTEGER DEFAULT 0 NOT NULL,
    total_value_spent     NUMERIC(18,0) DEFAULT 0 NOT NULL,
    
    -- Audit
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uq_auto_customer_profiles UNIQUE (tenant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_customer_profiles_lookup ON public.auto_customer_profiles (tenant_id, customer_id);

-- 3. Enable RLS
ALTER TABLE public.auto_vehicle_owners      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_customer_profiles   ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_vehicle_owners') THEN
    CREATE POLICY "Tenant view auto_vehicle_owners" ON public.auto_vehicle_owners
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_customer_profiles') THEN
    CREATE POLICY "Tenant view auto_customer_profiles" ON public.auto_customer_profiles
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- 5. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_vehicle_owners_updated_at') THEN
    CREATE TRIGGER trg_auto_vehicle_owners_updated_at
    BEFORE UPDATE ON public.auto_vehicle_owners
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_customer_profiles_updated_at') THEN
    CREATE TRIGGER trg_auto_customer_profiles_updated_at
    BEFORE UPDATE ON public.auto_customer_profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;
END $$;
