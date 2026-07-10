-- ============================================================
-- Verification Script for Rule Management Tables
-- ============================================================
-- Run this in Supabase SQL Editor to verify migration success
-- Expected: All checks should pass
-- ============================================================

DO $$
DECLARE
  v_test_count INTEGER := 0;
  v_pass_count INTEGER := 0;
  v_fail_count INTEGER := 0;
  v_result TEXT;
BEGIN
  RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  Rule Management Migration Verification                   ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 1: Verify tables exist
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify tables exist', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    GROUP BY table_schema
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All 4 tables exist (rules, rule_versions, rule_approvals, rule_test_results)';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Not all tables exist';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 2: Verify rules table structure
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify rules table structure', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rules' 
    AND column_name IN (
      'id', 'tenant_id', 'name', 'description', 'provider', 'category',
      'conditions', 'actions', 'priority', 'status', 'version',
      'created_by', 'updated_by', 'created_at', 'updated_at'
    )
    GROUP BY table_name
    HAVING COUNT(*) >= 15
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: rules table has all required columns';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: rules table missing columns';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 3: Verify JSONB columns
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify JSONB columns', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rules' 
    AND column_name IN ('conditions', 'actions')
    AND data_type = 'jsonb'
    GROUP BY table_name
    HAVING COUNT(*) = 2
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: conditions and actions are JSONB type';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: JSONB columns not correctly defined';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 4: Verify indexes exist
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify indexes exist', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    GROUP BY schemaname
    HAVING COUNT(*) >= 15
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All required indexes exist (15+)';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing indexes';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 5: Verify RLS is enabled
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify RLS is enabled', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    AND rowsecurity = true
    GROUP BY schemaname
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: RLS enabled on all 4 tables';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: RLS not enabled on all tables';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 6: Verify RLS policies exist
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify RLS policies exist', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    GROUP BY schemaname
    HAVING COUNT(*) >= 8
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: RLS policies exist (8+ policies)';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing RLS policies';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 7: Verify trigger function exists
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify trigger functions exist', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN ('update_rule_updated_at', 'create_rule_version_snapshot')
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Trigger functions exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing trigger functions';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 8: Verify triggers are attached
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify triggers are attached', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname IN ('rules_updated_at', 'rule_approvals_updated_at', 'rules_version_snapshot')
    GROUP BY tgrelid
    HAVING COUNT(*) >= 3
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All triggers attached (3)';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing triggers';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 9: Verify RPC functions exist
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify RPC functions exist', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN (
      'get_rule_with_history',
      'get_pending_rule_approvals',
      'get_rule_test_stats',
      'rollback_rule_to_version'
    )
    GROUP BY pronamespace
    HAVING COUNT(*) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: All 4 RPC functions exist';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing RPC functions';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 10: Verify grants for authenticated users
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Verify grants for authenticated users', v_test_count;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_name IN ('rules', 'rule_versions', 'rule_approvals', 'rule_test_results')
    AND grantee = 'authenticated'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    GROUP BY grantee
    HAVING COUNT(DISTINCT table_name) = 4
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: authenticated role has correct grants';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Missing grants for authenticated';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 11: Test auto-versioning trigger
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Test auto-versioning trigger', v_test_count;
  
  -- Create test tenant (if not exists)
  INSERT INTO tenants (id, name, subdomain, plan)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Test Tenant', 'test', 'professional')
  ON CONFLICT (id) DO NOTHING;

  -- Create test user (if not exists)
  INSERT INTO users (id, tenant_id, email, name, role)
  VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'test@example.com',
    'Test User',
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert test rule
  INSERT INTO rules (
    id,
    tenant_id,
    name,
    provider,
    conditions,
    actions,
    priority,
    status,
    created_by,
    updated_by
  ) VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Test Rule',
    'booking',
    '[{"field": "customer.tier", "operator": "equals", "value": "VIP"}]'::jsonb,
    '[{"type": "modify", "field": "priorityScore", "operation": "add", "value": 50}]'::jsonb,
    100,
    'draft',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002'
  )
  ON CONFLICT (id) DO UPDATE SET
    conditions = EXCLUDED.conditions,
    updated_at = NOW();

  -- Check if version was created
  IF EXISTS (
    SELECT 1 FROM rule_versions 
    WHERE rule_id = '00000000-0000-0000-0000-000000000003'
  ) THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: Auto-versioning trigger works (version snapshot created)';
  ELSE
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: Auto-versioning trigger did not create version';
  END IF;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 12: Test get_rule_with_history RPC
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Test get_rule_with_history RPC', v_test_count;
  
  BEGIN
    PERFORM * FROM get_rule_with_history('00000000-0000-0000-0000-000000000003');
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: get_rule_with_history RPC executes successfully';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: get_rule_with_history RPC failed: %', SQLERRM;
  END;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 13: Test get_pending_rule_approvals RPC
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Test get_pending_rule_approvals RPC', v_test_count;
  
  BEGIN
    PERFORM * FROM get_pending_rule_approvals('00000000-0000-0000-0000-000000000001');
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: get_pending_rule_approvals RPC executes successfully';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: get_pending_rule_approvals RPC failed: %', SQLERRM;
  END;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 14: Test get_rule_test_stats RPC
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Test get_rule_test_stats RPC', v_test_count;
  
  BEGIN
    PERFORM * FROM get_rule_test_stats('00000000-0000-0000-0000-000000000003', 30);
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  ✅ PASS: get_rule_test_stats RPC executes successfully';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: get_rule_test_stats RPC failed: %', SQLERRM;
  END;
  RAISE NOTICE '';

  -- ============================================================
  -- TEST 15: Test rollback_rule_to_version RPC
  -- ============================================================
  v_test_count := v_test_count + 1;
  RAISE NOTICE '🧪 Test %: Test rollback_rule_to_version RPC', v_test_count;
  
  -- Update rule to create version 2
  UPDATE rules 
  SET priority = 200, version = 2
  WHERE id = '00000000-0000-0000-0000-000000000003';

  -- Try to rollback to version 1
  BEGIN
    SELECT rollback_rule_to_version(
      '00000000-0000-0000-0000-000000000003',
      1,
      '00000000-0000-0000-0000-000000000002'
    ) INTO v_result;
    
    IF v_result::jsonb->>'success' = 'true' THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  ✅ PASS: rollback_rule_to_version RPC executes successfully';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE NOTICE '  ❌ FAIL: rollback_rule_to_version returned failure: %', v_result::jsonb->>'error';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE NOTICE '  ❌ FAIL: rollback_rule_to_version RPC failed: %', SQLERRM;
  END;
  RAISE NOTICE '';

  -- ============================================================
  -- CLEANUP: Delete test data
  -- ============================================================
  RAISE NOTICE '🧹 Cleaning up test data...';
  DELETE FROM rule_versions WHERE rule_id = '00000000-0000-0000-0000-000000000003';
  DELETE FROM rules WHERE id = '00000000-0000-0000-0000-000000000003';
  DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002';
  DELETE FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001';
  RAISE NOTICE '✅ Test data cleaned up';
  RAISE NOTICE '';

  -- ============================================================
  -- SUMMARY
  -- ============================================================
  RAISE NOTICE '╔════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  TEST SUMMARY                                              ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Total Tests:  %                                          ║', v_test_count;
  RAISE NOTICE '║  Passed:       %                                          ║', v_pass_count;
  RAISE NOTICE '║  Failed:       %                                          ║', v_fail_count;
  RAISE NOTICE '║  Success Rate: % percent                                  ║', ROUND((v_pass_count::NUMERIC / v_test_count::NUMERIC * 100)::NUMERIC, 1);
  RAISE NOTICE '╚════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  IF v_fail_count = 0 THEN
    RAISE NOTICE '🎉 ALL TESTS PASSED! Migration is successful.';
  ELSE
    RAISE NOTICE '⚠️  SOME TESTS FAILED. Please review the errors above.';
  END IF;

END $$;

