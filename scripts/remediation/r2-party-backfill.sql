-- ==============================================================================
-- E0.1A-R2 — PARTY BACKFILL (AUTHORIZED)
-- ==============================================================================
-- Purpose: Create party_parties from persons using sealed R1 mapping
-- Scope: BACKFILL ONLY — NO FK CUTOVER
-- Prerequisites: R1 mapping sealed (848 rows, status=planned)
-- ==============================================================================

-- ==============================================================================
-- PRE-EXECUTION VALIDATION
-- ==============================================================================

DO $$
DECLARE
  v_sealed_mappings INT;
  v_planned_or_created INT;
BEGIN
  -- Verify R1 mapping sealed
  SELECT COUNT(*) INTO v_sealed_mappings
  FROM identity_migration_mapping
  WHERE sealed_at IS NOT NULL;
  
  SELECT COUNT(*) INTO v_planned_or_created
  FROM identity_migration_mapping
  WHERE status IN ('planned', 'party_created') AND sealed_at IS NOT NULL;
  
  IF v_sealed_mappings != 848 THEN
    RAISE EXCEPTION 'R2 BLOCKED: Expected 848 sealed mappings, found %', v_sealed_mappings;
  END IF;
  
  IF v_planned_or_created != 848 THEN
    RAISE EXCEPTION 'R2 BLOCKED: Expected 848 planned/created mappings, found %', v_planned_or_created;
  END IF;
  
  RAISE NOTICE '✅ PRE-EXECUTION: R1 mapping sealed (848 rows)';
END $$;

-- ==============================================================================
-- R2 — PARTY BACKFILL (Idempotent)
-- ==============================================================================

BEGIN;

-- Insert party_parties from persons using R1 mapping
INSERT INTO party_parties (
  id,
  tenant_id,
  party_type,
  display_name,
  legal_name,
  dob,
  gender,
  blood_type,
  created_at,
  updated_at,
  created_by,
  updated_by,
  version
)
SELECT 
  m.party_id,                                        -- From R1 sealed mapping
  p.tenant_id,
  'person',                                          -- Fixed: party_type = 'person'
  p.first_name || ' ' || p.last_name AS display_name,
  NULL AS legal_name,                                -- Persons don't have legal_name
  p.date_of_birth AS dob,
  p.gender,
  NULL AS blood_type,                                -- Persons don't have blood_type (yet)
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by,
  1 AS version
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
WHERE m.status = 'planned'
  AND m.sealed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;  -- Idempotent: skip if already exists

-- Update mapping status
UPDATE identity_migration_mapping
SET 
  status = 'party_created',
  party_created_at = NOW()
WHERE status = 'planned'
  AND party_id IN (SELECT id FROM party_parties);

COMMIT;

-- ==============================================================================
-- POST-EXECUTION COUNTERS
-- ==============================================================================

WITH counters AS (
  SELECT 
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE sealed_at IS NOT NULL) AS total_planned,
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE status = 'party_created') AS created,
    (SELECT COUNT(*) FROM identity_migration_mapping WHERE status = 'planned') AS still_pending,
    (SELECT COUNT(*) FROM party_parties pp WHERE pp.id IN (SELECT party_id FROM identity_migration_mapping)) AS party_count
)
SELECT 
  'R2 EXECUTION COUNTERS' AS report,
  total_planned AS planned,
  created,
  still_pending,
  party_count AS parties_in_db,
  CASE 
    WHEN created = 848 AND still_pending = 0 AND party_count = 848 
    THEN '✅ R2 COMPLETE'
    ELSE '❌ R2 INCOMPLETE'
  END AS r2_status
FROM counters;

-- Expected output:
-- planned: 848
-- created: 848 (or less if some already existed)
-- still_pending: 0
-- parties_in_db: 848
-- r2_status: ✅ R2 COMPLETE

-- ==============================================================================
-- DATA CLASSIFICATION REPORT
-- ==============================================================================

SELECT '
-- ==============================================================================
-- R2 DATA CLASSIFICATION REPORT
-- ==============================================================================

MIGRATED TO party_parties:
  ✅ id (mapped from R1)
  ✅ tenant_id
  ✅ party_type = person
  ✅ display_name (first_name + last_name)
  ✅ dob (date_of_birth)
  ✅ gender
  ✅ created_at, updated_at
  ✅ created_by, updated_by
  ✅ version

DEFERRED (not in party_parties core schema):
  ⏸️  persons.identifiers (JSONB array) → requires party_identifiers subtable
  ⏸️  persons.contacts (JSONB array) → requires party_contacts subtable
  ⏸️  persons.addresses (JSONB array) → requires party_addresses subtable
  ⏸️  persons.photo_url → requires Party metadata or attachment system
  ⏸️  persons.preferred_language → requires Party metadata

RETAINED IN LEGACY persons:
  🔒 persons.* (ALL FIELDS PRESERVED for rollback)

SEMANTIC MAPPING NOTES:
  - persons.first_name + last_name → party.display_name
  - persons.date_of_birth → party.dob
  - persons.middle_name → NOT MAPPED (party schema lacks middle_name)
  - persons.nationality → NOT MAPPED (party schema lacks nationality)
  - persons.status → NOT MAPPED (party.deleted_at used instead)

' AS data_classification_report;

-- ==============================================================================
-- END R2
-- ==============================================================================
