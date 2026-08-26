-- Phase 4B.3 Test Fixture T7: No Declaration (OPC Principle)
-- Expected: WARNING → Deploy ELIGIBLE
-- No migration declaration → fallback to Contract invariants only
-- Proves: System does NOT infer correctness from actual DB state alone

-- Setup: Create table with security intact but extra column
CREATE TABLE IF NOT EXISTS test_hc_legacy (
  patient_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  first_name text,
  last_name text,
  notes text  -- ← NEW COLUMN (not declared, no declaration exists)
);

-- Enable RLS (security intact)
ALTER TABLE test_hc_legacy ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY IF NOT EXISTS test_legacy_select ON test_hc_legacy
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_legacy_insert ON test_hc_legacy
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_legacy_update ON test_hc_legacy
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_legacy_delete ON test_hc_legacy
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment
COMMENT ON TABLE test_hc_legacy IS 'Phase 4B.3 T7: No declaration fixture (OPC principle test)';
