-- =============================================================================
-- E5.1: Remote Migration Identity (READY TO EXECUTE)
-- Created: 2026-08-24
-- Schema verified: version (text, NOT NULL), name (text, nullable)
-- 
-- Purpose: Extract version + name for 16 migrations CLI complained about
-- =============================================================================

-- ============================================
-- QUERY 1: All 20260820* migrations
-- ============================================
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%'
ORDER BY version;

-- ============================================
-- QUERY 2: All 20260821* migrations
-- ============================================
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260821%'
ORDER BY version;

-- ============================================
-- QUERY 3: Exact 16 versions CLI complained about
-- ============================================
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

-- =============================================================================
-- Expected Output Format:
-- 
-- version                          | name
-- ---------------------------------|--------------------------------
-- 20260820_r4_3_gate_tokens        | r4_3_gate_tokens
-- 20260820110000                   | database_role_separation
-- ...
-- 
-- NOTE: name column is nullable, may return NULL for some migrations
-- =============================================================================
