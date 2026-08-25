SELECT routine_name, routine_schema, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'finance_admin_cleanup_test_transactions',
  'finance_get_cash_movements_as_of',
  'finance_cash_opening_balance_as_of'
)
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
