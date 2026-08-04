-- ============================================================================
-- Bella Auto: Grant permissions to authenticated role
-- Fix for: permission denied for table auto_vehicles (Error code 42501)
-- Timestamp: 20260804120000
-- ============================================================================

-- Grant SELECT, INSERT, UPDATE, DELETE on all Bella Auto tables to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_vehicle_status_logs TO authenticated;

-- Grant USAGE on sequences (for inserts)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verification query (run manually after migration):
-- SELECT tablename, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'authenticated' 
-- AND table_name LIKE 'auto_%' 
-- ORDER BY table_name, privilege_type;
