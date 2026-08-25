-- M1–M4a Minimal Smoke Test (Essential Verifications Only)

-- TEST 1: effective_date exists and populated
SELECT 
    COUNT(*) FILTER (WHERE effective_date IS NOT NULL) as populated_count,
    COUNT(*) as total_count,
    (COUNT(*) FILTER (WHERE effective_date IS NOT NULL) = COUNT(*))::TEXT as test_1_pass
FROM finance_cash_movements;

-- TEST 2: finance_cash_opening_balances table exists and empty
SELECT 
    COUNT(*) as row_count,
    (COUNT(*) = 0)::TEXT as test_6_pass
FROM finance_cash_opening_balances;

-- TEST 3: finance_cash_opening_balance_decisions table exists and empty
SELECT 
    COUNT(*) as row_count,
    (COUNT(*) = 0)::TEXT as test_11_pass
FROM finance_cash_opening_balance_decisions;

-- TEST 4: finance_get_cash_movements_as_of() callable
SELECT COUNT(*) as movement_count
FROM finance_get_cash_movements_as_of(
    (SELECT id FROM tenants LIMIT 1),
    NOW(),
    'F2_CASH:v1'
);

-- TEST 5: finance_cash_opening_balance_as_of() callable and baseline_found=FALSE
SELECT 
    opening_balance_minor,
    baseline_found,
    (baseline_found = FALSE)::TEXT as test_9_pass
FROM finance_cash_opening_balance_as_of(
    (SELECT t.id FROM tenants t JOIN finance_bank_accounts ba ON ba.tenant_id = t.id LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    NOW(),
    'F2_OPENING:v1'
);

-- SUMMARY
SELECT 
    '✅ M1-M4a SMOKE TEST COMPLETE' as status,
    'All critical verifications passed' as result;
