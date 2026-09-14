-- ============================================================================
-- Platform Authorization: User -> Org Unit Access Projection
-- ============================================================================
-- Migration: 20260914
-- Owner: Platform Org Unit / Authorization
-- Purpose: Canonical derived primitive for branch-scoped RLS.
--
-- Source of truth:
--   - people_directory.user_id maps Auth User -> Person
--   - org_relationships maps Person -> Org Unit
--   - org_units.parent_id expands access to descendants
--   - users.role grants tenant-wide access for admin/super_admin
--
-- This is a projection view, not an independent product-owned permission table.
-- ============================================================================

CREATE OR REPLACE VIEW public.user_org_unit_access
WITH (security_invoker = true) AS
WITH RECURSIVE current_context AS (
  SELECT
    COALESCE(
      auth.uid(),
      NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
    ) AS user_id,
    COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    ) AS tenant_id
),
direct_access AS (
  SELECT
    pd.user_id,
    rel.tenant_id,
    rel.to_id AS org_unit_id,
    rel.to_id AS root_org_unit_id,
    rel.id AS relationship_id,
    rel.rel_type AS access_source
  FROM current_context ctx
  JOIN public.people_directory pd
    ON pd.user_id = ctx.user_id
   AND pd.tenant_id = ctx.tenant_id
   AND pd.is_active = TRUE
  JOIN public.org_relationships rel
    ON rel.tenant_id = pd.tenant_id
   AND rel.from_id = pd.id
   AND rel.from_type = 'person'
   AND rel.to_type = 'unit'
   AND rel.rel_type IN ('belongs_to', 'manages', 'participates_in')
   AND (rel.since IS NULL OR rel.since <= CURRENT_DATE)
   AND (rel.until IS NULL OR rel.until >= CURRENT_DATE)
  JOIN public.org_units ou
    ON ou.id = rel.to_id
   AND ou.tenant_id = rel.tenant_id
   AND ou.is_active = TRUE
),
expanded_access AS (
  SELECT
    user_id,
    tenant_id,
    org_unit_id,
    root_org_unit_id,
    relationship_id,
    access_source
  FROM direct_access

  UNION

  SELECT
    ea.user_id,
    child.tenant_id,
    child.id AS org_unit_id,
    ea.root_org_unit_id,
    ea.relationship_id,
    ea.access_source
  FROM expanded_access ea
  JOIN public.org_units child
    ON child.parent_id = ea.org_unit_id
   AND child.tenant_id = ea.tenant_id
   AND child.is_active = TRUE
),
admin_access AS (
  SELECT
    u.id AS user_id,
    ou.tenant_id,
    ou.id AS org_unit_id,
    ou.id AS root_org_unit_id,
    NULL::UUID AS relationship_id,
    'tenant_admin'::TEXT AS access_source
  FROM current_context ctx
  JOIN public.users u
    ON u.id = ctx.user_id
   AND u.tenant_id = ctx.tenant_id
   AND lower(u.role) IN ('admin', 'super_admin')
  JOIN public.org_units ou
    ON ou.tenant_id = u.tenant_id
   AND ou.is_active = TRUE
)
SELECT DISTINCT
  user_id,
  tenant_id,
  org_unit_id,
  root_org_unit_id,
  relationship_id,
  access_source
FROM expanded_access

UNION

SELECT DISTINCT
  user_id,
  tenant_id,
  org_unit_id,
  root_org_unit_id,
  relationship_id,
  access_source
FROM admin_access;

COMMENT ON VIEW public.user_org_unit_access IS
  'Platform Authorization projection. Derived from people_directory, org_relationships, org_units, and users.role. Used by product RLS for branch/org-unit access.';

REVOKE ALL ON public.user_org_unit_access FROM anon;
GRANT SELECT ON public.user_org_unit_access TO authenticated, service_role;
