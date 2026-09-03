-- Phase 4B.3 — Database Verification RPC Functions
-- Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
-- 
-- Minimal PostgreSQL introspection RPC functions for 4B.3 Verification Engine.
-- These are infrastructure adapters, NOT decision logic.
-- Decision logic belongs in 4B.3 engine (verification-engine.ts).

-- Function 1: query_tables
-- Returns list of tables in a schema
CREATE OR REPLACE FUNCTION query_tables(schema_name text DEFAULT 'public')
RETURNS TABLE(table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::text
  FROM pg_tables t
  WHERE t.schemaname = schema_name
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: query_table_exists
-- Checks if a table exists in a schema
CREATE OR REPLACE FUNCTION query_table_exists(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = schema_name
      AND tablename = table_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: query_columns
-- Returns column definitions for a table
CREATE OR REPLACE FUNCTION query_columns(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS TABLE(
  name text,
  type text,
  nullable boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::text AS name,
    c.udt_name::text AS type,
    (c.is_nullable = 'YES') AS nullable
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND c.table_name = query_columns.table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: query_primary_key
-- Returns primary key column names for a table
CREATE OR REPLACE FUNCTION query_primary_key(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS text[] AS $$
DECLARE
  pk_columns text[];
BEGIN
  SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
  INTO pk_columns
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE i.indisprimary
    AND n.nspname = schema_name
    AND c.relname = table_name;

  RETURN COALESCE(pk_columns, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 5: query_foreign_keys
-- Returns foreign key constraints for a table
CREATE OR REPLACE FUNCTION query_foreign_keys(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS TABLE(
  column text,
  references text,
  referenced_column text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kcu.column_name::text AS column,
    ccu.table_name::text AS references,
    ccu.column_name::text AS referenced_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = schema_name
    AND tc.table_name = query_foreign_keys.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 6: query_rls_status
-- Checks if RLS is enabled on a table
CREATE OR REPLACE FUNCTION query_rls_status(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS boolean AS $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT c.relrowsecurity
  INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = schema_name
    AND c.relname = table_name;

  RETURN COALESCE(rls_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 7: query_rls_policies
-- Returns RLS policies for a table
CREATE OR REPLACE FUNCTION query_rls_policies(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS TABLE(
  name text,
  command text,
  using_clause text,
  check_clause text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pol.polname::text AS name,
    CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE 'UNKNOWN'
    END AS command,
    pg_get_expr(pol.polqual, pol.polrelid)::text AS using_clause,
    pg_get_expr(pol.polwithcheck, pol.polrelid)::text AS check_clause
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = schema_name
    AND c.relname = table_name
  ORDER BY pol.polname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (adjust as needed for your security model)
GRANT EXECUTE ON FUNCTION query_tables(text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_table_exists(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_columns(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_primary_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_foreign_keys(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_rls_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_rls_policies(text, text) TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION query_tables IS 'Phase 4B.3 — List tables in schema (infrastructure adapter)';
COMMENT ON FUNCTION query_table_exists IS 'Phase 4B.3 — Check table existence (infrastructure adapter)';
COMMENT ON FUNCTION query_columns IS 'Phase 4B.3 — Get column definitions (infrastructure adapter)';
COMMENT ON FUNCTION query_primary_key IS 'Phase 4B.3 — Get primary key columns (infrastructure adapter)';
COMMENT ON FUNCTION query_foreign_keys IS 'Phase 4B.3 — Get foreign key constraints (infrastructure adapter)';
COMMENT ON FUNCTION query_rls_status IS 'Phase 4B.3 — Check RLS enabled status (infrastructure adapter)';
COMMENT ON FUNCTION query_rls_policies IS 'Phase 4B.3 — Get RLS policies (infrastructure adapter)';
