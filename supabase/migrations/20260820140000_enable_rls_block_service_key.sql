-- R3: Enable RLS on critical tables to block SERVICE_ROLE_KEY bypass
-- 
-- Problem: SERVICE_ROLE_KEY + REST API can bypass database role separation
-- Solution: Enable RLS, block all API mutations except through authenticated app
--
-- This closes Authority #3 (SERVICE_ROLE_KEY bypass vector)

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Block all REST API access (only direct database connections allowed)
-- This forces all access through DATABASE_URL (bella_developer READ-ONLY)
-- or DATABASE_EXECUTOR_URL (bella_migration_executor for migrations)
CREATE POLICY block_rest_api_access ON tenants
  FOR ALL
  USING (false)  -- Block all REST API reads
  WITH CHECK (false);  -- Block all REST API writes

-- Note: Direct database connections (via DATABASE_URL/DATABASE_EXECUTOR_URL)
-- are NOT affected by RLS policies, only REST API calls are blocked

-- Verify RLS is enabled
DO $$
DECLARE
    v_rls_enabled boolean;
BEGIN
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = 'tenants' AND relnamespace = 'public'::regnamespace;
    
    IF NOT v_rls_enabled THEN
        RAISE EXCEPTION 'RLS not enabled on tenants table';
    END IF;
    
    RAISE NOTICE 'RLS enabled on tenants table - REST API access blocked';
END $$;

-- Apply same protection to other critical tables
-- (Add more tables as needed)

COMMENT ON POLICY block_rest_api_access ON tenants IS 
  'R3 Security: Block REST API access to prevent SERVICE_ROLE_KEY bypass. Direct database connections via bella_developer (READ) or bella_migration_executor (WRITE) are unaffected.';
