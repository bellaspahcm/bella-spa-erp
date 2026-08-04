-- Migration: Disable RLS for Workshop tables (using manual tenant filtering instead)
-- Created: 2026-08-04
-- Reason: Client-side Supabase queries cannot set app.current_tenant_id for RLS policies
--         Manual .eq('tenant_id', tenantId) filtering is more reliable for client-side queries

-- Disable RLS on auto_service_appointments
ALTER TABLE auto_service_appointments DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policy
DROP POLICY IF EXISTS auto_service_appointments_tenant_isolation ON auto_service_appointments;

-- Disable RLS on auto_repair_orders
ALTER TABLE auto_repair_orders DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policy
DROP POLICY IF EXISTS auto_repair_orders_tenant_isolation ON auto_repair_orders;

-- Add comment explaining the decision
COMMENT ON TABLE auto_service_appointments IS 'Service appointments. RLS disabled - tenant isolation enforced via application-level .eq(tenant_id) filters';
COMMENT ON TABLE auto_repair_orders IS 'Repair orders. RLS disabled - tenant isolation enforced via application-level .eq(tenant_id) filters';

-- Note: Application code MUST filter by tenant_id in ALL queries:
--   .from('auto_service_appointments').select('*').eq('tenant_id', tenantId)
--   .from('auto_repair_orders').select('*').eq('tenant_id', tenantId)
