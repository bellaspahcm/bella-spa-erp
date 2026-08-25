-- Phase 4B.1 Test Scenario 3: DB-Only Change
--
-- Purpose: Test database-only routing (migration without app deploy)
--
-- Expected classification:
-- - db_changed: true
-- - needs_migration: true
-- - needs_app_deploy: false (schema-only, no app code required)
-- - risk_class: depends on migration risk analysis
--
-- Expected routing:
-- - test-routing-db-only job runs
-- - All other routing jobs skip

-- Test table for scenario 3
CREATE TABLE IF NOT EXISTS test_scenario3_db_only (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_field TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE test_scenario3_db_only IS 'Test table for Phase 4B.1 Scenario 3 - DB-only routing verification';
