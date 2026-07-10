-- ============================================================
-- Cleanup Failed Migration and Retry
-- ============================================================
-- Run this first to clean up any partial migration
-- Then re-run the main migration
-- ============================================================

-- Drop tables if they exist (in correct order to respect foreign keys)
DROP TABLE IF EXISTS rule_test_results CASCADE;
DROP TABLE IF EXISTS rule_approvals CASCADE;
DROP TABLE IF EXISTS rule_versions CASCADE;
DROP TABLE IF EXISTS rules CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_rule_updated_at() CASCADE;
DROP FUNCTION IF EXISTS create_rule_version_snapshot() CASCADE;
DROP FUNCTION IF EXISTS get_rule_with_history(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_pending_rule_approvals(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_rule_test_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS rollback_rule_to_version(UUID, INTEGER, UUID) CASCADE;

-- Ready for fresh migration
SELECT 'Cleanup complete. Ready to run migration.' AS status;

