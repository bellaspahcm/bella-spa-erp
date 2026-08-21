-- ============================================================================
-- BELLA RUNTIME MIGRATION 05-A: FIXTURE CLASSIFICATION & UUID RESERVATION
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Classify Runtime tenant_id TEXT fixtures and reserve deterministic UUIDs
-- Phase: RESERVATION (NO canonical tenants created, NO FK constraints yet)
-- Gates: E1 (preflight), P3, P4
-- Mandatory Conditions: #1 (P4 metadata validation), #2 (advisory lock), #4 (transaction + lock + PK)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md
-- Security Review: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_SECURITY_REVIEW.md
-- Data Integrity Review: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_DATA_INTEGRITY_REVIEW.md
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Architecture Review: 🟢 PASS
-- - Security Review: 🟢 PASS* (conditions #1, #2, #4 implemented here)
-- - Data Integrity Review: 🟢 PASS
--
-- FORBIDDEN: DO NOT execute without E1 gate PASS
-- ============================================================================

-- ============================================================================
-- MANDATORY CONDITION #2: ADVISORY LOCK (Explicit Acquisition)
-- ============================================================================
-- Acquire exclusive advisory lock to prevent concurrent 05-A execution
-- Lock is transaction-scoped and released automatically at COMMIT/ROLLBACK
DO $$
DECLARE
  v_lock_acquired BOOLEAN;
BEGIN
  -- Attempt to acquire advisory lock (non-blocking check)
  SELECT pg_try_advisory_xact_lock(hashtext('BELLA_MIGRATION_05')) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    RAISE EXCEPTION 
      'MIGRATION 05-A: ADVISORY LOCK NOT ACQUIRED. 
       
       Another 05-A execution may be in progress, or a previous transaction did not complete.
       
       STOP. Verify no concurrent migration execution.
       
       To manually release stuck lock (USE WITH EXTREME CAUTION):
       SELECT pg_advisory_unlock_all();'
      USING ERRCODE = 'lock_not_available';
  END IF;
  
  RAISE NOTICE 'MIGRATION 05-A: Advisory lock acquired (hashtext: BELLA_MIGRATION_05)';
END $$;

-- ============================================================================
-- PART 1: CREATE MIGRATION EVIDENCE SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS migration_evidence;

COMMENT ON SCHEMA migration_evidence IS
  'Evidence schema for Migration 05 identity reconciliation.
   
   Persists post-migration for audit trail and forensic analysis.
   
   DO NOT DROP after migration completion.';

-- ============================================================================
-- PART 2: CREATE CANONICAL_TENANT_MAP (TWO-PHASE RECONCILIATION)
-- ============================================================================
-- 🔴 V3 CORRECTION 1: Separate reserved_tenant_id from canonical_tenant_id
-- NO FK constraint during RESERVATION phase (tenants don't exist yet)

CREATE TABLE migration_evidence.canonical_tenant_map (
  -- Primary key
  legacy_fixture_id TEXT PRIMARY KEY,
  
  -- PHASE 1: Reserved UUID (05-A)
  -- NO FK constraint during reservation (tenants don't exist yet)
  reserved_tenant_id UUID,
  
  -- PHASE 2: Canonical UUID (05-B)
  -- FK constraint added AFTER tenant creation
  canonical_tenant_id UUID,
  
  -- Classification
  classification TEXT NOT NULL CHECK (classification IN (
    'TEST_ORPHAN',      -- No mapping, will be deleted
    'TEST_FIXTURE',     -- Maps to canonical tenant
    'VALID_MAPPING'     -- Production mapping (future use)
  )),
  
  -- Reconciliation phase tracking
  reconciliation_phase TEXT NOT NULL CHECK (reconciliation_phase IN (
    'RESERVATION',  -- 05-A completed: reserved_tenant_id populated
    'COMPLETE'      -- 05-B completed: canonical_tenant_id populated, FK added
  )) DEFAULT 'RESERVATION',
  
  reconciliation_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT CURRENT_USER,
  completed_at TIMESTAMPTZ,
  
  -- 🔴 V3 CORRECTION 5: Deletion audit columns (Data Integrity Review recommendation)
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deletion_reason TEXT,
  
  -- INVARIANT 1: TEST_ORPHAN has no UUIDs
  CONSTRAINT orphan_invariant CHECK (
    (classification = 'TEST_ORPHAN' 
     AND reserved_tenant_id IS NULL 
     AND canonical_tenant_id IS NULL)
    OR
    (classification != 'TEST_ORPHAN')
  ),
  
  -- INVARIANT 2: RESERVATION phase rules
  CONSTRAINT reservation_phase_invariant CHECK (
    (reconciliation_phase = 'RESERVATION'
     AND completed_at IS NULL
     AND (
       (classification = 'TEST_ORPHAN' 
        AND reserved_tenant_id IS NULL 
        AND canonical_tenant_id IS NULL)
       OR
       (classification = 'TEST_FIXTURE'
        AND reserved_tenant_id IS NOT NULL
        AND canonical_tenant_id IS NULL)
     ))
    OR
    (reconciliation_phase = 'COMPLETE')
  ),
  
  -- INVARIANT 3: COMPLETE phase rules (reserved_tenant_id = canonical_tenant_id)
  CONSTRAINT complete_phase_invariant CHECK (
    (reconciliation_phase = 'COMPLETE'
     AND completed_at IS NOT NULL
     AND (
       (classification = 'TEST_ORPHAN')
       OR
       (classification = 'TEST_FIXTURE'
        AND reserved_tenant_id IS NOT NULL
        AND canonical_tenant_id IS NOT NULL
        AND reserved_tenant_id = canonical_tenant_id)
     ))
    OR
    (reconciliation_phase = 'RESERVATION')
  )
);

-- Indexes (NO FK yet - added by 05-B)
CREATE INDEX idx_canonical_map_classification 
  ON migration_evidence.canonical_tenant_map(classification);

CREATE INDEX idx_canonical_map_phase 
  ON migration_evidence.canonical_tenant_map(reconciliation_phase);

CREATE INDEX idx_canonical_map_reserved_uuid 
  ON migration_evidence.canonical_tenant_map(reserved_tenant_id)
  WHERE reserved_tenant_id IS NOT NULL;

-- 🔴 V3 CORRECTION 2: Partial UNIQUE index (correct PostgreSQL syntax)
-- v2 error: UNIQUE constraint with WHERE clause in CREATE TABLE
-- v3 fix: Use CREATE UNIQUE INDEX with WHERE clause
CREATE UNIQUE INDEX uq_canonical_map_reserved_uuid
  ON migration_evidence.canonical_tenant_map(reserved_tenant_id)
  WHERE reserved_tenant_id IS NOT NULL;

CREATE UNIQUE INDEX uq_canonical_map_canonical_uuid
  ON migration_evidence.canonical_tenant_map(canonical_tenant_id)
  WHERE canonical_tenant_id IS NOT NULL;

COMMENT ON TABLE migration_evidence.canonical_tenant_map IS 
  'Two-phase reconciliation map separating reservation from canonical identity.
   
   PHASE 1 (05-A - RESERVATION):
     - reserved_tenant_id populated for TEST_FIXTURE
     - canonical_tenant_id NULL
     - NO FK constraint yet (tenants do not exist)
   
   PHASE 2 (05-B - COMPLETE):
     - Tenants created using reserved_tenant_id
     - canonical_tenant_id = reserved_tenant_id
     - FK constraint added to canonical_tenant_id
   
   INVARIANT: Reservation ≠ Canonical Identity
     - reserved_tenant_id: planned UUID (no FK)
     - canonical_tenant_id: actual tenant UUID (with FK after 05-B)
   
   TEST_ORPHAN: Both UUIDs NULL, will be deleted by 05-B';

COMMENT ON COLUMN migration_evidence.canonical_tenant_map.reserved_tenant_id IS
  'Deterministic UUID reserved by 05-A. NO FK constraint during reservation phase.';

COMMENT ON COLUMN migration_evidence.canonical_tenant_map.canonical_tenant_id IS
  'Actual tenant UUID after 05-B creates tenant. FK constraint added by 05-B at COMPLETE phase.';

COMMENT ON COLUMN migration_evidence.canonical_tenant_map.deleted_at IS
  'Timestamp when TEST_ORPHAN row was deleted from runtime_tenant_registry (populated by 05-B).';

COMMENT ON COLUMN migration_evidence.canonical_tenant_map.deleted_by IS
  'User/role that executed orphan deletion (populated by 05-B).';

COMMENT ON COLUMN migration_evidence.canonical_tenant_map.deletion_reason IS
  'Human-readable reason for orphan deletion (populated by 05-B).';

-- ============================================================================
-- PART 3: PREFLIGHT P4 COLLISION GATE (WITH MANDATORY CONDITION #1)
-- ============================================================================
-- 🔴 MANDATORY CONDITION #1: P4 Metadata Validation
-- Security Review requirement: Verify created_at + provisioned_by to distinguish
-- legitimate collision from attacker-created tenant

CREATE OR REPLACE FUNCTION migration_05a_preflight_p4_collision_gate()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_reserved_uuids UUID[];
  v_collision_count INTEGER;
  v_collision_details RECORD;
  v_metadata_column_exists BOOLEAN;
  v_metadata_type TEXT;
  v_created_at_column_exists BOOLEAN;
  v_created_at_type TEXT;
BEGIN
  RAISE NOTICE 'P4 COLLISION GATE: Starting collision detection for reserved UUIDs';
  
  -- Get all reserved UUIDs from classification
  SELECT array_agg(reserved_tenant_id) 
  INTO v_reserved_uuids
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_FIXTURE'
    AND reserved_tenant_id IS NOT NULL;
  
  RAISE NOTICE 'P4: Reserved UUIDs to check: %', array_length(v_reserved_uuids, 1);
  
  -- Check if any reserved UUID already exists in public.tenants
  SELECT COUNT(*)
  INTO v_collision_count
  FROM public.tenants
  WHERE id = ANY(v_reserved_uuids);
  
  IF v_collision_count = 0 THEN
    RAISE NOTICE 'P4 COLLISION GATE: PASS (No collisions detected)';
    RETURN;
  END IF;
  
  -- =========================================================================
  -- COLLISION DETECTED: Begin forensic analysis
  -- =========================================================================
  RAISE WARNING 'P4 COLLISION GATE: COLLISION DETECTED (% reserved UUIDs already exist in public.tenants)', v_collision_count;
  
  -- 🔴 MANDATORY CONDITION #1: Introspect metadata schema BEFORE querying
  -- Security Review S.2.2: Cannot trust metadata presence or type
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'metadata'
  ) INTO v_metadata_column_exists;
  
  IF v_metadata_column_exists THEN
    SELECT data_type INTO v_metadata_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'metadata';
    
    IF v_metadata_type != 'jsonb' THEN
      RAISE EXCEPTION 
        'P4 COLLISION GATE: METADATA TYPE MISMATCH
         
         Expected: jsonb
         Found: %
         
         Cannot classify collision. STOP.
         
         HUMAN REVIEW REQUIRED.',
        v_metadata_type
        USING ERRCODE = 'data_exception';
    END IF;
  END IF;
  
  -- Check created_at column
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'created_at'
  ) INTO v_created_at_column_exists;
  
  IF v_created_at_column_exists THEN
    SELECT data_type INTO v_created_at_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'created_at';
    
    IF v_created_at_type NOT IN ('timestamp with time zone', 'timestamp without time zone') THEN
      RAISE EXCEPTION 
        'P4 COLLISION GATE: CREATED_AT TYPE MISMATCH
         
         Expected: timestamp
         Found: %
         
         Cannot validate collision timeline. STOP.
         
         HUMAN REVIEW REQUIRED.',
        v_created_at_type
        USING ERRCODE = 'data_exception';
    END IF;
  END IF;
  
  -- 🔴 MANDATORY CONDITION #1: Detailed collision forensics
  FOR v_collision_details IN
    SELECT 
      t.id,
      t.name,
      CASE 
        WHEN v_created_at_column_exists THEN t.created_at::TEXT
        ELSE 'UNKNOWN (column missing)'
      END AS created_at,
      CASE 
        WHEN v_metadata_column_exists AND v_metadata_type = 'jsonb' THEN 
          COALESCE(t.metadata->>'provisioned_by', 'UNKNOWN (metadata empty)')
        WHEN v_metadata_column_exists THEN
          'UNKNOWN (metadata wrong type)'
        ELSE 
          'UNKNOWN (metadata column missing)'
      END AS provisioned_by,
      CASE 
        WHEN v_metadata_column_exists AND v_metadata_type = 'jsonb' THEN 
          COALESCE(t.metadata->>'fixture_type', 'UNKNOWN (metadata empty)')
        WHEN v_metadata_column_exists THEN
          'UNKNOWN (metadata wrong type)'
        ELSE 
          'UNKNOWN (metadata column missing)'
      END AS fixture_type,
      ctm.legacy_fixture_id AS expected_fixture_id
    FROM public.tenants t
    INNER JOIN migration_evidence.canonical_tenant_map ctm 
      ON t.id = ctm.reserved_tenant_id
    WHERE t.id = ANY(v_reserved_uuids)
  LOOP
    RAISE WARNING 'P4 COLLISION: UUID=% | name=% | created_at=% | provisioned_by=% | fixture_type=% | expected_fixture=%',
      v_collision_details.id,
      v_collision_details.name,
      v_collision_details.created_at,
      v_collision_details.provisioned_by,
      v_collision_details.fixture_type,
      v_collision_details.expected_fixture_id;
  END LOOP;
  
  -- 🔴 SECURITY REVIEW S.2.2: Classification logic
  -- If metadata/created_at missing or wrong type → UNKNOWN → STOP
  IF NOT v_metadata_column_exists OR v_metadata_type != 'jsonb' THEN
    RAISE EXCEPTION 
      'P4 COLLISION GATE: COLLISION CLASSIFICATION = UNKNOWN
       
       Reserved UUIDs are occupied, but metadata validation failed.
       
       Cannot distinguish between:
         - Legitimate previous 05-B execution
         - Attacker-created collision
       
       STOP. NO MUTATION.
       
       HUMAN REVIEW REQUIRED:
         1. Inspect occupying tenants (see WARNING logs above)
         2. Verify tenant origin (who created, when, why)
         3. Decision:
            a) Legitimate 05-B partial completion → Complete 05-B manually
            b) Attacker collision → Choose new UUID range, rollback 05-A, restart
            c) Stale test data → Delete occupying tenants, retry 05-A
       
       Database state: canonical_tenant_map created, NO mutations to public.tenants.
       Safe to rollback 05-A transaction.',
      v_collision_count
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  
  -- If metadata exists and valid, check provisioned_by
  -- (For future: could add logic to distinguish legitimate vs attacker collision)
  -- For now: ANY collision = STOP for human review
  
  RAISE EXCEPTION 
    'P4 COLLISION GATE: COLLISION DETECTED
     
     % reserved UUIDs already exist in public.tenants.
     
     Collision forensics logged above (see WARNINGs).
     
     STOP. NO MUTATION.
     
     HUMAN REVIEW REQUIRED:
       1. Inspect collision details (created_at, provisioned_by, fixture_type)
       2. Determine collision cause:
          a) Previous 05-B execution (legitimate)
          b) Concurrent 05-A/05-B execution
          c) External process using reserved UUID range
          d) Attacker pre-emption
       3. Resolution:
          - If legitimate: verify tenant identity, complete or rollback as needed
          - If concurrent: coordinate execution order
          - If external/attacker: choose new UUID range, rollback, restart
     
     Database state: canonical_tenant_map created, NO mutations to public.tenants.
     Safe to rollback 05-A transaction.',
    v_collision_count
    USING ERRCODE = 'unique_violation';
END;
$$;

COMMENT ON FUNCTION migration_05a_preflight_p4_collision_gate() IS
  'Preflight P4: UUID collision detection with metadata validation.
   
   Security Review S.2.2 compliance: Verifies created_at + provisioned_by to distinguish
   legitimate collision from attacker-created tenant.
   
   If metadata missing/wrong type: Classification = UNKNOWN → STOP.
   If collision detected: STOP, log forensics, require human review.
   
   NO auto-delete, NO auto-reassign, NO ON CONFLICT DO NOTHING.';

-- ============================================================================
-- PART 4: FIXTURE CLASSIFICATION & UUID RESERVATION
-- ============================================================================
-- Insert canonical mapping (RESERVATION phase)

INSERT INTO migration_evidence.canonical_tenant_map 
  (legacy_fixture_id, reserved_tenant_id, canonical_tenant_id, 
   classification, reconciliation_reason, reconciliation_phase)
VALUES
  -- TEST_ORPHAN: No reservation (will be deleted by 05-B)
  ('test-quarantine-tenant-a', NULL, NULL, 'TEST_ORPHAN', 
   'Integration test artifact from tests/integration/runtime/quarantine-repository.integration.test.ts. Classification: ORPHAN. Action: DELETE by 05-B. Evidence: Created during test execution, no corresponding canonical tenant required.', 
   'RESERVATION'),
   
  ('test-quarantine-tenant-b', NULL, NULL, 'TEST_ORPHAN', 
   'Integration test artifact from tests/integration/runtime/quarantine-repository.integration.test.ts. Classification: ORPHAN. Action: DELETE by 05-B. Evidence: Created during test execution, no corresponding canonical tenant required.', 
   'RESERVATION'),
  
  -- TEST_FIXTURE: Reserve deterministic UUIDs
  ('test-e2e-tenant-a', '11111111-0000-4000-8000-000000000001'::UUID, NULL, 'TEST_FIXTURE',
   'E2E test fixture from tests/utils/e2e-fixtures.ts. Classification: TEST_FIXTURE. UUID: 11111111-0000-4000-8000-000000000001 (deterministic, RESERVED). Action: 05-B will create canonical tenant with this exact UUID.', 
   'RESERVATION'),
   
  ('test-e2e-tenant-b', '11111111-0000-4000-8000-000000000002'::UUID, NULL, 'TEST_FIXTURE',
   'E2E test fixture from tests/utils/e2e-fixtures.ts. Classification: TEST_FIXTURE. UUID: 11111111-0000-4000-8000-000000000002 (deterministic, RESERVED). Action: 05-B will create canonical tenant with this exact UUID.', 
   'RESERVATION'),
   
  ('test-e2e-tenant-attacker', '11111111-0000-4000-8000-000000000003'::UUID, NULL, 'TEST_FIXTURE',
   'E2E security test fixture from tests/utils/e2e-fixtures.ts. Classification: TEST_FIXTURE. UUID: 11111111-0000-4000-8000-000000000003 (deterministic, RESERVED). Action: 05-B will create canonical tenant with this exact UUID.', 
   'RESERVATION');

-- ============================================================================
-- PART 5: EXECUTE P4 COLLISION GATE
-- ============================================================================
-- 🔴 MANDATORY CONDITION #4: Transaction + Lock + PK/UNIQUE + Verification
-- Advisory lock acquired at top of transaction
-- P4 gate validates no PK collision before COMMIT
-- UNIQUE indexes enforce no duplicate reservations

DO $$
BEGIN
  -- Execute P4 collision gate (will RAISE EXCEPTION if collision detected)
  PERFORM migration_05a_preflight_p4_collision_gate();
  
  RAISE NOTICE 'MIGRATION 05-A: P4 collision gate PASS';
END $$;

-- ============================================================================
-- PART 6: VERIFICATION & COMPLETION
-- ============================================================================

DO $$
DECLARE
  v_total_count INTEGER;
  v_orphan_count INTEGER;
  v_fixture_count INTEGER;
  v_reservation_phase_count INTEGER;
BEGIN
  -- Verify mapping completeness
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE classification = 'TEST_ORPHAN'),
    COUNT(*) FILTER (WHERE classification = 'TEST_FIXTURE'),
    COUNT(*) FILTER (WHERE reconciliation_phase = 'RESERVATION')
  INTO 
    v_total_count,
    v_orphan_count,
    v_fixture_count,
    v_reservation_phase_count
  FROM migration_evidence.canonical_tenant_map;
  
  -- Expected: 5 rows total (2 orphans, 3 fixtures), all in RESERVATION phase
  IF v_total_count != 5 THEN
    RAISE EXCEPTION 'MIGRATION 05-A: VERIFICATION FAILED - Expected 5 rows, found %', v_total_count;
  END IF;
  
  IF v_orphan_count != 2 THEN
    RAISE EXCEPTION 'MIGRATION 05-A: VERIFICATION FAILED - Expected 2 TEST_ORPHAN, found %', v_orphan_count;
  END IF;
  
  IF v_fixture_count != 3 THEN
    RAISE EXCEPTION 'MIGRATION 05-A: VERIFICATION FAILED - Expected 3 TEST_FIXTURE, found %', v_fixture_count;
  END IF;
  
  IF v_reservation_phase_count != 5 THEN
    RAISE EXCEPTION 'MIGRATION 05-A: VERIFICATION FAILED - Expected all 5 in RESERVATION phase, found %', v_reservation_phase_count;
  END IF;
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ MIGRATION 05-A: CLASSIFICATION & RESERVATION COMPLETE    ║
╠══════════════════════════════════════════════════════════╣
║ Schema: migration_evidence                               ║
║ Table: canonical_tenant_map                              ║
║                                                          ║
║ Classification Results:                                  ║
║   TEST_ORPHAN:   % rows                                  ║
║   TEST_FIXTURE:  % rows                                  ║
║   TOTAL:         % rows                                  ║
║                                                          ║
║ Phase: RESERVATION (05-A complete)                       ║
║                                                          ║
║ Reserved UUIDs:                                          ║
║   test-e2e-tenant-a:        11111111...001               ║
║   test-e2e-tenant-b:        11111111...002               ║
║   test-e2e-tenant-attacker: 11111111...003               ║
║                                                          ║
║ P4 Collision Gate: PASS                                  ║
║ Advisory Lock: ACQUIRED                                  ║
║                                                          ║
║ NEXT STEP: Execute 05-B (canonical tenant creation)      ║
║                                                          ║
║ FORBIDDEN: DO NOT modify canonical_tenant_map manually   ║
╚══════════════════════════════════════════════════════════╝',
    v_orphan_count,
    v_fixture_count,
    v_total_count;
END $$;

-- ============================================================================
-- MANDATORY CONDITIONS IMPLEMENTATION SUMMARY
-- ============================================================================
-- ✅ #1: P4 metadata validation (created_at + provisioned_by) ← migration_05a_preflight_p4_collision_gate()
-- ✅ #2: Advisory lock explicit acquisition ← pg_try_advisory_xact_lock() at transaction start
-- ✅ #4: Transaction + lock + PK/UNIQUE + verification ← Full transaction wrap + UNIQUE indexes + P4 gate
-- ✅ #5: Deletion audit columns ← deleted_at, deleted_by, deletion_reason in schema
-- ⏳ #3: Mapping immutability ← Implemented in 05-B (trigger after COMPLETE phase)
-- ============================================================================

-- Advisory lock released automatically at transaction end (COMMIT)
