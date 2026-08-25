-- =============================================================================
-- E5: Remote/Local Migration Name Reconciliation (FIXED)
-- Created: 2026-08-24
-- 
-- Purpose: Verify exact version + name mapping between remote schema_migrations
-- and local migration files
-- 
-- Context: db push --dry-run blocked with:
-- "Remote migration versions not found in local migrations directory."
-- 
-- FIXED: Removed applied_at column (does not exist in schema_migrations)
-- READ-ONLY: No modifications
-- =============================================================================

-- E5.1: Extract exact remote versions + names for 20260820*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
ORDER BY version;

-- E5.2: Extract exact remote versions + names for 20260821*
SELECT
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%'
ORDER BY version;

-- E5.3: Check ALL remote versions CLI complained about
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

-- E5.4: Count total remote migrations
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
-- Expected Mapping:
-- 
-- Remote version              | Remote name                    | Local filename
-- ----------------------------|--------------------------------|--------------------------------
-- 20260820_r4_3_gate_tokens   | r4_3_gate_tokens               | 20260820_r4_3_gate_tokens.sql
-- 20260820110000              | database_role_separation       | 20260820110000_database_role_separation.sql
-- 20260821115404              | logistics_schema               | 20260821115404_logistics_schema.sql
-- 
-- =============================================================================
