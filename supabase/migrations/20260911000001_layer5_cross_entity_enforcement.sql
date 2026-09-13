-- ============================================
-- Migration: Layer 5 Cross-Entity Enforcement
-- Date: 2026-09-11
-- Purpose: Enforce Product.tenant_id = Project.tenant_id at DB level
-- Issue: A9/A10 security defect - products can reference cross-tenant projects
-- ============================================

-- Step 1: Validate existing data (abort if violations exist)
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO violation_count
  FROM real_estate_products prod
  JOIN real_estate_projects proj ON prod.project_id = proj.id
  WHERE prod.tenant_id != proj.tenant_id;

  IF violation_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply Layer 5 constraint: % existing products reference cross-tenant projects. Fix data first.', violation_count;
  END IF;

  RAISE NOTICE 'Validation passed: No existing cross-tenant parent references';
END $$;

-- Step 2: Add unique constraint on projects (id, tenant_id)
-- This is required for composite FK
ALTER TABLE public.real_estate_projects
  ADD CONSTRAINT real_estate_projects_id_tenant_unique
  UNIQUE (id, tenant_id);

-- Step 3: Drop existing FK constraint
ALTER TABLE public.real_estate_products
  DROP CONSTRAINT IF EXISTS real_estate_products_project_id_fkey;

-- Step 4: Add composite FK (project_id, tenant_id) → (id, tenant_id)
-- This enforces: Product.tenant_id MUST equal Project.tenant_id
ALTER TABLE public.real_estate_products
  ADD CONSTRAINT real_estate_products_project_tenant_fkey
  FOREIGN KEY (project_id, tenant_id)
  REFERENCES public.real_estate_projects(id, tenant_id)
  ON DELETE CASCADE;

-- Verification query (should return 0)
DO $$
DECLARE
  test_result INTEGER;
BEGIN
  -- Try to find any products with mismatched tenant_id
  SELECT COUNT(*)
  INTO test_result
  FROM real_estate_products prod
  LEFT JOIN real_estate_projects proj 
    ON prod.project_id = proj.id AND prod.tenant_id = proj.tenant_id
  WHERE proj.id IS NULL;

  IF test_result > 0 THEN
    RAISE WARNING 'Found % products with invalid project references after migration', test_result;
  ELSE
    RAISE NOTICE 'Layer 5 enforcement verified: All products reference same-tenant projects';
  END IF;
END $$;

-- ============================================
-- Documentation
-- ============================================

COMMENT ON CONSTRAINT real_estate_projects_id_tenant_unique ON real_estate_projects IS
  'Layer 5: Required for composite FK enforcement of cross-entity tenant boundary';

COMMENT ON CONSTRAINT real_estate_products_project_tenant_fkey ON real_estate_products IS
  'Layer 5: Enforces Product.tenant_id = Project.tenant_id (cross-entity tenant isolation)';

-- ============================================
-- What this migration enforces:
--
-- VALID:
-- Product { tenant_id: A, project_id: Project{id: X, tenant_id: A} } ✅
--
-- INVALID (blocked by FK):
-- Product { tenant_id: A, project_id: Project{id: X, tenant_id: B} } ❌
--
-- Test coverage:
-- - A9: Cross-entity forgery (CREATE) → FK violation
-- - A10: Cross-entity escape (UPDATE) → FK violation
-- ============================================
