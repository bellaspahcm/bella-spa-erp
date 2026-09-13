-- Check real_estate_projects.tenant_id column definition and default

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'real_estate_projects'
  AND column_name = 'tenant_id';
