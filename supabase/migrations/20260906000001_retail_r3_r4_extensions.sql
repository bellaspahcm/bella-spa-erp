-- Retail OS R3+R4 Extensions
-- Date: 2026-09-06
-- Purpose: Product Variants (R3) + Batch/Lot Tracking (R4)
-- Trigger: Real customer demand (Kids Clothing + Fresh Food products)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- R3: Product Variants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.retail_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  
  -- Variant Identity
  variant_sku TEXT NOT NULL,
  variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Inventory
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISCONTINUED')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, variant_sku)
);

-- Indexes for R3
CREATE INDEX idx_retail_product_variants_tenant ON public.retail_product_variants(tenant_id);
CREATE INDEX idx_retail_product_variants_product ON public.retail_product_variants(product_id);
CREATE INDEX idx_retail_product_variants_sku ON public.retail_product_variants(variant_sku);
CREATE INDEX idx_retail_product_variants_status ON public.retail_product_variants(status);

-- RLS for R3
ALTER TABLE public.retail_product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_product_variants ON public.retail_product_variants
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Comments for R3
COMMENT ON TABLE public.retail_product_variants IS 'Product variants for size/color/style variations (R3)';
COMMENT ON COLUMN public.retail_product_variants.variant_attributes IS 'JSONB attributes like {size: "4T", color: "red"}';

-- ============================================================================
-- R4: Batch/Lot Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.retail_product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id) ON DELETE CASCADE,
  
  -- Batch Identity
  batch_number TEXT NOT NULL,
  lot_number TEXT,
  
  -- Expiry
  manufactured_date DATE,
  expiry_date DATE NOT NULL,
  
  -- Inventory
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'RECALLED')),
  
  -- Metadata
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, product_id, batch_number)
);

-- Indexes for R4
CREATE INDEX idx_retail_product_batches_tenant ON public.retail_product_batches(tenant_id);
CREATE INDEX idx_retail_product_batches_product ON public.retail_product_batches(product_id);
CREATE INDEX idx_retail_product_batches_expiry ON public.retail_product_batches(expiry_date);
CREATE INDEX idx_retail_product_batches_status ON public.retail_product_batches(status);

-- RLS for R4
ALTER TABLE public.retail_product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_product_batches ON public.retail_product_batches
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Comments for R4
COMMENT ON TABLE public.retail_product_batches IS 'Batch/lot tracking with expiry dates (R4)';
COMMENT ON COLUMN public.retail_product_batches.expiry_date IS 'Required expiry date for FEFO inventory management';

-- ============================================================================
-- Inventory Movements Extension (R2 compatibility)
-- ============================================================================

-- Add optional variant/batch references to existing retail_inventory_movements
ALTER TABLE public.retail_inventory_movements 
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.retail_product_variants(id);

ALTER TABLE public.retail_inventory_movements 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.retail_product_batches(id);

CREATE INDEX IF NOT EXISTS idx_retail_inventory_movements_variant ON public.retail_inventory_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_retail_inventory_movements_batch ON public.retail_inventory_movements(batch_id);

COMMENT ON COLUMN public.retail_inventory_movements.variant_id IS 'Optional: Links movement to specific variant (R3)';
COMMENT ON COLUMN public.retail_inventory_movements.batch_id IS 'Optional: Links movement to specific batch (R4)';

-- ============================================================================
-- Backward Compatibility Notes
-- ============================================================================

-- 1. R1 Product Catalog: Unchanged, all existing products continue working
-- 2. R2 Inventory Movements: Extended with optional variant/batch references
-- 3. Products WITHOUT variants/batches: Work exactly as before (R1+R2 only)
-- 4. Products WITH variants: Parent product.current_stock = SUM(variant.current_stock)
-- 5. Products WITH batches: Parent product.current_stock = SUM(batch.current_stock)
