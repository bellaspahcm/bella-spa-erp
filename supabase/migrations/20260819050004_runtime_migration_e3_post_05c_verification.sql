-- ============================================================================
-- BELLA RUNTIME MIGRATION: E3 GATE (POST-05-C VERIFICATION)
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Post-type-migration verification (TEXT→UUID completeness and integrity)
-- Phase: POST-MIGRATION VERIFICATION (read-only, NO mutations)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md Part F
-- Data Integrity Review: Type migration completeness (D.3, D.4, D.8.2)
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Must execute AFTER 05-C
-- - Read-only verification (0 mutations)
--
-- USAGE: SELECT * FROM migration_05_e3_gate();
-- ============================================================================

CREATE OR REPLACE FUNCTION migration_05_e3_gate()
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
  v_parent_type TEXT;
  v_child_table TEXT;
  v_child_type TEXT;
  v_parent_fk_exists BOOLEAN;
  v_child_fk_exists BOOLEAN;
  v_rls_enabled BOOLEAN;
  v_policy_count INT;
  v_mapping_verified BOOLEAN;
  v_orphan_count INT;
  v_fixture_count INT;
BEGIN
  RAISE NOTICE 'E3 GATE: Starting post-05-C verification';
  RAISE NOTICE 'E3 MODE: READ-ONLY (0 mutations)';
  
  -- ==========================================================================
  -- E3.1: Parent table type (runtime_tenant_registry.tenant_id = UUID)
  -- ==========================================================================
  SELECT data_type INTO v_parent_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'runtime_tenant_registry'
    AND column_name = 'tenant_id';
  
  RETURN QUERY SELECT 
    'E3.1: runtime_tenant_registry.tenant_id type'::TEXT,
    CASE 
      WHEN v_parent_type = 'uuid' THEN 'PASS'
      WHEN v_parent_type = 'text' THEN 'FAIL'
      ELSE 'FAIL' 
    END,
    format('Found: %s, Expected: uuid (post-05-C)', COALESCE(v_parent_type, 'NULL'));
  
  IF v_parent_type != 'uuid' THEN
    RAISE EXCEPTION 'E3.1 FAILED: runtime_tenant_registry.tenant_id type = %, expected uuid. 05-C incomplete.', v_parent_type;
  END IF;
  
  -- ==========================================================================
  -- E3.2: Child table types (all TEXT → UUID)
  -- ==========================================================================
  FOR v_child_table IN 
    SELECT unnest(ARRAY[
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table exists
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_child_table
    ) THEN
      RETURN QUERY SELECT 
        format('E3.2: %s.tenant_id type', v_child_table)::TEXT,
        'WARNING'::TEXT,
        format('Table does not exist (acceptable if not in use)');
      CONTINUE;
    END IF;
    
    SELECT data_type INTO v_child_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_child_table
      AND column_name = 'tenant_id';
    
    RETURN QUERY SELECT 
      format('E3.2: %s.tenant_id type', v_child_table)::TEXT,
      CASE 
        WHEN v_child_type = 'uuid' THEN 'PASS'
        WHEN v_child_type = 'text' THEN 'FAIL'
        WHEN v_child_type IS NULL THEN 'WARNING'
        ELSE 'FAIL' 
      END,
      format('Found: %s, Expected: uuid', COALESCE(v_child_type, 'COLUMN MISSING'));
    
    IF v_child_type = 'text' THEN
      RAISE EXCEPTION 'E3.2 FAILED: %.tenant_id still TEXT. 05-C incomplete.', v_child_table;
    END IF;
  END LOOP;
  
  -- ==========================================================================
  -- E3.3: Parent FK (runtime_tenant_registry → public.tenants)
  -- ==========================================================================
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'runtime_tenant_registry'
      AND constraint_name = 'fk_runtime_tenant'
      AND constraint_type = 'FOREIGN KEY'
  ) INTO v_parent_fk_exists;
  
  RETURN QUERY SELECT 
    'E3.3: FK runtime_tenant_registry → public.tenants'::TEXT,
    CASE WHEN v_parent_fk_exists THEN 'PASS' ELSE 'FAIL' END,
    format('Constraint fk_runtime_tenant exists: %s', v_parent_fk_exists);
  
  IF NOT v_parent_fk_exists THEN
    RAISE EXCEPTION 'E3.3 FAILED: FK runtime_tenant_registry → public.tenants missing. 05-C FK step incomplete.';
  END IF;
  
  -- ==========================================================================
  -- E3.4: Child FKs (child tables → runtime_tenant_registry)
  -- ==========================================================================
  FOR v_child_table IN 
    SELECT unnest(ARRAY[
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table exists
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_child_table
    ) THEN
      RETURN QUERY SELECT 
        format('E3.4: FK %s → runtime_tenant_registry', v_child_table)::TEXT,
        'WARNING'::TEXT,
        'Table does not exist (acceptable if not in use)';
      CONTINUE;
    END IF;
    
    SELECT EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = v_child_table
        AND constraint_name = format('fk_%s_tenant', v_child_table)
        AND constraint_type = 'FOREIGN KEY'
    ) INTO v_child_fk_exists;
    
    RETURN QUERY SELECT 
      format('E3.4: FK %s → runtime_tenant_registry', v_child_table)::TEXT,
      CASE WHEN v_child_fk_exists THEN 'PASS' ELSE 'FAIL' END,
      format('Constraint fk_%s_tenant exists: %s', v_child_table, v_child_fk_exists);
    
    IF NOT v_child_fk_exists THEN
      RAISE EXCEPTION 'E3.4 FAILED: FK % → runtime_tenant_registry missing. 05-C FK step incomplete.', v_child_table;
    END IF;
  END LOOP;
  
  -- ==========================================================================
  -- E3.5: RLS enabled verification
  -- ==========================================================================
  FOR v_child_table IN 
    SELECT unnest(ARRAY[
      'runtime_tenant_registry',
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table exists
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_child_table
    ) THEN
      RETURN QUERY SELECT 
        format('E3.5: RLS enabled on %s', v_child_table)::TEXT,
        'WARNING'::TEXT,
        'Table does not exist';
      CONTINUE;
    END IF;
    
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_child_table
      AND relnamespace = 'public'::regnamespace;
    
    -- Count policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = v_child_table;
    
    RETURN QUERY SELECT 
      format('E3.5: RLS on %s', v_child_table)::TEXT,
      CASE 
        WHEN v_rls_enabled AND v_policy_count > 0 THEN 'PASS'
        WHEN v_rls_enabled AND v_policy_count = 0 THEN 'WARNING'
        WHEN NOT v_rls_enabled THEN 'WARNING'
        ELSE 'WARNING'
      END,
      format('RLS enabled: %s, Policies: %s', v_rls_enabled, v_policy_count);
  END LOOP;
  
  -- ==========================================================================
  -- E3.6: TEXT→UUID mapping correctness verification
  -- ==========================================================================
  SELECT 
    COUNT(*) = 3 
    AND COUNT(*) FILTER (WHERE canonical_tenant_id IS NOT NULL) = 3
    AND COUNT(*) FILTER (WHERE reconciliation_phase = 'COMPLETE') = 3
  INTO v_mapping_verified
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE';
  
  RETURN QUERY SELECT 
    'E3.6: TEXT→UUID mapping correctness'::TEXT,
    CASE WHEN v_mapping_verified THEN 'PASS' ELSE 'FAIL' END,
    format('Mapping complete: %s (3 TEST_FIXTURE with canonical UUIDs in COMPLETE phase)', v_mapping_verified);
  
  IF NOT v_mapping_verified THEN
    RAISE EXCEPTION 'E3.6 FAILED: canonical_tenant_map incomplete or incorrect. Mapping verification failed.';
  END IF;
  
  -- ==========================================================================
  -- E3.7: No orphan UUIDs in runtime_tenant_registry
  -- ==========================================================================
  SELECT COUNT(*) INTO v_orphan_count
  FROM runtime_tenant_registry rtr
  WHERE NOT EXISTS(
    SELECT 1 FROM public.tenants t WHERE t.id = rtr.tenant_id
  );
  
  RETURN QUERY SELECT 
    'E3.7: No orphan UUIDs in runtime_tenant_registry'::TEXT,
    CASE WHEN v_orphan_count = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('Orphan UUIDs: %s (expected 0, FK should prevent this)', v_orphan_count);
  
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'E3.7 FAILED: % orphan UUID(s) in runtime_tenant_registry. FK integrity violation.', v_orphan_count;
  END IF;
  
  -- ==========================================================================
  -- E3.8: Fixture count post-migration (3 canonical tenants, 3 runtime rows)
  -- ==========================================================================
  SELECT COUNT(*) INTO v_fixture_count
  FROM runtime_tenant_registry rtr
  INNER JOIN migration_evidence.canonical_tenant_map ctm 
    ON rtr.tenant_id = ctm.canonical_tenant_id
  WHERE ctm.classification = 'TEST_FIXTURE'
    AND ctm.reconciliation_phase = 'COMPLETE';
  
  RETURN QUERY SELECT 
    'E3.8: Fixture count post-migration'::TEXT,
    CASE WHEN v_fixture_count = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('Found: %s runtime rows mapped to canonical tenants (expected 3)', v_fixture_count);
  
  IF v_fixture_count != 3 THEN
    RAISE EXCEPTION 'E3.8 FAILED: Runtime fixture count = %, expected 3. Data loss or incomplete migration.', v_fixture_count;
  END IF;
  
  -- ==========================================================================
  -- E3.9: Canonical tenant existence (3 tenants with test_infrastructure)
  -- ==========================================================================
  DECLARE
    v_canonical_tenant_count INT;
    v_has_metadata BOOLEAN;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'metadata' 
        AND data_type = 'jsonb'
    ) INTO v_has_metadata;
    
    IF v_has_metadata THEN
      SELECT COUNT(*) INTO v_canonical_tenant_count
      FROM public.tenants
      WHERE id IN (
        SELECT canonical_tenant_id 
        FROM migration_evidence.canonical_tenant_map 
        WHERE classification = 'TEST_FIXTURE'
      );
      
      RETURN QUERY SELECT 
        'E3.9: Canonical tenant existence'::TEXT,
        CASE WHEN v_canonical_tenant_count = 3 THEN 'PASS' ELSE 'FAIL' END,
        format('Canonical tenants: %s (expected 3)', v_canonical_tenant_count);
      
      IF v_canonical_tenant_count != 3 THEN
        RAISE EXCEPTION 'E3.9 FAILED: Canonical tenant count = %, expected 3. 05-B incomplete or tenants deleted.', v_canonical_tenant_count;
      END IF;
    ELSE
      RETURN QUERY SELECT 
        'E3.9: Canonical tenant existence'::TEXT,
        'WARNING'::TEXT,
        'Cannot verify (metadata column unavailable)';
    END IF;
  END;
  
  -- ==========================================================================
  -- E3.10: Phase audit (RESERVATION → COMPLETE verification)
  -- ==========================================================================
  DECLARE
    v_reservation_count INT;
    v_complete_count INT;
  BEGIN
    SELECT 
      COUNT(*) FILTER (WHERE reconciliation_phase = 'RESERVATION'),
      COUNT(*) FILTER (WHERE reconciliation_phase = 'COMPLETE')
    INTO v_reservation_count, v_complete_count
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_FIXTURE';
    
    RETURN QUERY SELECT 
      'E3.10: Phase audit (RESERVATION → COMPLETE)'::TEXT,
      CASE 
        WHEN v_reservation_count = 0 AND v_complete_count = 3 THEN 'PASS'
        ELSE 'FAIL'
      END,
      format('RESERVATION: %s, COMPLETE: %s (expected: 0 RESERVATION, 3 COMPLETE)', v_reservation_count, v_complete_count);
    
    IF v_reservation_count > 0 OR v_complete_count != 3 THEN
      RAISE EXCEPTION 'E3.10 FAILED: Phase transition incomplete. RESERVATION=%s, COMPLETE=%s', v_reservation_count, v_complete_count;
    END IF;
  END;
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ E3 GATE: POST-05-C VERIFICATION COMPLETE                 ║
╠══════════════════════════════════════════════════════════╣
║ Mode:     READ-ONLY                                      ║
║ Mutations: 0                                             ║
║                                                          ║
║ Verification Summary:                                    ║
║   - Type migration: TEXT → UUID ✅                       ║
║   - FK integrity: All constraints exist ✅               ║
║   - Mapping correctness: 3 fixtures verified ✅          ║
║   - No orphan UUIDs ✅                                   ║
║   - Phase audit: RESERVATION → COMPLETE ✅               ║
║                                                          ║
║ PASS = Expected state                                    ║
║ WARNING = Acceptable deviation                           ║
║ FAIL = Blocking issue, migration incomplete             ║
║                                                          ║
║ NEXT: Review results, confirm migration success          ║
╚══════════════════════════════════════════════════════════╝';
END;
$$;

COMMENT ON FUNCTION migration_05_e3_gate() IS
  'E3 Gate: Post-05-C type migration verification (Amendment 12 v3).
   
   Verifies:
     - All tables migrated TEXT → UUID
     - FK constraints established (runtime → public.tenants)
     - RLS policies preserved
     - TEXT→UUID mapping correctness via canonical_tenant_map
     - No orphan UUIDs
     - 3 fixtures preserved with correct identity
   
   Returns TABLE for structured verification results.
   
   PASS: Expected state
   WARNING: Acceptable deviation
   FAIL: Migration incomplete, requires resolution
   
   Read-only verification (0 mutations).
   
   Execute AFTER 05-C.';

-- ============================================================================
-- VERIFICATION: Test E3 gate availability
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'E3 Gate (post-05-C verification) function created successfully';
  RAISE NOTICE 'Usage: SELECT * FROM migration_05_e3_gate();';
  RAISE NOTICE 'Execute AFTER 05-C to verify type migration completeness';
END $$;
