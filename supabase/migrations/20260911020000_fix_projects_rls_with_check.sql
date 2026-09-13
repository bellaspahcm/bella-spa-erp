-- ============================================================================
-- Fix: Projects RLS WITH CHECK Missing
-- Migration: Add WITH CHECK clause to enforce tenant boundary on INSERT/UPDATE
-- Date: 2026-09-11
-- Defect: DEFECT-P1-TENANT-WRITE
-- ============================================================================
--
-- ISSUE:
--   RLS policy "Projects: Manage for admins" has USING clause (SELECT filter)
--   but NO WITH CHECK clause (INSERT/UPDATE enforcement).
--
--   Result: Authenticated users can INSERT/UPDATE with wrong tenant_id
--
-- FIX:
--   Add WITH CHECK clause to enforce tenant_id matches authenticated user's tenant
--
-- IMPACT:
--   - Authenticated connections: tenant boundary enforced ✅
--   - Service-role connections: still bypass RLS (by design, app must validate)
--
-- EVIDENCE:
--   - P1.1 Test T5: Wrong-tenant insert ALLOWED (before fix)
--   - After fix: Should be BLOCKED for authenticated, app-validated for service-role
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop existing policy (will recreate with WITH CHECK)
-- ============================================================================

DROP POLICY IF EXISTS "Projects: Manage for admins" 
  ON real_estate_projects;

-- ============================================================================
-- Step 2: Recreate policy with WITH CHECK clause
-- ============================================================================

CREATE POLICY "Projects: Manage for admins"
ON real_estate_projects
FOR ALL
TO authenticated
USING (
  -- SELECT filtering: only see projects in own tenant
  tenant_id IN (
    SELECT users.tenant_id 
    FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  -- INSERT/UPDATE enforcement: can only write to own tenant
  tenant_id IN (
    SELECT users.tenant_id 
    FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
  )
);

-- ============================================================================
-- Step 3: Verify policy exists with WITH CHECK
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
  with_check_present BOOLEAN;
BEGIN
  -- Check policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'real_estate_projects'
    AND policyname = 'Projects: Manage for admins';
  
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'Policy "Projects: Manage for admins" not found after creation';
  END IF;
  
  -- Check WITH CHECK clause exists (not NULL)
  SELECT (with_check IS NOT NULL) INTO with_check_present
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'real_estate_projects'
    AND policyname = 'Projects: Manage for admins';
  
  IF NOT with_check_present THEN
    RAISE WARNING 'WITH CHECK clause may not be properly set';
  ELSE
    RAISE NOTICE '✅ Migration successful: WITH CHECK clause added';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================
--
-- After this migration:
--
-- 1. Authenticated users (admin/manager):
--    - CAN insert/update projects with own tenant_id ✅
--    - CANNOT insert/update projects with other tenant_id ❌
--
-- 2. Service-role connections:
--    - Still bypass RLS (by PostgreSQL design)
--    - Application layer MUST validate tenant ownership
--    - ProjectService already injects tenant_id from auth context ✅
--
-- 3. Verification required:
--    - Rerun P1.1 tests (especially T5)
--    - Test authenticated context (not just service-role)
--    - Verify normal workflow still works (T1-T4)
--
-- 4. Related policies to review:
--    - "Projects: View for authenticated users" (SELECT only - OK)
--    - "projects_tenant_read" (SELECT only, public role - OK)
--
-- ============================================================================
--
-- Security Note:
--
-- WITH CHECK is essential for multi-tenant security:
--
-- ❌ WITHOUT WITH CHECK:
--    User can do: INSERT INTO projects (tenant_id, ...) VALUES ('other-tenant', ...)
--    Result: Cross-tenant ownership violation
--
-- ✅ WITH WITH CHECK:
--    Same insert attempt → "new row violates row-level security policy"
--    Result: Tenant boundary enforced
--
-- However: service-role bypasses ALL RLS policies.
-- Application code using service-role MUST validate tenant ownership.
--
-- ============================================================================
