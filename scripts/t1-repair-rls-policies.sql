-- T1 Repair: Add RLS policies to hc_prescriptions and hc_appointments
-- Purpose: Fix production RLS policy gaps to enable T1 PASS
-- Date: 2026-08-25

-- ========================================
-- hc_prescriptions RLS Policies
-- ========================================

-- Confirm RLS enabled (should already be true)
ALTER TABLE public.hc_prescriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS tenant_isolation_hc_prescriptions ON public.hc_prescriptions;

-- Create FOR ALL policy matching Healthcare Kernel pattern
CREATE POLICY tenant_isolation_hc_prescriptions 
  ON public.hc_prescriptions
  FOR ALL
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id'))::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id'))::uuid);

-- ========================================
-- hc_appointments RLS Policies  
-- ========================================

-- Confirm RLS enabled
ALTER TABLE public.hc_appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS tenant_isolation_hc_appointments ON public.hc_appointments;

-- Create FOR ALL policy matching Healthcare Kernel pattern
CREATE POLICY tenant_isolation_hc_appointments
  ON public.hc_appointments
  FOR ALL
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id'))::uuid)
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id'))::uuid);

-- ========================================
-- Verification
-- ========================================

-- Query to verify policies created
SELECT 
  c.relname AS table_name,
  p.polname AS policy_name,
  p.polcmd AS command,
  pg_get_expr(p.polqual, p.polrelid) AS using_clause,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_clause
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname IN ('hc_prescriptions', 'hc_appointments')
ORDER BY c.relname, p.polname;
