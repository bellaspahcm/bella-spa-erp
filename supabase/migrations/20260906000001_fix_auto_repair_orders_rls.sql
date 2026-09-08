-- ============================================================================
-- Bella AutoMove — Fix auto_repair_orders and auto_service_appointments RLS
-- Issue: RLS policies use current_setting('app.current_tenant_id') which Platform doesn't support
-- Fix: Update to use Platform's get_auth_tenant_id()
-- Timestamp: 20260906000001
-- ============================================================================

-- Drop old policies that use current_setting
DROP POLICY IF EXISTS auto_service_appointments_tenant_isolation ON public.auto_service_appointments;
DROP POLICY IF EXISTS auto_repair_orders_tenant_isolation ON public.auto_repair_orders;
DROP POLICY IF EXISTS auto_repair_order_items_tenant_isolation ON public.auto_repair_order_items;

-- Create new policies using Platform's get_auth_tenant_id()
CREATE POLICY "auto_service_appointments_tenant_isolation" ON public.auto_service_appointments
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

CREATE POLICY "auto_repair_orders_tenant_isolation" ON public.auto_repair_orders
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

CREATE POLICY "auto_repair_order_items_tenant_isolation" ON public.auto_repair_order_items
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());
