-- E7: CANONICAL MIGRATION IDENTITY AUDIT
-- Purpose: Establish exact local↔remote identity for 16 affected migrations
-- Status: READ-ONLY FORENSIC (NO MODIFICATIONS)
-- Date: 2026-08-24

-- E7.1: ENUMERATE EXACT REMOTE IDENTITIES (16 affected migrations)

SELECT 
  version,
  name,
  array_length(statements, 1) as statement_count,
  LEFT(statements[1], 100) as first_statement_preview,
  CASE 
    WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
    WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
    ELSE 'OTHER'
  END as version_format
FROM supabase_migrations.schema_migrations
WHERE 
  version LIKE '20260820%' 
  OR version LIKE '20260821%'
ORDER BY version;

-- Expected: 16 rows
-- Classification by format:
--   LEGACY_8DIGIT: 7 migrations (20260820_*, 20260821_*)
--   STANDARD_14DIGIT: 9 migrations (20260820000000, etc.)

-- E7.2: CLASSIFY EACH MIGRATION

-- Class A: Exact legacy match (local 8-digit → remote 8-digit)
-- Class B: Local 14-digit vs remote 8-digit (IDENTITY DIVERGENCE)
-- Class C: Remote-only (no local file)
-- Class D: Local-only (no remote record)

WITH local_migrations AS (
  -- These will be manually verified against filesystem
  SELECT unnest(ARRAY[
    '20260820_r4_3_gate_tokens',
    '20260820_r4_4_monitoring_audit', 
    '20260820_r4_approval_contract',
    '20260820000000',
    '20260820010000',
    '20260820100000',
    '20260820110000',
    '20260820120000',
    '20260820130000',
    '20260820140000',
    '20260821_create_accessorial_rates_table',
    '20260821_create_carrier_rates_table',
    '20260821_create_discrepancies_table',
    '20260821_create_freight_audit_tables',
    '20260821000000',
    '20260821115404'
  ]) as local_version
),
remote_migrations AS (
  SELECT 
    version as remote_version,
    name as remote_name
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20260820%' OR version LIKE '20260821%'
)
SELECT 
  l.local_version,
  r.remote_version,
  r.remote_name,
  CASE
    WHEN l.local_version = r.remote_version THEN 'CLASS_A_EXACT_MATCH'
    WHEN r.remote_version IS NULL THEN 'CLASS_D_LOCAL_ONLY'
    ELSE 'CLASS_B_DIVERGENCE'
  END as classification
FROM local_migrations l
LEFT JOIN remote_migrations r ON l.local_version = r.remote_version
ORDER BY l.local_version;

-- Expected outcomes:
-- CLASS_A_EXACT_MATCH: Legacy 8-digit and standard 14-digit matches
-- CLASS_B_DIVERGENCE: Should be 0 (indicates identity corruption)
-- CLASS_D_LOCAL_ONLY: Should be 0 for these 16 (E5 proved all exist)

-- E7.3: VERIFY 20260824000000 IS FREE ON REMOTE

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version = '20260824000000'
    ) THEN 'OCCUPIED'
    ELSE 'FREE'
  END as version_20260824000000_status;

-- Expected: FREE
-- This version is candidate for RPC deployment

-- E7.4: DETECT REMOTE-ONLY MIGRATIONS (Class C)

SELECT 
  version as remote_version,
  name as remote_name,
  'CLASS_C_REMOTE_ONLY' as classification
FROM supabase_migrations.schema_migrations
WHERE (version LIKE '20260820%' OR version LIKE '20260821%')
  AND version NOT IN (
    '20260820_r4_3_gate_tokens',
    '20260820_r4_4_monitoring_audit',
    '20260820_r4_approval_contract',
    '20260820000000',
    '20260820010000',
    '20260820100000',
    '20260820110000',
    '20260820120000',
    '20260820130000',
    '20260820140000',
    '20260821_create_accessorial_rates_table',
    '20260821_create_carrier_rates_table',
    '20260821_create_discrepancies_table',
    '20260821_create_freight_audit_tables',
    '20260821000000',
    '20260821115404'
  )
ORDER BY version;

-- Expected: 0 rows (E5 proved all 16 remote migrations have local files)

-- E7.5: FULL IDENTITY MATRIX (16 migrations)

SELECT 
  version,
  name,
  CASE 
    WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
    WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
    ELSE 'OTHER'
  END as format,
  CASE
    WHEN version IN (
      '20260820_r4_3_gate_tokens',
      '20260820_r4_4_monitoring_audit',
      '20260820_r4_approval_contract',
      '20260821_create_accessorial_rates_table',
      '20260821_create_carrier_rates_table',
      '20260821_create_discrepancies_table',
      '20260821_create_freight_audit_tables'
    ) THEN 'CLASS_A_LEGACY_EXACT_MATCH'
    WHEN version IN (
      '20260820000000',
      '20260820010000',
      '20260820100000',
      '20260820110000',
      '20260820120000',
      '20260820130000',
      '20260820140000',
      '20260821000000',
      '20260821115404'
    ) THEN 'CLASS_A_STANDARD_EXACT_MATCH'
    ELSE 'UNEXPECTED'
  END as identity_status
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%' OR version LIKE '20260821%'
ORDER BY version;

-- E7.6: SUMMARY REPORT

WITH classification_summary AS (
  SELECT 
    CASE 
      WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
      WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
      ELSE 'OTHER'
    END as format,
    COUNT(*) as count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20260820%' OR version LIKE '20260821%'
  GROUP BY format
)
SELECT 
  format,
  count,
  CASE
    WHEN format = 'LEGACY_8DIGIT' THEN '7 expected (CLI reconciliation limitation)'
    WHEN format = 'STANDARD_14DIGIT' THEN '9 expected (CLI reconciles correctly)'
    ELSE 'Unexpected format detected'
  END as expected_vs_actual
FROM classification_summary
ORDER BY format;

-- E7 GATE: PASS CONDITIONS

-- PASS if ALL of the following:
-- 1. E7.1: Exactly 16 rows returned
-- 2. E7.2: All 16 classifications = CLASS_A_EXACT_MATCH
-- 3. E7.3: 20260824000000 status = FREE
-- 4. E7.4: 0 CLASS_C_REMOTE_ONLY migrations
-- 5. E7.5: All identity_status = CLASS_A_* (no UNEXPECTED)
-- 6. E7.6: 7 LEGACY_8DIGIT + 9 STANDARD_14DIGIT = 16 total

-- BLOCKED if ANY of the following:
-- - CLASS_B_DIVERGENCE detected (local version ≠ remote version for same migration)
-- - CLASS_C_REMOTE_ONLY detected (remote migration without local file)
-- - 20260824000000 status = OCCUPIED
-- - Total count ≠ 16
-- - Any identity_status = UNEXPECTED

-- EXECUTION INSTRUCTIONS

-- Run via Dashboard → SQL Editor:
-- 1. Copy entire script
-- 2. Execute in Dashboard SQL Editor
-- 3. Capture all 6 result sets (E7.1 - E7.6)
-- 4. Analyze against PASS conditions
-- 5. Document results in E7_CANONICAL_IDENTITY_AUDIT_RESULTS.md

-- DO NOT:
-- - Modify schema_migrations table
-- - Execute migration repair
-- - Rename migration files
-- - Deploy any migrations

-- ONLY:
-- - Read and analyze existing state
-- - Classify migration identities
-- - Verify provenance integrity
