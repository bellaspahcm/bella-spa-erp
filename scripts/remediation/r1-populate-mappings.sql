-- ==============================================================================
-- E0.1A-R1.2 — POPULATE IDENTITY MAPPINGS
-- ==============================================================================
-- Purpose: Insert 848 person → party mappings with CREATE_NEW_PARTY strategy
-- Prerequisites: R1.1 complete (table created), R0 census complete
-- Blast Radius: Platform-wide (Education, HR, Real Estate)
-- ==============================================================================

-- ==============================================================================
-- R1.2 — INSERT MAPPINGS
-- ==============================================================================

INSERT INTO identity_migration_mapping (
  person_id,
  party_id,
  tenant_id,
  strategy,
  match_evidence,
  status
)
SELECT 
  id AS person_id,
  id AS party_id,  -- Same UUID (0 collisions verified in R0.3)
  tenant_id,
  'CREATE_NEW_PARTY' AS strategy,
  jsonb_build_object(
    'reason', 'no_existing_party',
    'collision_check', 'pass',
    'r0_census_date', '2026-09-12',
    'persons_total', 848,
    'uuid_collisions', 0,
    'deterministic_duplicates', 0,
    'data_quality_missing_name_pct', 0.00,
    'data_quality_missing_dob_pct', 0.00
  ) AS match_evidence,
  'planned' AS status
FROM persons
ORDER BY created_at;

-- Expected: INSERT 0 848

-- ==============================================================================
-- R1.3 — RECONCILIATION QUERIES
-- ==============================================================================

-- 1. Total mapping count
SELECT COUNT(*) AS total_mappings
FROM identity_migration_mapping;
-- Expected: 848

-- 2. Unmapped persons
SELECT COUNT(*) AS unmapped_persons
FROM persons p
LEFT JOIN identity_migration_mapping m ON p.id = m.person_id
WHERE m.person_id IS NULL;
-- Expected: 0

-- 3. Duplicate party_id mappings (should be ZERO)
SELECT party_id, COUNT(*) AS duplicate_count
FROM identity_migration_mapping
GROUP BY party_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 4. Strategy distribution
SELECT strategy, COUNT(*) AS count, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM identity_migration_mapping
GROUP BY strategy
ORDER BY count DESC;
-- Expected: CREATE_NEW_PARTY | 848 | 100.00

-- 5. Status distribution
SELECT status, COUNT(*) AS count
FROM identity_migration_mapping
GROUP BY status
ORDER BY count DESC;
-- Expected: planned | 848

-- 6. Tenant coverage (all tenants should be 100% mapped)
SELECT 
  tenant_id,
  persons_count,
  mapped_count,
  CASE 
    WHEN persons_count = mapped_count THEN '✅ 100%'
    ELSE '❌ INCOMPLETE'
  END AS coverage
FROM (
  SELECT 
    COALESCE(p.tenant_id, m.tenant_id) AS tenant_id,
    COUNT(DISTINCT p.id) AS persons_count,
    COUNT(DISTINCT m.person_id) AS mapped_count
  FROM persons p
  FULL OUTER JOIN identity_migration_mapping m ON p.id = m.person_id
  GROUP BY COALESCE(p.tenant_id, m.tenant_id)
) tenant_stats
WHERE persons_count != mapped_count;
-- Expected: 0 rows (all tenants 100% mapped)

-- 7. Sample mappings (verify evidence structure)
SELECT 
  person_id,
  party_id,
  tenant_id,
  strategy,
  match_evidence->>'reason' AS reason,
  match_evidence->>'collision_check' AS collision_check,
  status,
  created_at
FROM identity_migration_mapping
ORDER BY created_at
LIMIT 10;

-- ==============================================================================
-- R1.3 PASS CRITERIA SUMMARY
-- ==============================================================================

WITH reconciliation_summary AS (
  SELECT 
    (SELECT COUNT(*) FROM identity_migration_mapping) AS total_mappings,
    (SELECT COUNT(*) FROM persons p LEFT JOIN identity_migration_mapping m ON p.id = m.person_id WHERE m.person_id IS NULL) AS unmapped_persons,
    (SELECT COUNT(*) FROM (SELECT party_id FROM identity_migration_mapping GROUP BY party_id HAVING COUNT(*) > 1) duplicates) AS duplicate_party_mappings,
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE strategy = 'CREATE_NEW_PARTY') AS create_new_party_count,
    (SELECT COUNT(DISTINCT tenant_id) FROM persons) AS total_tenants,
    (SELECT COUNT(DISTINCT tenant_id) FROM identity_migration_mapping) AS mapped_tenants
)
SELECT 
  total_mappings,
  unmapped_persons,
  duplicate_party_mappings,
  create_new_party_count,
  ROUND(create_new_party_count * 100.0 / total_mappings, 2) AS create_new_party_pct,
  total_tenants,
  mapped_tenants,
  CASE 
    WHEN total_mappings = 848 
     AND unmapped_persons = 0 
     AND duplicate_party_mappings = 0 
     AND create_new_party_count = 848 
     AND total_tenants = mapped_tenants 
    THEN '✅ R1.3 PASS'
    ELSE '❌ R1.3 FAIL'
  END AS r1_3_status
FROM reconciliation_summary;

-- Expected output:
-- total_mappings: 848
-- unmapped_persons: 0
-- duplicate_party_mappings: 0
-- create_new_party_count: 848
-- create_new_party_pct: 100.00
-- total_tenants: 307
-- mapped_tenants: 307
-- r1_3_status: ✅ R1.3 PASS

-- ==============================================================================
-- END R1.2 + R1.3
-- ==============================================================================
