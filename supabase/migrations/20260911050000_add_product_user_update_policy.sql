-- ============================================================================
-- Migration: Add user-level UPDATE policy for real_estate_products
-- Date: 2026-09-11 05:00:00
-- Issue: P5.5 Reservation cancel fails - Product UPDATE blocked for non-admin users
-- Root Cause: Policy "Products: Manage for admins" requires admin/manager role
--             Test user (loadtest-realestate@test.local) has role='partner'
--             ReservationService cannot UPDATE product status during reserve/release
-- Classification: Insufficient Policy (exists but too restrictive)
-- ============================================================================

-- Evidence from production DB:
-- Current policy: "Products: Manage for admins" (cmd=ALL)
-- USING: tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
-- Test user: loadtest-realestate@test.local, role='partner'
-- Result: UPDATE blocked for partner users

-- Pattern reference:
-- re_reservations has "reservations_user_update" allowing authenticated users to UPDATE their own records
-- Matching pattern: tenant_id check without role restriction

-- Fix: Add user-level UPDATE policy (minimal scope, tenant-isolated)
DROP POLICY IF EXISTS "Products: Update for authenticated users" ON real_estate_products;
CREATE POLICY "Products: Update for authenticated users" ON real_estate_products
  FOR UPDATE 
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Note: Existing "Products: Manage for admins" (ALL) remains for admin operations
-- This new policy enables ReservationService to update product status for all authenticated users
-- Tenant isolation preserved via tenant_id check
-- No INSERT/DELETE added (not required for reservation lifecycle)
