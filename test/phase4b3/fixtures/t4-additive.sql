-- Phase 4B.3 Test Fixture T4: Additive Non-Security Change
-- Expected: WARNING → Deploy ELIGIBLE
-- Platform expansion: New column added (not declared) but security intact

-- Setup: Create table with extra column NOT in declaration
CREATE TABLE IF NOT EXISTS test_hc_patients_additive (
  patient_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  first_name text,
  last_name text,
  metadata jsonb  -- ← NEW COLUMN (not declared in migration)
);

-- Enable RLS (security intact)
ALTER TABLE test_hc_patients_additive ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY IF NOT EXISTS test_additive_select ON test_hc_patients_additive
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_additive_insert ON test_hc_patients_additive
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_additive_update ON test_hc_patients_additive
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_additive_delete ON test_hc_patients_additive
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment
COMMENT ON TABLE test_hc_patients_additive IS 'Phase 4B.3 T4: Additive change fixture (metadata column not declared)';
