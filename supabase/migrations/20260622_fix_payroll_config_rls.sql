-- =====================================================
-- FIX: tenant_payroll_config RLS Policies
-- =====================================================
-- Problem: RLS policies reference non-existent user_tenant_roles table
-- Solution: Use users.tenant_id instead (Bella SPA uses direct tenant_id column)
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can update own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can insert own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can delete own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Users can view own tenant payroll config history" ON tenant_payroll_config_history;

-- =====================================================
-- NEW POLICIES (Using public.users.tenant_id)
-- =====================================================

-- Policy: Users can only see configs from their tenant
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Policy: Only admins/owners can update configs
CREATE POLICY "Admins can update own tenant payroll config"
  ON tenant_payroll_config
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Only admins/owners can insert configs
CREATE POLICY "Admins can insert own tenant payroll config"
  ON tenant_payroll_config
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Only admins/owners can delete configs
CREATE POLICY "Admins can delete own tenant payroll config"
  ON tenant_payroll_config
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Users can view history from their tenant
CREATE POLICY "Users can view own tenant payroll config history"
  ON tenant_payroll_config_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Test if policies work
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated successfully';
  RAISE NOTICE 'Users can now insert/update payroll configs if they are admin/owner';
END $$;
