-- Check if tables and columns exist
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('real_estate_projects', 'real_estate_products', 're_customers', 're_leads')
ORDER BY table_name, ordinal_position;
