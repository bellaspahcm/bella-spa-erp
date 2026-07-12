-- Query to verify actual column names in production database
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('packages', 'customers', 'users')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
