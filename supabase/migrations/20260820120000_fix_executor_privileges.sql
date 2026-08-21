-- ============================================================================
-- FIX BELLA_MIGRATION_EXECUTOR PRIVILEGES (R3 SECURITY FIX)
-- ============================================================================
-- Migration: 20260820120000_fix_executor_privileges.sql
-- Purpose: Fix critical security issues in bella_migration_executor privileges
-- Phase: R3 Remediation (Security Fix)
--
-- Issues Fixed:
--   1. CREATEDB privilege (unnecessary - executor doesn't need to create databases)
--   2. INSERT/UPDATE/DELETE on migration_governance.approvals (BYPASS R2!)
--
-- Principle: "Người thực thi không được tự quyết định quyền được thực thi"
-- ============================================================================

-- ============================================================================
-- FIX #1: Remove CREATEDB privilege (unnecessary)
-- ============================================================================

ALTER ROLE bella_migration_executor NOCREATEDB;

COMMENT ON ROLE bella_migration_executor IS 
  'R3 Database Role Separation - Authorized mutation executor role. '
  'BDGF uses this role to execute approved migrations. '
  'Requires valid Human GO approval (enforced by R2). '
  'FULL DML + DDL privileges on application tables. '
  'READ-ONLY on governance tables (cannot modify approvals). '
  'Fixed: 2026-08-20 (removed CREATEDB, restricted governance access)';

-- ============================================================================
-- FIX #2: Restrict privileges on migration_governance.approvals
-- ============================================================================

-- REVOKE mutation privileges on approvals table
-- Executor CANNOT modify approval records (would bypass R2)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON migration_governance.approvals FROM bella_migration_executor;

-- GRANT only SELECT (executor needs to read approvals via verify_approval function)
GRANT SELECT ON migration_governance.approvals TO bella_migration_executor;

-- ============================================================================
-- KEEP: Privileges on migration_governance.role_usage_audit
-- ============================================================================

-- Executor SHOULD be able to INSERT audit records (self-audit)
-- But does NOT need UPDATE/DELETE/TRUNCATE
REVOKE UPDATE, DELETE, TRUNCATE ON migration_governance.role_usage_audit FROM bella_migration_executor;
GRANT SELECT, INSERT ON migration_governance.role_usage_audit TO bella_migration_executor;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify CREATEDB removed
-- SELECT rolname, rolcreatedb FROM pg_roles WHERE rolname = 'bella_migration_executor';
-- Expected: bella_migration_executor | f

-- Verify approvals privileges restricted
-- SELECT privilege_type FROM information_schema.table_privileges 
-- WHERE grantee = 'bella_migration_executor' 
--   AND table_schema = 'migration_governance' 
--   AND table_name = 'approvals';
-- Expected: SELECT only (NO INSERT, UPDATE, DELETE)

-- Verify audit privileges
-- SELECT privilege_type FROM information_schema.table_privileges 
-- WHERE grantee = 'bella_migration_executor' 
--   AND table_schema = 'migration_governance' 
--   AND table_name = 'role_usage_audit';
-- Expected: SELECT, INSERT (NO UPDATE, DELETE)

-- ============================================================================
-- SECURITY RATIONALE
-- ============================================================================

-- WHY bella_migration_executor CANNOT modify approvals:
--
-- If executor could INSERT/UPDATE/DELETE approvals:
--   Executor → CREATE approval record → Bypass R2 Human GO
--   Executor → UPDATE expires_at → Extend expired approval
--   Executor → UPDATE status = 'GO' → Self-authorize
--   Executor → DELETE approval → Remove evidence
--
-- This violates the core principle:
--   "Người thực thi không được tự quyết định quyền được thực thi"
--
-- Executor can only:
--   1. READ approvals (via verify_approval function)
--   2. EXECUTE mutations (after R2 approval verified)
--   3. WRITE audit logs (self-audit)
--
-- Executor cannot:
--   1. Create approvals (only Human GO can)
--   2. Modify approvals (only Human GO can)
--   3. Delete approvals (only Human GO can revoke)
--   4. Create databases (not part of migration duties)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
