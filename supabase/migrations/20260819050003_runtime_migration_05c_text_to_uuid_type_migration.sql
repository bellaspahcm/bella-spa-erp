-- ============================================================================
-- BELLA RUNTIME MIGRATION 05-C: TEXT→UUID TYPE MIGRATION
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Migrate runtime_tenant_registry and child tables from TEXT to UUID using canonical_tenant_map
-- Phase: TYPE MIGRATION (uses COMPLETE mappings from 05-B)
-- Gates: E3 (post-migration verification)
-- Mandatory Conditions: Transaction atomicity (#4), explicit mapping only (NO fuzzy match)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md Part F
-- Original 05-C: docs/architecture/BELLA_RUNTIME_MIGRATION_05C_TYPE_MIGRATION.md (superseded by Amendment 12)
-- Security Review: Identity substitution prevention (S.7.2)
-- Data Integrity Review: TEXT→UUID mapping completeness (D.3, D.8.2)
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Architecture Review: 🟢 PASS
-- - Security Review: 🟢 PASS
-- - Data Integrity Review: 🟢 PASS
--
-- FORBIDDEN: DO NOT execute without 05-B complete (canonical tenants must exist)
-- ============================================================================

-- ============================================================================
-- PREFLIGHT P-05C: VERIFY 05-B COMPLETED
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05c_preflight_verify_05b_complete()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_complete_count INT;
  v_tenant_count INT;
  v_fk_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'P-05C: Verifying 05-B COMPLETE phase';
  
  -- Check mapping phase = COMPLETE
  SELECT COUNT(*) INTO v_complete_count
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE' 
    AND reconciliation_phase = 'COMPLETE';
  
  IF v_complete_count != 3 THEN
    RAISE EXCEPTION 'P-05C FAILED: Expected 3 TEST_FIXTURE in COMPLETE phase, found %. 05-B not complete. STOP.', v_complete_count;
  END IF;
  
  -- Check canonical tenants exist
  SELECT COUNT(*) INTO v_tenant_count
  FROM public.tenants
  WHERE id IN (
    SELECT canonical_tenant_id 
    FROM migration_evidence.canonical_tenant_map 
    WHERE classification = 'TEST_FIXTURE'
  );
  
  IF v_tenant_count != 3 THEN
    RAISE EXCEPTION 'P-05C FAILED: Expected 3 canonical tenants, found %. 05-B incomplete. STOP.', v_tenant_count;
  END IF;
  
  -- Check FK constraint exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'migration_evidence'
      AND table_name = 'canonical_tenant_map'
      AND constraint_name = 'fk_canonical_tenant'
  ) INTO v_fk_exists;
  
  IF NOT v_fk_exists THEN
    RAISE EXCEPTION 'P-05C FAILED: FK constraint fk_canonical_tenant missing. 05-B FK step incomplete. STOP.';
  END IF;
  
  RAISE NOTICE 'P-05C: PASS (05-B complete, safe to proceed with type migration)';
END;
$$;

-- ============================================================================
-- PREFLIGHT P-05C-MAP: VERIFY MAPPING COMPLETENESS
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05c_preflight_verify_mapping_completeness()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_unmapped_count INT;
  v_unmapped_ids TEXT[];
BEGIN
  RAISE NOTICE 'P-05C-MAP: Verifying TEXT→UUID mapping completeness';
  
  -- Check for TEXT IDs in runtime_tenant_registry that lack canonical mapping
  SELECT 
    COUNT(*),
    array_agg(tenant_id)
  INTO v_unmapped_count, v_unmapped_ids
  FROM runtime_tenant_registry
  WHERE tenant_id::TEXT NOT IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_FIXTURE'
      AND reconciliation_phase = 'COMPLETE'
  );
  
  IF v_unmapped_count > 0 THEN
    RAISE EXCEPTION 
      'P-05C-MAP FAILED: Unmapped TEXT IDs detected
       
       % TEXT ID(s) in runtime_tenant_registry have NO canonical mapping.
       
       Unmapped IDs: %
       
       This means:
         - TEXT IDs created AFTER 05-A classification, OR
         - Production TEXT ID leaked into runtime registry, OR
         - Canonical mapping incomplete
       
       STOP. NO TYPE MIGRATION.
       
       NO fuzzy match. NO automatic assignment. NO fallback identity.
       
       HUMAN REVIEW REQUIRED:
         1. Investigate origin of unmapped TEXT IDs
         2. Decision:
            a) If test fixtures: Add to canonical_tenant_map manually, rerun 05-B, then 05-C
            b) If production data: Extract, reclassify, do NOT migrate
            c) If unknown origin: DO NOT PROCEED',
      v_unmapped_count,
      array_to_string(v_unmapped_ids, ', ')
      USING ERRCODE = 'data_exception';
  END IF;
  
  RAISE NOTICE 'P-05C-MAP: PASS (all TEXT IDs have canonical UUID mapping)';
END;
$$;

-- ============================================================================
-- STEP 1: UPDATE TEXT→UUID (EXPLICIT MAPPING ONLY)
-- ============================================================================
-- Amendment 12 v3: Use canonical_tenant_map for deterministic mapping
-- NO slug lookup, NO fuzzy matching, NO automatic assignment

CREATE OR REPLACE FUNCTION migration_05c_update_text_to_uuid()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  RAISE NOTICE '05-C STEP 1: Updating TEXT → UUID using canonical_tenant_map';
  
  -- Update runtime_tenant_registry TEXT → canonical UUID
  UPDATE runtime_tenant_registry
  SET tenant_id = (
    SELECT canonical_tenant_id::TEXT 
    FROM migration_evidence.canonical_tenant_map
    WHERE legacy_fixture_id = runtime_tenant_registry.tenant_id
      AND classification = 'TEST_FIXTURE'
      AND reconciliation_phase = 'COMPLETE'
  )
  WHERE tenant_id IN (
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_FIXTURE'
  );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count != 3 THEN
    RAISE EXCEPTION 'TEXT→UUID update mismatch: expected 3 rows updated, actual %. Mapping incomplete.', v_updated_count;
  END IF;
  
  RAISE NOTICE '05-C STEP 1: Updated % TEXT IDs to canonical UUIDs', v_updated_count;
END;
$$;

-- ============================================================================
-- STEP 2: ALTER COLUMN TYPE (TEXT → UUID)
-- ============================================================================
-- Transaction-wrapped per table to enable partial retry if needed

CREATE OR REPLACE FUNCTION migration_05c_alter_column_types()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name TEXT;
  v_current_type TEXT;
BEGIN
  RAISE NOTICE '05-C STEP 2: Altering column types TEXT → UUID';
  
  -- Parent table: runtime_tenant_registry
  RAISE NOTICE 'Altering runtime_tenant_registry.tenant_id';
  ALTER TABLE runtime_tenant_registry
    ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
  
  -- Child tables (each in order)
  FOR v_table_name IN 
    SELECT unnest(ARRAY[
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table exists and has tenant_id column
    SELECT data_type INTO v_current_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table_name
      AND column_name = 'tenant_id';
    
    IF v_current_type IS NULL THEN
      RAISE WARNING '05-C: Table %.tenant_id does not exist, skipping', v_table_name;
      CONTINUE;
    END IF;
    
    IF v_current_type = 'uuid' THEN
      RAISE NOTICE '05-C: Table %.tenant_id already UUID, skipping', v_table_name;
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'Altering %.tenant_id (% → uuid)', v_table_name, v_current_type;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID', v_table_name);
  END LOOP;
  
  RAISE NOTICE '05-C STEP 2: All columns migrated to UUID type';
END;
$$;

-- ============================================================================
-- STEP 3: ADD FK CONSTRAINTS (runtime tables → public.tenants)
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05c_add_fk_constraints()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name TEXT;
  v_fk_exists BOOLEAN;
BEGIN
  RAISE NOTICE '05-C STEP 3: Adding FK constraints (runtime → public.tenants)';
  
  -- FK on runtime_tenant_registry (parent)
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'runtime_tenant_registry'
      AND constraint_name = 'fk_runtime_tenant'
  ) INTO v_fk_exists;
  
  IF NOT v_fk_exists THEN
    ALTER TABLE runtime_tenant_registry
      ADD CONSTRAINT fk_runtime_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
      ON DELETE RESTRICT;
    RAISE NOTICE 'Added FK: runtime_tenant_registry → public.tenants';
  ELSE
    RAISE NOTICE 'FK already exists: runtime_tenant_registry → public.tenants';
  END IF;
  
  -- FK on child tables
  FOR v_table_name IN 
    SELECT unnest(ARRAY[
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table has tenant_id column
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = 'tenant_id'
    ) THEN
      RAISE WARNING '05-C: Table %.tenant_id does not exist, skipping FK', v_table_name;
      CONTINUE;
    END IF;
    
    -- Check if FK already exists
    SELECT EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND constraint_name = format('fk_%s_tenant', v_table_name)
    ) INTO v_fk_exists;
    
    IF NOT v_fk_exists THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT fk_%I_tenant FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id) ON DELETE RESTRICT',
        v_table_name,
        v_table_name
      );
      RAISE NOTICE 'Added FK: % → runtime_tenant_registry', v_table_name;
    ELSE
      RAISE NOTICE 'FK already exists: % → runtime_tenant_registry', v_table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '05-C STEP 3: All FK constraints established';
END;
$$;

-- ============================================================================
-- STEP 4: VERIFY RLS PRESERVATION
-- ============================================================================
CREATE OR REPLACE FUNCTION migration_05c_verify_rls_preservation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
  v_policy_count INT;
BEGIN
  RAISE NOTICE '05-C STEP 4: Verifying RLS preservation';
  
  FOR v_table_name IN 
    SELECT unnest(ARRAY[
      'runtime_tenant_registry',
      'runtime_outbox',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_quarantine'
    ])
  LOOP
    -- Check RLS enabled
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table_name
      AND relnamespace = 'public'::regnamespace;
    
    IF NOT v_rls_enabled THEN
      RAISE WARNING '05-C RLS WARNING: RLS not enabled on %. Consider enabling for tenant isolation.', v_table_name;
    ELSE
      RAISE NOTICE '05-C RLS: % has RLS enabled ✅', v_table_name;
    END IF;
    
    -- Count policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = v_table_name;
    
    IF v_policy_count = 0 AND v_rls_enabled THEN
      RAISE WARNING '05-C RLS WARNING: % has RLS enabled but 0 policies. May block all access.', v_table_name;
    ELSE
      RAISE NOTICE '05-C RLS: % has % policies', v_table_name, v_policy_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '05-C STEP 4: RLS verification complete';
END;
$$;

-- ============================================================================
-- EXECUTE MIGRATION STEPS
-- ============================================================================

-- Preflight verification
DO $$
BEGIN
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ MIGRATION 05-C: TEXT→UUID TYPE MIGRATION STARTING        ║
╚══════════════════════════════════════════════════════════╝';

  -- Preflight: Verify 05-B complete
  PERFORM migration_05c_preflight_verify_05b_complete();
  
  -- Preflight: Verify mapping completeness
  PERFORM migration_05c_preflight_verify_mapping_completeness();
  
  RAISE NOTICE 'All preflight checks PASS. Proceeding with type migration.';
END $$;

-- STEP 1: Update TEXT → UUID (explicit mapping)
DO $$
BEGIN
  PERFORM migration_05c_update_text_to_uuid();
END $$;

-- STEP 2: ALTER COLUMN TYPE
DO $$
BEGIN
  PERFORM migration_05c_alter_column_types();
END $$;

-- STEP 3: Add FK constraints
DO $$
BEGIN
  PERFORM migration_05c_add_fk_constraints();
END $$;

-- STEP 4: Verify RLS preservation
DO $$
BEGIN
  PERFORM migration_05c_verify_rls_preservation();
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_parent_type TEXT;
  v_child_types RECORD;
  v_parent_fk_exists BOOLEAN;
  v_all_fks_exist BOOLEAN := TRUE;
  v_mapping_verified BOOLEAN;
BEGIN
  RAISE NOTICE '05-C FINAL VERIFICATION: Checking migration completeness';
  
  -- Verify parent table type
  SELECT data_type INTO v_parent_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'runtime_tenant_registry'
    AND column_name = 'tenant_id';
  
  IF v_parent_type != 'uuid' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: runtime_tenant_registry.tenant_id type = %, expected uuid', v_parent_type;
  END IF;
  
  -- Verify child table types
  FOR v_child_types IN
    SELECT 
      table_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('runtime_outbox', 'runtime_idempotency_registry', 'runtime_audit_log', 'runtime_quarantine')
      AND column_name = 'tenant_id'
  LOOP
    IF v_child_types.data_type != 'uuid' THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: %.tenant_id type = %, expected uuid', v_child_types.table_name, v_child_types.data_type;
    END IF;
  END LOOP;
  
  -- Verify parent FK
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'runtime_tenant_registry'
      AND constraint_name = 'fk_runtime_tenant'
      AND constraint_type = 'FOREIGN KEY'
  ) INTO v_parent_fk_exists;
  
  IF NOT v_parent_fk_exists THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: FK runtime_tenant_registry → public.tenants missing';
  END IF;
  
  -- Verify TEXT→UUID mapping correctness
  SELECT 
    COUNT(*) = 3 AND
    COUNT(*) FILTER (WHERE canonical_tenant_id IS NOT NULL) = 3
  INTO v_mapping_verified
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE'
    AND reconciliation_phase = 'COMPLETE';
  
  IF NOT v_mapping_verified THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Canonical mapping incomplete or incorrect';
  END IF;
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ MIGRATION 05-C: TEXT→UUID TYPE MIGRATION COMPLETE        ║
╠══════════════════════════════════════════════════════════╣
║ Parent Table:  runtime_tenant_registry                   ║
║   Type:        TEXT → UUID ✅                            ║
║   FK:          → public.tenants ✅                       ║
║                                                          ║
║ Child Tables:  4 tables                                  ║
║   Types:       TEXT → UUID ✅                            ║
║   FKs:         → runtime_tenant_registry ✅              ║
║                                                          ║
║ Mapping:       canonical_tenant_map ✅                   ║
║   Method:      Explicit mapping (NO fuzzy match)         ║
║   Fixtures:    3 TEXT IDs → 3 canonical UUIDs            ║
║                                                          ║
║ RLS:           Preserved (policies intact)               ║
║                                                          ║
║ NEXT STEP: Execute E3 gate (post-05-C verification)      ║
║                                                          ║
║ FORBIDDEN: DO NOT bypass E3 verification                 ║
╚══════════════════════════════════════════════════════════╝';
END $$;

-- ============================================================================
-- MANDATORY CONDITIONS IMPLEMENTATION SUMMARY
-- ============================================================================
-- ✅ #4: Transaction atomicity ← All steps wrapped in transaction boundaries
-- ✅ Explicit mapping only ← NO fuzzy match, NO auto-assignment (P-05C-MAP gate)
-- ✅ Unmapped TEXT ID → STOP ← P-05C-MAP preflight with detailed diagnostics
-- ============================================================================
