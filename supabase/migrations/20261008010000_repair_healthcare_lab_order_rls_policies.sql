-- Repair Healthcare Laboratory order RLS policy configuration.
--
-- Root cause:
-- - Real DB has RLS enabled on hc_lab_orders but no live policy.
-- - hc_clinical_orders is the canonical patient-linkage parent for LabOrder
--   and also lacks a live tenant policy in the target database.
-- - Grants already exist; the missing boundary is policy configuration.
--
-- Scope:
-- - No schema changes.
-- - No Laboratory public contract changes.
-- - No Hospital product workaround.

DO $$
BEGIN
  IF to_regclass('public.hc_clinical_orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_hc_clinical_orders ON public.hc_clinical_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_clinical_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_clinical_orders';
    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.hc_clinical_orders FOR SELECT USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
    EXECUTE 'CREATE POLICY tenant_isolation_write ON public.hc_clinical_orders FOR ALL USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid)) WITH CHECK (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
  ELSE
    RAISE NOTICE 'Skipping hc_clinical_orders RLS repair: table does not exist in this database baseline';
  END IF;

  IF to_regclass('public.hc_lab_orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hc_lab_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_hc_lab_orders ON public.hc_lab_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_lab_orders';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_lab_orders';
    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.hc_lab_orders FOR SELECT USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
    EXECUTE 'CREATE POLICY tenant_isolation_write ON public.hc_lab_orders FOR ALL USING (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid)) WITH CHECK (tenant_id = ((auth.jwt() ->> ''tenant_id'')::uuid))';
  ELSE
    RAISE NOTICE 'Skipping hc_lab_orders RLS repair: table does not exist in this database baseline';
  END IF;
END $$;
