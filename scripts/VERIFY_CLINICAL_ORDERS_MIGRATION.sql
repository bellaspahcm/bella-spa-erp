-- ============================================================================
-- VERIFICATION SCRIPT: Clinical Orders Migration
-- Run in Supabase Studio SQL Editor to verify migration success
-- ============================================================================

-- CHECK 1: Verify columns exist
SELECT 
  'CHECK 1: Columns' as check_name,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ PASSED'
    ELSE '❌ FAILED - Missing columns'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hc_clinical_orders'
  AND column_name IN ('patient_party_id', 'request_id', 'version');

-- CHECK 2: Verify patient_party_id is NOT NULL
SELECT 
  'CHECK 2: NOT NULL' as check_name,
  CASE 
    WHEN is_nullable = 'NO' THEN '✅ PASSED'
    ELSE '❌ FAILED - patient_party_id is nullable'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hc_clinical_orders'
  AND column_name = 'patient_party_id';

-- CHECK 3: Verify version has default 1
SELECT 
  'CHECK 3: Version default' as check_name,
  CASE 
    WHEN column_default LIKE '%1%' THEN '✅ PASSED'
    ELSE '❌ FAILED - version has no default'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hc_clinical_orders'
  AND column_name = 'version';

-- CHECK 4: Verify patient consistency (backfill)
SELECT 
  'CHECK 4: Patient consistency' as check_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASSED'
    ELSE '❌ FAILED - ' || COUNT(*) || ' mismatches'
  END as result
FROM hc_clinical_orders o
JOIN hc_encounters e ON o.encounter_id = e.id
WHERE o.patient_party_id != e.patient_party_id;

-- CHECK 5: Verify no NULL patient_party_id
SELECT 
  'CHECK 5: No NULL patients' as check_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASSED'
    ELSE '❌ FAILED - ' || COUNT(*) || ' NULL patients'
  END as result
FROM hc_clinical_orders
WHERE patient_party_id IS NULL;

-- CHECK 6: Verify composite FK constraint exists
SELECT 
  'CHECK 6: Composite FK' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASSED'
    ELSE '❌ FAILED - Composite FK not found'
  END as result
FROM pg_constraint
WHERE conname = 'fk_clinical_orders_patient_matches_encounter'
  AND conrelid = 'hc_clinical_orders'::regclass;

-- CHECK 7: Verify UNIQUE constraint on hc_encounters
SELECT 
  'CHECK 7: UNIQUE constraint' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASSED'
    ELSE '❌ FAILED - UNIQUE constraint not found'
  END as result
FROM pg_constraint
WHERE conname = 'uq_hc_encounters_id_patient'
  AND conrelid = 'hc_encounters'::regclass;

-- CHECK 8: Verify tenant-scoped idempotency index
SELECT 
  'CHECK 8: Idempotency index' as check_name,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASSED'
    ELSE '❌ FAILED - Idempotency index not found'
  END as result
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'hc_clinical_orders'
  AND indexname = 'idx_hc_clinical_orders_request_id';

-- CHECK 9: Verify performance indexes
SELECT 
  'CHECK 9: Performance indexes' as check_name,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ PASSED - ' || COUNT(*) || ' indexes found'
    ELSE '❌ FAILED - Missing indexes'
  END as result
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'hc_clinical_orders'
  AND indexname IN ('idx_hc_clinical_orders_patient', 'idx_hc_clinical_orders_version');

-- SUMMARY: Count total orders
SELECT 
  '========== SUMMARY ==========' as separator,
  COUNT(*) as total_orders,
  COUNT(patient_party_id) as orders_with_patient,
  COUNT(request_id) as orders_with_request_id,
  MIN(version) as min_version,
  MAX(version) as max_version
FROM hc_clinical_orders;

-- ============================================================================
-- END OF VERIFICATION
-- All checks should show ✅ PASSED
-- ============================================================================
