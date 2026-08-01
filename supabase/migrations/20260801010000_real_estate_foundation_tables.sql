-- ============================================================================
-- Bella EIP — Real Estate Foundation tables (Capability 1)
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
-- Timestamp: 20260801010000
-- ============================================================================

-- 1. Create re_zones
CREATE TABLE IF NOT EXISTS public.re_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  total_area_m2 NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_re_zone_code UNIQUE (tenant_id, project_id, code)
);

CREATE INDEX IF NOT EXISTS idx_re_zones_lookup ON public.re_zones (tenant_id, project_id);

-- 2. Create re_blocks
CREATE TABLE IF NOT EXISTS public.re_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.re_zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  floors INT NOT NULL DEFAULT 1,
  units_per_floor INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_re_block_code UNIQUE (tenant_id, project_id, code)
);

CREATE INDEX IF NOT EXISTS idx_re_blocks_lookup ON public.re_blocks (tenant_id, project_id, zone_id);

-- 3. Additive columns on real_estate_products (Safe add, do not drop or modify existing)
ALTER TABLE public.real_estate_products 
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.re_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES public.re_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS floor_number INT,
  ADD COLUMN IF NOT EXISTS unit_code TEXT,
  ADD COLUMN IF NOT EXISTS area_m2 NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(15,2) DEFAULT 0 CHECK (base_price >= 0),
  ADD COLUMN IF NOT EXISTS floor_price NUMERIC(15,2) DEFAULT 0 CHECK (floor_price >= 0),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_real_estate_products_zone ON public.real_estate_products (zone_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_products_block ON public.real_estate_products (block_id);

-- 4. Create re_price_lists
CREATE TABLE IF NOT EXISTS public.re_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'published', 'expired', 'rolled_back')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_re_price_list_version UNIQUE (tenant_id, project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_re_price_lists_lookup ON public.re_price_lists (tenant_id, project_id, version DESC);

-- 5. Create re_product_prices
CREATE TABLE IF NOT EXISTS public.re_product_prices (
  price_list_id UUID NOT NULL REFERENCES public.re_price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.real_estate_products(id) ON DELETE CASCADE,
  base_price NUMERIC(15,2) NOT NULL CHECK (base_price >= 0),
  price_per_m2 NUMERIC(15,2) NOT NULL CHECK (price_per_m2 >= 0),
  floor_price NUMERIC(15,2) NOT NULL CHECK (floor_price >= 0),
  max_discount_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_rate >= 0 AND max_discount_rate <= 100),
  PRIMARY KEY (price_list_id, product_id)
);

-- 6. Create re_promotions
CREATE TABLE IF NOT EXISTS public.re_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  promotion_type TEXT NOT NULL CHECK (promotion_type IN ('early_bird', 'vip', 'bulk', 'bank_discount', 'campaign')),
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(15,2) NOT NULL CHECK (discount_value >= 0),
  max_uses INT CHECK (max_uses > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  stackable BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_promotions_lookup ON public.re_promotions (tenant_id, status);

-- 7. Create re_price_history (Immutable append-only log)
CREATE TABLE IF NOT EXISTS public.re_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.real_estate_products(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES public.re_price_lists(id) ON DELETE SET NULL,
  old_price NUMERIC(15,2),
  new_price NUMERIC(15,2) NOT NULL CHECK (new_price >= 0),
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_re_price_history_lookup ON public.re_price_history (tenant_id, product_id, changed_at DESC);

-- 8. Create rm_inventory_matrix Read Model
CREATE TABLE IF NOT EXISTS public.rm_inventory_matrix (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL,
  project_name TEXT,
  zone_id UUID,
  zone_code TEXT,
  block_id UUID,
  block_code TEXT,
  floor_number INT,
  unit_code TEXT,
  product_type TEXT,
  area_m2 NUMERIC(8,2),
  current_price NUMERIC(15,2),
  status TEXT NOT NULL,
  reserved_by_customer TEXT,
  reservation_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_inventory_matrix_lookup 
  ON public.rm_inventory_matrix (tenant_id, project_id, zone_id, block_id);

-- Enable RLS
ALTER TABLE public.re_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rm_inventory_matrix ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Tenant Access (Authenticated Users & Service Role)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_zones') THEN
    CREATE POLICY "Allow authenticated users full access to re_zones" ON public.re_zones FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_blocks') THEN
    CREATE POLICY "Allow authenticated users full access to re_blocks" ON public.re_blocks FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_price_lists') THEN
    CREATE POLICY "Allow authenticated users full access to re_price_lists" ON public.re_price_lists FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_product_prices') THEN
    CREATE POLICY "Allow authenticated users full access to re_product_prices" ON public.re_product_prices FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_promotions') THEN
    CREATE POLICY "Allow authenticated users full access to re_promotions" ON public.re_promotions FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_price_history') THEN
    CREATE POLICY "Allow authenticated users full access to re_price_history" ON public.re_price_history FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to rm_inventory_matrix') THEN
    CREATE POLICY "Allow authenticated users full access to rm_inventory_matrix" ON public.rm_inventory_matrix FOR ALL TO authenticated USING (true);
  END IF;
END $$;
