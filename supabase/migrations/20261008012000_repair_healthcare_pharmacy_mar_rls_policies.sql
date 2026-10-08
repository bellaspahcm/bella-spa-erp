-- Repair Healthcare Pharmacy / MAR RLS policy configuration.
--
-- Root cause:
-- - Medication / Pharmacy / MAR Real DB proof persisted hc_prescriptions and
--   hc_medication_administration_records successfully via Healthcare engines.
-- - Same-tenant authenticated RLS read returned no prescription rows.
-- - Cross-tenant denial remains required.
--
-- Scope:
-- - No schema changes.
-- - No Pharmacy public contract changes.
-- - No Hospital product workaround.

ALTER TABLE public.hc_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_medication_administration_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_hc_prescriptions ON public.hc_prescriptions;
DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_prescriptions;
DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_prescriptions;
DROP POLICY IF EXISTS "tenant_isolation_hc_prescriptions" ON public.hc_prescriptions;

DROP POLICY IF EXISTS "hc_mar_tenant_policy" ON public.hc_medication_administration_records;
DROP POLICY IF EXISTS "hc_mar_tenant_isolation" ON public.hc_medication_administration_records;
DROP POLICY IF EXISTS tenant_isolation_select ON public.hc_medication_administration_records;
DROP POLICY IF EXISTS tenant_isolation_write ON public.hc_medication_administration_records;

CREATE POLICY tenant_isolation_select
  ON public.hc_prescriptions
  FOR SELECT
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY tenant_isolation_write
  ON public.hc_prescriptions
  FOR ALL
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY tenant_isolation_select
  ON public.hc_medication_administration_records
  FOR SELECT
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY tenant_isolation_write
  ON public.hc_medication_administration_records
  FOR ALL
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
