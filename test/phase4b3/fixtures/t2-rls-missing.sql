-- Phase 4B.3 Test Fixture T2: RLS Missing on Security-Critical Table
-- Expected: FAIL → Deploy BLOCKED
-- Security violation: RLS not enabled on security-critical table

-- Setup: Create test table WITHOUT RLS (intentional violation)
CREATE TABLE IF NOT EXISTS test_hc_patient_notes (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS NOT ENABLED (intentional security violation for T2)
-- No policies created
-- This violates Contract security invariants

-- Comment for verification
COMMENT ON TABLE test_hc_patient_notes IS 'Phase 4B.3 T2: RLS missing fixture (security violation)';
