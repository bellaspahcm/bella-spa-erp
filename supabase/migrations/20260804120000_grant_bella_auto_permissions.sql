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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_customer_journeys TO authenticated;

-- Grant permissions for Customer Satisfaction (NPS/CSI)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_satisfaction_surveys TO authenticated;

-- Grant permissions for Service Center
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_service_appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_service_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_maintenance_packages TO authenticated;

-- Grant permissions for Trade-In Center
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_trade_in_valuations TO authenticated;

-- Grant permissions for Finance & Insurance Center
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_loan_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_insurance_policies TO authenticated;

-- Grant USAGE on sequences (for inserts)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verification query (run manually after migration):
-- SELECT tablename, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'authenticated' 
-- AND table_name LIKE 'auto_%' 
-- ORDER BY table_name, privilege_type;
