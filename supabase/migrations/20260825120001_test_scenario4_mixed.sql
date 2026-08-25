-- Phase 4B.1 Test Scenario 4: Mixed Change (DB + App)
--
-- Purpose: Test mixed routing (migration + app deploy)
--
-- Expected classification:
-- - db_changed: true
-- - app_changed: true (due to companion tsx file)
-- - needs_migration: true
-- - needs_app_deploy: true
-- - risk_class: HIGH (migration present)
--
-- Expected routing:
-- - test-routing-mixed job runs
-- - All other routing jobs skip

-- Test table for scenario 4
CREATE TABLE IF NOT EXISTS test_scenario4_mixed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_field TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_scenario4_mixed IS 'Test table for Phase 4B.1 Scenario 4 - Mixed routing verification';
