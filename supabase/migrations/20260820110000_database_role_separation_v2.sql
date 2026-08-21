-- R3: DATABASE ROLE SEPARATION (SIMPLIFIED)
-- Only grant on schemas that definitely exist: public and migration_governance

-- CREATE ROLES
CREATE ROLE bella_developer WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE bella_migration_executor WITH LOGIN NOSUPERUSER CREATEDB NOCREATEROLE;

-- bella_developer: READ-ONLY
GRANT USAGE ON SCHEMA public, migration_governance TO bella_developer;
GRANT SELECT ON ALL TABLES IN SCHEMA public, migration_governance TO bella_developer;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, migration_governance TO bella_developer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, migration_governance GRANT SELECT ON TABLES TO bella_developer;

-- bella_migration_executor: FULL PRIVILEGES
GRANT USAGE, CREATE ON SCHEMA public, migration_governance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, migration_governance TO bella_migration_executor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, migration_governance TO bella_migration_executor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, migration_governance TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, migration_governance GRANT ALL ON TABLES TO bella_migration_executor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, migration_governance GRANT ALL ON SEQUENCES TO bella_migration_executor;

-- AUDIT TABLE
CREATE TABLE migration_governance.role_usage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DDL', 'FUNCTION', 'OTHER')),
  schema_name text,
  table_name text,
  query_text text,
  session_username text,
  application_name text,
  client_addr inet,
  attempted_at timestamptz DEFAULT now(),
  succeeded boolean NOT NULL,
  error_message text
);

GRANT INSERT ON migration_governance.role_usage_audit TO bella_developer, bella_migration_executor;
