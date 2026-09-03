-- ============================================================================
-- E7 State Verification Query
-- Purpose: Verify E7 migration is fully applied
-- ============================================================================

-- Check 1: logistics schema exists
SELECT 'logistics schema' AS check_name, 
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.schemata WHERE schema_name = 'logistics'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status;

-- Check 2: All 6 E7 tables exist
SELECT 'E7 tables' AS check_name,
       COUNT(*) AS table_count,
       array_agg(table_name ORDER BY table_name) AS tables
FROM information_schema.tables 
WHERE table_schema = 'logistics';

-- Check 3: Migration recorded in history
SELECT 'Migration history' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM supabase_migrations.schema_migrations 
         WHERE version = '20260822000000'
       ) THEN '✅ RECORDED' ELSE '❌ NOT RECORDED' END AS status;

-- Check 4: Detailed table verification
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'logistics' AND table_name = t.table_name) AS column_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'logistics' AND table_name = t.table_name) AS constraint_count
FROM information_schema.tables t
WHERE table_schema = 'logistics'
ORDER BY table_name;

-- Check 5: RLS enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status
FROM pg_tables 
WHERE schemaname = 'logistics'
ORDER BY tablename;
