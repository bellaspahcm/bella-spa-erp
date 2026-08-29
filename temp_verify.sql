-- F2 M1-M4a Deployment Verification
-- Test 1: effective_date column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_movements'
  AND column_name = 'effective_date';
