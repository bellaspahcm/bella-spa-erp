-- ============================================================================
-- Migration: Add RLS UPDATE/INSERT policies for real_estate_products
-- Date: 2026-09-11 05:00:00
-- Issue: P5.5 Reservation cancel fails because Product UPDATE is blocked by RLS
-- Root Cause: real_estate_products has SELECT policy but missing UPDATE/INSERT
-- Fix: Add policies to allow authenticated users to UPDATE/INSERT products in their tenant
-- ============================================================================

-- Products: Users can INSERT products for their tenant
DROP POLICY IF EXISTS "products_tenant_insert" ON real_estate_products;
CREATE POLICY "products_tenant_insert" ON real_estate_products
  FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Products: Users can UPDATE products in their tenant
DROP POLICY IF EXISTS "products_tenant_update" ON real_estate_products;
CREATE POLICY "products_tenant_update" ON real_estate_products
  FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Products: Users can DELETE products in their tenant (for completeness)
DROP POLICY IF EXISTS "products_tenant_delete" ON real_estate_products;
CREATE POLICY "products_tenant_delete" ON real_estate_products
  FOR DELETE 
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
