-- ============================================================================
-- Bella EIP — Bella Auto Phase 1: auto_vehicles (VIN Management)
-- Architectural Invariant 01: Fully Additive. No impact on production tenants.
-- Timestamp: 20260803210000
-- ============================================================================

-- Vehicle status type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auto_vehicle_status') THEN
    CREATE TYPE public.auto_vehicle_status AS ENUM (
      'in_transit',   -- Đang vận chuyển từ nhà sản xuất / cảng
      'warehouse',    -- Đã về tổng kho
      'showroom',     -- Đang trưng bày tại showroom
      'allocated',    -- Đã phân bổ cho một hợp đồng đặt cọc
      'delivered',    -- Đã bàn giao cho khách hàng
      'returned',     -- Đã thu hồi (trả hàng / lỗi)
      'scrapped'      -- Đã thanh lý / hủy
    );
  END IF;
END $$;

-- 1. Bảng auto_vehicles (Kho xe theo số VIN)
CREATE TABLE IF NOT EXISTS public.auto_vehicles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Catalog references
    variant_id     UUID NOT NULL REFERENCES public.auto_variants(id) ON DELETE RESTRICT,

    -- Identity
    vin            TEXT NOT NULL,           -- Vehicle Identification Number (17 chars)
    chassis_number TEXT,                    -- Số khung
    engine_number  TEXT,                    -- Số máy

    -- Spec overrides per unit
    color_exterior TEXT NOT NULL,
    color_interior TEXT,
    model_year     INTEGER NOT NULL,

    -- Pricing
    list_price     NUMERIC(18,0) NOT NULL DEFAULT 0,  -- Giá niêm yết (VND)
    cost_price     NUMERIC(18,0) NOT NULL DEFAULT 0,  -- Giá vốn nhập

    -- Lifecycle status (state machine enforced at application layer)
    status         public.auto_vehicle_status NOT NULL DEFAULT 'in_transit',

    -- Location tracking
    location_note  TEXT,      -- Chi nhánh / kho hiện tại

    -- Allocation (set when status = 'allocated')
    allocated_to_contract_id  UUID,         -- FK to auto_bookings (Phase 4)
    allocated_at              TIMESTAMP WITH TIME ZONE,
    allocated_by_user_id      UUID REFERENCES public.users(id),

    -- Delivery (set when status = 'delivered')
    delivered_at              TIMESTAMP WITH TIME ZONE,
    delivered_to_customer_id  UUID,         -- FK to customers (Phase 2)
    delivery_notes            TEXT,

    -- Import / logistics
    expected_arrival_date     DATE,
    actual_arrival_date       DATE,
    import_declaration_number TEXT,         -- Số tờ khai hải quan

    -- Audit
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Constraints
    CONSTRAINT uq_auto_vehicles_vin UNIQUE (tenant_id, vin),
    CONSTRAINT chk_auto_vehicles_vin_length CHECK (char_length(vin) = 17)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_tenant         ON public.auto_vehicles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_variant        ON public.auto_vehicles (tenant_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_status         ON public.auto_vehicles (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_vin            ON public.auto_vehicles (tenant_id, vin);

-- 2. Bảng auto_vehicle_status_logs (Lịch sử thay đổi trạng thái VIN — immutable)
CREATE TABLE IF NOT EXISTS public.auto_vehicle_status_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id     UUID NOT NULL REFERENCES public.auto_vehicles(id) ON DELETE CASCADE,
    from_status    public.auto_vehicle_status,
    to_status      public.auto_vehicle_status NOT NULL,
    changed_by_user_id UUID REFERENCES public.users(id),
    reason         TEXT,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_vehicle_status_logs_vehicle ON public.auto_vehicle_status_logs (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_auto_vehicle_status_logs_tenant  ON public.auto_vehicle_status_logs (tenant_id);

-- 3. Enable RLS
ALTER TABLE public.auto_vehicles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_vehicle_status_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_vehicles') THEN
    CREATE POLICY "Tenant view auto_vehicles" ON public.auto_vehicles
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_vehicle_status_logs') THEN
    CREATE POLICY "Tenant view auto_vehicle_status_logs" ON public.auto_vehicle_status_logs
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- 5. updated_at trigger (reuse pattern from existing tables)
CREATE OR REPLACE FUNCTION public.auto_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_auto_vehicles_updated_at'
  ) THEN
    CREATE TRIGGER trg_auto_vehicles_updated_at
    BEFORE UPDATE ON public.auto_vehicles
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;
END $$;
