-- ============================================================================
-- Bella AutoMove — Fix table privileges for authenticated and anon roles
-- Issue: E2E tests revealed "permission denied for table auto_vehicles"
-- Root cause: RLS enabled but table-level SELECT privilege never granted
-- Timestamp: 20260906000000
-- ============================================================================

-- Grant SELECT to authenticated role (primary E2E/production role)
GRANT SELECT ON public.auto_vehicles TO authenticated;
GRANT SELECT ON public.auto_vehicle_status_logs TO authenticated;
GRANT SELECT ON public.auto_service_appointments TO authenticated;
GRANT SELECT ON public.auto_repair_orders TO authenticated;
GRANT SELECT ON public.auto_repair_order_items TO authenticated;

-- Grant SELECT to anon role (for unauthenticated public access if needed)
GRANT SELECT ON public.auto_vehicles TO anon;
GRANT SELECT ON public.auto_vehicle_status_logs TO anon;
GRANT SELECT ON public.auto_service_appointments TO anon;
GRANT SELECT ON public.auto_repair_orders TO anon;
GRANT SELECT ON public.auto_repair_order_items TO anon;

-- Add anon-compatible RLS policies using Platform's get_auth_tenant_id()
-- (These are secondary - primary issue was missing table privileges)
DO $$
BEGIN
  -- auto_vehicles: Allow anon to read within tenant context
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon view auto_vehicles') THEN
    CREATE POLICY "Anon view auto_vehicles" ON public.auto_vehicles
        FOR SELECT TO anon
        USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
  END IF;

  -- auto_vehicle_status_logs: Allow anon to read within tenant context
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon view auto_vehicle_status_logs') THEN
    CREATE POLICY "Anon view auto_vehicle_status_logs" ON public.auto_vehicle_status_logs
        FOR SELECT TO anon
        USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
  END IF;

  -- auto_service_appointments: Allow anon to read within tenant context
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon view auto_service_appointments') THEN
    CREATE POLICY "Anon view auto_service_appointments" ON public.auto_service_appointments
        FOR SELECT TO anon
        USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
  END IF;

  -- auto_repair_orders: Allow anon to read within tenant context
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon view auto_repair_orders') THEN
    CREATE POLICY "Anon view auto_repair_orders" ON public.auto_repair_orders
        FOR SELECT TO anon
        USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
  END IF;

  -- auto_repair_order_items: Allow anon to read within tenant context
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon view auto_repair_order_items') THEN
    CREATE POLICY "Anon view auto_repair_order_items" ON public.auto_repair_order_items
        FOR SELECT TO anon
        USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;
