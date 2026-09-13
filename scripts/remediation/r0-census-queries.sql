-- ==============================================================================
-- E0.1A-R0 — IDENTITY MIGRATION PREFLIGHT CENSUS QUERIES
-- ==============================================================================
-- Purpose: Census existing Person/Party data before migration
-- Usage: Run each query manually, record results in R0_CENSUS_REPORT.md
-- ==============================================================================

-- ==============================================================================
-- R0.1 — PERSON CENSUS
-- ==============================================================================

-- Total persons
SELECT COUNT(*) AS total_persons FROM persons;

-- Persons by tenant
SELECT 
  tenant_id,
  COUNT(*) AS person_count
FROM persons
GROUP BY tenant_id
ORDER BY person_count DESC;

-- Sample persons structure
SELECT 
  id,
  tenant_id,
  first_name,
  last_name,
  full_name,
  date_of_birth,
  email,
  phone,
  created_at,
  updated_at
FROM persons
LIMIT 10;

-- Persons with missing critical fields
SELECT COUNT(*) AS missing_name
FROM persons
WHERE full_name IS NULL AND (first_name IS NULL OR last_name IS NULL);

SELECT COUNT(*) AS missing_dob
FROM persons
WHERE date_of_birth IS NULL;

-- ==============================================================================
-- R0.2 — PARTY CENSUS
-- ==============================================================================

-- Total parties
SELECT COUNT(*) AS total_parties FROM party_parties;

-- Parties by type
SELECT 
  type,
  COUNT(*) AS party_count
FROM party_parties
GROUP BY type
ORDER BY party_count DESC;

-- Parties by tenant
SELECT 
  tenant_id,
  COUNT(*) AS party_count
FROM party_parties
GROUP BY tenant_id
ORDER BY party_count DESC;

-- Individual parties
SELECT COUNT(*) AS individual_parties
FROM party_parties
WHERE type = 'individual';

-- Sample parties structure
SELECT 
  id,
  tenant_id,
  type,
  display_name,
  created_at,
  updated_at
FROM party_parties
LIMIT 10;

-- ==============================================================================
-- R0.3 — UUID COLLISION DETECTION
-- ==============================================================================

-- Check for same UUID in both tables
SELECT 
  p.id,
  p.tenant_id AS person_tenant,
  pp.tenant_id AS party_tenant,
  p.full_name AS person_name,
  pp.display_name AS party_name,
  p.email AS person_email,
  p.created_at AS person_created,
  pp.created_at AS party_created
FROM persons p
INNER JOIN party_parties pp ON p.id = pp.id
ORDER BY p.created_at;

-- Count collisions
SELECT COUNT(*) AS uuid_collisions
FROM persons p
INNER JOIN party_parties pp ON p.id = pp.id;

-- ==============================================================================
-- R0.4 — SAME-HUMAN DUPLICATE DETECTION
-- ==============================================================================

-- Detect probable same-human records (fuzzy match by name + email)
WITH person_normalized AS (
  SELECT 
    id AS person_id,
    tenant_id,
    LOWER(TRIM(full_name)) AS name_normalized,
    date_of_birth,
    LOWER(TRIM(email)) AS email_normalized,
    created_at
  FROM persons
  WHERE full_name IS NOT NULL
),
party_normalized AS (
  SELECT 
    id AS party_id,
    tenant_id,
    LOWER(TRIM(display_name)) AS name_normalized,
    created_at
  FROM party_parties
  WHERE type = 'individual' AND display_name IS NOT NULL
)
SELECT 
  pn.person_id,
  pn.name_normalized AS person_name,
  pn.email_normalized AS person_email,
  pp.party_id,
  pp.name_normalized AS party_name,
  pn.tenant_id,
  pn.date_of_birth,
  'NAME_MATCH' AS match_type
FROM person_normalized pn
INNER JOIN party_normalized pp 
  ON pn.tenant_id = pp.tenant_id
  AND pn.name_normalized = pp.name_normalized
LIMIT 100;

-- Count probable matches
WITH person_normalized AS (
  SELECT 
    id AS person_id,
    tenant_id,
    LOWER(TRIM(full_name)) AS name_normalized
  FROM persons
  WHERE full_name IS NOT NULL
),
party_normalized AS (
  SELECT 
    id AS party_id,
    tenant_id,
    LOWER(TRIM(display_name)) AS name_normalized
  FROM party_parties
  WHERE type = 'individual' AND display_name IS NOT NULL
)
SELECT COUNT(*) AS probable_same_human_matches
FROM person_normalized pn
INNER JOIN party_normalized pp 
  ON pn.tenant_id = pp.tenant_id
  AND pn.name_normalized = pp.name_normalized;

-- ==============================================================================
-- R0.5 — PERSON FK CENSUS
-- ==============================================================================

-- Find all tables with person_id column
SELECT 
  table_name,
  column_name
FROM information_schema.columns
WHERE column_name LIKE '%person_id%'
  AND table_schema = 'public'
ORDER BY table_name;

-- Count students with person_id
SELECT COUNT(*) AS students_with_person_id
FROM students
WHERE person_id IS NOT NULL;

-- Check if students.party_id exists yet
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'students' 
  AND column_name IN ('person_id', 'party_id');

-- ==============================================================================
-- R0.6 — PARTY FK CENSUS
-- ==============================================================================

-- Find all tables with party_id column
SELECT 
  table_name,
  column_name
FROM information_schema.columns
WHERE column_name LIKE '%party_id%'
  AND table_schema = 'public'
ORDER BY table_name;

-- Verify no students.party_id exists yet
SELECT COUNT(*) AS students_with_party_id
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';

-- ==============================================================================
-- R0.7 — MIGRATION READINESS SUMMARY
-- ==============================================================================

-- Summary query
WITH person_census AS (
  SELECT 
    COUNT(*) AS total_persons,
    COUNT(*) FILTER (WHERE full_name IS NULL AND (first_name IS NULL OR last_name IS NULL)) AS missing_name,
    COUNT(*) FILTER (WHERE date_of_birth IS NULL) AS missing_dob
  FROM persons
),
party_census AS (
  SELECT 
    COUNT(*) AS total_parties,
    COUNT(*) FILTER (WHERE type = 'individual') AS individual_parties
  FROM party_parties
),
collision_census AS (
  SELECT COUNT(*) AS uuid_collisions
  FROM persons p
  INNER JOIN party_parties pp ON p.id = pp.id
),
student_census AS (
  SELECT COUNT(*) AS students_with_person_id
  FROM students
  WHERE person_id IS NOT NULL
)
SELECT 
  pc.total_persons,
  pc.missing_name,
  ROUND((pc.missing_name::NUMERIC / pc.total_persons::NUMERIC) * 100, 2) AS missing_name_pct,
  pc.missing_dob,
  ROUND((pc.missing_dob::NUMERIC / pc.total_persons::NUMERIC) * 100, 2) AS missing_dob_pct,
  pp.total_parties,
  pp.individual_parties,
  cc.uuid_collisions,
  sc.students_with_person_id
FROM person_census pc
CROSS JOIN party_census pp
CROSS JOIN collision_census cc
CROSS JOIN student_census sc;

-- ==============================================================================
-- DECISION CRITERIA
-- ==============================================================================

-- Check preflight readiness
SELECT 
  CASE 
    WHEN uuid_collisions > 0 THEN '❌ BLOCKED: UUID collisions detected'
    WHEN missing_name_pct > 5 THEN '⚠️  WARNING: >5% missing names, cleanup recommended'
    ELSE '✅ READY: No collisions, acceptable data quality'
  END AS preflight_status
FROM (
  WITH person_census AS (
    SELECT 
      COUNT(*) AS total_persons,
      COUNT(*) FILTER (WHERE full_name IS NULL AND (first_name IS NULL OR last_name IS NULL)) AS missing_name
    FROM persons
  ),
  collision_census AS (
    SELECT COUNT(*) AS uuid_collisions
    FROM persons p
    INNER JOIN party_parties pp ON p.id = pp.id
  )
  SELECT 
    pc.total_persons,
    pc.missing_name,
    ROUND((pc.missing_name::NUMERIC / pc.total_persons::NUMERIC) * 100, 2) AS missing_name_pct,
    cc.uuid_collisions
  FROM person_census pc
  CROSS JOIN collision_census cc
) summary;

-- ==============================================================================
-- END OF CENSUS QUERIES
-- ==============================================================================
-- 
-- NEXT STEPS:
-- 1. Run each query above
-- 2. Record results in R0_CENSUS_REPORT.md
-- 3. Analyze collision/duplicate results
-- 4. Make GO/NO-GO decision for R1 Migration
-- 
-- ==============================================================================
