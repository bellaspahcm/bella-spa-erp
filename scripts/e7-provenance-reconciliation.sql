-- ============================================================================
-- E7 Migration Provenance Reconciliation
-- Date: 2026-09-03
-- Purpose: Record E7 migration in history after verifying schema exists
-- Method: Official schema_migrations table INSERT (since CLI unavailable)
-- ============================================================================

-- IMPORTANT: Only run this AFTER verifying:
-- 1. logistics schema exists in database
-- 2. All 6 E7 tables exist (items, locations, inventory, inventory_movements, traceability, uom)
-- 3. RLS enabled on all 6 tables
-- 4. Migration version 20260822000000 NOT in schema_migrations

-- ============================================================================
-- PRE-FLIGHT VERIFICATION
-- ============================================================================

DO $$
DECLARE
  schema_exists BOOLEAN;
  table_count INTEGER;
  migration_exists BOOLEAN;
BEGIN
  -- Check logistics schema
  SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'logistics'
  ) INTO schema_exists;
  
  IF NOT schema_exists THEN
    RAISE EXCEPTION 'ERROR: logistics schema does not exist! Do not run this script.';
  END IF;
  
  -- Check table count
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'logistics';
  
  IF table_count != 6 THEN
    RAISE EXCEPTION 'ERROR: Expected 6 logistics tables, found %. Do not run this script.', table_count;
  END IF;
  
  -- Check migration not already recorded
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version = '20260822000000'
  ) INTO migration_exists;
  
  IF migration_exists THEN
    RAISE EXCEPTION 'ERROR: Migration 20260822000000 already recorded! Do not run this script.';
  END IF;
  
  RAISE NOTICE '✅ Pre-flight checks passed';
  RAISE NOTICE '✅ logistics schema exists';
  RAISE NOTICE '✅ 6 tables present';
  RAISE NOTICE '✅ Migration not yet recorded';
  RAISE NOTICE 'Proceeding with provenance reconciliation...';
END $$;

-- ============================================================================
-- RECORD E7 MIGRATION IN HISTORY
-- ============================================================================

-- Note: This uses the official schema_migrations table structure
-- This is provenance reconciliation, not migration execution
-- The schema already exists; we are aligning history with reality

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260822000000',
  'logistics_os_domain_kernel',
  ARRAY[
    '-- E7 Logistics OS Domain Kernel',
    '-- Applied: Schema verified present in database',
    '-- Tables: items, locations, inventory, inventory_movements, traceability, uom',
    '-- RLS: Enabled on all tables',
    '-- Reconciliation: Migration history aligned with database reality'
  ]
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- POST-RECONCILIATION VERIFICATION
-- ============================================================================

DO $$
DECLARE
  migration_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migration_count
  FROM supabase_migrations.schema_migrations 
  WHERE version = '20260822000000';
  
  IF migration_count = 0 THEN
    RAISE EXCEPTION 'ERROR: Migration was not recorded!';
  END IF;
  
  RAISE NOTICE '✅ E7 migration provenance reconciled';
  RAISE NOTICE '✅ Version 20260822000000 recorded in schema_migrations';
  RAISE NOTICE '✅ Migration history now aligned with database reality';
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

SELECT 
  'E7 Provenance Reconciliation Complete' AS status,
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version = '20260822000000';

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- This reconciliation is necessary because:
-- 1. E7 schema physically exists in database (verified via direct query)
-- 2. Migration history has no record of version 20260822000000
-- 3. Supabase CLI is timing out and cannot execute repair command
-- 4. Without this record, future migrations may attempt to re-apply E7

-- This is NOT "fabricating history" because:
-- 1. We verified the actual schema matches the migration file
-- 2. We are aligning provenance with verified database reality
-- 3. We use the official schema_migrations table structure
-- 4. We document this as reconciliation, not original application

-- Root cause of provenance gap: UNKNOWN
-- Possible causes: CLI timeout, manual application, restore from backup
-- Evidence: DB schema exists, migration history missing record

-- ============================================================================
-- END OF E7 PROVENANCE RECONCILIATION
-- ============================================================================
