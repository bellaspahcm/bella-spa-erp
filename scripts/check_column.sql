SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('finance_cash_movements', 'finance_cash_opening_balances')
  AND column_name = 'effective_date'
ORDER BY table_name;
