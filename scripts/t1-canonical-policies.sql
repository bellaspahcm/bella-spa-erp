-- ============================================================================
-- T1 Repair: Canonical RLS Policies
-- Source: Canonical migrations (provenance confirmed)
-- ============================================================================

-- Policy 1: hc_prescriptions
-- Source: supabase/migrations/20260806030000_healthcare_kernel_schema.sql line 95
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'hc_prescriptions' 
      AND policyname = 'tenant_isolation_hc_prescriptions'
  ) THEN
    CREATE POLICY tenant_isolation_hc_prescriptions 
      ON public.hc_prescriptions 
      FOR ALL 
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- Policy 2: hc_appointments
-- Source: supabase/migrations/20260807000000_create_hc_appointments.sql line 37
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'hc_appointments' 
      AND policyname = 'tenant_isolation_hc_appointments'
  ) THEN
    CREATE POLICY tenant_isolation_hc_appointments 
      ON public.hc_appointments
      FOR ALL 
      USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- Verification query
SELECT 
  c.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(p.polqual, p.polrelid) AS using_clause
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname IN ('hc_prescriptions', 'hc_appointments')
ORDER BY c.relname, p.polname;
