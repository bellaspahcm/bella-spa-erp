-- ============================================================================
-- Diagnose Schema Access for Type Generation
-- Purpose: Determine why CLI cannot see logistics schema
-- ============================================================================

-- Check 1: Schema ownership and permissions
SELECT 
  nspname AS schema_name,
  nspowner::regrole AS owner,
  has_schema_privilege('postgres', nspname, 'USAGE') AS postgres_usage,
  has_schema_privilege('anon', nspname, 'USAGE') AS anon_usage,
  has_schema_privilege('authenticated', nspname, 'USAGE') AS authenticated_usage,
  has_schema_privilege('service_role', nspname, 'USAGE') AS service_role_usage
FROM pg_namespace
WHERE nspname IN ('public', 'logistics')
ORDER BY nspname;

-- Check 2: Current role and search path
SELECT 
  current_user AS current_role,
  session_user AS session_role,
  current_setting('search_path') AS search_path;

-- Check 3: Tables visible to current role
SELECT 
  schemaname,
  tablename,
  tableowner,
  has_table_privilege(current_user, schemaname || '.' || tablename, 'SELECT') AS can_select
FROM pg_tables
WHERE schemaname IN ('public', 'logistics')
ORDER BY schemaname, tablename;

-- Check 4: Grant statements needed (if any)
SELECT 
  'GRANT USAGE ON SCHEMA logistics TO postgres, anon, authenticated, service_role;' AS fix_suggestion
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.schema_privileges
  WHERE schema_name = 'logistics' AND grantee IN ('postgres', 'anon', 'authenticated', 'service_role')
);
