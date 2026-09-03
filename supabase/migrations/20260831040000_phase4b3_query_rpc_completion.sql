-- =========================================================================
-- Migration: Phase 4B.3 Query RPC Completion
-- Purpose: Complete missing introspection RPCs on the test/pre-production DB.
-- Context: Remote history has 20260826154323_phase4b3_verification_rpc, but
--          schema reality showed only 4/7 query_* RPCs existed.
-- =========================================================================

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

CREATE OR REPLACE FUNCTION query_foreign_keys(
  table_name text,
  schema_name text DEFAULT 'public'
)
RETURNS TABLE(
  column_name text,
  references_table text,
  referenced_column text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kcu.column_name::text AS column_name,
    ccu.table_name::text AS references_table,
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

GRANT EXECUTE ON FUNCTION query_primary_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_foreign_keys(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION query_rls_policies(text, text) TO authenticated;

COMMENT ON FUNCTION query_primary_key(text, text) IS 'Phase 4B.3 completion - Get primary key columns (infrastructure adapter)';
COMMENT ON FUNCTION query_foreign_keys(text, text) IS 'Phase 4B.3 completion - Get foreign key constraints (infrastructure adapter)';
COMMENT ON FUNCTION query_rls_policies(text, text) IS 'Phase 4B.3 completion - Get RLS policies (infrastructure adapter)';