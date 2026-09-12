-- ============================================================================
-- Org Unit Hierarchy RPCs
-- Migration: 20260912100000
-- Purpose: Recursive queries for org_units hierarchy and circular reference detection
-- Dependencies: 20260801030000_foundation_org_people_schema.sql
-- ============================================================================

-- ============================================================================
-- RPC 1: get_org_unit_hierarchy
-- Returns org unit hierarchy with depth and path information
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_unit_hierarchy(
  p_root_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  unit_type TEXT,
  name TEXT,
  code TEXT,
  parent_id UUID,
  is_active BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  depth INT,
  path UUID[],
  path_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Base case: root units
    SELECT
      u.id,
      u.tenant_id,
      u.unit_type,
      u.name,
      u.code,
      u.parent_id,
      u.is_active,
      u.metadata,
      u.created_at,
      u.updated_at,
      0 AS depth,
      ARRAY[u.id] AS path,
      ARRAY[u.name] AS path_names
    FROM public.org_units u
    WHERE u.tenant_id = p_tenant_id
      AND (
        (p_root_id IS NULL AND u.parent_id IS NULL)
        OR u.id = p_root_id
      )
    
    UNION ALL
    
    -- Recursive case: children
    SELECT
      u.id,
      u.tenant_id,
      u.unit_type,
      u.name,
      u.code,
      u.parent_id,
      u.is_active,
      u.metadata,
      u.created_at,
      u.updated_at,
      h.depth + 1,
      h.path || u.id,
      h.path_names || u.name
    FROM public.org_units u
    INNER JOIN hierarchy h ON u.parent_id = h.id
    WHERE u.tenant_id = p_tenant_id
  )
  SELECT
    hierarchy.id,
    hierarchy.tenant_id,
    hierarchy.unit_type,
    hierarchy.name,
    hierarchy.code,
    hierarchy.parent_id,
    hierarchy.is_active,
    hierarchy.metadata,
    hierarchy.created_at,
    hierarchy.updated_at,
    hierarchy.depth,
    hierarchy.path,
    hierarchy.path_names
  FROM hierarchy
  ORDER BY hierarchy.depth, hierarchy.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_org_unit_hierarchy IS
  'Returns org unit hierarchy from root with depth and path information. '
  'Used for breadcrumb navigation and org tree rendering. '
  'Tenant-isolated by p_tenant_id parameter.';

-- Grant execute to authenticated users (RLS applies)
GRANT EXECUTE ON FUNCTION public.get_org_unit_hierarchy(UUID, UUID) TO authenticated;

-- ============================================================================
-- RPC 2: get_org_unit_descendants
-- Returns all descendant IDs of an org unit (for circular reference detection)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_unit_descendants(
  p_unit_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (id UUID) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Base case: direct children
    SELECT u.id
    FROM public.org_units u
    WHERE u.parent_id = p_unit_id
      AND u.tenant_id = p_tenant_id
    
    UNION ALL
    
    -- Recursive case: descendants of children
    SELECT u.id
    FROM public.org_units u
    INNER JOIN descendants d ON u.parent_id = d.id
    WHERE u.tenant_id = p_tenant_id
  )
  SELECT descendants.id FROM descendants;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_org_unit_descendants IS
  'Returns all descendant IDs of an org unit (recursive). '
  'Used for circular reference detection and hierarchy validation. '
  'Tenant-isolated by p_tenant_id parameter.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_unit_descendants(UUID, UUID) TO authenticated;
