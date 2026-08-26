-- Phase 4B.3 Test Fixture T3: Unexpected Table Deletion (Drift)
-- Expected: FAIL → Deploy BLOCKED
-- Drift detection: Security-critical table deleted/missing

-- Setup: Simulate state where security-critical table is missing
-- For T3, we deliberately DO NOT create the expected table
-- Expected state: test_hc_medications should exist (security-critical)
-- Actual state: test_hc_medications MISSING

-- Drop table if exists (simulate deletion drift)
DROP TABLE IF EXISTS test_hc_medications CASCADE;

-- Comment: This fixture represents "after deletion" state
-- Verification engine will detect: expected table missing → FAIL
