-- ============================================================================
-- NEGATIVE TESTS: Clinical Orders Migration Constraints
-- Run in Supabase Studio SQL Editor to verify constraint behavior
-- Each test should FAIL (except Test 4 which should PASS)
-- ============================================================================

-- SETUP: Get test data
SELECT 
  '========== TEST DATA ==========' as info,
  (SELECT id FROM hc_encounters LIMIT 1) as sample_encounter_id,
  (SELECT patient_party_id FROM hc_encounters LIMIT 1) as correct_patient_id,
  (SELECT id FROM party_parties WHERE id != (SELECT patient_party_id FROM hc_encounters LIMIT 1) LIMIT 1) as wrong_patient_id,
  (SELECT tenant_id FROM hc_encounters LIMIT 1) as sample_tenant_id;

-- ============================================================================
-- TEST 1: Wrong patient_party_id (Composite FK Violation)
-- Expected: ❌ FAIL with FK constraint error
-- ============================================================================

DO $$
DECLARE
  test_encounter_id UUID;
  correct_patient_id UUID;
  wrong_patient_id UUID;
  test_tenant_id UUID;
BEGIN
  -- Get test data
  SELECT id, patient_party_id, tenant_id 
  INTO test_encounter_id, correct_patient_id, test_tenant_id
  FROM hc_encounters LIMIT 1;
  
  -- Get different patient
  SELECT id INTO wrong_patient_id
  FROM party_parties 
  WHERE id != correct_patient_id 
  LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Wrong patient_party_id';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Encounter: %', test_encounter_id;
  RAISE NOTICE 'Correct patient: %', correct_patient_id;
  RAISE NOTICE 'Wrong patient: %', wrong_patient_id;
  RAISE NOTICE 'Attempting INSERT with WRONG patient...';
  
  -- This should FAIL
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version
  ) VALUES (
    gen_random_uuid(),
    test_tenant_id,
    test_encounter_id,
    wrong_patient_id,  -- ❌ WRONG patient
    wrong_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1
  );
  
  RAISE EXCEPTION 'TEST 1 FAILED: Insert should have been blocked by composite FK!';
  
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✅ TEST 1 PASSED: Composite FK blocked wrong patient_party_id';
    RAISE NOTICE 'Error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 1 UNEXPECTED ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 2: NULL patient_party_id (NOT NULL Constraint)
-- Expected: ❌ FAIL with NOT NULL error
-- ============================================================================

DO $$
DECLARE
  test_encounter_id UUID;
  test_tenant_id UUID;
  test_patient_id UUID;
BEGIN
  SELECT id, tenant_id, patient_party_id
  INTO test_encounter_id, test_tenant_id, test_patient_id
  FROM hc_encounters LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: NULL patient_party_id';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Attempting INSERT with NULL patient...';
  
  -- This should FAIL
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version
  ) VALUES (
    gen_random_uuid(),
    test_tenant_id,
    test_encounter_id,
    NULL,  -- ❌ NULL patient
    test_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1
  );
  
  RAISE EXCEPTION 'TEST 2 FAILED: Insert should have been blocked by NOT NULL!';
  
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE '✅ TEST 2 PASSED: NOT NULL constraint blocked NULL patient_party_id';
    RAISE NOTICE 'Error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 2 UNEXPECTED ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 3: Duplicate (tenant_id, request_id) (UNIQUE Constraint)
-- Expected: ❌ FAIL with uniqueness violation
-- ============================================================================

DO $$
DECLARE
  test_encounter_id UUID;
  test_patient_id UUID;
  test_tenant_id UUID;
  test_request_id UUID := gen_random_uuid();
  first_order_id UUID;
BEGIN
  SELECT id, patient_party_id, tenant_id 
  INTO test_encounter_id, test_patient_id, test_tenant_id
  FROM hc_encounters LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Duplicate (tenant_id, request_id)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant: %', test_tenant_id;
  RAISE NOTICE 'Request ID: %', test_request_id;
  
  -- First insert (should succeed)
  RAISE NOTICE 'Inserting first order...';
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version, request_id
  ) VALUES (
    gen_random_uuid(),
    test_tenant_id,
    test_encounter_id,
    test_patient_id,
    test_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1,
    test_request_id
  ) RETURNING id INTO first_order_id;
  
  RAISE NOTICE '✅ First order created: %', first_order_id;
  RAISE NOTICE 'Attempting duplicate request_id in same tenant...';
  
  -- Second insert with same request_id (should FAIL)
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version, request_id
  ) VALUES (
    gen_random_uuid(),
    test_tenant_id,  -- ❌ Same tenant
    test_encounter_id,
    test_patient_id,
    test_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1,
    test_request_id  -- ❌ Same request_id
  );
  
  RAISE EXCEPTION 'TEST 3 FAILED: Duplicate request_id should have been blocked!';
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '✅ TEST 3 PASSED: UNIQUE constraint blocked duplicate request_id';
    RAISE NOTICE 'Error: %', SQLERRM;
    
    -- Cleanup
    DELETE FROM hc_clinical_orders WHERE id = first_order_id;
    RAISE NOTICE 'Cleanup: Deleted test order %', first_order_id;
    
  WHEN OTHERS THEN
    -- Cleanup on error
    DELETE FROM hc_clinical_orders WHERE request_id = test_request_id;
    RAISE EXCEPTION 'TEST 3 UNEXPECTED ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 4: Same request_id, different tenant (Should PASS)
-- Expected: ✅ PASS (tenant-scoped uniqueness)
-- ============================================================================

DO $$
DECLARE
  test_encounter_id UUID;
  test_patient_id UUID;
  tenant_1 UUID := gen_random_uuid();
  tenant_2 UUID := gen_random_uuid();
  test_request_id UUID := gen_random_uuid();
  order_1_id UUID;
  order_2_id UUID;
BEGIN
  SELECT id, patient_party_id
  INTO test_encounter_id, test_patient_id
  FROM hc_encounters LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Same request_id, different tenant';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant 1: %', tenant_1;
  RAISE NOTICE 'Tenant 2: %', tenant_2;
  RAISE NOTICE 'Request ID: %', test_request_id;
  
  -- Insert in tenant 1
  RAISE NOTICE 'Inserting order in tenant 1...';
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version, request_id
  ) VALUES (
    gen_random_uuid(),
    tenant_1,
    test_encounter_id,
    test_patient_id,
    test_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1,
    test_request_id
  ) RETURNING id INTO order_1_id;
  
  RAISE NOTICE '✅ Order 1 created: %', order_1_id;
  
  -- Insert in tenant 2 with SAME request_id (should SUCCEED)
  RAISE NOTICE 'Inserting order in tenant 2 with same request_id...';
  INSERT INTO hc_clinical_orders (
    id, tenant_id, encounter_id, patient_party_id, customer_id,
    order_type, status, version, request_id
  ) VALUES (
    gen_random_uuid(),
    tenant_2,  -- ✅ Different tenant
    test_encounter_id,
    test_patient_id,
    test_patient_id,  -- customer_id (required field)
    'medication',
    'draft',
    1,
    test_request_id  -- ✅ Same request_id
  ) RETURNING id INTO order_2_id;
  
  RAISE NOTICE '✅ Order 2 created: %', order_2_id;
  RAISE NOTICE '✅ TEST 4 PASSED: Tenant-scoped uniqueness allows same request_id across tenants';
  
  -- Cleanup
  DELETE FROM hc_clinical_orders WHERE id IN (order_1_id, order_2_id);
  RAISE NOTICE 'Cleanup: Deleted test orders % and %', order_1_id, order_2_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Cleanup on error
    DELETE FROM hc_clinical_orders WHERE request_id = test_request_id;
    RAISE EXCEPTION 'TEST 4 UNEXPECTED ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  '========================================' as separator,
  'NEGATIVE TESTS COMPLETE' as result,
  '4/4 constraint behaviors verified' as details,
  'Ready for Repository implementation' as next_step;

-- Expected Results:
-- TEST 1: ✅ PASSED (composite FK blocked)
-- TEST 2: ✅ PASSED (NOT NULL blocked)
-- TEST 3: ✅ PASSED (UNIQUE blocked)
-- TEST 4: ✅ PASSED (tenant isolation works)

-- ============================================================================
-- END OF NEGATIVE TESTS
-- ============================================================================
