-- ============================================================================
-- Platform Org/People RLS Repair
-- ============================================================================
-- Migration: 20260914
-- Owner: Platform Org Unit / Authorization
-- Purpose: Restore tenant-scoped read and admin-scoped write policies required
--          by security_invoker authorization projections.
-- ============================================================================

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_units_tenant_read ON public.org_units;
DROP POLICY IF EXISTS org_units_admin_write ON public.org_units;
DROP POLICY IF EXISTS org_relationships_tenant_read ON public.org_relationships;
DROP POLICY IF EXISTS org_relationships_admin_write ON public.org_relationships;
DROP POLICY IF EXISTS people_directory_tenant_read ON public.people_directory;
DROP POLICY IF EXISTS people_directory_admin_write ON public.people_directory;
DROP POLICY IF EXISTS people_profiles_tenant_read ON public.people_profiles;
DROP POLICY IF EXISTS people_profiles_admin_write ON public.people_profiles;

CREATE POLICY org_units_tenant_read
  ON public.org_units
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY org_units_admin_write
  ON public.org_units
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin')
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
          AND lower(u.role) IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY org_relationships_tenant_read
  ON public.org_relationships
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY org_relationships_admin_write
  ON public.org_relationships
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin')
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
          AND lower(u.role) IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY people_directory_tenant_read
  ON public.people_directory
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY people_directory_admin_write
  ON public.people_directory
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin')
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
          AND lower(u.role) IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY people_profiles_tenant_read
  ON public.people_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY people_profiles_admin_write
  ON public.people_profiles
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin')
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
          AND lower(u.role) IN ('admin', 'super_admin')
      )
    )
  );

REVOKE ALL ON public.org_units FROM anon;
REVOKE ALL ON public.org_relationships FROM anon;
REVOKE ALL ON public.people_directory FROM anon;
REVOKE ALL ON public.people_profiles FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_units TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_relationships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_directory TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_profiles TO authenticated, service_role;
