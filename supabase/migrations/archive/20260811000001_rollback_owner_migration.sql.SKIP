-- Rollback Migration: owner_name → Person Center
-- Date: 2026-08-11
-- ONLY USE IF MIGRATION FAILED OR NEEDS REVERTING

BEGIN;

-- =============================================================================
-- WARNING: This rollback will DELETE parties and roles created by migration
-- =============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '2eb42ea0-913e-47dc-8f16-49b9f11d88ac';
  v_product_count INT;
  v_party_count INT;
  v_role_count INT;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE '⚠️  STARTING ROLLBACK - owner_name migration';
  RAISE NOTICE '================================================';
  
  -- =============================================================================
  -- STEP 1: Remove FK links from products
  -- =============================================================================
  
  UPDATE real_estate_products
  SET customer_id = NULL,
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND customer_id IS NOT NULL;
  
  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Unlinked % products from parties', v_product_count;
  
  -- Verify no products have customer_id
  SELECT COUNT(*) INTO v_product_count
  FROM real_estate_products
  WHERE tenant_id = v_tenant_id
    AND customer_id IS NOT NULL;
  
  IF v_product_count > 0 THEN
    RAISE EXCEPTION 'Still have % products with customer_id after unlinking', v_product_count;
  END IF;
  
  -- =============================================================================
  -- STEP 2: Delete party_roles created by migration
  -- =============================================================================
  
  DELETE FROM party_roles
  WHERE tenant_id = v_tenant_id
    AND vertical = 'real_estate'
    AND role_type = 'investor'
    AND attributes->>'source' = 'migration_2026_08_11';
  
  GET DIAGNOSTICS v_role_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % party_roles', v_role_count;
  
  -- =============================================================================
  -- STEP 3: Delete party_parties created by migration
  -- =============================================================================
  
  DELETE FROM party_parties
  WHERE tenant_id = v_tenant_id
    AND party_type = 'person'
    AND display_name IN ('Phạm Minh Đức', 'Nguyễn Văn An', 'Hoàng Kim Khánh', 'Nguyễn Thị Hoa');
  
  GET DIAGNOSTICS v_party_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % party_parties', v_party_count;
  
  -- =============================================================================
  -- STEP 4: Drop customer_id column
  -- =============================================================================
  
  ALTER TABLE real_estate_products DROP COLUMN IF EXISTS customer_id;
  
  RAISE NOTICE 'Dropped customer_id column from real_estate_products';
  
  -- =============================================================================
  -- STEP 5: Final validation
  -- =============================================================================
  
  -- Verify owner_name still intact
  SELECT COUNT(*) INTO v_product_count
  FROM real_estate_products
  WHERE tenant_id = v_tenant_id
    AND owner_name IS NOT NULL;
  
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ ROLLBACK COMPLETE - VALIDATION';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Products with owner_name: % (expected 41)', v_product_count;
  RAISE NOTICE 'Parties deleted: % (expected 4)', v_party_count;
  RAISE NOTICE 'Roles deleted: % (expected 4)', v_role_count;
  RAISE NOTICE '================================================';
  
  IF v_product_count <> 41 THEN
    RAISE EXCEPTION 'owner_name data loss detected: expected 41, got %', v_product_count;
  END IF;
  
  IF v_party_count <> 4 THEN
    RAISE WARNING 'Expected to delete 4 parties, deleted %', v_party_count;
  END IF;
  
  IF v_role_count <> 4 THEN
    RAISE WARNING 'Expected to delete 4 roles, deleted %', v_role_count;
  END IF;
  
  RAISE NOTICE '✅ System returned to pre-migration state';
  RAISE NOTICE '✅ No data loss detected (41 products with owner_name preserved)';
END $$;

COMMIT;
