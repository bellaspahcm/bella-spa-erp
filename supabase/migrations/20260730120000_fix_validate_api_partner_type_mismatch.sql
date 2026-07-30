-- =====================================================
-- Fix validate_api_partner Function Type Mismatch (PostgreSQL 42804)
-- =====================================================
-- Description: Explicitly cast ap.partner_name::TEXT and match exact column types
--              to resolve PostgreSQL error 42804 (structure of query does not match function result type)
-- Date: 2026-07-30
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_api_partner(p_api_key TEXT)
RETURNS TABLE (
  partner_id UUID,
  tenant_id UUID,
  partner_name TEXT,
  allowed_scopes TEXT[],
  is_active BOOLEAN,
  is_sandbox BOOLEAN,
  rate_limit_per_minute INTEGER,
  rate_limit_per_day INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id AS partner_id,
    ap.tenant_id AS tenant_id,
    ap.partner_name::TEXT AS partner_name,
    ap.allowed_scopes AS allowed_scopes,
    ap.is_active AS is_active,
    ap.is_sandbox AS is_sandbox,
    ap.rate_limit_per_minute AS rate_limit_per_minute,
    ap.rate_limit_per_day AS rate_limit_per_day
  FROM public.api_partners ap
  WHERE ap.api_key = p_api_key
    AND ap.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.validate_api_partner IS 'Validate API key and return partner configuration (with explicit type casting for PostgreSQL 42804 safety)';

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_api_partner TO service_role, anon;
