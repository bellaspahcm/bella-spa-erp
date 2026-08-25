-- Phase 4B.3 Test Fixture T1: Happy Path
-- Expected: PASS → Deploy ELIGIBLE
-- All invariants satisfied: RLS enabled, structure correct, tenant isolation enforced

-- Setup: Create test table with correct RLS
CREATE TABLE IF NOT EXISTS test_hc_appointments (
  appointment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (security-critical)
ALTER TABLE test_hc_appointments ENABLE ROW LEVEL SECURITY;

-- Create all 4 required policies with tenant isolation
CREATE POLICY IF NOT EXISTS test_tenant_isolation_select ON test_hc_appointments
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_tenant_isolation_insert ON test_hc_appointments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_tenant_isolation_update ON test_hc_appointments
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_tenant_isolation_delete ON test_hc_appointments
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment for verification
COMMENT ON TABLE test_hc_appointments IS 'Phase 4B.3 T1: Happy path fixture';
