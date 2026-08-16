-- ============================================================================
-- POST-MIGRATION VERIFICATION: hc_encounters
-- Run this AFTER migration to verify data integrity
-- ============================================================================

-- 1. Record count (MUST match pre-migration: 8254)
SELECT 'Total Records' AS metric, COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 8254 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters;

-- 2. Canonical columns populated (encounter_type)
SELECT 
  'encounter_type populated' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 8254 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE encounter_type IS NOT NULL;

-- 3. Canonical columns populated (period_start)
SELECT 
  'period_start populated' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 8254 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE period_start IS NOT NULL;

-- 4. Status values normalized (no legacy values)
SELECT 
  'Legacy status values' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE status IN ('in_progress', 'completed');

-- 5. Status distribution (post-migration)
SELECT 
  'Status Distribution' AS metric,
  status,
  COUNT(*)::TEXT AS count
FROM hc_encounters
GROUP BY status
ORDER BY COUNT(*) DESC;

-- 6. Encounter class values normalized (no legacy values)
SELECT 
  'Legacy encounter_class values' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE encounter_class NOT IN ('AMB', 'EMER', 'IMP', 'HH', 'VR');

-- 7. Encounter class distribution (post-migration)
SELECT 
  'Encounter Class Distribution' AS metric,
  encounter_class,
  COUNT(*)::TEXT AS count
FROM hc_encounters
GROUP BY encounter_class
ORDER BY COUNT(*) DESC;

-- 8. Encounter type distribution (new canonical field)
SELECT 
  'Encounter Type Distribution' AS metric,
  encounter_type,
  COUNT(*)::TEXT AS count
FROM hc_encounters
GROUP BY encounter_type
ORDER BY COUNT(*) DESC;

-- 9. Metadata populated (legacy fields preserved)
SELECT 
  'Metadata populated' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 8254 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;

-- 10. Period validation (end >= start where end exists)
SELECT 
  'Invalid periods (end < start)' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) = 0 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM hc_encounters
WHERE period_end IS NOT NULL AND period_end < period_start;

-- 11. Tenant distribution preserved
SELECT 
  'Tenant Distribution' AS metric,
  t.name AS tenant_name,
  COUNT(e.id)::TEXT AS record_count
FROM hc_encounters e
LEFT JOIN tenants t ON e.tenant_id = t.id
GROUP BY t.name
ORDER BY COUNT(e.id) DESC;

-- 12. RLS policies exist
SELECT 
  'RLS Policies Count' AS metric,
  COUNT(*)::TEXT AS value,
  CASE WHEN COUNT(*) >= 2 THEN '✓ PASS' ELSE '✗ FAIL (SECURITY ISSUE)' END AS status
FROM pg_policies
WHERE tablename = 'hc_encounters';

-- 13. RLS policy details
SELECT 
  'RLS Policy' AS metric,
  policyname AS policy_name,
  cmd AS command,
  CASE 
    WHEN qual LIKE '%tenant_id%' THEN '✓ Tenant isolation'
    ELSE '✗ Missing tenant check'
  END AS validation
FROM pg_policies
WHERE tablename = 'hc_encounters'
ORDER BY policyname;

-- 14. Constraints verification
SELECT 
  'Constraints' AS metric,
  conname AS constraint_name,
  contype AS type,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    ELSE contype::TEXT
  END AS constraint_type
FROM pg_constraint
WHERE conrelid = 'hc_encounters'::regclass
ORDER BY conname;

-- ============================================================================
-- EXPECTED RESULTS (All PASS):
-- ✓ Total Records: 8254
-- ✓ encounter_type populated: 8254
-- ✓ period_start populated: 8254
-- ✓ Legacy status values: 0
-- ✓ Legacy encounter_class values: 0
-- ✓ Metadata populated: 8254
-- ✓ Invalid periods: 0
-- ✓ RLS Policies: 2+ (tenant_isolation_select, tenant_isolation_write)
-- ============================================================================
