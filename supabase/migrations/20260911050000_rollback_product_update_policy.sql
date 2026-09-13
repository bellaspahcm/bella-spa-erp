-- ============================================================================
-- Migration: Rollback Product UPDATE Policy (Service-Layer Authorization)
-- Date: 2026-09-11 05:00:00
-- Issue: P5.5 Reservation workflow blocked by admin-only Product UPDATE policy
-- Initial attempt: Added user-level UPDATE policy (ROLLED BACK due to privilege expansion)
-- Final solution: Service-layer authorization via service_role client
-- ============================================================================

-- Root cause analysis:
-- - Policy "Products: Manage for admins" restricts UPDATE to admin/manager only
-- - ReservationService needs to UPDATE product status during reserve/release
-- - Initial fix: Added generic UPDATE policy for all authenticated users
-- - Security issue: Allowed ktv users to UPDATE price, area, project_id, etc.
-- - Principle of least privilege violated

-- Correct approach:
-- 1. Keep admin-only RLS policy intact (security boundary)
-- 2. Application code uses service_role client for privileged operations
-- 3. Authorization enforced at Server Action layer (user authentication)
-- 4. ReservationService receives service client → bypasses RLS for controlled mutations
-- 5. Only Product status affected, not price/area/relationships

-- This migration documents the rollback (already executed via CLI)
-- No SQL changes needed - admin-only policy remains as canonical authorization

-- Policy state after this migration:
-- - "Products: Manage for admins" (ALL): admin/manager only ✓
-- - "Products: View for authenticated users" (SELECT): all authenticated ✓
-- - "products_tenant_read" (SELECT): all authenticated ✓
-- - No generic UPDATE policy for non-admin users ✓

-- Application implementation:
-- - src/lib/supabase-service.ts: Service client helper
-- - src/modules/real_estate/actions/reservationActions.ts: Uses service client
-- - Authorization: User authenticated → Service performs privileged mutation

-- Security verification:
-- Negative test: ktv user direct UPDATE on Product price/area → MUST BLOCK
-- Positive test: Authenticated reservation workflow → Product status transitions work
