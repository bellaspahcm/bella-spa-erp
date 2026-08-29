-- Remote DB State Verification - 2026-08-24
-- Check 1: F2 effective_date column
SELECT 'CHECK_1_COLUMN' as check_name, table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('finance_cash_movements', 'finance_cash_opening_balances')
  AND column_name = 'effective_date';

-- Check 2: Last 25 applied migrations
SELECT 'CHECK_2_MIGRATIONS' as check_name, version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 25;

-- Check 3: RPC functions
SELECT 'CHECK_3_RPCS' as check_name, routine_name, routine_schema
FROM information_schema.routines
WHERE routine_name IN (
  'finance_admin_cleanup_test_transactions',
  'finance_get_cash_movements_as_of',
  'finance_cash_opening_balance_as_of'
)
AND routine_type = 'FUNCTION';

-- Check 4: effective_date population
SELECT 'CHECK_4_DATA' as check_name,
  COUNT(*) as total_rows,
  COUNT(effective_date) as with_effective_date,
  COUNT(*) - COUNT(effective_date) as null_effective_date
FROM public.finance_cash_movements;
