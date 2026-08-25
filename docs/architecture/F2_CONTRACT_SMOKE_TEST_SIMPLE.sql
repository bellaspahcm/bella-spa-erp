-- =========================================================================
-- F2 CASH TEMPORAL & OPENING BALANCE CONTRACT — RUNTIME SMOKE TEST
-- =========================================================================
-- Simplified version without \echo (for Supabase CLI compatibility)
-- =========================================================================

-- TEST 1: effective_date column exists and populated
DO $$
DECLARE
    v_column_exists BOOLEAN;
    v_null_count INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'finance_cash_movements'
          AND column_name = 'effective_date'
          AND is_nullable = 'NO'
    ) INTO v_column_exists;
    
    IF NOT v_column_exists THEN
        RAISE EXCEPTION 'TEST 1 FAILED: effective_date column missing or nullable';
    END IF;
    
    SELECT 
        COUNT(*) FILTER (WHERE effective_date IS NULL),
        COUNT(*)
    INTO v_null_count, v_total_count
    FROM public.finance_cash_movements;
    
    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: % cash movements have NULL effective_date', v_null_count;
    END IF;
    
    RAISE NOTICE 'TEST 1 PASSED: effective_date exists, NOT NULL, % rows', v_total_count;
END $$;

-- TEST 2: effective_date lineage from F1
DO $$
DECLARE
    v_total INTEGER;
    v_valid_lineage INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE fcm.effective_date = ft.posted_at)
    INTO v_total, v_valid_lineage
    FROM public.finance_cash_movements fcm
    JOIN public.finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id;
    
    IF v_total != v_valid_lineage THEN
        RAISE EXCEPTION 'TEST 2 FAILED: %/% movements have invalid F1 lineage', 
            (v_total - v_valid_lineage), v_total;
    END IF;
    
    RAISE NOTICE 'TEST 2 PASSED: All % movements have valid F1 lineage', v_total;
END $$;

-- TEST 3: effective_date index exists
DO $$
DECLARE
    v_index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'finance_cash_movements'
          AND indexname = 'idx_finance_cash_movements_effective_date'
    ) INTO v_index_exists;
    
    IF NOT v_index_exists THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Index missing';
    END IF;
    
    RAISE NOTICE 'TEST 3 PASSED: Index exists';
END $$;

-- TEST 4: finance_get_cash_movements_as_of() callable
DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_test_tenant_id UUID;
    v_result_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'finance_get_cash_movements_as_of'
          AND pronargs = 3
    ) INTO v_function_exists;
    
    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Function missing or wrong signature';
    END IF;
    
    SELECT id INTO v_test_tenant_id FROM public.tenants LIMIT 1;
    
    IF v_test_tenant_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_result_count
        FROM finance_get_cash_movements_as_of(
            v_test_tenant_id,
            NOW(),
            'F2_CASH:v1'
        );
        
        RAISE NOTICE 'TEST 4 PASSED: Function callable, % rows', v_result_count;
    ELSE
        RAISE NOTICE 'TEST 4 PASSED: Function exists (no tenant data)';
    END IF;
END $$;

-- TEST 5: Contract return schema v1.2
DO $$
DECLARE
    v_has_bank_account_id BOOLEAN;
    v_has_f1_transaction_id BOOLEAN;
BEGIN
    SELECT 
        bool_or(column_name = 'bank_account_id'),
        bool_or(column_name = 'f1_transaction_id')
    INTO v_has_bank_account_id, v_has_f1_transaction_id
    FROM information_schema.routine_columns
    WHERE routine_name = 'finance_get_cash_movements_as_of';
    
    IF NOT v_has_bank_account_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Missing bank_account_id';
    END IF;
    
    IF NOT v_has_f1_transaction_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Missing f1_transaction_id';
    END IF;
    
    RAISE NOTICE 'TEST 5 PASSED: Contract return schema v1.2 verified';
END $$;

-- TEST 6: finance_cash_opening_balances table exists
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'finance_cash_opening_balances'
    ) INTO v_table_exists;
    
    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Table missing';
    END IF;
    
    SELECT COUNT(*) INTO v_row_count
    FROM public.finance_cash_opening_balances;
    
    IF v_row_count != 0 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Table contains % rows (expected 0)', v_row_count;
    END IF;
    
    RAISE NOTICE 'TEST 6 PASSED: Table exists and is empty';
END $$;

-- TEST 7: Provenance columns exist (INV-F2-O2)
DO $$
DECLARE
    v_source_type_not_null BOOLEAN;
BEGIN
    SELECT 
        is_nullable = 'NO'
    INTO v_source_type_not_null
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_cash_opening_balances'
      AND column_name = 'source_type';
    
    IF NOT v_source_type_not_null THEN
        RAISE EXCEPTION 'TEST 7 FAILED: source_type is nullable (violates INV-F2-O2)';
    END IF;
    
    RAISE NOTICE 'TEST 7 PASSED: Provenance columns correct';
END $$;

-- TEST 8: Immutability trigger exists (INV-F2-D3)
DO $$
DECLARE
    v_trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE event_object_table = 'finance_cash_opening_balances'
      AND trigger_name = 'trg_opening_balance_immutability';
    
    IF v_trigger_count < 2 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Immutability trigger missing (expected 2 events)';
    END IF;
    
    RAISE NOTICE 'TEST 8 PASSED: Immutability trigger exists';
END $$;

-- TEST 9: finance_cash_opening_balance_as_of() callable
DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_test_tenant_id UUID;
    v_test_account_id UUID;
    v_baseline_found BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'finance_cash_opening_balance_as_of'
          AND pronargs = 4
    ) INTO v_function_exists;
    
    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Function missing or wrong signature';
    END IF;
    
    SELECT t.id, ba.id INTO v_test_tenant_id, v_test_account_id
    FROM public.tenants t
    JOIN public.finance_bank_accounts ba ON ba.tenant_id = t.id
    LIMIT 1;
    
    IF v_test_tenant_id IS NOT NULL AND v_test_account_id IS NOT NULL THEN
        SELECT baseline_found INTO v_baseline_found
        FROM finance_cash_opening_balance_as_of(
            v_test_tenant_id,
            v_test_account_id,
            NOW(),
            'F2_OPENING:v1'
        );
        
        IF v_baseline_found THEN
            RAISE EXCEPTION 'TEST 9 FAILED: baseline_found = TRUE when no baseline exists';
        END IF;
        
        RAISE NOTICE 'TEST 9 PASSED: Function callable, baseline_found = FALSE';
    ELSE
        RAISE NOTICE 'TEST 9 PASSED: Function exists (no account data)';
    END IF;
END $$;

-- TEST 10: RLS enabled
DO $$
DECLARE
    v_rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = 'finance_cash_opening_balances'
      AND relnamespace = 'public'::regnamespace;
    
    IF NOT v_rls_enabled THEN
        RAISE EXCEPTION 'TEST 10 FAILED: RLS not enabled';
    END IF;
    
    RAISE NOTICE 'TEST 10 PASSED: RLS enabled';
END $$;

-- TEST 11: finance_cash_opening_balance_decisions table exists
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'finance_cash_opening_balance_decisions'
    ) INTO v_table_exists;
    
    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'TEST 11 FAILED: Decision table missing';
    END IF;
    
    SELECT COUNT(*) INTO v_row_count
    FROM public.finance_cash_opening_balance_decisions;
    
    IF v_row_count != 0 THEN
        RAISE EXCEPTION 'TEST 11 FAILED: Decision table contains % rows (expected 0)', v_row_count;
    END IF;
    
    RAISE NOTICE 'TEST 11 PASSED: Decision registry table exists and is empty';
END $$;

-- TEST 12: decision_type constraint exists
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name = 'chk_decision_type'
    ) INTO v_constraint_exists;
    
    IF NOT v_constraint_exists THEN
        RAISE EXCEPTION 'TEST 12 FAILED: CHECK constraint missing';
    END IF;
    
    RAISE NOTICE 'TEST 12 PASSED: decision_type constraint exists';
END $$;

-- SUMMARY
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== F2 SMOKE TEST COMPLETE ===';
    RAISE NOTICE 'All 12 tests PASSED';
    RAISE NOTICE '';
    RAISE NOTICE 'Verified:';
    RAISE NOTICE '  - M1: effective_date column, backfill, index';
    RAISE NOTICE '  - M2: finance_get_cash_movements_as_of() v1.2';
    RAISE NOTICE '  - M3: finance_cash_opening_balances + contract';
    RAISE NOTICE '  - M4a: finance_cash_opening_balance_decisions';
    RAISE NOTICE '';
    RAISE NOTICE 'Boundaries Respected:';
    RAISE NOTICE '  - No data seeded in opening balance tables';
    RAISE NOTICE '  - baseline_found returns FALSE (no baseline)';
    RAISE NOTICE '  - Immutability trigger exists';
    RAISE NOTICE '  - RLS enabled';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT GATE: Human architect baseline provenance decision';
    RAISE NOTICE 'BLOCKED: M4b, F5.6';
END $$;
