-- =============================================================================
-- E5.0: Schema Inspection — Verify schema_migrations Structure
-- Created: 2026-08-24
-- 
-- Purpose: Inspect actual schema of supabase_migrations.schema_migrations
-- before querying migration identity
-- 
-- Context: E5.1 query failed with "applied_at does not exist"
-- Must verify actual schema before proceeding with identity queries
-- 
-- READ-ONLY: No modifications
-- =============================================================================

-- E5.0.1: Inspect schema_migrations table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

-- E5.0.2: Count total migrations in remote history
SELECT COUNT(*) as total_remote_migrations
FROM supabase_migrations.schema_migrations;

-- E5.0.3: Sample first 5 migrations to understand data format
SELECT *
FROM supabase_migrations.schema_migrations
ORDER BY version
LIMIT 5;

-- =============================================================================
-- Expected Columns (to be verified):
-- 
-- - version (text, primary key)
-- - name (text, migration name without .sql extension)
-- - statements (text[], array of DDL statement types)
-- 
-- NOT expected (but need to verify):
-- - applied_at (timestamp) — does NOT exist per error
-- - hash (text) — unknown
-- - created_at (timestamp) — unknown
-- 
-- =============================================================================
-- 
-- After E5.0 schema verification, proceed with:
-- 
-- E5.1: Query version + name only (using verified columns)
-- E5.2: Compare with local filenames
-- E5.3: Classify CASE A/B/C/D
-- E5.4: Generate reconciliation matrix
-- 
-- =============================================================================
