-- ==============================================================================
-- E0.1A-R2V — BACKFILL VERIFICATION GATE
-- ==============================================================================
-- Purpose: Verify R2 backfill before authorizing R3
-- Prerequisites: R2 complete
-- ==============================================================================

-- ==============================================================================
-- R2V.1 — MAPPING COVERAGE
-- ==============================================================================

SELECT 
  'R2V.1 — MAPPING COVERAGE' AS check_name,
  COUNT(*) FILTER (WHERE status = 'party_created') AS party_created,
  COUNT(*) FILTER (WHERE status = 'planned') AS still_planned,
  COUNT(*) FILTER (WHERE status NOT IN ('party_created', 'planned')) AS unexpected_status,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status = 'party_created') = 848 
     AND COUNT(*) FILTER (WHERE status = 'planned') = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping;

-- Expected: party_created=848, still_planned=0, unexpected_status=0

-- ==============================================================================
-- R2V.2 — PARTY EXISTENCE (Per-Record Verification)
-- ==============================================================================

SELECT 
  'R2V.2 — PARTY EXISTENCE' AS check_name,
  COUNT(*) AS total_mappings,
  COUNT(pp.id) AS parties_found,
  COUNT(*) - COUNT(pp.id) AS missing_parties,
  CASE 
    WHEN COUNT(*) = COUNT(pp.id) AND COUNT(*) = 848
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
LEFT JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created';

-- Expected: total_mappings=848, parties_found=848, missing_parties=0

-- ==============================================================================
-- R2V.3 — PARTY TYPE VALIDATION
-- ==============================================================================

SELECT 
  'R2V.3 — PARTY TYPE' AS check_name,
  COUNT(*) AS total_parties,
  COUNT(*) FILTER (WHERE pp.party_type = 'person') AS correct_type,
  COUNT(*) FILTER (WHERE pp.party_type != 'person') AS wrong_type,
  CASE 
    WHEN COUNT(*) FILTER (WHERE pp.party_type != 'person') = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created';

-- Expected: total_parties=848, correct_type=848, wrong_type=0

-- ==============================================================================
-- R2V.4 — TENANT CONSISTENCY
-- ==============================================================================

SELECT 
  'R2V.4 — TENANT CONSISTENCY' AS check_name,
  COUNT(*) AS total_mappings,
  COUNT(*) FILTER (WHERE p.tenant_id = pp.tenant_id) AS tenant_match,
  COUNT(*) FILTER (WHERE p.tenant_id != pp.tenant_id) AS tenant_mismatch,
  CASE 
    WHEN COUNT(*) FILTER (WHERE p.tenant_id != pp.tenant_id) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created';

-- Expected: total_mappings=848, tenant_match=848, tenant_mismatch=0

-- ==============================================================================
-- R2V.5 — UUID COLLISION CHECK
-- ==============================================================================

SELECT 
  'R2V.5 — UUID COLLISION' AS check_name,
  COUNT(*) AS collisions,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM persons p
INNER JOIN party_parties pp ON p.id = pp.id;

-- Expected: collisions=0 (person.id should NOT equal party.id because R1 mapping created unique party_id)

-- ==============================================================================
-- R2V.6 — DISPLAY NAME VALIDATION
-- ==============================================================================

SELECT 
  'R2V.6 — DISPLAY NAME' AS check_name,
  COUNT(*) AS total_parties,
  COUNT(*) FILTER (WHERE pp.display_name IS NOT NULL AND pp.display_name != '') AS valid_names,
  COUNT(*) FILTER (WHERE pp.display_name IS NULL OR pp.display_name = '') AS missing_names,
  CASE 
    WHEN COUNT(*) FILTER (WHERE pp.display_name IS NULL OR pp.display_name = '') = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created';

-- Expected: total_parties=848, valid_names=848, missing_names=0

-- ==============================================================================
-- R2V.7 — DOB PRESERVATION
-- ==============================================================================

SELECT 
  'R2V.7 — DOB PRESERVATION' AS check_name,
  COUNT(*) AS total_with_dob,
  COUNT(*) FILTER (WHERE p.date_of_birth = pp.dob) AS dob_match,
  COUNT(*) FILTER (WHERE p.date_of_birth != pp.dob) AS dob_mismatch,
  CASE 
    WHEN COUNT(*) FILTER (WHERE p.date_of_birth != pp.dob) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created'
  AND p.date_of_birth IS NOT NULL;

-- Expected: total_with_dob=848, dob_match=848, dob_mismatch=0

-- ==============================================================================
-- R2V.8 — GENDER PRESERVATION
-- ==============================================================================

SELECT 
  'R2V.8 — GENDER PRESERVATION' AS check_name,
  COUNT(*) AS total_with_gender,
  COUNT(*) FILTER (WHERE p.gender = pp.gender) AS gender_match,
  COUNT(*) FILTER (WHERE p.gender != pp.gender) AS gender_mismatch,
  CASE 
    WHEN COUNT(*) FILTER (WHERE p.gender != pp.gender) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created'
  AND p.gender IS NOT NULL;

-- Expected: total_with_gender=848, gender_match=848, gender_mismatch=0

-- ==============================================================================
-- R2V.9 — CREATED_AT PRESERVATION
-- ==============================================================================

SELECT 
  'R2V.9 — CREATED_AT PRESERVATION' AS check_name,
  COUNT(*) AS total_parties,
  COUNT(*) FILTER (WHERE p.created_at = pp.created_at) AS timestamp_match,
  COUNT(*) FILTER (WHERE p.created_at != pp.created_at) AS timestamp_mismatch,
  CASE 
    WHEN COUNT(*) FILTER (WHERE p.created_at != pp.created_at) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE m.status = 'party_created';

-- Expected: total_parties=848, timestamp_match=848, timestamp_mismatch=0

-- ==============================================================================
-- R2V SUMMARY
-- ==============================================================================

WITH verification_results AS (
  SELECT 
    'Mapping Coverage' AS check_name,
    CASE WHEN COUNT(*) FILTER (WHERE status = 'party_created') = 848 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM identity_migration_mapping
  
  UNION ALL
  
  SELECT 
    'Party Existence',
    CASE WHEN COUNT(*) = 848 AND COUNT(pp.id) = 848 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  LEFT JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created'
  
  UNION ALL
  
  SELECT 
    'Party Type',
    CASE WHEN COUNT(*) FILTER (WHERE pp.party_type != 'person') = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created'
  
  UNION ALL
  
  SELECT 
    'Tenant Consistency',
    CASE WHEN COUNT(*) FILTER (WHERE p.tenant_id != pp.tenant_id) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN persons p ON m.person_id = p.id
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created'
  
  UNION ALL
  
  SELECT 
    'UUID Collision',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM persons p
  INNER JOIN party_parties pp ON p.id = pp.id
  
  UNION ALL
  
  SELECT 
    'Display Name',
    CASE WHEN COUNT(*) FILTER (WHERE pp.display_name IS NULL OR pp.display_name = '') = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created'
  
  UNION ALL
  
  SELECT 
    'DOB Preservation',
    CASE WHEN COUNT(*) FILTER (WHERE p.date_of_birth != pp.dob) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN persons p ON m.person_id = p.id
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created' AND p.date_of_birth IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'Gender Preservation',
    CASE WHEN COUNT(*) FILTER (WHERE p.gender != pp.gender) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN persons p ON m.person_id = p.id
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created' AND p.gender IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'Created_At Preservation',
    CASE WHEN COUNT(*) FILTER (WHERE p.created_at != pp.created_at) = 0 THEN 'PASS' ELSE 'FAIL' END
  FROM identity_migration_mapping m
  JOIN persons p ON m.person_id = p.id
  JOIN party_parties pp ON m.party_id = pp.id
  WHERE m.status = 'party_created'
)
SELECT 
  '═══════════════════════════════════════════════════════════════' AS separator
UNION ALL
SELECT 'R2V VERIFICATION SUMMARY'
UNION ALL
SELECT '═══════════════════════════════════════════════════════════════'
UNION ALL
SELECT check_name || ': ' || result FROM verification_results
UNION ALL
SELECT '═══════════════════════════════════════════════════════════════'
UNION ALL
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM verification_results WHERE result = 'FAIL') = 0
    THEN '🎉 R2V PASS — R3 AUTHORIZED'
    ELSE '❌ R2V FAIL — R3 BLOCKED'
  END;

-- ==============================================================================
-- END R2V
-- ==============================================================================
