-- Retail OS RLS Policy Fix
-- Date: 2026-09-06
-- Purpose: Add WITH CHECK clause to allow INSERTs

-- Drop and recreate policies with both USING and WITH CHECK

-- Products
DROP POLICY IF EXISTS tenant_isolation_retail_products ON public.retail_products;
CREATE POLICY tenant_isolation_retail_products ON public.retail_products
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Product Variants
DROP POLICY IF EXISTS tenant_isolation_retail_product_variants ON public.retail_product_variants;
CREATE POLICY tenant_isolation_retail_product_variants ON public.retail_product_variants
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Product Batches
DROP POLICY IF EXISTS tenant_isolation_retail_product_batches ON public.retail_product_batches;
CREATE POLICY tenant_isolation_retail_product_batches ON public.retail_product_batches
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Inventory Movements
DROP POLICY IF EXISTS tenant_isolation_retail_inventory_movements ON public.retail_inventory_movements;
CREATE POLICY tenant_isolation_retail_inventory_movements ON public.retail_inventory_movements
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);
