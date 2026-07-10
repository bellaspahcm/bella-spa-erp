-- ============================================================================
-- Booking Engine Schema Verification Tests
-- ============================================================================
-- Purpose: Verify migration 20260709140000 deployed correctly
-- Run after: npx supabase db push
-- Usage: npx supabase db execute -f supabase/tests/booking_engine_schema_verification.sql
-- ============================================================================

\echo '🧪 Booking Engine Schema Verification Tests'
\echo '============================================'
\echo ''

-- ============================================================================
-- TEST 1: Tables Exist
-- ============================================================================

\echo '📋 Test 1: Verify Tables Exist'

DO $$
DECLARE
  v_missing_tables TEXT[];
  v_table TEXT;
BEGIN
  -- Check if all 4 tables exist
  SELECT ARRAY_AGG(table_name)
  INTO v_missing_tables
  FROM (
    SELECT unnest(ARRAY['waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events']) AS table_name
  ) expected
  WHERE table_name NOT IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  );
  
  IF v_missing_tables IS NOT NULL THEN
    RAISE EXCEPTION '❌ Missing tables: %', array_to_string(v_missing_tables, ', ');
  ELSE
    RAISE NOTICE '✅ All 4 tables exist';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 2: Column Counts
-- ============================================================================

\echo '📋 Test 2: Verify Column Counts'

DO $$
DECLARE
  v_waitlist_cols INT;
  v_pricing_cols INT;
  v_capacity_cols INT;
  v_events_cols INT;
BEGIN
  -- Count columns in each table
  SELECT COUNT(*) INTO v_waitlist_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'waitlist';
  
  SELECT COUNT(*) INTO v_pricing_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'pricing_rules';
  
  SELECT COUNT(*) INTO v_capacity_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'capacity_snapshots';
  
  SELECT COUNT(*) INTO v_events_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'booking_events';
  
  -- Verify counts
  IF v_waitlist_cols < 12 THEN
    RAISE EXCEPTION '❌ waitlist: Expected ≥12 columns, got %', v_waitlist_cols;
  END IF;
  
  IF v_pricing_cols < 11 THEN
    RAISE EXCEPTION '❌ pricing_rules: Expected ≥11 columns, got %', v_pricing_cols;
  END IF;
  
  IF v_capacity_cols < 10 THEN
    RAISE EXCEPTION '❌ capacity_snapshots: Expected ≥10 columns, got %', v_capacity_cols;
  END IF;
  
  IF v_events_cols < 12 THEN
    RAISE EXCEPTION '❌ booking_events: Expected ≥12 columns, got %', v_events_cols;
  END IF;
  
  RAISE NOTICE '✅ Column counts correct (waitlist: %, pricing: %, capacity: %, events: %)',
    v_waitlist_cols, v_pricing_cols, v_capacity_cols, v_events_cols;
END $$;

\echo ''

-- ============================================================================
-- TEST 3: Indexes Exist
-- ============================================================================

\echo '📋 Test 3: Verify Indexes'

DO $$
DECLARE
  v_expected_indexes TEXT[] := ARRAY[
    'idx_waitlist_tenant_status',
    'idx_waitlist_date_slot',
    'idx_waitlist_priority',
    'idx_waitlist_customer',
    'idx_waitlist_expiry',
    'idx_pricing_rules_tenant_enabled',
    'idx_pricing_rules_type',
    'idx_pricing_rules_priority',
    'idx_pricing_rules_validity',
    'idx_capacity_snapshots_date',
    'idx_capacity_snapshots_hour',
    'idx_capacity_snapshots_utilization',
    'idx_capacity_snapshots_branch',
    'idx_capacity_snapshots_unique',
    'idx_booking_events_booking',
    'idx_booking_events_type',
    'idx_booking_events_created_at',
    'idx_booking_events_user'
  ];
  v_missing_indexes TEXT[];
BEGIN
  -- Check if all indexes exist
  SELECT ARRAY_AGG(index_name)
  INTO v_missing_indexes
  FROM (
    SELECT unnest(v_expected_indexes) AS index_name
  ) expected
  WHERE index_name NOT IN (
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
  );
  
  IF v_missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION '❌ Missing indexes: %', array_to_string(v_missing_indexes, ', ');
  ELSE
    RAISE NOTICE '✅ All 17 indexes exist';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 4: Functions Exist
-- ============================================================================

\echo '📋 Test 4: Verify Functions'

DO $$
DECLARE
  v_missing_functions TEXT[];
BEGIN
  -- Check if all 3 functions exist
  SELECT ARRAY_AGG(function_name)
  INTO v_missing_functions
  FROM (
    SELECT unnest(ARRAY[
      'expire_old_waitlist_entries',
      'calculate_waitlist_priority',
      'get_available_capacity'
    ]) AS function_name
  ) expected
  WHERE function_name NOT IN (
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
  );
  
  IF v_missing_functions IS NOT NULL THEN
    RAISE EXCEPTION '❌ Missing functions: %', array_to_string(v_missing_functions, ', ');
  ELSE
    RAISE NOTICE '✅ All 3 functions exist';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 5: RLS Enabled
-- ============================================================================

\echo '📋 Test 5: Verify RLS Enabled'

DO $$
DECLARE
  v_tables_without_rls TEXT[];
BEGIN
  -- Check if RLS enabled on all tables
  SELECT ARRAY_AGG(tablename)
  INTO v_tables_without_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
    AND tablename NOT IN (
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = true
    );
  
  IF v_tables_without_rls IS NOT NULL THEN
    RAISE EXCEPTION '❌ RLS not enabled on: %', array_to_string(v_tables_without_rls, ', ');
  ELSE
    RAISE NOTICE '✅ RLS enabled on all 4 tables';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 6: RLS Policies Exist
-- ============================================================================

\echo '📋 Test 6: Verify RLS Policies'

DO $$
DECLARE
  v_policy_count INT;
BEGIN
  -- Count policies on booking engine tables
  SELECT COUNT(*)
  INTO v_policy_count
  FROM pg_policies
  WHERE tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events');
  
  IF v_policy_count < 6 THEN
    RAISE EXCEPTION '❌ Expected ≥6 RLS policies, found %', v_policy_count;
  ELSE
    RAISE NOTICE '✅ RLS policies exist (% policies)', v_policy_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 7: Constraints
-- ============================================================================

\echo '📋 Test 7: Verify Constraints'

DO $$
DECLARE
  v_constraint_count INT;
BEGIN
  -- Check key constraints exist
  SELECT COUNT(*)
  INTO v_constraint_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
    AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'CHECK');
  
  IF v_constraint_count < 10 THEN
    RAISE EXCEPTION '❌ Expected ≥10 constraints, found %', v_constraint_count;
  ELSE
    RAISE NOTICE '✅ Constraints exist (% constraints)', v_constraint_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 8: Function Signatures
-- ============================================================================

\echo '📋 Test 8: Verify Function Signatures'

DO $$
BEGIN
  -- Test expire_old_waitlist_entries (no params)
  PERFORM * FROM pg_proc
  WHERE proname = 'expire_old_waitlist_entries'
    AND pronargs = 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ expire_old_waitlist_entries() signature incorrect';
  END IF;
  
  -- Test calculate_waitlist_priority (2 UUID params)
  PERFORM * FROM pg_proc
  WHERE proname = 'calculate_waitlist_priority'
    AND pronargs = 2;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ calculate_waitlist_priority() signature incorrect';
  END IF;
  
  -- Test get_available_capacity (UUID, DATE, TEXT params)
  PERFORM * FROM pg_proc
  WHERE proname = 'get_available_capacity'
    AND pronargs = 3;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ get_available_capacity() signature incorrect';
  END IF;
  
  RAISE NOTICE '✅ All function signatures correct';
END $$;

\echo ''

-- ============================================================================
-- TEST 9: Data Types
-- ============================================================================

\echo '📋 Test 9: Verify Critical Column Types'

DO $$
BEGIN
  -- Check waitlist.priority_score is INT
  PERFORM 1 FROM information_schema.columns
  WHERE table_name = 'waitlist' AND column_name = 'priority_score'
    AND data_type = 'integer';
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ waitlist.priority_score type incorrect';
  END IF;
  
  -- Check pricing_rules.multiplier is NUMERIC
  PERFORM 1 FROM information_schema.columns
  WHERE table_name = 'pricing_rules' AND column_name = 'multiplier'
    AND data_type = 'numeric';
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ pricing_rules.multiplier type incorrect';
  END IF;
  
  -- Check pricing_rules.condition is JSONB
  PERFORM 1 FROM information_schema.columns
  WHERE table_name = 'pricing_rules' AND column_name = 'condition'
    AND data_type = 'jsonb';
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ pricing_rules.condition type incorrect';
  END IF;
  
  -- Check capacity_snapshots.utilization_rate is NUMERIC
  PERFORM 1 FROM information_schema.columns
  WHERE table_name = 'capacity_snapshots' AND column_name = 'utilization_rate'
    AND data_type = 'numeric';
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ capacity_snapshots.utilization_rate type incorrect';
  END IF;
  
  -- Check booking_events.event_data is JSONB
  PERFORM 1 FROM information_schema.columns
  WHERE table_name = 'booking_events' AND column_name = 'event_data'
    AND data_type = 'jsonb';
  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ booking_events.event_data type incorrect';
  END IF;
  
  RAISE NOTICE '✅ All critical column types correct';
END $$;

\echo ''

-- ============================================================================
-- TEST 10: Insert & Query Test (Minimal Data)
-- ============================================================================

\echo '📋 Test 10: Basic Insert & Query Test'

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_customer_id UUID := gen_random_uuid();
  v_package_id UUID := gen_random_uuid();
  v_booking_id UUID := gen_random_uuid();
  v_waitlist_id UUID;
  v_rule_id UUID;
  v_snapshot_id UUID;
  v_event_id UUID;
BEGIN
  -- Test waitlist insert
  INSERT INTO waitlist (
    tenant_id, customer_id, package_id,
    preferred_date, priority_score, status, expires_at
  ) VALUES (
    v_tenant_id, v_customer_id, v_package_id,
    CURRENT_DATE + 1, 50, 'active', NOW() + INTERVAL '7 days'
  ) RETURNING id INTO v_waitlist_id;
  
  IF v_waitlist_id IS NULL THEN
    RAISE EXCEPTION '❌ Failed to insert into waitlist';
  END IF;
  
  -- Test pricing_rules insert
  INSERT INTO pricing_rules (
    tenant_id, rule_name, rule_type, condition, multiplier, priority, enabled
  ) VALUES (
    v_tenant_id, 'Test Rule', 'peak_hour', '{"hour_range": [10, 14]}'::jsonb, 1.15, 100, true
  ) RETURNING id INTO v_rule_id;
  
  IF v_rule_id IS NULL THEN
    RAISE EXCEPTION '❌ Failed to insert into pricing_rules';
  END IF;
  
  -- Test capacity_snapshots insert
  INSERT INTO capacity_snapshots (
    tenant_id, snapshot_date, snapshot_hour,
    total_capacity, booked_capacity, available_capacity, buffer_reserved, utilization_rate
  ) VALUES (
    v_tenant_id, CURRENT_DATE, 10,
    10, 5, 4, 1, 50.00
  ) RETURNING id INTO v_snapshot_id;
  
  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION '❌ Failed to insert into capacity_snapshots';
  END IF;
  
  -- Test booking_events insert
  INSERT INTO booking_events (
    tenant_id, booking_id, event_type, event_description
  ) VALUES (
    v_tenant_id, v_booking_id, 'created', 'Test event'
  ) RETURNING id INTO v_event_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION '❌ Failed to insert into booking_events';
  END IF;
  
  -- Cleanup test data
  DELETE FROM booking_events WHERE id = v_event_id;
  DELETE FROM capacity_snapshots WHERE id = v_snapshot_id;
  DELETE FROM pricing_rules WHERE id = v_rule_id;
  DELETE FROM waitlist WHERE id = v_waitlist_id;
  
  RAISE NOTICE '✅ All tables accept inserts and deletes correctly';
END $$;

\echo ''

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo '============================================'
\echo '✅ All Schema Verification Tests Passed!'
\echo '============================================'
\echo ''
\echo 'Schema is ready for:'
\echo '  1. TypeScript type generation'
\echo '  2. Provider implementation'
\echo '  3. Integration tests'
\echo ''
