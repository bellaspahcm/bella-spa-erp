-- Migration: Enable RLS and Tenant Isolation for Retail OS Tables
-- Purpose: Remediate security gap - apply canonical Bella tenant isolation pattern
-- Date: 2026-09-06
-- Context: Retail Products validation discovered RLS was disabled on shared DB
-- Pattern: Uses public.get_auth_tenant_id() (canonical Bella function)

-- =============================================================================
-- RETAIL PRODUCTS TABLE
-- =============================================================================

-- Enable RLS
ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Tenant isolation - retail products" ON public.retail_products;
DROP POLICY IF EXISTS "Service role full access - retail products" ON public.retail_products;

-- Tenant isolation policy for authenticated users
CREATE POLICY "Tenant isolation - retail products"
  ON public.retail_products
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- Service role full access (for tests, migrations, background jobs)
CREATE POLICY "Service role full access - retail products"
  ON public.retail_products
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON POLICY "Tenant isolation - retail products" ON public.retail_products IS
  'Canonical Bella tenant isolation: authenticated users see only their tenant data';

-- =============================================================================
-- RETAIL INVENTORY MOVEMENTS TABLE
-- =============================================================================

ALTER TABLE public.retail_inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation - inventory movements" ON public.retail_inventory_movements;
DROP POLICY IF EXISTS "Service role full access - inventory movements" ON public.retail_inventory_movements;

CREATE POLICY "Tenant isolation - inventory movements"
  ON public.retail_inventory_movements
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Service role full access - inventory movements"
  ON public.retail_inventory_movements
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON POLICY "Tenant isolation - inventory movements" ON public.retail_inventory_movements IS
  'Canonical Bella tenant isolation: authenticated users see only their tenant data';

-- =============================================================================
-- RETAIL PRODUCT VARIANTS TABLE (R3)
-- =============================================================================

ALTER TABLE public.retail_product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation - product variants" ON public.retail_product_variants;
DROP POLICY IF EXISTS "Service role full access - product variants" ON public.retail_product_variants;

CREATE POLICY "Tenant isolation - product variants"
  ON public.retail_product_variants
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Service role full access - product variants"
  ON public.retail_product_variants
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON POLICY "Tenant isolation - product variants" ON public.retail_product_variants IS
  'Canonical Bella tenant isolation: authenticated users see only their tenant data';

-- =============================================================================
-- RETAIL PRODUCT BATCHES TABLE (R4)
-- =============================================================================

ALTER TABLE public.retail_product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation - product batches" ON public.retail_product_batches;
DROP POLICY IF EXISTS "Service role full access - product batches" ON public.retail_product_batches;

CREATE POLICY "Tenant isolation - product batches"
  ON public.retail_product_batches
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Service role full access - product batches"
  ON public.retail_product_batches
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON POLICY "Tenant isolation - product batches" ON public.retail_product_batches IS
  'Canonical Bella tenant isolation: authenticated users see only their tenant data';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify RLS is enabled on all retail tables
DO $$
DECLARE
  rls_status RECORD;
  missing_rls TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR rls_status IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('retail_products', 'retail_inventory_movements', 'retail_product_variants', 'retail_product_batches')
  LOOP
    IF NOT rls_status.rowsecurity THEN
      missing_rls := array_append(missing_rls, rls_status.tablename);
    END IF;
  END LOOP;

  IF array_length(missing_rls, 1) > 0 THEN
    RAISE EXCEPTION 'RLS verification failed: tables without RLS enabled: %', array_to_string(missing_rls, ', ');
  ELSE
    RAISE NOTICE '✅ RLS verification passed: All retail tables have RLS enabled';
  END IF;
END $$;

-- Verify policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('retail_products', 'retail_inventory_movements', 'retail_product_variants', 'retail_product_batches');

  IF policy_count < 8 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 8 policies (2 per table), found %', policy_count;
  ELSE
    RAISE NOTICE '✅ Policy verification passed: % tenant isolation + service_role policies created', policy_count;
  END IF;
END $$;
