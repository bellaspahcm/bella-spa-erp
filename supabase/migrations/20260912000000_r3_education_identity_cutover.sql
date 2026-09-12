-- ==============================================================================
-- E0.1A-R3 EDUCATION IDENTITY CUTOVER
-- ==============================================================================
-- Migration: Person → Party for Education students
-- Remediation: E0.1A-R Identity Migration
-- Phase: R3 Database Cutover
-- Prerequisites: R2 SEALED (848 party_parties created)
-- ==============================================================================
-- Author: Bella Platform Team
-- Date: 2026-09-12
-- Evidence: docs/products/bella-english-center/R3_EXECUTION_PLAN.md
-- ==============================================================================

-- ==============================================================================
-- PRE-EXECUTION VALIDATION
-- ==============================================================================

DO $$
DECLARE
  v_mapped_parties INT;
  v_students_with_person_id INT;
BEGIN
  -- Verify R2 sealed mapping exists
  SELECT COUNT(*) INTO v_mapped_parties
  FROM identity_migration_mapping
  WHERE status = 'party_created' AND sealed_at IS NOT NULL;
  
  IF v_mapped_parties != 848 THEN
    RAISE EXCEPTION 'R3 PRE-FLIGHT FAIL: Expected 848 sealed mappings, found %', v_mapped_parties;
  END IF;
  
  -- Verify students have person_id
  SELECT COUNT(*) INTO v_students_with_person_id
  FROM students
  WHERE person_id IS NOT NULL;
  
  RAISE NOTICE '✅ PRE-FLIGHT: % sealed mappings, % students with person_id',
    v_mapped_parties, v_students_with_person_id;
END $$;

-- ==============================================================================
-- R3.1 — ADD students.party_id COLUMN (NULLABLE)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'party_id'
  ) THEN
    ALTER TABLE students ADD COLUMN party_id UUID;
    RAISE NOTICE '✅ R3.1: Added students.party_id column';
  ELSE
    RAISE NOTICE '⏭️  R3.1: students.party_id already exists (idempotent)';
  END IF;
END $$;

-- ==============================================================================
-- R3.2 — BACKFILL party_id FROM SEALED R1 MAPPING
-- ==============================================================================

UPDATE students s
SET party_id = m.party_id,
    updated_at = NOW()
FROM identity_migration_mapping m
WHERE s.person_id = m.person_id
  AND s.party_id IS NULL  -- Idempotent guard
  AND m.status = 'party_created'
  AND m.sealed_at IS NOT NULL;

-- ==============================================================================
-- R3.3 — VERIFY STUDENT MAPPINGS
-- ==============================================================================

DO $$
DECLARE
  v_total INT;
  v_with_person_id INT;
  v_with_party_id INT;
  v_missing_party_id INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(person_id),
    COUNT(party_id),
    COUNT(*) FILTER (WHERE party_id IS NULL)
  INTO v_total, v_with_person_id, v_with_party_id, v_missing_party_id
  FROM students;
  
  IF v_missing_party_id > 0 THEN
    RAISE EXCEPTION 'R3.3 FAIL: % students missing party_id', v_missing_party_id;
  END IF;
  
  IF v_with_party_id != v_with_person_id THEN
    RAISE EXCEPTION 'R3.3 FAIL: party_id count (%) != person_id count (%)',
      v_with_party_id, v_with_person_id;
  END IF;
  
  RAISE NOTICE '✅ R3.3: PASS — %/% students have party_id',
    v_with_party_id, v_total;
END $$;

-- ==============================================================================
-- R3.4 — ADD FK students.party_id → party_parties(id)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'students'
      AND constraint_name = 'students_party_id_fkey'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_party_id_fkey
    FOREIGN KEY (party_id)
    REFERENCES party_parties(id)
    ON DELETE RESTRICT;
    
    RAISE NOTICE '✅ R3.4: Added FK students.party_id → party_parties(id)';
  ELSE
    RAISE NOTICE '⏭️  R3.4: FK students_party_id_fkey already exists';
  END IF;
END $$;

-- ==============================================================================
-- R3.5 — VERIFY FK INTEGRITY
-- ==============================================================================

DO $$
DECLARE
  v_orphan_refs INT;
BEGIN
  SELECT COUNT(*)
  INTO v_orphan_refs
  FROM students s
  LEFT JOIN party_parties pp ON s.party_id = pp.id
  WHERE s.party_id IS NOT NULL AND pp.id IS NULL;
  
  IF v_orphan_refs > 0 THEN
    RAISE EXCEPTION 'R3.5 FAIL: % orphan party_id references', v_orphan_refs;
  END IF;
  
  RAISE NOTICE '✅ R3.5: PASS — 0 orphan party_id references';
END $$;

-- ==============================================================================
-- R3.6 — VERIFY TENANT CONSISTENCY
-- ==============================================================================

DO $$
DECLARE
  v_tenant_mismatch INT;
BEGIN
  SELECT COUNT(*)
  INTO v_tenant_mismatch
  FROM students s
  JOIN party_parties pp ON s.party_id = pp.id
  WHERE s.tenant_id != pp.tenant_id;
  
  IF v_tenant_mismatch > 0 THEN
    RAISE EXCEPTION 'R3.6 FAIL: % tenant mismatches (students vs party)', v_tenant_mismatch;
  END IF;
  
  RAISE NOTICE '✅ R3.6: PASS — 0 tenant mismatches';
END $$;

-- ==============================================================================
-- R3.7 — VERIFY PARTY_TYPE = 'person'
-- ==============================================================================

DO $$
DECLARE
  v_wrong_type INT;
BEGIN
  SELECT COUNT(*)
  INTO v_wrong_type
  FROM students s
  JOIN party_parties pp ON s.party_id = pp.id
  WHERE pp.party_type != 'person';
  
  IF v_wrong_type > 0 THEN
    RAISE EXCEPTION 'R3.7 FAIL: % students linked to non-person party', v_wrong_type;
  END IF;
  
  RAISE NOTICE '✅ R3.7: PASS — All students linked to party_type=person';
END $$;

-- ==============================================================================
-- R3.8 — CREATE INDEX FOR PERFORMANCE
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND indexname = 'idx_students_party_id'
  ) THEN
    CREATE INDEX idx_students_party_id ON students(party_id);
    RAISE NOTICE '✅ R3.8: Created index idx_students_party_id';
  ELSE
    RAISE NOTICE '⏭️  R3.8: Index idx_students_party_id already exists';
  END IF;
END $$;

-- ==============================================================================
-- R3 FINAL SUMMARY
-- ==============================================================================

DO $$
DECLARE
  v_total INT;
  v_with_person_id INT;
  v_with_party_id INT;
  v_missing_party_id INT;
  v_orphan_refs INT;
  v_tenant_mismatch INT;
  v_wrong_type INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(person_id),
    COUNT(party_id),
    COUNT(*) FILTER (WHERE party_id IS NULL)
  INTO v_total, v_with_person_id, v_with_party_id, v_missing_party_id
  FROM students;
  
  SELECT COUNT(*)
  INTO v_orphan_refs
  FROM students s
  LEFT JOIN party_parties pp ON s.party_id = pp.id
  WHERE s.party_id IS NOT NULL AND pp.id IS NULL;
  
  SELECT COUNT(*)
  INTO v_tenant_mismatch
  FROM students s
  JOIN party_parties pp ON s.party_id = pp.id
  WHERE s.tenant_id != pp.tenant_id;
  
  SELECT COUNT(*)
  INTO v_wrong_type
  FROM students s
  JOIN party_parties pp ON s.party_id = pp.id
  WHERE pp.party_type != 'person';
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'R3 EDUCATION IDENTITY CUTOVER — DATABASE MIGRATION COMPLETE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total Students:           %', v_total;
  RAISE NOTICE 'With person_id (legacy):  %', v_with_person_id;
  RAISE NOTICE 'With party_id (new):      %', v_with_party_id;
  RAISE NOTICE 'Missing party_id:         %', v_missing_party_id;
  RAISE NOTICE 'Orphan Party refs:        %', v_orphan_refs;
  RAISE NOTICE 'Tenant mismatches:        %', v_tenant_mismatch;
  RAISE NOTICE 'Wrong party_type:         %', v_wrong_type;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  IF v_missing_party_id = 0
     AND v_orphan_refs = 0
     AND v_tenant_mismatch = 0
     AND v_wrong_type = 0
  THEN
    RAISE NOTICE '🎉 R3 DATABASE CUTOVER: ✅ PASS';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Deploy R3 application code changes';
    RAISE NOTICE '  2. Update StudentService to validate Party';
    RAISE NOTICE '  3. Fix Contract implementation (partyId semantics)';
    RAISE NOTICE '  4. Run integration tests';
    RAISE NOTICE '  5. Run negative tests (no new Person creation)';
    RAISE NOTICE '  6. Verify R3.5–R3.7 pass';
    RAISE NOTICE '  7. Authorize R4 (Caller Migration)';
  ELSE
    RAISE EXCEPTION 'R3 DATABASE CUTOVER: 🔴 FAIL — See summary above';
  END IF;
END $$;

-- ==============================================================================
-- NOTES FOR APPLICATION DEPLOYMENT
-- ==============================================================================

-- R3 Database migration is COMPLETE at this point.
-- The following changes must be made in APPLICATION CODE (separate deployment):
--
-- R3.5 — StudentService Changes:
--   - validateStudentParty() — use party_id, not person_id
--   - getStudentByPartyId() — new query method
--   - Update Student entity loading to use party_id
--
-- R3.6 — Contract Implementation Fix:
--   - IEducationStudentContract.createStudent()
--     BEFORE: personId → persons.id
--     AFTER: partyId → party_parties.id
--   - Fix semantic drift: partyId input should map to party_id column
--
-- R3.7 — Integration Tests:
--   - Create new student → verify party_id populated, NO new persons row
--   - Load existing student → verify party_id matches person_id via mapping
--   - Update student → verify party_id unchanged
--   - Delete student → verify Party NOT deleted (referential integrity)
--
-- R3.8 — Negative Tests:
--   - Create student with invalid party_id → FK violation
--   - Create student without party_id → validation error (after NOT NULL)
--   - Verify NO new rows in persons table after student creation
--
-- COMPATIBILITY:
--   - person_id column RETAINED for now (dual-column transition)
--   - Legacy read paths still work (both person_id and party_id available)
--   - person_id can be deprecated/removed in R6 after full verification
--
-- ROLLBACK:
--   - DROP CONSTRAINT students_party_id_fkey;
--   - DROP INDEX idx_students_party_id;
--   - ALTER TABLE students DROP COLUMN party_id;
--   - Revert application code changes
--
-- ==============================================================================
-- END R3 DATABASE MIGRATION
-- ==============================================================================

