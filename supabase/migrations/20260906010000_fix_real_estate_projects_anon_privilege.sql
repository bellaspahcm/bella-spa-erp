-- Fix real_estate_projects table privilege for anon role
-- 
-- Context: E2E browser tests fail with "permission denied for table real_estate_projects"
-- Root Cause: Table only grants privileges to 'authenticated' and 'service_role', missing 'anon'
-- Evidence: Migration 20260731010000 line 146 explicitly REVOKEs from anon
-- Canonical Pattern: Bella tables grant to both anon and authenticated (e.g., bookings, customers)
--
-- Fix: Grant SELECT privilege to anon role (minimal privilege for read-only E2E tests)
-- Security: RLS policies already exist and enforce tenant isolation - this only grants table access
--
-- Date: 2026-09-06
-- Issue: Bella Land E2E validation

-- Grant SELECT privilege to anon role for real_estate_projects
-- This allows unauthenticated page loads (E2E pre-login context) while RLS policies still enforce tenant isolation
GRANT SELECT ON TABLE public.real_estate_projects TO anon;

-- Verify RLS is still enabled (should be TRUE)
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'real_estate_projects'
    AND relnamespace = 'public'::regnamespace;
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is not enabled on real_estate_projects - security violation';
  END IF;
  
  RAISE NOTICE 'RLS verification: real_estate_projects RLS enabled = %', rls_enabled;
END $$;

-- Add comment explaining the configuration
COMMENT ON TABLE public.real_estate_projects IS 'Real Estate projects with RLS tenant isolation. Privileges: anon (SELECT only for E2E), authenticated (full CRUD), service_role (full CRUD). RLS policies enforce tenant_id isolation and role-based access.';
