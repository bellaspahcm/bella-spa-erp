-- =============================================================================
-- Bella Runtime v1.1 — Grant Table Permissions to authenticated Role
-- Migration: 20260818000003_runtime_authenticated_grants.sql
-- Date: 2026-08-18
-- Purpose: Grant table-level access to authenticated role for RLS to work
-- Context: RLS policies control row access, but role needs table access first
-- Architecture: v1.1 FROZEN (no schema changes)
-- =============================================================================

-- CRITICAL: RLS policies from migration 20260818000002 cannot work without grants
-- This migration fixes the missing table-level permissions for authenticated role

BEGIN;

-- =============================================================================
-- Grant Minimal Privileges to authenticated Role
-- Derived from repository contracts (see: BELLA_RUNTIME_PRIVILEGE_MATRIX_V1.md)
-- =============================================================================

-- runtime_tenant_registry: SELECT, INSERT, UPDATE (CRUD with soft delete)
GRANT SELECT, INSERT, UPDATE ON runtime_tenant_registry TO authenticated;
COMMENT ON TABLE runtime_tenant_registry IS 
  'authenticated privileges: SELECT, INSERT, UPDATE (CRUD with soft delete)';

-- runtime_idempotency_registry: SELECT, INSERT, DELETE (immutable + TTL garbage collection)
-- NO UPDATE: idempotency records are immutable after insert
GRANT SELECT, INSERT, DELETE ON runtime_idempotency_registry TO authenticated;
COMMENT ON TABLE runtime_idempotency_registry IS 
  'authenticated privileges: SELECT, INSERT, DELETE (immutable + TTL GC)';

-- runtime_audit_log: SELECT, INSERT only (append-only audit trail)
-- NO UPDATE/DELETE: violates audit immutability invariant
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;
COMMENT ON TABLE runtime_audit_log IS 
  'authenticated privileges: SELECT, INSERT (append-only - NO UPDATE/DELETE)';

-- runtime_outbox: SELECT, INSERT, UPDATE (state machine for status transitions)
-- UPDATE required for: PENDING → PROCESSING → PUBLISHED/FAILED/QUARANTINED
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;
COMMENT ON TABLE runtime_outbox IS 
  'authenticated privileges: SELECT, INSERT, UPDATE (state machine transitions)';

-- runtime_quarantine: SELECT, INSERT, UPDATE, DELETE (review workflow + retention)
-- UPDATE required for: unreviewed → reviewed (resolution tracking)
-- DELETE required for: cleanup of reviewed records past retention period
GRANT SELECT, INSERT, UPDATE, DELETE ON runtime_quarantine TO authenticated;
COMMENT ON TABLE runtime_quarantine IS 
  'authenticated privileges: SELECT, INSERT, UPDATE, DELETE (review + retention)';

-- =============================================================================
-- Privilege Matrix Summary
-- =============================================================================
-- runtime_audit_log:              SELECT, INSERT          (append-only)
-- runtime_idempotency_registry:   SELECT, INSERT, DELETE  (immutable + GC)
-- runtime_outbox:                 SELECT, INSERT, UPDATE  (state machine)
-- runtime_quarantine:             SELECT, INSERT, UPDATE, DELETE (workflow + retention)
-- runtime_tenant_registry:        SELECT, INSERT, UPDATE  (CRUD soft delete)

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  grant_count INTEGER;
BEGIN
  -- Count table privileges for authenticated role
  SELECT COUNT(*) INTO grant_count
  FROM information_schema.role_table_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND table_name IN (
      'runtime_tenant_registry',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_outbox',
      'runtime_quarantine'
    );

  IF grant_count < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 table grants, found %', grant_count;
  END IF;

  RAISE NOTICE 'Migration verification: authenticated role has % table permissions', grant_count;
END $$;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
  'Runtime authenticated role grants complete' AS status,
  'Table-level permissions granted for RLS enforcement' AS detail,
  'JWT-based RLS policies from 20260818000002 now functional' AS impact;

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

-- 1. These grants are SAFE because RLS policies enforce tenant isolation at row level
-- 2. authenticated role can now access tables, but RLS filters rows by tenant_id
-- 3. service_role still bypasses RLS (Phase 3B tests unaffected)
-- 4. Append-only enforcement on audit_log maintained via RLS policies (no UPDATE grant)

-- =============================================================================
-- NEXT STEPS (for human operator)
-- =============================================================================

-- 1. Apply this migration to Supabase
-- 2. Verify Phase 3B regression: npm run test:runtime:3b (expect 97/97 PASS)
-- 3. Verify Gate 0: npm run test:runtime:3c:infra (expect 5/5 PASS)
