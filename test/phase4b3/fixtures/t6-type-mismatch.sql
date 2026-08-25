-- Phase 4B.3 Test Fixture T6: Type Mismatch (Declaration ≠ Actual)
-- Expected: FAIL → Deploy BLOCKED
-- Declaration says uuid, actual is text → proves "declaration ≠ proof"

-- Setup: Create table with WRONG type for encounter_id
CREATE TABLE IF NOT EXISTS test_hc_encounters (
  encounter_id text PRIMARY KEY,  -- ← Actual: TEXT (should be UUID per declaration)
  patient_id uuid,
  tenant_id uuid NOT NULL,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (security correct, but type wrong)
ALTER TABLE test_hc_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS test_enc_select ON test_hc_encounters
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_enc_insert ON test_hc_encounters
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_enc_update ON test_hc_encounters
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY IF NOT EXISTS test_enc_delete ON test_hc_encounters
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment
COMMENT ON TABLE test_hc_encounters IS 'Phase 4B.3 T6: Type mismatch fixture (encounter_id is text, not uuid)';
