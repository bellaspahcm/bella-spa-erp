-- =============================================================================
-- Bella Runtime v1.1 — RLS Policies for JWT-based Authentication
-- Migration: 20260818000002_runtime_rls_jwt.sql
-- Date: 2026-08-18
-- Purpose: Replace session variable RLS with JWT claim RLS
-- Security: Maintains identical tenant isolation guarantees
-- Architecture: v1.1 FROZEN (no schema changes)
-- =============================================================================

-- CRITICAL: This migration changes ONLY RLS policy implementation, not security guarantees
-- - Tenant isolation: MAINTAINED
-- - Audit append-only: MAINTAINED
-- - Cross-tenant access: BLOCKED (same as before)
-- - service_role bypass: UNAFFECTED (Phase 3B tests remain valid)

BEGIN;

-- =============================================================================
-- 1. runtime_tenant_registry
-- =============================================================================

-- Drop old session-variable policy
DROP POLICY IF EXISTS tenant_isolation_policy_registry ON runtime_tenant_registry;

-- Create new JWT-claim policy (identical permissions, different tenant context)
CREATE POLICY tenant_isolation_policy_registry_jwt ON runtime_tenant_registry
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

COMMENT ON POLICY tenant_isolation_policy_registry_jwt ON runtime_tenant_registry IS 
  'Tenant isolation via JWT claim. Replaces session variable pattern.';

-- =============================================================================
-- 2. runtime_idempotency_registry
-- =============================================================================

-- Drop old session-variable policy
DROP POLICY IF EXISTS tenant_isolation_policy_idempotency ON runtime_idempotency_registry;

-- Create new JWT-claim policy
CREATE POLICY tenant_isolation_policy_idempotency_jwt ON runtime_idempotency_registry
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

COMMENT ON POLICY tenant_isolation_policy_idempotency_jwt ON runtime_idempotency_registry IS 
  'Tenant isolation via JWT claim. Prevents cross-tenant replay.';

-- =============================================================================
-- 3. runtime_outbox
-- =============================================================================

-- Drop old session-variable policy
DROP POLICY IF EXISTS tenant_isolation_policy_outbox ON runtime_outbox;

-- Create new JWT-claim policy
CREATE POLICY tenant_isolation_policy_outbox_jwt ON runtime_outbox
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

COMMENT ON POLICY tenant_isolation_policy_outbox_jwt ON runtime_outbox IS 
  'Tenant isolation via JWT claim. Ensures at-least-once delivery per tenant.';

-- =============================================================================
-- 4. runtime_audit_log (⚠️ SPECIAL: append-only enforcement)
-- =============================================================================

-- Drop old session-variable policies
DROP POLICY IF EXISTS tenant_isolation_policy_audit ON runtime_audit_log;
DROP POLICY IF EXISTS audit_append_only_policy ON runtime_audit_log;

-- Create new JWT-claim policies (SELECT + INSERT only)
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY audit_append_only_policy_jwt ON runtime_audit_log
  FOR INSERT
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

-- Note: audit_no_update and audit_no_delete policies remain unchanged
-- These policies enforce append-only at database level (USING false)

COMMENT ON POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log IS 
  'Tenant isolation via JWT claim. READ-ONLY access to tenant audit trail.';

COMMENT ON POLICY audit_append_only_policy_jwt ON runtime_audit_log IS 
  'Tenant isolation via JWT claim. INSERT-ONLY (append-only enforcement).';

-- =============================================================================
-- 5. runtime_quarantine
-- =============================================================================

-- Drop old session-variable policy
DROP POLICY IF EXISTS tenant_isolation_policy_quarantine ON runtime_quarantine;

-- Create new JWT-claim policy
CREATE POLICY tenant_isolation_policy_quarantine_jwt ON runtime_quarantine
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

COMMENT ON POLICY tenant_isolation_policy_quarantine_jwt ON runtime_quarantine IS 
  'Tenant isolation via JWT claim. Poison message quarantine access.';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify all policies created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Count JWT-based policies (should be 6 total)
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'runtime_tenant_registry',
      'runtime_idempotency_registry',
      'runtime_outbox',
      'runtime_audit_log',
      'runtime_quarantine'
    )
    AND policyname LIKE '%_jwt';

  -- Should have 6 JWT policies:
  -- - 1 for tenant_registry
  -- - 1 for idempotency_registry
  -- - 1 for outbox
  -- - 2 for audit_log (SELECT + INSERT)
  -- - 1 for quarantine
  IF policy_count != 6 THEN
    RAISE EXCEPTION 'Expected 6 JWT policies, found %', policy_count;
  END IF;

  RAISE NOTICE 'Migration verification: % JWT-based RLS policies created', policy_count;
END $$;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
  'Runtime JWT-based RLS migration complete' AS status,
  '6 policies migrated from session variable to JWT claim' AS detail,
  'Tenant isolation maintained, append-only preserved' AS security_impact,
  'service_role unaffected, Phase 3B tests remain valid' AS compatibility;

-- =============================================================================
-- NEXT STEPS (for human operator)
-- =============================================================================

-- 1. Verify Phase 3B regression: npm run test:runtime:3b (expect 97/97 PASS)
-- 2. Verify Gate 0: npm run test:runtime:3c:infra (expect 5/5 PASS)
-- 3. If both PASS → Phase 3C Week 2 unblocked
