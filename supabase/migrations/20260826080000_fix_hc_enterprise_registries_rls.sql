-- =========================================================================
-- Migration: 20260826080000_fix_hc_enterprise_registries_rls
-- Purpose:   Replace open USING (true) policy on hc_enterprise_registries
--            with correct read-global / write-platform-only policies.
-- =========================================================================
--
-- DIAGNOSIS (H1.6 evidence):
--   hc_enterprise_registries was left with the original open policy
--   (qual = true, with_check = null, roles = public) from the baseline
--   migration. The 20260821000000_fix_healthcare_rls_tenant_isolation.sql
--   fixed 9/10 tables but omitted this table.
--
-- BUSINESS SCOPE:
--   hc_enterprise_registries is a GLOBAL PLATFORM reference table:
--   - Contains ICD codes, drug codes, medical standards, registry definitions
--   - Schema has NO tenant_id column (no FK to any tenant)
--   - UNIQUE (registry_type, code, version) confirms shared, non-tenant data
--   - 0 rows currently; populated by platform migrations, not tenant operations
--   - No FK references to patient/admission/clinical tables
--
-- CORRECT POLICY:
--   READ  → all authenticated users (global read: share reference data)
--   WRITE → service_role / postgres only (platform-managed data)
--
-- This is NOT the same policy as PHI tables (hc_inpatient_admissions etc.)
-- which require tenant_id scoping. The registries table is intentionally
-- global — the fix is to lock WRITES to platform roles only.
-- =========================================================================

DROP POLICY IF EXISTS "hc_registries_tenant_policy"    ON public.hc_enterprise_registries;
DROP POLICY IF EXISTS "hc_registries_read_global"      ON public.hc_enterprise_registries;
DROP POLICY IF EXISTS "hc_registries_write_platform_only" ON public.hc_enterprise_registries;

-- READ: authenticated users may read global reference data (ICD, drug codes etc.)
CREATE POLICY "hc_registries_read_global"
    ON public.hc_enterprise_registries
    FOR SELECT
    TO authenticated, service_role
    USING (true);

-- WRITE: only platform roles (service_role / postgres / supabase_admin) may mutate
CREATE POLICY "hc_registries_write_platform_only"
    ON public.hc_enterprise_registries
    FOR ALL
    TO service_role
    USING (
        CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name, 'supabase_admin'::name])
    )
    WITH CHECK (
        CURRENT_USER = ANY (ARRAY['service_role'::name, 'postgres'::name, 'supabase_admin'::name])
    );

COMMENT ON POLICY "hc_registries_read_global" ON public.hc_enterprise_registries IS
    'Global reference data (ICD codes, drug registries, medical standards) is readable '
    'by all authenticated users. No tenant scoping: data is platform-managed and shared '
    'across all tenants.';

COMMENT ON POLICY "hc_registries_write_platform_only" ON public.hc_enterprise_registries IS
    'Only service_role/postgres/supabase_admin can INSERT/UPDATE/DELETE reference data. '
    'Tenant users (authenticated) cannot mutate global registry entries. '
    'Reference data lifecycle is managed by platform migrations only.';
