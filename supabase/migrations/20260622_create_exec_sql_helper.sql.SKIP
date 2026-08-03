-- =====================================================
-- Create helper RPC function to execute raw SQL
-- Required for programmatic migration script execution
-- =====================================================

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Grant execute to service_role only (for security)
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Execute raw SQL - ONLY for service_role via migration scripts. DO NOT expose to client.';
