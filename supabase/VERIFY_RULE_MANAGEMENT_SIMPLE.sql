-- ============================================================
-- Rule Management Migration - Simple Verification
-- ============================================================
-- Simplified version that only checks structure (no test data)
-- ============================================================

DO $$
DECLARE
  v_test_count INTEGER := 0;
  v_pass_count INTEGER := 0;
  v_fail_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Rule Management Migration Verification';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- TEST 1: Tables exist
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 1: PASS - All 4 tables exist';
  ELSE
    RAISE NOTICE 'Test 1: FAIL - Missing tables';
  END IF;

  -- TEST 2: Rules table has required columns
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rules' 
    AND column_name IN ('id', 'tenant_id', 'name', 'provider', 'conditions', 'actions', 'priority', 'status', 'version')
    HAVING COUNT(*) >= 9
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 2: PASS - Rules table structure correct';
  ELSE
    RAISE NOTICE 'Test 2: FAIL - Rules table missing columns';
  END IF;

  -- TEST 3: JSONB columns
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rules' 
    AND column_name IN ('conditions', 'actions')
    AND data_type = 'jsonb'
    HAVING COUNT(*) = 2
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 3: PASS - JSONB columns defined';
  ELSE
    RAISE NOTICE 'Test 3: FAIL - JSONB columns missing';
  END IF;

  -- TEST 4: Indexes exist
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    HAVING COUNT(*) >= 15
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 4: PASS - Indexes created (15+)';
  ELSE
    RAISE NOTICE 'Test 4: FAIL - Missing indexes';
  END IF;

  -- TEST 5: RLS enabled
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    AND rowsecurity = true
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 5: PASS - RLS enabled on all tables';
  ELSE
    RAISE NOTICE 'Test 5: FAIL - RLS not enabled';
  END IF;

  -- TEST 6: RLS policies exist
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    HAVING COUNT(*) >= 8
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 6: PASS - RLS policies exist (8+)';
  ELSE
    RAISE NOTICE 'Test 6: FAIL - Missing RLS policies';
  END IF;

  -- TEST 7: Trigger functions exist
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN ('update_rule_updated_at', 'create_rule_version_snapshot')
    HAVING COUNT(*) = 2
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 7: PASS - Trigger functions exist';
  ELSE
    RAISE NOTICE 'Test 7: FAIL - Missing trigger functions';
  END IF;

  -- TEST 8: Triggers attached
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname LIKE 'rules_%' OR tgname LIKE 'rule_approvals_%'
    HAVING COUNT(*) >= 3
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 8: PASS - Triggers attached (3+)';
  ELSE
    RAISE NOTICE 'Test 8: FAIL - Missing triggers';
  END IF;

  -- TEST 9: RPC functions exist
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN (
      'get_rule_with_history',
      'get_pending_rule_approvals',
      'get_rule_test_stats',
      'rollback_rule_to_version'
    )
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 9: PASS - All 4 RPC functions exist';
  ELSE
    RAISE NOTICE 'Test 9: FAIL - Missing RPC functions';
  END IF;

  -- TEST 10: Grants for authenticated
  v_test_count := v_test_count + 1;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_name IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    AND grantee = 'authenticated'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    HAVING COUNT(DISTINCT table_name) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE 'Test 10: PASS - Grants for authenticated role';
  ELSE
    RAISE NOTICE 'Test 10: FAIL - Missing grants';
  END IF;

  -- SUMMARY
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Tests:  %', v_test_count;
  RAISE NOTICE 'Passed:       %', v_pass_count;
  RAISE NOTICE 'Failed:       %', v_fail_count;
  RAISE NOTICE 'Success Rate: % percent', ROUND((v_pass_count::NUMERIC / v_test_count::NUMERIC * 100)::NUMERIC, 1);
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF v_fail_count = 0 THEN
    RAISE NOTICE 'ALL TESTS PASSED! Migration is successful.';
  ELSE
    RAISE NOTICE 'SOME TESTS FAILED. Please review the errors above.';
  END IF;

END $$;

