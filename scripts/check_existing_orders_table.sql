-- Check if hc_clinical_orders already exists and what columns it has

-- Query 1: Check table existence
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'hc_clinical_orders'
) AS table_exists;

-- Query 2: If exists, show all columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'hc_clinical_orders' 
ORDER BY ordinal_position;

-- Query 3: Show constraints
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.hc_clinical_orders'::regclass;

-- Query 4: Show indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'hc_clinical_orders';
