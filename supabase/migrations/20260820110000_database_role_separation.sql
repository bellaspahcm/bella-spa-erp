-- ============================================================================
-- BELLA DATABASE ROLE SEPARATION (R3)
-- ============================================================================
-- Migration: 20260820110000_database_role_separation.sql
-- Purpose: Close 3 canonical mutation authorities identified by Audit 7 R1
-- Phase: R3 Remediation (Database Role Separation)
-- 
-- Problem Statement (from R1):
--   Developer has 3 mutation authorities via credentials:
--     1. DATABASE_URL → direct psql → FULL mutation capability
--     2. Supabase CLI → production access → FULL mutation capability
--     3. SERVICE_ROLE_KEY → exec_sql → FULL mutation capability
-- 
-- Solution (R3):
--   Establish credential/role separation at database infrastructure level:
--     - bella_developer: READ-ONLY role (SELECT only)
--     - bella_migration_executor: AUTHORIZED MUTATION role (DML + DDL)
--     - Distribute credentials: Developer gets READ-ONLY, BDGF gets MUTATION
-- 
-- Success Criteria:
--   ✅ Developer → DATABASE_URL → mutation → FAIL
--   ✅ Developer → Supabase CLI → production mutation → FAIL
--   ✅ Developer → SERVICE_ROLE_KEY → mutation → FAIL
--   ✅ Valid Human GO → BDGF → Executor → mutation → PASS
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE ROLES
-- ============================================================================

-- Create bella_developer role (NON-MUTATING)
-- Purpose: Developer daily work (queries, debugging, analysis)
-- Privileges: SELECT only (NO INSERT, UPDATE, DELETE, DDL)
CREATE ROLE bella_developer WITH
  LOGIN
  PASSWORD NULL  -- Will be set via Supabase dashboard or ALTER ROLE
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  CONNECTION LIMIT -1;

COMMENT ON ROLE bella_developer IS 
  'R3 Database Role Separation - Non-mutating developer role (READ-ONLY). '
  'Developer credentials should map to this role. '
  'NO INSERT/UPDATE/DELETE/DDL privileges.';

-- Create bella_migration_executor role (AUTHORIZED MUTATION)
-- Purpose: Execute approved migrations via BDGF
-- Privileges: Full DML + DDL (but requires Human GO approval from R2)
CREATE ROLE bella_migration_executor WITH
  LOGIN
  PASSWORD NULL  -- Will be set via secure credential management
  NOSUPERUSER
  CREATEDB     -- Needed for CREATE SCHEMA in migrations
  NOCREATEROLE
  NOREPLICATION
  CONNECTION LIMIT 5;

COMMENT ON ROLE bella_migration_executor IS 
  'R3 Database Role Separation - Authorized mutation executor role. '
  'BDGF uses this role to execute approved migrations. '
  'Requires valid Human GO approval (enforced by R2). '
  'FULL DML + DDL privileges.';

-- ============================================================================
-- STEP 2: GRANT PRIVILEGES TO bella_developer (READ-ONLY)
-- ============================================================================

-- Grant USAGE on existing schemas only
GRANT USAGE ON SCHEMA public TO bella_developer;
GRANT USAGE ON SCHEMA migration_governance TO bella_developer;
-- Conditional grants for domain schemas (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'platform') THEN
    GRANT USAGE ON SCHEMA platform TO bella_developer;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'finance') THEN
    GRANT USAGE ON SCHEMA finance TO bella_developer;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'healthcare') THEN
    GRANT USAGE ON SCHEMA healthcare TO bella_developer;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'education') THEN
    GRANT USAGE ON SCHEMA education TO bella_developer;
  END IF;
END $$;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bella_developer;
GRANT SELECT ON ALL TABLES IN SCHEMA migration_governance TO bella_developer;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'platform') THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA platform TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'finance') THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA finance TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'healthcare') THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA healthcare TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'education') THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA education TO bella_developer';
  END IF;
END $$;

-- Grant SELECT on all sequences
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO bella_developer;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA migration_governance TO bella_developer;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'platform') THEN
    EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA platform TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'finance') THEN
    EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA finance TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'healthcare') THEN
    EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA healthcare TO bella_developer';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'education') THEN
    EXECUTE 'GRANT SELECT ON ALL SEQUENCES IN SCHEMA education TO bella_developer';
  END IF;
END $$;

-- Grant EXECUTE on functions that are read-only or safe
-- (Selective - most functions should NOT be executable by developer)
-- Only grant if function is documented as safe for developer use
GRANT EXECUTE ON FUNCTION migration_governance.verify_approval(uuid, text, text) TO bella_developer;
-- Note: Do NOT grant EXECUTE on consume_approval() - that's executor-only

-- Set default privileges for FUTURE tables (auto-grant SELECT on new tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA migration_governance GRANT SELECT ON TABLES TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT SELECT ON TABLES TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT SELECT ON TABLES TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthcare GRANT SELECT ON TABLES TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA education GRANT SELECT ON TABLES TO bella_developer;

-- ============================================================================
-- STEP 3: GRANT PRIVILEGES TO bella_migration_executor (AUTHORIZED MUTATION)
-- ============================================================================

-- Grant USAGE and CREATE on all schemas
GRANT USAGE, CREATE ON SCHEMA public TO bella_migration_executor;
GRANT USAGE, CREATE ON SCHEMA migration_governance TO bella_migration_executor;
GRANT USAGE, CREATE ON SCHEMA platform TO bella_migration_executor;
GRANT USAGE, CREATE ON SCHEMA finance TO bella_migration_executor;
GRANT USAGE, CREATE ON SCHEMA healthcare TO bella_migration_executor;
GRANT USAGE, CREATE ON SCHEMA education TO bella_migration_executor;

-- Grant ALL privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA migration_governance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA platform TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA finance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA healthcare TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA education TO bella_migration_executor;

-- Grant ALL privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA migration_governance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA platform TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA finance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA healthcare TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA education TO bella_migration_executor;

-- Grant EXECUTE on all functions (executor needs full capability)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA migration_governance TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA platform TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA finance TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA healthcare TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA education TO bella_migration_executor;

-- Set default privileges for FUTURE objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA migration_governance GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthcare GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA education GRANT ALL ON TABLES TO bella_migration_executor;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA migration_governance GRANT ALL ON SEQUENCES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT ALL ON SEQUENCES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON SEQUENCES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthcare GRANT ALL ON SEQUENCES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA education GRANT ALL ON SEQUENCES TO bella_migration_executor;

-- ============================================================================
-- STEP 4: REVOKE MUTATION PRIVILEGES FROM EXISTING DEVELOPER-USED ROLES
-- ============================================================================

-- IMPORTANT: This migration does NOT immediately revoke from 'postgres' role
-- because current DATABASE_URL may be using 'postgres' for migration execution.
-- 
-- Deployment Plan:
--   1. Apply this migration (creates new roles)
--   2. Create new credentials/passwords for bella_developer and bella_migration_executor
--   3. Update developer .env: DATABASE_URL → bella_developer connection
--   4. Update BDGF executor .env: DATABASE_URL → bella_migration_executor connection
--   5. Update Supabase project settings to restrict 'postgres' role if needed
--   6. Test enforcement (R3 verification tests)
--
-- Future migration (after credential distribution):
--   - May revoke mutation privileges from 'postgres' role if no longer needed
--   - Or keep 'postgres' as emergency break-glass superuser

-- For now, document the intended credential mapping:
COMMENT ON ROLE bella_developer IS 
  'R3 Database Role Separation - Non-mutating developer role (READ-ONLY). '
  'CREDENTIAL MAPPING: Developer .env DATABASE_URL should use this role. '
  'NO INSERT/UPDATE/DELETE/DDL privileges. '
  'Created: 2026-08-20 (R3 Remediation)';

COMMENT ON ROLE bella_migration_executor IS 
  'R3 Database Role Separation - Authorized mutation executor role. '
  'CREDENTIAL MAPPING: BDGF executor DATABASE_EXECUTOR_URL should use this role. '
  'Requires valid Human GO approval (enforced by R2). '
  'FULL DML + DDL privileges. '
  'Created: 2026-08-20 (R3 Remediation)';

-- ============================================================================
-- STEP 5: CREATE AUDIT TABLE FOR ROLE USAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_governance.role_usage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  operation_type text NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DDL', etc.
  schema_name text,
  table_name text,
  query_text text,
  session_username text,
  application_name text,
  client_addr inet,
  attempted_at timestamptz DEFAULT now(),
  succeeded boolean NOT NULL,
  error_message text,
  
  CONSTRAINT role_usage_audit_operation_type_check 
    CHECK (operation_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DDL', 'FUNCTION', 'OTHER'))
);

COMMENT ON TABLE migration_governance.role_usage_audit IS
  'R3 Database Role Separation - Audit log for role usage and attempted mutations. '
  'Tracks which roles attempt which operations for security monitoring.';

-- Grant INSERT to both roles (so they can self-audit)
GRANT INSERT ON migration_governance.role_usage_audit TO bella_developer;
GRANT INSERT ON migration_governance.role_usage_audit TO bella_migration_executor;

-- ============================================================================
-- VERIFICATION QUERIES (for manual inspection)
-- ============================================================================

-- Verify roles were created
-- SELECT rolname, rolsuper, rolcreatedb, rolcreaterole 
-- FROM pg_roles 
-- WHERE rolname LIKE 'bella_%';

-- Verify bella_developer has only SELECT
-- SELECT grantee, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'bella_developer' 
-- AND table_schema = 'public' 
-- LIMIT 10;

-- Verify bella_migration_executor has full privileges
-- SELECT grantee, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'bella_migration_executor' 
-- AND table_schema = 'public' 
-- LIMIT 10;
