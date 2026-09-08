-- Retail OS Tenant Context Helper
-- Date: 2026-09-06
-- Purpose: Create set_tenant_context alias for Retail OS repositories

-- Create alias function for consistency with repository code
CREATE OR REPLACE FUNCTION public.set_tenant_context(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.set_tenant_context(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_tenant_context IS 'Alias for set_session_tenant - sets tenant context for RLS policies';
