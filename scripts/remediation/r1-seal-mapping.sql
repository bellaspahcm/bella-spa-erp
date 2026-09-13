-- ==============================================================================
-- E0.1A-R1.4 — SEAL MAPPING SNAPSHOT
-- ==============================================================================
-- Purpose: Mark mapping evidence as immutable after reconciliation passes
-- Prerequisites: R1.3 PASS (848 mappings, 0 unmapped, 0 duplicates)
-- Blast Radius: Platform-wide (Education, HR, Real Estate)
-- ==============================================================================

-- ==============================================================================
-- PRE-SEAL VERIFICATION
-- ==============================================================================

-- Verify R1.3 reconciliation before sealing
DO $$
DECLARE
  v_total_mappings INT;
  v_unmapped_persons INT;
  v_duplicate_mappings INT;
  v_create_new_party_count INT;
BEGIN
  SELECT COUNT(*) INTO v_total_mappings FROM identity_migration_mapping;
  SELECT COUNT(*) INTO v_unmapped_persons 
    FROM persons p 
    LEFT JOIN identity_migration_mapping m ON p.id = m.person_id 
    WHERE m.person_id IS NULL;
  SELECT COUNT(*) INTO v_duplicate_mappings 
    FROM (SELECT party_id FROM identity_migration_mapping GROUP BY party_id HAVING COUNT(*) > 1) dup;
  SELECT COUNT(*) INTO v_create_new_party_count 
    FROM identity_migration_mapping WHERE strategy = 'CREATE_NEW_PARTY';
  
  -- Validation checks
  IF v_total_mappings != 848 THEN
    RAISE EXCEPTION 'R1.3 FAIL: Expected 848 mappings, found %', v_total_mappings;
  END IF;
  
  IF v_unmapped_persons != 0 THEN
    RAISE EXCEPTION 'R1.3 FAIL: Found % unmapped persons', v_unmapped_persons;
  END IF;
  
  IF v_duplicate_mappings != 0 THEN
    RAISE EXCEPTION 'R1.3 FAIL: Found % duplicate party_id mappings', v_duplicate_mappings;
  END IF;
  
  IF v_create_new_party_count != 848 THEN
    RAISE EXCEPTION 'R1.3 FAIL: Expected 848 CREATE_NEW_PARTY, found %', v_create_new_party_count;
  END IF;
  
  RAISE NOTICE '✅ R1.3 PASS: All reconciliation checks passed';
  RAISE NOTICE 'Total mappings: %', v_total_mappings;
  RAISE NOTICE 'Unmapped persons: %', v_unmapped_persons;
  RAISE NOTICE 'Duplicate mappings: %', v_duplicate_mappings;
  RAISE NOTICE 'CREATE_NEW_PARTY: %', v_create_new_party_count;
END $$;

-- ==============================================================================
-- R1.4 — SEAL MAPPING EVIDENCE
-- ==============================================================================

-- Mark all mappings as evidence-sealed
UPDATE identity_migration_mapping
SET sealed_at = NOW()
WHERE status = 'planned' AND sealed_at IS NULL;

-- Expected: UPDATE 848

-- ==============================================================================
-- POST-SEAL VERIFICATION
-- ==============================================================================

-- Verify seal integrity
SELECT 
  COUNT(*) AS sealed_mappings,
  COUNT(*) FILTER (WHERE sealed_at IS NOT NULL) AS with_seal_timestamp,
  MIN(sealed_at) AS first_sealed,
  MAX(sealed_at) AS last_sealed,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE sealed_at IS NOT NULL) AND COUNT(*) = 848
    THEN '✅ SEAL COMPLETE'
    ELSE '❌ SEAL INCOMPLETE'
  END AS seal_status
FROM identity_migration_mapping;

-- Expected:
-- sealed_mappings: 848
-- with_seal_timestamp: 848
-- first_sealed: 2026-09-12T...
-- last_sealed: 2026-09-12T...
-- seal_status: ✅ SEAL COMPLETE

-- ==============================================================================
-- EXPORT EVIDENCE (for backup/audit)
-- ==============================================================================

-- Generate CSV export command (run manually in psql)
SELECT '
-- ==============================================================================
-- MANUAL STEP: Export mapping evidence as CSV backup
-- ==============================================================================

-- Run this command in your terminal (NOT in psql):

psql $DATABASE_EXECUTOR_URL -c "
COPY (
  SELECT 
    person_id,
    party_id,
    tenant_id,
    strategy,
    match_evidence::text AS match_evidence,
    status,
    created_at,
    sealed_at
  FROM identity_migration_mapping
  ORDER BY created_at
) TO STDOUT WITH CSV HEADER
" > evidence/E0.1A-R1-identity-mapping-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '.csv

-- Expected: 848 rows exported to evidence/ directory
' AS export_command;

-- ==============================================================================
-- R1.4 COMPLETION SUMMARY
-- ==============================================================================

WITH completion_summary AS (
  SELECT 
    (SELECT COUNT(*) FROM identity_migration_mapping) AS total_mappings,
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE sealed_at IS NOT NULL) AS sealed_mappings,
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE strategy = 'CREATE_NEW_PARTY') AS create_new_party,
    (SELECT COUNT(*) FROM persons p LEFT JOIN identity_migration_mapping m ON p.id = m.person_id WHERE m.person_id IS NULL) AS unmapped_persons,
    (SELECT COUNT(*) FROM (SELECT party_id FROM identity_migration_mapping GROUP BY party_id HAVING COUNT(*) > 1) dup) AS duplicate_mappings,
    (SELECT COUNT(DISTINCT tenant_id) FROM identity_migration_mapping) AS mapped_tenants,
    (SELECT MIN(sealed_at) FROM identity_migration_mapping) AS sealed_timestamp
)
SELECT 
  '✅ R1.1 — Mapping table created' AS step_1,
  '✅ R1.2 — ' || total_mappings || ' mappings populated' AS step_2,
  '✅ R1.3 — Reconciliation PASS (' || unmapped_persons || ' unmapped, ' || duplicate_mappings || ' duplicates)' AS step_3,
  '✅ R1.4 — Evidence sealed at ' || sealed_timestamp AS step_4,
  CASE 
    WHEN total_mappings = 848 
     AND sealed_mappings = 848 
     AND create_new_party = 848 
     AND unmapped_persons = 0 
     AND duplicate_mappings = 0 
    THEN '🎉 R1 IDENTITY MAPPING COMPLETE'
    ELSE '❌ R1 INCOMPLETE'
  END AS r1_status
FROM completion_summary;

-- ==============================================================================
-- NEXT STEPS
-- ==============================================================================

SELECT '
-- ==============================================================================
-- R1 COMPLETE ✅
-- ==============================================================================

R1.1 Mapping table created          ✅
R1.2 848 mappings populated          ✅
R1.3 Reconciliation PASS             ✅
R1.4 Evidence sealed                 ✅

-- ==============================================================================
-- BLOCKERS FOR R2 (Party Backfill)
-- ==============================================================================

R0.6 Write-Path Census               🔴 REQUIRED
R0.7 Contract/Caller Census          🔴 REQUIRED

CANNOT proceed to R2 Data Migration until R0.6 + R0.7 complete.

-- ==============================================================================
-- NEXT: R0.6 Write-Path Census
-- ==============================================================================

Execute: scripts/remediation/r0-write-path-census.ts

' AS next_steps;

-- ==============================================================================
-- END R1.4
-- ==============================================================================
