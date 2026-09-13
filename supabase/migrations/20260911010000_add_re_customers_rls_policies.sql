-- ============================================================================
-- Migration: Add RLS Policies for re_customers
-- Created: 2026-09-11
-- Purpose: Enable tenant isolation for real estate customers table
-- Context: Bella Land v2 RC — Phase 3 Customers Evidence Closure
-- ============================================================================

-- Verify RLS is enabled (should already be enabled from 20260802150000)
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policy 1: Read Access (SELECT)
-- Scope: Users can see customers in their own tenant, HQ super admins see all
-- Pattern: Matches canonical authorization used by Projects/Products
-- ============================================================================
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;

CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

-- ============================================================================
-- Policy 2: Write Access (INSERT, UPDATE, DELETE)
-- Scope: Admins can modify customers in their tenant, HQ super admins can modify all
-- Security: WITH CHECK prevents tenant_id forgery/escape on INSERT/UPDATE
-- Pattern: Matches canonical authorization used by Projects/Products
-- ============================================================================
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

CREATE POLICY "re_customers_tenant_write"
  ON re_customers
  FOR ALL
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- ============================================================================
-- Verification Comments
-- ============================================================================
COMMENT ON POLICY "re_customers_tenant_read" ON re_customers IS 
  'C3.2-A2: Allow users to read customers in their own tenant only';

COMMENT ON POLICY "re_customers_tenant_write" ON re_customers IS 
  'C3.2-A1,A4,A5,A6,A7: Allow users to write customers in their own tenant only. WITH CHECK prevents tenant_id forgery and escape attempts.';

-- ============================================================================
-- Expected Behavior:
-- 
-- ✅ PASS: Tenant A user reads Tenant A customers
-- ✅ PASS: Tenant A user creates customer with Tenant A tenant_id
-- ✅ PASS: Tenant A user updates Tenant A customer
-- ✅ PASS: Tenant A user deletes Tenant A customer
-- 
-- ❌ BLOCK: Tenant A user reads Tenant B customers
-- ❌ BLOCK: Tenant A user updates Tenant B customer
-- ❌ BLOCK: Tenant A user deletes Tenant B customer
-- ❌ BLOCK: Tenant A user creates customer with Tenant B tenant_id (forgery)
-- ❌ BLOCK: Tenant A user updates customer.tenant_id to Tenant B (escape)
-- ============================================================================
