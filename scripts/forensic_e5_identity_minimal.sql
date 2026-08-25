-- =============================================================================
-- E5.1: Remote Migration Identity (MINIMAL)
-- Created: 2026-08-24
-- 
-- Purpose: Extract ONLY version + name from remote schema_migrations
-- (after E5.0 schema inspection confirms these columns exist)
-- 
-- Context: CLI reports "Remote migration versions not found in local directory"
-- Need to compare remote (version, name) with local filenames
-- 
-- READ-ONLY: No modifications
-- =============================================================================

-- E5.1.1: All 20260820* migrations
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
ORDER BY version;

-- E5.1.2: All 20260821* migrations
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%'
ORDER BY version;

-- E5.1.3: Exact 16 versions CLI complained about
SELECT
  version,
  name
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

-- E5.1.4: Count check
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
-- Output Format:
-- 
-- version                          | name
-- ---------------------------------|--------------------------------
-- 20260820_r4_3_gate_tokens        | r4_3_gate_tokens (expected)
-- 20260820110000                   | database_role_separation (expected)
-- ...
-- 
-- =============================================================================
-- 
-- After E5.1 results, compare with E5.2 local filenames:
-- 
-- LOCAL                                    | REMOTE version              | REMOTE name
-- -----------------------------------------|-----------------------------|--------------------------
-- 20260820_r4_3_gate_tokens.sql            | 20260820_r4_3_gate_tokens   | r4_3_gate_tokens
-- 20260820110000_database_role_separation  | 20260820110000              | database_role_separation
-- 
-- Then classify:
-- - CASE A: version match + name match → CLI reconciliation issue
-- - CASE B: version match + name mismatch → Step 1 recorded wrong name
-- - CASE C: version mismatch → Abbreviated vs full timestamp issue
-- - CASE D: version exists remote but no DDL → Orphan history
-- 
-- =============================================================================
