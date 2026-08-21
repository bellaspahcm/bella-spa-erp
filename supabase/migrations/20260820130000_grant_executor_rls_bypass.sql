-- R3: Grant RLS BYPASSRLS to bella_migration_executor
-- Migration executor needs to bypass RLS to perform migrations

-- Grant BYPASSRLS privilege
ALTER ROLE bella_migration_executor WITH BYPASSRLS;

-- Verify
DO $$
DECLARE
    v_has_bypassrls boolean;
BEGIN
    SELECT rolbypassrls INTO v_has_bypassrls
    FROM pg_roles
    WHERE rolname = 'bella_migration_executor';
    
    IF NOT v_has_bypassrls THEN
        RAISE EXCEPTION 'bella_migration_executor does not have BYPASSRLS';
    END IF;
    
    RAISE NOTICE 'bella_migration_executor BYPASSRLS granted successfully';
END $$;
