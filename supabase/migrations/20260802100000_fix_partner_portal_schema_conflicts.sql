-- =====================================================
-- Fix Partner Portal Schema Conflicts
-- Created: 2026-08-02
-- Purpose: ALTER existing tables to match Partner Portal requirements
-- Context: Tables real_estate_projects & real_estate_products already exist
--          with different schema. This migration adds missing columns and
--          converts TEXT fields to ENUMs without losing production data.
-- =====================================================

-- Step 1: Add missing columns to real_estate_projects
ALTER TABLE IF EXISTS public.real_estate_projects 
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS developer TEXT,
ADD COLUMN IF NOT EXISTS total_units INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

-- Step 2: Generate code values for existing rows (PRJ-001, PRJ-002, ...)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.real_estate_projects WHERE code IS NULL
  ) THEN
    WITH numbered_projects AS (
      SELECT 
        id,
        'PRJ-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0') AS new_code
      FROM public.real_estate_projects
      WHERE code IS NULL
    )
    UPDATE public.real_estate_projects p
    SET code = np.new_code
    FROM numbered_projects np
    WHERE p.id = np.id;
  END IF;
END $$;

-- Step 3: Add unique constraint to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 're_projects_tenant_code_unique'
  ) THEN
    ALTER TABLE public.real_estate_projects
    ADD CONSTRAINT re_projects_tenant_code_unique 
    UNIQUE (tenant_id, code);
  END IF;
END $$;

-- Step 4: Add missing columns to real_estate_products
ALTER TABLE IF EXISTS public.real_estate_products 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

-- Step 5: Convert product_type from TEXT to ENUM (if column exists as TEXT)
DO $$
BEGIN
  -- Check if product_type is TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'real_estate_products' 
      AND column_name = 'product_type' 
      AND data_type = 'text'
  ) THEN
    -- Add temporary ENUM column
    ALTER TABLE public.real_estate_products 
    ADD COLUMN IF NOT EXISTS product_type_enum public.re_product_type;
    
    -- Map existing TEXT values to ENUM
    UPDATE public.real_estate_products
    SET product_type_enum = CASE 
      WHEN LOWER(product_type) = 'apartment' THEN 'apartment'::public.re_product_type
      WHEN LOWER(product_type) = 'townhouse' THEN 'townhouse'::public.re_product_type
      WHEN LOWER(product_type) = 'shophouse' THEN 'shophouse'::public.re_product_type
      WHEN LOWER(product_type) = 'villa' THEN 'villa'::public.re_product_type
      WHEN LOWER(product_type) LIKE '%land%' THEN 'land_plot'::public.re_product_type
      WHEN LOWER(product_type) = 'office' THEN 'office'::public.re_product_type
      ELSE 'apartment'::public.re_product_type
    END;
    
    -- Drop old TEXT column and rename ENUM column
    ALTER TABLE public.real_estate_products DROP COLUMN product_type;
    ALTER TABLE public.real_estate_products RENAME COLUMN product_type_enum TO product_type;
    ALTER TABLE public.real_estate_products ALTER COLUMN product_type SET NOT NULL;
  END IF;
END $$;

-- Step 6: Convert status from TEXT to ENUM (if column exists as TEXT)
DO $$
BEGIN
  -- Check if status is TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'real_estate_products' 
      AND column_name = 'status' 
      AND data_type = 'text'
  ) THEN
    -- Add temporary ENUM column
    ALTER TABLE public.real_estate_products 
    ADD COLUMN IF NOT EXISTS status_enum public.re_product_status;
    
    -- Map existing TEXT values to ENUM
    UPDATE public.real_estate_products
    SET status_enum = CASE 
      WHEN LOWER(status) = 'available' THEN 'available'::public.re_product_status
      WHEN LOWER(status) = 'booked' THEN 'booked'::public.re_product_status
      WHEN LOWER(status) = 'deposited' THEN 'deposited'::public.re_product_status
      WHEN LOWER(status) = 'contracted' THEN 'contracted'::public.re_product_status
      WHEN LOWER(status) = 'paid' THEN 'paid'::public.re_product_status
      WHEN LOWER(status) LIKE '%hand%' OR LOWER(status) = 'completed' THEN 'handed_over'::public.re_product_status
      WHEN LOWER(status) = 'cancelled' THEN 'cancelled'::public.re_product_status
      ELSE 'available'::public.re_product_status
    END;
    
    -- Drop old TEXT column and rename ENUM column
    ALTER TABLE public.real_estate_products DROP COLUMN status;
    ALTER TABLE public.real_estate_products RENAME COLUMN status_enum TO status;
    ALTER TABLE public.real_estate_products ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

-- Step 7: Add indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_re_products_tenant ON public.real_estate_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_products_project ON public.real_estate_products(project_id);
CREATE INDEX IF NOT EXISTS idx_re_products_code ON public.real_estate_products(product_code);
CREATE INDEX IF NOT EXISTS idx_re_products_status ON public.real_estate_products(status);
CREATE INDEX IF NOT EXISTS idx_re_products_type ON public.real_estate_products(product_type);

-- Step 8: Add unique constraint to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 're_products_tenant_code_unique'
  ) THEN
    ALTER TABLE public.real_estate_products
    ADD CONSTRAINT re_products_tenant_code_unique 
    UNIQUE (tenant_id, product_code);
  END IF;
END $$;

-- Success message
COMMENT ON TABLE public.real_estate_projects IS 'Altered for Partner Portal compatibility - preserves 18 existing rows';
COMMENT ON TABLE public.real_estate_products IS 'Altered for Partner Portal compatibility - preserves 36 existing rows';
