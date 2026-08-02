-- ============================================================================
-- Partner Registration System - Deployment Verification Script
-- Version: 1.0
-- Date: 2026-08-02
-- Purpose: Verify migration deployed successfully
-- 
-- Usage:
--   1. Copy this entire script
--   2. Paste into Supabase Dashboard > SQL Editor
--   3. Click Run
--   4. Check all tests pass (✅)
-- ============================================================================

DO $$
DECLARE
  v_test_count INT := 0;
  v_pass_count INT := 0;
  v_fail_count INT := 0;
  v_result BOOLEAN;
  v_message TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Partner Registration Deployment Verification';
  RAISE NOTICE 'Started at: %', NOW();
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 1: Tables Exist
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking tables exist...', v_test_count;
  
  SELECT COUNT(*) = 2 INTO v_result
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('partner_applications', 'partner_application_logs');
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Both tables exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Tables missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 2: ENUMs Exist
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking ENUMs exist...', v_test_count;
  
  SELECT COUNT(*) = 3 INTO v_result
  FROM pg_type
  WHERE typname IN (
    'partner_application_status',
    'partner_applicant_type',
    'partner_application_log_action'
  );
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All 3 ENUMs exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: ENUMs missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 3: Column Count
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking partner_applications columns...', v_test_count;
  
  SELECT COUNT(*) >= 50 INTO v_result
  FROM information_schema.columns
  WHERE table_name = 'partner_applications';
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: partner_applications has 50+ columns';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: partner_applications columns missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 4: RLS Enabled
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking RLS enabled...', v_test_count;
  
  SELECT 
    COUNT(*) = 2 INTO v_result
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('partner_applications', 'partner_application_logs')
    AND rowsecurity = true;
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: RLS enabled on both tables';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: RLS not enabled!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 5: RLS Policies Count
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking RLS policies...', v_test_count;
  
  SELECT COUNT(*) >= 6 INTO v_result
  FROM pg_policies
  WHERE tablename IN ('partner_applications', 'partner_application_logs');
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: At least 6 RLS policies exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: RLS policies missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 6: Functions Exist
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking functions exist...', v_test_count;
  
  SELECT COUNT(*) = 4 INTO v_result
  FROM pg_proc
  WHERE proname IN (
    'generate_email_verification_token',
    'generate_activation_token',
    'verify_partner_application_email',
    'get_partner_application_stats'
  );
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All 4 functions exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Functions missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 7: Triggers Exist
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking triggers exist...', v_test_count;
  
  SELECT COUNT(*) = 2 INTO v_result
  FROM pg_trigger
  WHERE tgname IN (
    'trigger_update_partner_application_updated_at',
    'trigger_log_partner_application_status_change'
  );
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Both triggers exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Triggers missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 8: Indexes Exist
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Checking indexes exist...', v_test_count;
  
  SELECT COUNT(*) >= 10 INTO v_result
  FROM pg_indexes
  WHERE tablename IN ('partner_applications', 'partner_application_logs');
  
  IF v_result THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: At least 10 indexes exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Indexes missing!';
  END IF;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 9: Token Generation Function Works
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Testing generate_email_verification_token()...', v_test_count;
  
  BEGIN
    SELECT LENGTH(generate_email_verification_token()) > 30 INTO v_result;
    
    IF v_result THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  ✅ PASS: Token generation works';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE NOTICE '  ❌ FAIL: Token too short!';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Token generation failed! Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 10: Stats Function Works
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Testing get_partner_application_stats()...', v_test_count;
  
  BEGIN
    SELECT get_partner_application_stats(NULL) IS NOT NULL INTO v_result;
    
    IF v_result THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  ✅ PASS: Stats function works';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE NOTICE '  ❌ FAIL: Stats function returned NULL!';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Stats function failed! Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 11: Insert Test (Draft Application)
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Testing draft application insert...', v_test_count;
  
  BEGIN
    INSERT INTO partner_applications (
      applicant_type,
      full_name,
      email,
      phone,
      status
    ) VALUES (
      'individual_broker',
      'Test User (Verification)',
      'verification.test@bella.ai',
      '+84999999999',
      'draft'
    );
    
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Draft application inserted successfully';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Insert failed! Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 12: Trigger Test (updated_at auto-update)
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Testing updated_at trigger...', v_test_count;
  
  BEGIN
    UPDATE partner_applications
    SET full_name = 'Test User (Updated)'
    WHERE email = 'verification.test@bella.ai';
    
    SELECT updated_at > created_at INTO v_result
    FROM partner_applications
    WHERE email = 'verification.test@bella.ai';
    
    IF v_result THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  ✅ PASS: updated_at trigger works';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE NOTICE '  ❌ FAIL: updated_at not updated!';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Trigger test failed! Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- TEST 13: Cleanup Test Data
  -- ============================================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE 'Test %: Cleaning up test data...', v_test_count;
  
  BEGIN
    DELETE FROM partner_applications
    WHERE email = 'verification.test@bella.ai';
    
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Test data cleaned up';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Cleanup failed! Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Tests: %', v_test_count;
  RAISE NOTICE 'Passed: % (%.0f%%)', v_pass_count, (v_pass_count::FLOAT / v_test_count * 100);
  RAISE NOTICE 'Failed: %', v_fail_count;
  RAISE NOTICE '';
  
  IF v_fail_count = 0 THEN
    RAISE NOTICE '✅ ALL TESTS PASSED!';
    RAISE NOTICE 'Partner Registration System deployed successfully.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Create Storage bucket: partner-application-documents';
    RAISE NOTICE '  2. Regenerate TypeScript types';
    RAISE NOTICE '  3. Test frontend registration flow';
  ELSE
    RAISE NOTICE '❌ DEPLOYMENT VERIFICATION FAILED!';
    RAISE NOTICE 'Please review failed tests above and fix issues.';
    RAISE NOTICE '';
    RAISE NOTICE 'Common fixes:';
    RAISE NOTICE '  - Re-run migration script';
    RAISE NOTICE '  - Check for conflicting table names';
    RAISE NOTICE '  - Verify database permissions';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Completed at: %', NOW();
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- BONUS: Show Current State
-- ============================================================================

-- Show table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('partner_applications', 'partner_application_logs')
ORDER BY tablename;

-- Show ENUM values
SELECT 
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE 'partner_%'
GROUP BY t.typname
ORDER BY t.typname;

-- Show function signatures
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname LIKE '%partner%application%'
ORDER BY proname;

-- Show current application count (should be 0 initially)
SELECT get_partner_application_stats(NULL) as stats;

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
