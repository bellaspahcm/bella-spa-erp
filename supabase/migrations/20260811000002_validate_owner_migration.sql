-- Validation Queries: owner_name → Person Center Migration
-- Date: 2026-08-11
-- Run AFTER migration to verify success

-- =============================================================================
-- VALIDATION QUERY SET
-- =============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '2eb42ea0-913e-47dc-8f16-49b9f11d88ac';
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔍 MIGRATION VALIDATION QUERIES';
  RAISE NOTICE '================================================';
END $$;

-- -----------------------------------------------------------------------------
-- Query 1: Party count
-- -----------------------------------------------------------------------------
SELECT '1. Party Count' as check_name,
       COUNT(*) as actual,
       4 as expected,
       CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM party_parties
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND party_type = 'person'
  AND display_name IN ('Phạm Minh Đức', 'Nguyễn Văn An', 'Hoàng Kim Khánh', 'Nguyễn Thị Hoa');

-- -----------------------------------------------------------------------------
-- Query 2: Role count
-- -----------------------------------------------------------------------------
SELECT '2. Role Count' as check_name,
       COUNT(*) as actual,
       4 as expected,
       CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM party_roles
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND vertical = 'real_estate'
  AND role_type = 'investor'
  AND attributes->>'source' = 'migration_2026_08_11';

-- -----------------------------------------------------------------------------
-- Query 3: Products linked
-- -----------------------------------------------------------------------------
SELECT '3. Products Linked' as check_name,
       COUNT(*) as actual,
       '~28' as expected,
       CASE 
         WHEN COUNT(*) BETWEEN 20 AND 35 THEN '✅ PASS' 
         ELSE '❌ FAIL' 
       END as status
FROM real_estate_products
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND customer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Query 4: Placeholders (NULL customer_id)
-- -----------------------------------------------------------------------------
SELECT '4. Placeholders (NULL)' as check_name,
       COUNT(*) as actual,
       '~14' as expected,
       CASE 
         WHEN COUNT(*) BETWEEN 10 AND 18 THEN '✅ PASS' 
         ELSE '❌ FAIL' 
       END as status
FROM real_estate_products
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND customer_id IS NULL
  AND owner_name IN ('Chưa có chủ sở hữu', 'Khách hàng đặt cọc');

-- -----------------------------------------------------------------------------
-- Query 5: Orphaned FKs (should be 0)
-- -----------------------------------------------------------------------------
SELECT '5. Orphaned FKs' as check_name,
       COUNT(*) as actual,
       0 as expected,
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM real_estate_products rp
LEFT JOIN party_parties pp ON rp.customer_id = pp.id
WHERE rp.tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND rp.customer_id IS NOT NULL
  AND pp.id IS NULL;

-- -----------------------------------------------------------------------------
-- Query 6: owner_name preserved
-- -----------------------------------------------------------------------------
SELECT '6. owner_name Preserved' as check_name,
       COUNT(*) as actual,
       41 as expected,
       CASE WHEN COUNT(*) = 41 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM real_estate_products
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND owner_name IS NOT NULL;

-- =============================================================================
-- DETAILED REPORTS (for manual inspection)
-- =============================================================================

-- Report 1: Owner distribution
SELECT 
  '📊 Owner Distribution' as report_name,
  pp.display_name as owner,
  COUNT(rp.id) as product_count,
  array_agg(rp.product_code ORDER BY rp.product_code) as products
FROM real_estate_products rp
JOIN party_parties pp ON rp.customer_id = pp.id
WHERE rp.tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
GROUP BY pp.display_name
ORDER BY COUNT(rp.id) DESC;

-- Report 2: Placeholders
SELECT 
  '📊 Placeholders' as report_name,
  owner_name,
  COUNT(*) as count
FROM real_estate_products
WHERE tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND customer_id IS NULL
  AND owner_name IS NOT NULL
GROUP BY owner_name;

-- Report 3: Party details
SELECT 
  '📊 Party Details' as report_name,
  pp.id as party_id,
  pp.display_name,
  pp.party_type,
  pr.role_type,
  pr.vertical,
  pr.attributes->>'source' as source,
  pr.active_from
FROM party_parties pp
LEFT JOIN party_roles pr ON pp.id = pr.party_id
WHERE pp.tenant_id = '2eb42ea0-913e-47dc-8f16-49b9f11d88ac'
  AND pp.party_type = 'person'
  AND pp.display_name IN ('Phạm Minh Đức', 'Nguyễn Văn An', 'Hoàng Kim Khánh', 'Nguyễn Thị Hoa')
ORDER BY pp.display_name;

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT 
  '✅ Run all queries above to validate migration' as summary,
  'All status should show ✅ PASS' as expected_result;
