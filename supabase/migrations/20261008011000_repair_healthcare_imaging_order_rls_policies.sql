-- Repair Healthcare Imaging order RLS policy configuration.
--
-- Root cause:
-- - Real DB has RLS enabled on hc_imaging_orders but no live tenant policy.
-- - Hospital Imaging runtime uses public Imaging contract backed by hc_imaging_orders.
-- - Grants are not a substitute for tenant RLS proof.
--
-- Scope:
-- - No schema changes.
-- - No Imaging public contract changes.
-- - No Hospital product workaround.

DO $$
BEGIN
  IF to_regclass('public.hc_imaging_orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hc_imaging_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_hc_imaging_orders ON public.hc_imaging_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_imaging_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_imaging_orders';
    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.hc_imaging_orders FOR SELECT USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
    EXECUTE 'CREATE POLICY tenant_isolation_write ON public.hc_imaging_orders FOR ALL USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid)) WITH CHECK (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
  ELSE
    RAISE NOTICE 'Skipping hc_imaging_orders RLS repair: table does not exist in this database baseline';
  END IF;
END $$;
