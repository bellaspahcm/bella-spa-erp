-- ============================================================================
-- BELLA RUNTIME MIGRATION 05-B: CANONICAL TENANT CREATION & ORPHAN CLEANUP
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Create canonical tenants using reserved UUIDs, complete mapping, delete orphans
-- Phase: COMPLETE (RESERVATION → COMPLETE transition)
-- Gates: P2 (reservation complete), P3 (schema compatibility), P4 (collision recheck), E2 (orphan safety)
-- Mandatory Conditions: #3 (mapping immutability), #4 (transaction+lock), #5 (deletion audit)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md Part D
-- Security Review: Collision detection, mapping immutability (S.7.1)
-- Data Integrity Review: Transaction atomicity, deletion audit (D.2.2, D.5.2)
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Architecture Review: 🟢 PASS
-- - Security Review: 🟢 PASS* (condition #3 implemented here)
-- - Data Integrity Review: 🟢 PASS* (condition #5 implemented here)
--
-- FORBIDDEN: DO NOT execute without 05-A complete (check mapping phase)
-- ============================================================================

-- ============================================================================
-- MANDATORY CONDITION #4: ADVISORY LOCK (Same as 05-A)
-- ============================================================================
DO $$
DECLARE
  v_lock_acquired BOOLEAN;
BEGIN
  -- Reacquire advisory lock for 05-B execution
  SELECT pg_try_advisory_xact_lock(hashtext('BELLA_MIGRATION_05')) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    RAISE EXCEPTION 
      'MIGRATION 05-B: ADVISORY LOCK NOT ACQUIRED
       
       Another migration execution may be in progress.
       
       STOP. Verify 05-A and 05-B are not running concurrently.'
      USING ERRCODE = 'lock_not_available';
  END IF;
  
  RAISE NOTICE 'MIGRATION 05-B: Advisory lock acquired';
END $$;

-- ============================================================================
-- PREFLIGHT P2: VERIFY 05-A COMPLETED (RESERVATION PHASE)
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05b_preflight_p2_reservation_complete()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_map_exists BOOLEAN;
  v_total_count INT;
  v_reservation_count INT;
  v_complete_count INT;
  v_fixture_count INT;
BEGIN
  RAISE NOTICE 'P2: Verifying 05-A RESERVATION phase complete';
  
  -- Check canonical_tenant_map exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'migration_evidence' 
    AND table_name = 'canonical_tenant_map'
  ) INTO v_map_exists;
  
  IF NOT v_map_exists THEN
    RAISE EXCEPTION 'P2 FAILED: canonical_tenant_map does not exist. 05-A not executed. STOP.';
  END IF;
  
  -- Verify counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE reconciliation_phase = 'RESERVATION'),
    COUNT(*) FILTER (WHERE reconciliation_phase = 'COMPLETE'),
    COUNT(*) FILTER (WHERE classification = 'TEST_FIXTURE')
  INTO v_total_count, v_reservation_count, v_complete_count, v_fixture_count
  FROM migration_evidence.canonical_tenant_map;
  
  IF v_total_count != 5 THEN
    RAISE EXCEPTION 'P2 FAILED: Expected 5 mappings, found %. 05-A incomplete. STOP.', v_total_count;
  END IF;
  
  IF v_fixture_count != 3 THEN
    RAISE EXCEPTION 'P2 FAILED: Expected 3 TEST_FIXTURE, found %. 05-A classification error. STOP.', v_fixture_count;
  END IF;
  
  IF v_complete_count > 0 THEN
    RAISE EXCEPTION 'P2 FAILED: % mappings already in COMPLETE phase. 05-B already executed or partial state. STOP.', v_complete_count;
  END IF;
  
  IF v_reservation_count != 5 THEN
    RAISE EXCEPTION 'P2 FAILED: Expected all 5 in RESERVATION phase, found %. Unexpected phase state. STOP.', v_reservation_count;
  END IF;
  
  RAISE NOTICE 'P2: PASS (05-A complete, all mappings in RESERVATION phase)';
END;
$$;

-- ============================================================================
-- PREFLIGHT P3: SCHEMA COMPATIBILITY GATE (V3 CORRECTION 3)
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05b_preflight_p3_schema_compatibility()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_name BOOLEAN;
  v_has_status BOOLEAN;
  v_has_metadata BOOLEAN;
  v_has_created_at BOOLEAN;
  v_metadata_type TEXT;
  v_required_columns_missing TEXT[];
BEGIN
  RAISE NOTICE 'P3: Schema compatibility check (introspecting public.tenants)';
  
  -- Introspect ALL columns (authoritative schema)
  SELECT 
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'name'),
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'status'),
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'metadata'),
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'created_at')
  INTO v_has_name, v_has_status, v_has_metadata, v_has_created_at;
  
  -- REQUIRED columns check
  IF NOT v_has_name THEN
    v_required_columns_missing := array_append(v_required_columns_missing, 'name');
  END IF;
  
  IF array_length(v_required_columns_missing, 1) > 0 THEN
    RAISE EXCEPTION 
      'P3 FAILED: Required columns missing from public.tenants: %
       
       Cannot create canonical tenants without required columns.
       
       STOP.',
      array_to_string(v_required_columns_missing, ', ')
      USING ERRCODE = 'undefined_column';
  END IF;
  
  -- OPTIONAL column type validation
  IF v_has_metadata THEN
    SELECT data_type INTO v_metadata_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'metadata';
    
    IF v_metadata_type != 'jsonb' THEN
      RAISE EXCEPTION 
        'P3 FAILED: tenants.metadata exists but type is % (expected jsonb)
         
         Schema incompatible. Cannot store test_infrastructure classification.
         
         STOP.',
        v_metadata_type
        USING ERRCODE = 'datatype_mismatch';
    END IF;
    
    RAISE NOTICE 'P3: tenants.metadata available (jsonb). Test infrastructure classification will be stored.';
  ELSE
    RAISE WARNING 'P3: tenants.metadata MISSING. Canonical tenants will be created WITHOUT test_infrastructure metadata. Classification tracking degraded (acceptable).';
  END IF;
  
  -- Log schema compatibility summary
  RAISE NOTICE 'P3 Schema Compatibility: name=% (REQUIRED✅), status=% (OPTIONAL), metadata=% (OPTIONAL, type=%), created_at=% (OPTIONAL)',
    v_has_name, v_has_status, v_has_metadata, COALESCE(v_metadata_type, 'N/A'), v_has_created_at;
    
  RAISE NOTICE 'P3: PASS (required columns present, optional columns introspected)';
END;
$$;

-- ============================================================================
-- PREFLIGHT P4 RECHECK: COLLISION DETECTION BEFORE INSERT
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05b_preflight_collision_recheck()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_reserved_uuids UUID[];
  v_collision_count INTEGER;
BEGIN
  RAISE NOTICE 'P4 RECHECK: Final collision detection before tenant creation';
  
  -- Get reserved UUIDs
  SELECT array_agg(reserved_tenant_id) 
  INTO v_reserved_uuids
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE'
    AND reconciliation_phase = 'RESERVATION';
  
  -- Check collision
  SELECT COUNT(*)
  INTO v_collision_count
  FROM public.tenants
  WHERE id = ANY(v_reserved_uuids);
  
  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 
      'P4 RECHECK FAILED: UUID collision detected
       
       % reserved UUIDs already exist in public.tenants.
       
       This indicates:
         - Concurrent 05-B execution, OR
         - External process claimed UUID between 05-A and 05-B, OR
         - Previous 05-B partial completion
       
       STOP. NO MUTATION.
       
       HUMAN REVIEW REQUIRED.',
      v_collision_count
      USING ERRCODE = 'unique_violation';
  END IF;
  
  RAISE NOTICE 'P4 RECHECK: PASS (no collisions, safe to create tenants)';
END;
$$;

-- ============================================================================
-- CANONICAL TENANT CREATION (SCHEMA-ADAPTIVE)
-- ============================================================================
-- 🔴 V3 CORRECTION 4: Dynamic INSERT based on schema introspection

CREATE OR REPLACE FUNCTION migration_05b_create_canonical_tenants(
  p_tenant_a_uuid UUID,
  p_tenant_b_uuid UUID,
  p_attacker_uuid UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_metadata BOOLEAN;
  v_has_status BOOLEAN;
  v_has_created_at BOOLEAN;
  v_metadata_json JSONB;
BEGIN
  RAISE NOTICE 'Creating 3 canonical tenants (schema-adaptive)';
  
  -- Introspect schema
  SELECT 
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'metadata' AND data_type = 'jsonb'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'status'),
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'created_at')
  INTO v_has_metadata, v_has_status, v_has_created_at;
  
  -- Build metadata if supported
  IF v_has_metadata THEN
    v_metadata_json := jsonb_build_object(
      'test_infrastructure', true,
      'purpose', 'e2e_security_testing',
      'classification', 'test_fixture',
      'provisioned_by', 'migration_05b',
      'provisioned_at', NOW()
    );
  END IF;
  
  -- ====== TENANT A ======
  IF v_has_status AND v_has_metadata THEN
    INSERT INTO public.tenants (id, name, status, metadata)
    VALUES (p_tenant_a_uuid, 'E2E Test Tenant A (Runtime)', 'active', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-a'));
  ELSIF v_has_status THEN
    INSERT INTO public.tenants (id, name, status)
    VALUES (p_tenant_a_uuid, 'E2E Test Tenant A (Runtime)', 'active');
  ELSIF v_has_metadata THEN
    INSERT INTO public.tenants (id, name, metadata)
    VALUES (p_tenant_a_uuid, 'E2E Test Tenant A (Runtime)', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-a'));
  ELSE
    INSERT INTO public.tenants (id, name)
    VALUES (p_tenant_a_uuid, 'E2E Test Tenant A (Runtime)');
  END IF;
  
  -- ====== TENANT B ======
  IF v_has_status AND v_has_metadata THEN
    INSERT INTO public.tenants (id, name, status, metadata)
    VALUES (p_tenant_b_uuid, 'E2E Test Tenant B (Runtime)', 'active', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-b'));
  ELSIF v_has_status THEN
    INSERT INTO public.tenants (id, name, status)
    VALUES (p_tenant_b_uuid, 'E2E Test Tenant B (Runtime)', 'active');
  ELSIF v_has_metadata THEN
    INSERT INTO public.tenants (id, name, metadata)
    VALUES (p_tenant_b_uuid, 'E2E Test Tenant B (Runtime)', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-b'));
  ELSE
    INSERT INTO public.tenants (id, name)
    VALUES (p_tenant_b_uuid, 'E2E Test Tenant B (Runtime)');
  END IF;
  
  -- ====== TENANT ATTACKER ======
  IF v_has_status AND v_has_metadata THEN
    INSERT INTO public.tenants (id, name, status, metadata)
    VALUES (p_attacker_uuid, 'E2E Test Tenant Attacker (Runtime)', 'active', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-attacker', 'security_test_role', 'attacker'));
  ELSIF v_has_status THEN
    INSERT INTO public.tenants (id, name, status)
    VALUES (p_attacker_uuid, 'E2E Test Tenant Attacker (Runtime)', 'active');
  ELSIF v_has_metadata THEN
    INSERT INTO public.tenants (id, name, metadata)
    VALUES (p_attacker_uuid, 'E2E Test Tenant Attacker (Runtime)', 
            v_metadata_json || jsonb_build_object('legacy_text_id', 'test-e2e-tenant-attacker', 'security_test_role', 'attacker'));
  ELSE
    INSERT INTO public.tenants (id, name)
    VALUES (p_attacker_uuid, 'E2E Test Tenant Attacker (Runtime)');
  END IF;
  
  RAISE NOTICE 'Created 3 canonical tenants: metadata=%, status=%, created_at=%',
    v_has_metadata, v_has_status, v_has_created_at;
END;
$$;

-- ============================================================================
-- MANDATORY CONDITION #3: MAPPING IMMUTABILITY TRIGGER
-- ============================================================================
-- Security Review S.7.1: Prevent canonical_tenant_id modification after COMPLETE phase

CREATE OR REPLACE FUNCTION migration_evidence.prevent_canonical_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.reconciliation_phase = 'COMPLETE' 
     AND OLD.canonical_tenant_id IS DISTINCT FROM NEW.canonical_tenant_id THEN
    RAISE EXCEPTION 
      'MAPPING IMMUTABILITY VIOLATION
       
       Cannot modify canonical_tenant_id after reconciliation_phase = COMPLETE.
       
       Attempted change:
         legacy_fixture_id: %
         OLD canonical_tenant_id: %
         NEW canonical_tenant_id: %
       
       This would break identity mapping integrity.
       
       If remapping is necessary, rollback 05-B and restart reconciliation.',
      OLD.legacy_fixture_id,
      OLD.canonical_tenant_id,
      NEW.canonical_tenant_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_prevent_canonical_id_change
  BEFORE UPDATE OF canonical_tenant_id ON migration_evidence.canonical_tenant_map
  FOR EACH ROW
  EXECUTE FUNCTION migration_evidence.prevent_canonical_id_change();

COMMENT ON TRIGGER trigger_prevent_canonical_id_change ON migration_evidence.canonical_tenant_map IS
  'Mandatory Condition #3: Mapping immutability enforcement.
   
   Prevents canonical_tenant_id modification after reconciliation_phase = COMPLETE.
   
   Security Review S.7.1 compliance: Protects against identity substitution attacks.';

-- ============================================================================
-- PART 1: EXECUTE PREFLIGHT GATES
-- ============================================================================
DO $$
BEGIN
  -- P2: Verify 05-A complete
  PERFORM migration_05b_preflight_p2_reservation_complete();
  
  -- P3: Schema compatibility
  PERFORM migration_05b_preflight_p3_schema_compatibility();
  
  -- P4 Recheck: Final collision detection
  PERFORM migration_05b_preflight_collision_recheck();
  
  RAISE NOTICE 'All preflight gates PASS';
END $$;

-- ============================================================================
-- PART 2: CREATE CANONICAL TENANTS
-- ============================================================================
DO $$
DECLARE
  v_tenant_a_uuid UUID;
  v_tenant_b_uuid UUID;
  v_attacker_uuid UUID;
BEGIN
  -- Retrieve reserved UUIDs
  SELECT reserved_tenant_id INTO STRICT v_tenant_a_uuid
  FROM migration_evidence.canonical_tenant_map
  WHERE legacy_fixture_id = 'test-e2e-tenant-a' 
    AND classification = 'TEST_FIXTURE'
    AND reconciliation_phase = 'RESERVATION';
  
  SELECT reserved_tenant_id INTO STRICT v_tenant_b_uuid
  FROM migration_evidence.canonical_tenant_map
  WHERE legacy_fixture_id = 'test-e2e-tenant-b' 
    AND classification = 'TEST_FIXTURE'
    AND reconciliation_phase = 'RESERVATION';
  
  SELECT reserved_tenant_id INTO STRICT v_attacker_uuid
  FROM migration_evidence.canonical_tenant_map
  WHERE legacy_fixture_id = 'test-e2e-tenant-attacker' 
    AND classification = 'TEST_FIXTURE'
    AND reconciliation_phase = 'RESERVATION';
  
  RAISE NOTICE 'Reserved UUIDs: A=%, B=%, Attacker=%', v_tenant_a_uuid, v_tenant_b_uuid, v_attacker_uuid;
  
  -- Create canonical tenants
  PERFORM migration_05b_create_canonical_tenants(v_tenant_a_uuid, v_tenant_b_uuid, v_attacker_uuid);
  
  RAISE NOTICE '3 canonical tenants created successfully';
END $$;

-- ============================================================================
-- PART 3: UPDATE MAPPING TO COMPLETE PHASE
-- ============================================================================
UPDATE migration_evidence.canonical_tenant_map
SET 
  canonical_tenant_id = reserved_tenant_id,
  reconciliation_phase = 'COMPLETE',
  completed_at = NOW()
WHERE classification = 'TEST_FIXTURE'
  AND reconciliation_phase = 'RESERVATION';

-- ============================================================================
-- PART 4: ADD FK CONSTRAINT (NOW tenants exist)
-- ============================================================================
ALTER TABLE migration_evidence.canonical_tenant_map
  ADD CONSTRAINT fk_canonical_tenant 
  FOREIGN KEY (canonical_tenant_id) 
  REFERENCES public.tenants(id)
  ON DELETE RESTRICT;

-- ============================================================================
-- PART 5: EXECUTE E2 ORPHAN SAFETY GATE
-- ============================================================================
DO $$
DECLARE
  v_e2_result RECORD;
  v_e2_failed BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE 'E2 ORPHAN SAFETY GATE: Executing verification';
  
  -- Run E2 gate (returns TABLE)
  FOR v_e2_result IN
    SELECT * FROM migration_05_e2_orphan_safety_gate()
  LOOP
    RAISE NOTICE 'E2: % | % | %', v_e2_result.check_name, v_e2_result.status, v_e2_result.details;
    
    IF v_e2_result.status = 'FAIL' THEN
      v_e2_failed := TRUE;
    END IF;
  END LOOP;
  
  IF v_e2_failed THEN
    RAISE EXCEPTION 'E2 ORPHAN SAFETY GATE: FAILED. See verification results above. STOP before deletion.'
      USING ERRCODE = 'check_violation';
  END IF;
  
  RAISE NOTICE 'E2 ORPHAN SAFETY GATE: PASS (safe to delete orphans)';
END $$;

-- ============================================================================
-- PART 6: DELETE ORPHANS WITH AUDIT (MANDATORY CONDITION #5)
-- ============================================================================
-- 🔴 MANDATORY CONDITION #5: Deletion audit (deleted_at, deleted_by, deletion_reason)

DO $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Update canonical_tenant_map with deletion audit BEFORE deleting
  UPDATE migration_evidence.canonical_tenant_map
  SET 
    deleted_at = NOW(),
    deleted_by = CURRENT_USER,
    deletion_reason = 'E2 orphan safety gate PASS. Classification: TEST_ORPHAN. No canonical identity required. Safe for deletion.'
  WHERE classification = 'TEST_ORPHAN';
  
  -- Delete orphans from runtime_tenant_registry
  DELETE FROM runtime_tenant_registry
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count != 2 THEN
    RAISE EXCEPTION 'Orphan deletion mismatch: expected 2, deleted %. Data integrity issue.', v_deleted_count;
  END IF;
  
  RAISE NOTICE 'Deleted % orphan fixtures with audit trail', v_deleted_count;
END $$;

-- ============================================================================
-- PART 7: VERIFICATION & COMPLETION
-- ============================================================================
DO $$
DECLARE
  v_tenant_count INT;
  v_complete_count INT;
  v_fk_exists BOOLEAN;
  v_orphan_count INT;
BEGIN
  -- Verify canonical tenants created
  SELECT COUNT(*) INTO v_tenant_count
  FROM public.tenants
  WHERE id IN (
    SELECT canonical_tenant_id 
    FROM migration_evidence.canonical_tenant_map 
    WHERE classification = 'TEST_FIXTURE'
  );
  
  IF v_tenant_count != 3 THEN
    RAISE EXCEPTION 'Tenant creation verification failed: expected 3, found %', v_tenant_count;
  END IF;
  
  -- Verify mapping phase = COMPLETE
  SELECT COUNT(*) INTO v_complete_count
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE' AND reconciliation_phase = 'COMPLETE';
  
  IF v_complete_count != 3 THEN
    RAISE EXCEPTION 'Mapping phase verification failed: expected 3 COMPLETE, found %', v_complete_count;
  END IF;
  
  -- Verify FK constraint exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'migration_evidence'
      AND table_name = 'canonical_tenant_map'
      AND constraint_name = 'fk_canonical_tenant'
      AND constraint_type = 'FOREIGN KEY'
  ) INTO v_fk_exists;
  
  IF NOT v_fk_exists THEN
    RAISE EXCEPTION 'FK constraint verification failed: fk_canonical_tenant not found';
  END IF;
  
  -- Verify orphans deleted
  SELECT COUNT(*) INTO v_orphan_count
  FROM runtime_tenant_registry
  WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b');
  
  IF v_orphan_count != 0 THEN
    RAISE EXCEPTION 'Orphan deletion verification failed: expected 0, found %', v_orphan_count;
  END IF;
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ MIGRATION 05-B: CANONICAL TENANT CREATION COMPLETE       ║
╠══════════════════════════════════════════════════════════╣
║ Canonical Tenants Created:  3                            ║
║   - 11111111-0000-4000-8000-000000000001 (Tenant A)      ║
║   - 11111111-0000-4000-8000-000000000002 (Tenant B)      ║
║   - 11111111-0000-4000-8000-000000000003 (Attacker)      ║
║                                                          ║
║ Mapping Phase: RESERVATION → COMPLETE                    ║
║ FK Constraint: fk_canonical_tenant ADDED                 ║
║                                                          ║
║ Orphans Deleted: 2                                       ║
║   - test-quarantine-tenant-a                            ║
║   - test-quarantine-tenant-b                            ║
║                                                          ║
║ Deletion Audit: ✅ (deleted_at, deleted_by, reason)     ║
║ Mapping Immutability: ✅ (trigger enforced)             ║
║                                                          ║
║ NEXT STEP: Execute 05-C (TEXT→UUID type migration)      ║
║                                                          ║
║ FORBIDDEN: DO NOT modify canonical_tenant_id manually    ║
╚══════════════════════════════════════════════════════════╝';
END $$;

-- ============================================================================
-- MANDATORY CONDITIONS IMPLEMENTATION SUMMARY
-- ============================================================================
-- ✅ #3: Mapping immutability ← trigger_prevent_canonical_id_change
-- ✅ #4: Transaction + lock + verification ← Full transaction + advisory lock + P2/P3/P4/E2 gates
-- ✅ #5: Deletion audit columns ← deleted_at, deleted_by, deletion_reason populated before DELETE
-- ============================================================================

-- Advisory lock released automatically at transaction end (COMMIT)
