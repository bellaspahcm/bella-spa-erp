-- =============================================================================
-- E5: Remote/Local Migration Name Reconciliation
-- Created: 2026-08-24
-- 
-- Purpose: Verify exact version + name mapping between remote schema_migrations
-- and local migration files for 20260820* and 20260821* versions that CLI
-- reports as "not found in local migrations directory"
-- 
-- Context: db push --dry-run blocked with:
-- "Remote migration versions not found in local migrations directory."
-- 
-- READ-ONLY: No modifications
-- =============================================================================

-- E5.1: Extract exact remote versions + names for 20260820*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count,
  statements[1] as first_statement_type
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
ORDER BY version;

-- E5.2: Extract exact remote versions + names for 20260821*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count,
  statements[1] as first_statement_type
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%'
ORDER BY version;

-- E5.3: Check ALL remote versions CLI complained about
-- (from dry-run error message)
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version IN (
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

-- E5.4: Count total remote migrations vs local files
SELECT
  'Remote 20260820*' as scope,
  COUNT(*) as count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
UNION ALL
SELECT
  'Remote 20260821*' as scope,
  COUNT(*) as count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%';

-- =============================================================================
-- Expected Mapping Format:
-- 
-- REMOTE version                    | REMOTE name                          | LOCAL filename
-- ----------------------------------|--------------------------------------|----------------------------------
-- 20260820_r4_3_gate_tokens         | r4_3_gate_tokens                     | 20260820_r4_3_gate_tokens.sql
-- 20260820000000                    | ?                                    | 20260820000000_*.sql
-- 20260821_create_freight_audit_... | create_freight_audit_tables          | 20260821_create_freight_audit_tables.sql
-- 
-- =============================================================================
-- 
-- CLI Naming Convention Hypothesis:
-- 
-- For versions with underscore suffix (20260820_description):
--   - CLI expects local file: {version}.sql
--   - Example: 20260820_r4_3_gate_tokens.sql
-- 
-- For versions with full timestamp (20260820HHMMSS):
--   - CLI expects local file: {version}_{name}.sql
--   - Example: 20260820110000_database_role_separation.sql
-- 
-- =============================================================================
-- 
-- E5 Decision Tree:
-- 
-- IF remote version NOT FOUND locally:
--   → CASE A: File was deleted/never committed
--     → Action: Restore from git history or remote schema
--   → CASE B: Naming mismatch
--     → Action: Rename local file to match remote version+name
--   → CASE C: Orphan remote history
--     → Action: Investigate if safe to mark as reverted
-- 
-- IF remote version FOUND but name mismatch:
--   → CASE D: Step 1 recorded wrong name
--     → Action: UPDATE schema_migrations.name
--   → CASE E: Local file has wrong name
--     → Action: Rename local file
-- 
-- IF duplicate local versions:
--   → Already handled in E1-E3 (Option B executed)
-- 
-- =============================================================================
