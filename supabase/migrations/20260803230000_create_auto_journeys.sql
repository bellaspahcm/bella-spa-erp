-- ============================================================================
-- Bella EIP — Bella Auto Phase 3: Journey Engine & Experience Management
-- Architectural Invariant 01: Fully Additive. No impact on production tenants.
-- Timestamp: 20260803230000
-- ============================================================================

-- 1. Bảng auto_journey_stages (Danh mục định nghĩa 22 giai đoạn hành trình)
CREATE TABLE IF NOT EXISTS public.auto_journey_stages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code           TEXT NOT NULL,            -- Ví dụ: 'lead_new', 'test_drive', 'negotiation', 'delivered', 'service_10k', 'trade_in'
    name           TEXT NOT NULL,            -- Tên giai đoạn tiếng Việt
    description    TEXT,
    sort_order     INTEGER NOT NULL,         -- Thứ tự sắp xếp trong phễu hành trình (1-22)
    sla_hours      INTEGER DEFAULT 24,       -- SLA thời gian tối đa được ở stage này (để JourneySLAMonitorService check)
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_auto_journey_stages_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_auto_journey_stages_tenant ON public.auto_journey_stages (tenant_id);

-- 2. Bảng auto_customer_journeys (Theo dõi hành trình hiện tại của từng khách hàng)
CREATE TABLE IF NOT EXISTS public.auto_customer_journeys (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    current_stage_id UUID NOT NULL REFERENCES public.auto_journey_stages(id) ON DELETE RESTRICT,
    
    -- SLA tracking
    entered_stage_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sla_deadline   TIMESTAMP WITH TIME ZONE, -- calculated dynamically = entered_stage_at + sla_hours
    sla_status     TEXT NOT NULL DEFAULT 'on_time', -- 'on_time', 'at_risk', 'breached'
    
    -- Audit
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_auto_customer_journeys_customer UNIQUE (tenant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_customer_journeys_tenant ON public.auto_customer_journeys (tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_customer_journeys_customer ON public.auto_customer_journeys (customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_customer_journeys_stage ON public.auto_customer_journeys (current_stage_id);

-- 3. Bảng auto_journey_events (Lịch sử chuyển đổi giai đoạn - immutable logs)
CREATE TABLE IF NOT EXISTS public.auto_journey_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id     UUID NOT NULL REFERENCES public.auto_customer_journeys(id) ON DELETE CASCADE,
    from_stage_id  UUID REFERENCES public.auto_journey_stages(id) ON DELETE RESTRICT,
    to_stage_id    UUID NOT NULL REFERENCES public.auto_journey_stages(id) ON DELETE RESTRICT,
    changed_by_user_id UUID REFERENCES public.users(id),
    duration_hours NUMERIC(10,2),            -- Thời gian lưu trú ở stage cũ (hours)
    reason         TEXT,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_journey_events_journey ON public.auto_journey_events (journey_id);
CREATE INDEX IF NOT EXISTS idx_auto_journey_events_tenant ON public.auto_journey_events (tenant_id);

-- 4. Bảng auto_touchpoints (Touchpoints tự động ghi nhận tương tác đa kênh)
CREATE TABLE IF NOT EXISTS public.auto_touchpoints (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    channel        TEXT NOT NULL,            -- 'call', 'email', 'zalo', 'showroom_visit', 'test_drive', 'website_event'
    direction      TEXT NOT NULL DEFAULT 'inbound', -- 'inbound', 'outbound'
    title          TEXT NOT NULL,            -- Tiêu đề tương tác (e.g. 'Cuộc gọi tư vấn xe BMW M4')
    content        TEXT,                     -- Chi tiết tương tác / note cuộc gọi
    interacted_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    staff_id       UUID REFERENCES public.users(id),
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_touchpoints_customer ON public.auto_touchpoints (customer_id);
CREATE INDEX IF NOT EXISTS idx_auto_touchpoints_tenant ON public.auto_touchpoints (tenant_id);

-- 5. Enable RLS
ALTER TABLE public.auto_journey_stages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_customer_journeys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_journey_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_touchpoints         ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_journey_stages') THEN
    CREATE POLICY "Tenant view auto_journey_stages" ON public.auto_journey_stages
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_customer_journeys') THEN
    CREATE POLICY "Tenant view auto_customer_journeys" ON public.auto_customer_journeys
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_journey_events') THEN
    CREATE POLICY "Tenant view auto_journey_events" ON public.auto_journey_events
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_touchpoints') THEN
    CREATE POLICY "Tenant view auto_touchpoints" ON public.auto_touchpoints
        FOR ALL TO authenticated
        USING  (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- 7. Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_journey_stages_updated_at') THEN
    CREATE TRIGGER trg_auto_journey_stages_updated_at
    BEFORE UPDATE ON public.auto_journey_stages
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_customer_journeys_updated_at') THEN
    CREATE TRIGGER trg_auto_customer_journeys_updated_at
    BEFORE UPDATE ON public.auto_customer_journeys
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_updated_at();
  END IF;
END $$;
