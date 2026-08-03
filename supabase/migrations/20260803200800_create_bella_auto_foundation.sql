-- ============================================================================
-- Bella EIP — Bella Auto Foundation tables (Phase 0)
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
-- Timestamp: 20260803200800
-- ============================================================================

-- 1. Bảng auto_brands (Thương hiệu xe)
CREATE TABLE IF NOT EXISTS public.auto_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    country_of_origin TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_auto_brands_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_auto_brands_tenant ON public.auto_brands (tenant_id);

-- 2. Bảng auto_models (Dòng xe)
CREATE TABLE IF NOT EXISTS public.auto_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.auto_brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    segment TEXT, -- Sedan, SUV, Crossover, MPV, Hatchback...
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_auto_models_name UNIQUE (tenant_id, brand_id, name)
);

CREATE INDEX IF NOT EXISTS idx_auto_models_lookup ON public.auto_models (tenant_id, brand_id);

-- 3. Bảng auto_variants (Phiên bản xe)
CREATE TABLE IF NOT EXISTS public.auto_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES public.auto_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ví dụ: LCI, xDrive, Luxury Line...
    year INTEGER NOT NULL,
    fuel_type TEXT, -- Gasoline, Diesel, EV, Hybrid...
    transmission TEXT, -- Automatic, Manual...
    specs_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_auto_variants_name UNIQUE (tenant_id, model_id, name, year)
);

CREATE INDEX IF NOT EXISTS idx_auto_variants_lookup ON public.auto_variants (tenant_id, model_id);

-- Enable RLS
ALTER TABLE public.auto_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_variants ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Tenant Access (Authenticated Users & Service Role)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_brands') THEN
    CREATE POLICY "Tenant view auto_brands" ON public.auto_brands
        FOR ALL TO authenticated
        USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_models') THEN
    CREATE POLICY "Tenant view auto_models" ON public.auto_models
        FOR ALL TO authenticated
        USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant view auto_variants') THEN
    CREATE POLICY "Tenant view auto_variants" ON public.auto_variants
        FOR ALL TO authenticated
        USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
        WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;
