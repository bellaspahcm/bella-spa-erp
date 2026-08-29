-- P0.2 Section 3: Supabase Authority Audit
-- READ-ONLY queries to verify credential → capability chain
-- NO DDL, NO DML, NO credential testing

-- ============================================
-- 3.1: Database Roles Inventory
-- ============================================

-- List all non-system roles
SELECT 
  rolname AS role_name,
  rolsuper AS is_superuser,
  rolcreatedb AS can_create_db,
  rolcreaterole AS can_create_role,
  rolbypassrls AS bypass_rls,
  rolconnlimit AS connection_limit,
  CASE 
    WHEN rolsuper THEN 'SUPERUSER'
    WHEN rolbypassrls THEN 'ADMIN (bypass RLS)'
    ELSE 'STANDARD'
  END AS authority_level
FROM pg_roles
WHERE rolname NOT LIKE 'pg_%'
  AND rolname NOT LIKE 'rds_%'
ORDER BY rolsuper DESC, rolbypassrls DESC, rolname;

-- ============================================
-- 3.2: Schema Privileges
-- ============================================

-- Check CREATE privilege on schemas (DDL capability indicator)
SELECT 
  nspname AS schema_name,
  r.rolname AS role_name,
  has_schema_privilege(r.rolname, nspname, 'CREATE') AS can_create_objects,
  has_schema_privilege(r.rolname, nspname, 'USAGE') AS can_access
FROM pg_namespace n
CROSS JOIN (
  SELECT rolname 
  FROM pg_roles 
  WHERE rolname NOT LIKE 'pg_%' 
    AND rolname NOT LIKE 'rds_%'
) r
WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND (
    has_schema_privilege(r.rolname, nspname, 'CREATE') 
    OR has_schema_privilege(r.rolname, nspname, 'USAGE')
  )
ORDER BY schema_name, can_create_objects DESC, role_name;

-- ============================================
-- 3.3: Table Privileges Summary
-- ============================================

-- Summarize table-level privileges per role
WITH role_table_privs AS (
  SELECT 
    grantee AS role_name,
    table_schema,
    COUNT(DISTINCT table_name) AS table_count,
    bool_or(privilege_type = 'SELECT') AS has_select,
    bool_or(privilege_type = 'INSERT') AS has_insert,
    bool_or(privilege_type = 'UPDATE') AS has_update,
    bool_or(privilege_type = 'DELETE') AS has_delete,
    bool_or(privilege_type = 'TRUNCATE') AS has_truncate,
    bool_or(privilege_type = 'REFERENCES') AS has_references,
    bool_or(privilege_type = 'TRIGGER') AS has_trigger
  FROM information_schema.table_privileges
  WHERE grantee NOT LIKE 'pg_%'
    AND table_schema NOT IN ('pg_catalog', 'information_schema')
  GROUP BY grantee, table_schema
)
SELECT 
  role_name,
  table_schema,
  table_count,
  CASE 
    WHEN has_select AND NOT (has_insert OR has_update OR has_delete) THEN 'READ-ONLY'
    WHEN has_insert OR has_update OR has_delete THEN 'DML'
    ELSE 'UNKNOWN'
  END AS capability_level,
  has_select,
  has_insert,
  has_update,
  has_delete,
  has_truncate
FROM role_table_privs
ORDER BY 
  CASE WHEN capability_level = 'DML' THEN 1 ELSE 2 END,
  role_name,
  table_schema;

-- ============================================
-- 3.4: DDL Capability Check
-- ============================================

-- Check which roles can perform DDL operations
SELECT 
  rolname AS role_name,
  rolsuper AS superuser,
  rolcreatedb AS can_create_database,
  rolcreaterole AS can_create_role,
  rolbypassrls AS bypass_rls,
  CASE 
    WHEN rolsuper THEN 'DDL (superuser)'
    WHEN EXISTS (
      SELECT 1 
      FROM pg_namespace n
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND has_schema_privilege(rolname, n.nspname, 'CREATE')
    ) THEN 'DDL (schema CREATE)'
    ELSE 'NO DDL'
  END AS ddl_capability
FROM pg_roles
WHERE rolname NOT LIKE 'pg_%'
  AND rolname NOT LIKE 'rds_%'
ORDER BY rolsuper DESC, ddl_capability;

-- ============================================
-- 3.5: Role Membership
-- ============================================

-- Show role inheritance (which roles inherit from which)
SELECT 
  r.rolname AS member_role,
  m.rolname AS member_of_role,
  r.rolsuper AS is_superuser
FROM pg_auth_members am
JOIN pg_roles r ON am.member = r.oid
JOIN pg_roles m ON am.roleid = m.oid
WHERE r.rolname NOT LIKE 'pg_%'
  AND m.rolname NOT LIKE 'pg_%'
ORDER BY member_of_role, member_role;

-- ============================================
-- 3.6: Specific Role Analysis
-- ============================================

-- Analyze commonly expected roles
DO $$
DECLARE
  role_list text[] := ARRAY[
    'postgres',
    'authenticator',
    'authenticated',
    'anon',
    'service_role',
    'supabase_admin',
    'bella_readonly',
    'bella_deployment'
  ];
  role_name text;
BEGIN
  RAISE NOTICE '--- Role Analysis ---';
  FOREACH role_name IN ARRAY role_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      RAISE NOTICE 'Role: % - EXISTS', role_name;
    ELSE
      RAISE NOTICE 'Role: % - NOT FOUND', role_name;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 3.7: Connection String Analysis (Metadata Only)
-- ============================================

-- Show current connection identity
SELECT 
  current_user AS authenticated_as,
  session_user AS session_identity,
  current_database() AS database_name,
  inet_server_addr() AS server_address,
  inet_server_port() AS server_port;

-- Check current role privileges
SELECT 
  current_user AS role_name,
  pg_has_role(current_user, 'pg_read_all_data', 'MEMBER') AS read_all_data,
  pg_has_role(current_user, 'pg_write_all_data', 'MEMBER') AS write_all_data,
  (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
  (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls;

-- ============================================
-- AUTHORITY CHAIN VERIFICATION
-- ============================================

-- This query MUST be run with each credential to map:
-- Credential → Identity → Role → Privileges → Capability

-- INSTRUCTIONS:
-- 1. Run this script with SUPABASE_SERVICE_ROLE_KEY credential
-- 2. Run this script with SUPABASE_DB_URL credential
-- 3. Run this script with any read-only credential
-- 4. Compare results to determine actual authority

-- DO NOT:
-- - Execute DDL statements
-- - Test CREATE TABLE
-- - Test ALTER/DROP
-- - Modify any data
-- - Test on production without approval

-- ONLY:
-- - Query system catalogs (pg_roles, pg_namespace, information_schema)
-- - Verify privilege metadata
-- - Document findings in P0_2_CREDENTIAL_INVENTORY.md Section 3
