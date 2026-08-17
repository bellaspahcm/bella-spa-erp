-- H1.2 Security Roles
-- Date: 2026-08-17
-- Constitution: v1.3 FROZEN (A3, C3)
-- Purpose: DB-level permission boundary enforcement

-- ============================================================================
-- SECTION 1: H1.2 Worker Role (A3)
-- ============================================================================

-- Create role (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'h1_2_worker') THEN
    CREATE ROLE h1_2_worker LOGIN;
  END IF;
END
$$;

-- Password should be set via environment variable, not hard-coded
-- SECURITY: Password must be managed externally
-- Example: ALTER ROLE h1_2_worker WITH PASSWORD '<from-env>';

COMMENT ON ROLE h1_2_worker IS 'H1.2 Worker role - restricted F1-F4 access (A3)';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON finance_outbox_events TO h1_2_worker;

-- Idempotency check only (SELECT, not INSERT/UPDATE/DELETE)
GRANT SELECT ON finance_transactions TO h1_2_worker;

-- Explicitly revoke F1-F4 mutation permissions
REVOKE INSERT, UPDATE, DELETE ON finance_transactions FROM h1_2_worker;
REVOKE ALL ON journal_entries FROM h1_2_worker;
REVOKE ALL ON journal_lines FROM h1_2_worker;
REVOKE ALL ON accounts FROM h1_2_worker;
REVOKE ALL ON chart_of_accounts FROM h1_2_worker;

-- Grant function execution
GRANT EXECUTE ON FUNCTION generate_idempotency_key(UUID, TEXT, TEXT) TO h1_2_worker;

-- ============================================================================
-- SECTION 2: H1.2 Reconciliation Readonly Role (C3)
-- ============================================================================

-- Create role (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'h1_2_reconciliation_readonly') THEN
    CREATE ROLE h1_2_reconciliation_readonly LOGIN;
  END IF;
END
$$;

-- Password should be set via environment variable
-- SECURITY: Password must be managed externally

COMMENT ON ROLE h1_2_reconciliation_readonly IS 'H1.2 Reconciliation read-only role (C3)';

-- Grant SELECT only
GRANT SELECT ON finance_outbox_events TO h1_2_reconciliation_readonly;
GRANT SELECT ON finance_transactions TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_entries TO h1_2_reconciliation_readonly;
GRANT SELECT ON journal_lines TO h1_2_reconciliation_readonly;

-- Explicitly revoke mutation permissions
REVOKE INSERT, UPDATE, DELETE ON finance_outbox_events FROM h1_2_reconciliation_readonly;
REVOKE INSERT, UPDATE, DELETE ON finance_transactions FROM h1_2_reconciliation_readonly;
REVOKE INSERT, UPDATE, DELETE ON journal_entries FROM h1_2_reconciliation_readonly;
REVOKE INSERT, UPDATE, DELETE ON journal_lines FROM h1_2_reconciliation_readonly;

-- ============================================================================
-- SECTION 3: Permission Verification Queries
-- ============================================================================

-- These queries can be used to verify role permissions
-- Run as superuser to check

-- Check h1_2_worker permissions
-- SELECT grantee, table_name, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'h1_2_worker';

-- Check h1_2_reconciliation_readonly permissions
-- SELECT grantee, table_name, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE grantee = 'h1_2_reconciliation_readonly';

-- ============================================================================
-- SECTION 4: Security Boundary Enforcement Test
-- ============================================================================

-- Test h1_2_worker cannot mutate F1-F4
-- SET ROLE h1_2_worker;
-- INSERT INTO journal_entries (...) VALUES (...);
-- Expected: ERROR: permission denied for table journal_entries

-- Test h1_2_reconciliation_readonly cannot mutate ledger
-- SET ROLE h1_2_reconciliation_readonly;
-- UPDATE journal_entries SET status = 'POSTED' WHERE id = '...';
-- Expected: ERROR: permission denied for table journal_entries

-- RESET ROLE;

-- ============================================================================
-- END OF ROLE CREATION
-- ============================================================================

-- A3 Enforcement: h1_2_worker physically cannot mutate F1-F4 tables
-- C3 Enforcement: h1_2_reconciliation_readonly physically cannot mutate any tables
