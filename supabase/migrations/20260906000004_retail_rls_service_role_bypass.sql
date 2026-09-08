-- Retail OS RLS Service Role Bypass
-- Date: 2026-09-06
-- Purpose: Allow service_role to bypass RLS for testing

-- Drop existing policies
DROP POLICY IF EXISTS tenant_isolation_retail_products ON public.retail_products;
DROP POLICY IF EXISTS tenant_isolation_retail_product_variants ON public.retail_product_variants;
DROP POLICY IF EXISTS tenant_isolation_retail_product_batches ON public.retail_product_batches;
DROP POLICY IF EXISTS tenant_isolation_retail_inventory_movements ON public.retail_inventory_movements;

-- Recreate with service_role bypass
-- Products
CREATE POLICY tenant_isolation_retail_products ON public.retail_products
  USING (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
  WITH CHECK (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  );

-- Product Variants
CREATE POLICY tenant_isolation_retail_product_variants ON public.retail_product_variants
  USING (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
  WITH CHECK (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  );

-- Product Batches
CREATE POLICY tenant_isolation_retail_product_batches ON public.retail_product_batches
  USING (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
  WITH CHECK (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  );

-- Inventory Movements
CREATE POLICY tenant_isolation_retail_inventory_movements ON public.retail_inventory_movements
  USING (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
  WITH CHECK (
    current_user = 'service_role' OR 
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  );
