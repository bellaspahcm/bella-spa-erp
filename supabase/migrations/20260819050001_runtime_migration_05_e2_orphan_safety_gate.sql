-- ============================================================================
-- BELLA RUNTIME MIGRATION 05: E2 ORPHAN SAFETY GATE
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Multi-stage verification gate before orphan deletion in 05-B
-- Phase: Verification gate (read-only, NO mutations)
-- Correction: V3 Correction 6 (E2 orphan protection)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md Part I
-- Security Review: Orphan deletion authorization model (S.6)
-- Data Integrity Review: Fixture preservation (D.8)
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Part of 05-B execution safety framework
--
-- USAGE: Called by 05-B BEFORE deleting TEST_ORPHAN fixtures
-- BEHAVIOR: EXCEPTION on ANY verification failure → STOP deletion
-- ============================================================================

-- ============================================================================
-- E2 ORPHAN SAFETY GATE FUNCTION
-- ============================================================================
-- 5-stage verification:
--   E2-A: Count check (expected vs actual)
--   E2-B: Known set check (no unexpected orphans)
--   E2-C: Reference check (no child FK references)
--   E2-D: Temporal validation (test window, not production)
--   E2-E: Final deletion candidate verification

CREATE OR REPLACE FUNCTION migration_05_e2_orphan_safety_gate()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  -- Configuration
  v_expected_orphan_count INT := 2;
  v_known_orphan_set TEXT[] := ARRAY[
    'test-quarantine-tenant-a',
    'test-quarantine-tenant-b'
  ];
  v_test_window_start TIMESTAMPTZ := '2026-08-18 00:00:00+00'::TIMESTAMPTZ;
  v_test_window_end TIMESTAMPTZ := '2026-08-19 23:59:59+00'::TIMESTAMPTZ;
  
  -- Verification state
  v_actual_orphan_count INT;
  v_orphan_fixture TEXT;
  v_unexpected_orphans TEXT[];
  v_orphan_fk_count INT;
  v_child_table TEXT;
  v_orphan_dates RECORD;
  v_temporal_violations TEXT[];
BEGIN
  RAISE NOTICE 'E2 ORPHAN SAFETY GATE: Starting 5-stage verification';
  
  -- =========================================================================
  -- E2-A: Mapping classification count verification
  -- =========================================================================
  SELECT COUNT(*) INTO v_actual_orphan_count
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_ORPHAN';
  
  RETURN QUERY SELECT 
    'E2-A: Orphan count verification'::TEXT,
    CASE WHEN v_actual_orphan_count = v_expected_orphan_count THEN 'PASS' ELSE 'FAIL' END,
    format('Expected: %s, Found: %s', v_expected_orphan_count, v_actual_orphan_count);
  
  IF v_actual_orphan_count != v_expected_orphan_count THEN
    RAISE EXCEPTION 
      'E2-A FAILED: Orphan count mismatch
       
       Expected: %
       Found: %
       
       Possible causes:
         - Unexpected test fixture created after 05-A classification
         - Production data misclassified as TEST_ORPHAN
         - Manual modification of canonical_tenant_map
       
       STOP. NO DELETION.
       
       HUMAN REVIEW REQUIRED:
         1. Query canonical_tenant_map WHERE classification = ''TEST_ORPHAN''
         2. Verify each orphan is legitimate test artifact
         3. Decision:
            a) If legitimate: update v_expected_orphan_count, retry
            b) If production data: reclassify to TEST_FIXTURE, retry
            c) If unknown: DO NOT DELETE',
      v_expected_orphan_count, 
      v_actual_orphan_count
      USING ERRCODE = 'data_exception';
  END IF;
  
  -- =========================================================================
  -- E2-B: Known fixture set membership verification
  -- =========================================================================
  RAISE NOTICE 'E2-B: Verifying orphans are in known test fixture set';
  
  FOR v_orphan_fixture IN
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
    ORDER BY legacy_fixture_id
  LOOP
    IF v_orphan_fixture != ALL(v_known_orphan_set) THEN
      v_unexpected_orphans := array_append(v_unexpected_orphans, v_orphan_fixture);
      RAISE WARNING 'E2-B: Unexpected orphan detected: %', v_orphan_fixture;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    'E2-B: Known orphan set verification'::TEXT,
    CASE WHEN array_length(v_unexpected_orphans, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE 
      WHEN array_length(v_unexpected_orphans, 1) IS NULL 
      THEN format('All %s orphans in known test fixture set', v_actual_orphan_count)
      ELSE format('Unexpected orphans: %s', array_to_string(v_unexpected_orphans, ', '))
    END;
  
  IF array_length(v_unexpected_orphans, 1) > 0 THEN
    RAISE EXCEPTION 
      'E2-B FAILED: Unexpected orphan(s) detected
       
       Unexpected: %
       Known set: %
       
       Unexpected orphans are NOT in the known test fixture set.
       
       STOP. NO DELETION.
       
       HUMAN REVIEW REQUIRED:
         1. Investigate origin of unexpected fixtures
         2. Verify they are not production tenants
         3. Decision:
            a) If legitimate test orphans: add to known set, retry
            b) If production tenants: reclassify, do NOT delete
            c) If unknown origin: DO NOT DELETE',
      array_to_string(v_unexpected_orphans, ', '),
      array_to_string(v_known_orphan_set, ', ')
      USING ERRCODE = 'data_exception';
  END IF;
  
  -- =========================================================================
  -- E2-C: FK reference check (orphans must have no child references)
  -- =========================================================================
  RAISE NOTICE 'E2-C: Checking for child references in runtime tables';
  
  -- Check runtime_outbox
  SELECT COUNT(*) INTO v_orphan_fk_count
  FROM runtime_outbox
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  );
  
  IF v_orphan_fk_count > 0 THEN
    RAISE EXCEPTION 
      'E2-C FAILED: Orphans have % child reference(s) in runtime_outbox
       
       Expected: 0 references
       Found: % references
       
       Orphan fixtures should not have outbox events.
       
       STOP. NO DELETION.
       
       HUMAN REVIEW REQUIRED:
         1. Query runtime_outbox WHERE tenant_id IN (orphan_ids)
         2. Investigate why orphans have outbox events
         3. Decision:
            a) If legitimate test events: delete events first, then retry
            b) If production events: reclassify tenant, do NOT delete
            c) If unexpected: DO NOT DELETE',
      v_orphan_fk_count,
      v_orphan_fk_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  
  -- Check runtime_idempotency_registry
  SELECT COUNT(*) INTO v_orphan_fk_count
  FROM runtime_idempotency_registry
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  );
  
  IF v_orphan_fk_count > 0 THEN
    RAISE EXCEPTION 
      'E2-C FAILED: Orphans have % child reference(s) in runtime_idempotency_registry. Expected 0. STOP.',
      v_orphan_fk_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  
  -- Check runtime_audit_log
  SELECT COUNT(*) INTO v_orphan_fk_count
  FROM runtime_audit_log
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  );
  
  IF v_orphan_fk_count > 0 THEN
    RAISE EXCEPTION 
      'E2-C FAILED: Orphans have % child reference(s) in runtime_audit_log. Expected 0. STOP.',
      v_orphan_fk_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  
  -- Check runtime_quarantine
  SELECT COUNT(*) INTO v_orphan_fk_count
  FROM runtime_quarantine
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  );
  
  IF v_orphan_fk_count > 0 THEN
    RAISE EXCEPTION 
      'E2-C FAILED: Orphans have % child reference(s) in runtime_quarantine. Expected 0. STOP.',
      v_orphan_fk_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  
  RETURN QUERY SELECT 
    'E2-C: Orphan FK reference check'::TEXT,
    'PASS'::TEXT,
    'No child references found in runtime tables (outbox, idempotency, audit, quarantine)'::TEXT;
  
  -- =========================================================================
  -- E2-D: Temporal validation (test window, not production data)
  -- =========================================================================
  RAISE NOTICE 'E2-D: Verifying orphans created within test execution window';
  
  FOR v_orphan_dates IN
    SELECT 
      rtr.tenant_id,
      rtr.created_at,
      rtr.created_at BETWEEN v_test_window_start AND v_test_window_end AS in_window
    FROM runtime_tenant_registry rtr
    WHERE rtr.tenant_id IN (
      SELECT legacy_fixture_id 
      FROM migration_evidence.canonical_tenant_map
      WHERE classification = 'TEST_ORPHAN'
    )
  LOOP
    IF NOT v_orphan_dates.in_window THEN
      v_temporal_violations := array_append(
        v_temporal_violations, 
        format('%s (created: %s)', v_orphan_dates.tenant_id, v_orphan_dates.created_at)
      );
      RAISE WARNING 'E2-D: Temporal violation: % created at % (outside test window %-%)', 
        v_orphan_dates.tenant_id, 
        v_orphan_dates.created_at,
        v_test_window_start,
        v_test_window_end;
    END IF;
  END LOOP;
  
  IF array_length(v_temporal_violations, 1) > 0 THEN
    RAISE EXCEPTION 
      'E2-D FAILED: Temporal validation failed (production contamination suspected)
       
       Test window: % to %
       Violations: %
       
       Some orphans were created OUTSIDE the test execution window.
       This suggests they may be production data, not test artifacts.
       
       STOP. NO DELETION.
       
       HUMAN REVIEW REQUIRED:
         1. Verify created_at timestamps
         2. Investigate tenant origin
         3. Decision:
            a) If test window incorrect: adjust window, retry
            b) If production data: reclassify, do NOT delete
            c) If uncertain: DO NOT DELETE',
      v_test_window_start,
      v_test_window_end,
      array_to_string(v_temporal_violations, ', ')
      USING ERRCODE = 'data_exception';
  END IF;
  
  RETURN QUERY SELECT 
    'E2-D: Production contamination check'::TEXT,
    'PASS'::TEXT,
    format('All %s orphans created within test window (%s -- %s)', 
           v_actual_orphan_count, 
           v_test_window_start, 
           v_test_window_end);
  
  -- =========================================================================
  -- E2-E: Final deletion candidate verification
  -- =========================================================================
  RETURN QUERY SELECT 
    'E2-E: Deletion candidates verified'::TEXT,
    'PASS'::TEXT,
    format('%s orphan(s) safe for deletion: %s', 
           v_actual_orphan_count,
           array_to_string(v_known_orphan_set, ', '));
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ E2 ORPHAN SAFETY GATE: PASS                              ║
╠══════════════════════════════════════════════════════════╣
║ E2-A: Count verification         ✅ PASS                 ║
║ E2-B: Known set verification     ✅ PASS                 ║
║ E2-C: FK reference check          ✅ PASS                 ║
║ E2-D: Temporal validation         ✅ PASS                 ║
║ E2-E: Final verification          ✅ PASS                 ║
║                                                          ║
║ Orphans safe for deletion: %                            ║
║   - test-quarantine-tenant-a                            ║
║   - test-quarantine-tenant-b                            ║
║                                                          ║
║ NEXT: 05-B can proceed with orphan deletion             ║
╚══════════════════════════════════════════════════════════╝',
    v_actual_orphan_count;
END;
$$;

COMMENT ON FUNCTION migration_05_e2_orphan_safety_gate() IS
  'E2 Orphan Safety Gate: Multi-stage verification before deletion.
   
   5 stages (ANY failure = STOP):
     E2-A: Count check (expected 2 orphans)
     E2-B: Known set check (quarantine-tenant-a/b only)
     E2-C: FK reference check (no child records)
     E2-D: Temporal validation (created in test window)
     E2-E: Final verification summary
   
   Returns TABLE for query-based verification.
   Raises EXCEPTION with forensic details on ANY failure.
   
   NO graceful degradation. NO silent failure.
   
   Called by 05-B immediately before DELETE operation.';

-- ============================================================================
-- VERIFICATION: Test E2 gate availability
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'E2 Orphan Safety Gate function created successfully';
  RAISE NOTICE 'Usage: SELECT * FROM migration_05_e2_orphan_safety_gate();';
  RAISE NOTICE 'Called automatically by 05-B before orphan deletion';
END $$;
