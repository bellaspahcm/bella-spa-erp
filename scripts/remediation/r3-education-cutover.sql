-- ==============================================================================
-- E0.1A-R3 — EDUCATION CUTOVER (AUTHORIZED)
-- ==============================================================================
-- Purpose: Migrate students FK from person_id to party_id
-- Scope: Staged cutover (NO person_id drop/rename yet)
-- Prerequisites: R2 sealed (848 parties created)
-- ==============================================================================

-- ==============================================================================
-- PRE-EXECUTION VALIDATION
-- ==============================================================================

DO $$
DECLARE
  v_person_parties INT;
  v_mapped_parties INT;
  v_students_with_person_id INT;
BEGIN
  -- Verify R2 mapped parties exist
  SELECT COUNT(*) INTO v_mapped_parties
  FROM party_parties pp
  WHERE pp.id IN (SELECT party_id FROM identity_migration_mapping WHERE status = 'party_created');
  
  SELECT COUNT(*) INTO v_person_parties
  FROM party_parties
  WHERE party_type = 'person';
  
  IF v_mapped_parties != 848 THEN
    RAISE EXCEPTION 'R3 BLOCKED: Expected 848 mapped parties, found %', v_mapped_parties;
  END IF;
  
  -- Verify students have person_id
  SELECT COUNT(*) INTO v_students_with_person_id
  FROM students
  WHERE person_id IS NOT NULL;
  
  RAISE NOTICE '✅ PRE-EXECUTION: % mapped parties (% total person-type), % students with person_id', v_mapped_parties, v_person_parties, v_students_with_person_id;
END $$;

-- ==============================================================================
-- R3.1 — ADD students.party_id (NULLABLE)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'party_id'
  ) THEN
    ALTER TABLE students ADD COLUMN party_id UUID;
    RAISE NOTICE '✅ R3.1: Added students.party_id column';
  ELSE
    RAISE NOTICE '⏭️  R3.1: students.party_id already exists (idempotent)';
  END IF;
END $$;

-- ==============================================================================
-- R3.2 — BACKFILL party_id from sealed R1 mapping
-- ==============================================================================

UPDATE students s
SET party_id = m.party_id
FROM identity_migration_mapping m
WHERE s.person_id = m.person_id
  AND s.party_id IS NULL;  -- Idempotent

-- ==============================================================================
-- R3.3 — VERIFY student mappings
-- ==============================================================================

WITH verification AS (
  SELECT 
    COUNT(*) as total_students,
    COUNT(person_id) as with_person_id,
    COUNT(party_id) as with_party_id,
    COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id
  FROM students
)
SELECT 
  'R3.3 VERIFICATION' as check_name,
  total_students,
  with_person_id,
  with_party_id,
  missing_party_id,
  CASE 
    WHEN missing_party_id = 0 AND with_party_id = with_person_id
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
FROM verification;

-- ==============================================================================
-- R3.4 — ADD FK students.party_id → party_parties(id)
-- ==============================================================================

DO $$
BEGIN
  -- Add FK constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'students_party_id_fkey'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_party_id_fkey
    FOREIGN KEY (party_id) REFERENCES party_parties(id);
    
    RAISE NOTICE '✅ R3.4: Added FK students.party_id → party_parties(id)';
  ELSE
    RAISE NOTICE '⏭️  R3.4: FK students_party_id_fkey already exists';
  END IF;
END $$;

-- ==============================================================================
-- R3.5 — VERIFY FK integrity
-- ==============================================================================

SELECT 
  'R3.5 FK INTEGRITY' as check_name,
  COUNT(*) as total_students,
  COUNT(*) FILTER (WHERE party_id IS NOT NULL) as with_party_id,
  COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id,
  (
    SELECT COUNT(*)
    FROM students s
    LEFT JOIN party_parties pp ON s.party_id = pp.id
    WHERE s.party_id IS NOT NULL AND pp.id IS NULL
  ) as orphan_party_refs,
  CASE 
    WHEN COUNT(*) FILTER (WHERE party_id IS NULL) = 0
     AND (SELECT COUNT(*) FROM students s LEFT JOIN party_parties pp ON s.party_id = pp.id WHERE s.party_id IS NOT NULL AND pp.id IS NULL) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
FROM students;

-- ==============================================================================
-- R3.6 — VERIFY tenant consistency
-- ==============================================================================

SELECT 
  'R3.6 TENANT CONSISTENCY' as check_name,
  COUNT(*) as total_students,
  COUNT(*) FILTER (
    WHERE s.tenant_id = pp.tenant_id
  ) as tenant_match,
  COUNT(*) FILTER (
    WHERE s.tenant_id != pp.tenant_id
  ) as tenant_mismatch,
  CASE 
    WHEN COUNT(*) FILTER (WHERE s.tenant_id != pp.tenant_id) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
FROM students s
JOIN party_parties pp ON s.party_id = pp.id;

-- ==============================================================================
-- R3.7 — VERIFY party_type = 'person'
-- ==============================================================================

SELECT 
  'R3.7 PARTY TYPE' as check_name,
  COUNT(*) as total_students,
  COUNT(*) FILTER (WHERE pp.party_type = 'person') as correct_type,
  COUNT(*) FILTER (WHERE pp.party_type != 'person') as wrong_type,
  CASE 
    WHEN COUNT(*) FILTER (WHERE pp.party_type != 'person') = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
FROM students s
JOIN party_parties pp ON s.party_id = pp.id;

-- ==============================================================================
-- R3.8 — MAKE party_id AUTHORITATIVE (Optional: can defer to R4)
-- ==============================================================================

-- NOT NULL constraint (if ready)
-- ALTER TABLE students ALTER COLUMN party_id SET NOT NULL;

-- Note: Deferred to after R4 caller migration + R6 verification
-- For now, party_id is populated but person_id remains for compatibility

-- ==============================================================================
-- R3 SUMMARY
-- ==============================================================================

WITH r3_summary AS (
  SELECT 
    (SELECT COUNT(*) FROM students) as total_students,
    (SELECT COUNT(*) FROM students WHERE person_id IS NOT NULL) as with_person_id,
    (SELECT COUNT(*) FROM students WHERE party_id IS NOT NULL) as with_party_id,
    (SELECT COUNT(*) FROM students WHERE party_id IS NULL) as missing_party_id,
    (SELECT COUNT(*) FROM students s LEFT JOIN party_parties pp ON s.party_id = pp.id WHERE s.party_id IS NOT NULL AND pp.id IS NULL) as orphan_refs,
    (SELECT COUNT(*) FROM students s JOIN party_parties pp ON s.party_id = pp.id WHERE s.tenant_id != pp.tenant_id) as tenant_mismatch,
    (SELECT COUNT(*) FROM students s JOIN party_parties pp ON s.party_id = pp.id WHERE pp.party_type != 'person') as wrong_type
)
SELECT 
  '═══════════════════════════════════════════════════════════════' as separator
UNION ALL
SELECT 'R3 EDUCATION CUTOVER SUMMARY'
UNION ALL
SELECT '═══════════════════════════════════════════════════════════════'
UNION ALL
SELECT 'Total Students: ' || total_students FROM r3_summary
UNION ALL
SELECT 'With person_id (legacy): ' || with_person_id FROM r3_summary
UNION ALL
SELECT 'With party_id (new): ' || with_party_id FROM r3_summary
UNION ALL
SELECT 'Missing party_id: ' || missing_party_id FROM r3_summary
UNION ALL
SELECT 'Orphan Party refs: ' || orphan_refs FROM r3_summary
UNION ALL
SELECT 'Tenant mismatches: ' || tenant_mismatch FROM r3_summary
UNION ALL
SELECT 'Wrong party_type: ' || wrong_type FROM r3_summary
UNION ALL
SELECT '═══════════════════════════════════════════════════════════════'
UNION ALL
SELECT 
  CASE 
    WHEN missing_party_id = 0 
     AND orphan_refs = 0
     AND tenant_mismatch = 0
     AND wrong_type = 0
    THEN '🎉 R3 DATABASE CUTOVER: ✅ PASS'
    ELSE '❌ R3 DATABASE CUTOVER: 🔴 FAIL'
  END
FROM r3_summary;

-- ==============================================================================
-- END R3 DATABASE MIGRATION
-- ==============================================================================
-- NEXT: R3.5–R3.7 (Code changes: StudentService + Contract)
-- ==============================================================================
