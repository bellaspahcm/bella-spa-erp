-- ============================================================================
-- MANUAL CLEANUP: Drop existing hc_encounters table
-- Run this in Supabase SQL Editor BEFORE running Phase 2 migration
-- ============================================================================

-- WARNING: This will delete ALL encounter data
-- Only run in development/staging environment

-- 1. Drop table (CASCADE removes dependent objects)
DROP TABLE IF EXISTS public.hc_encounters CASCADE;

-- 2. Verify deletion
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hc_encounters') 
        THEN '✅ Table dropped successfully' 
        ELSE '❌ Table still exists' 
    END AS status;

-- After running this, execute the full migration:
-- 1. Restore: supabase/migrations/20260811000000_create_encounters_table.sql.PARTIAL
--    → Rename back to .sql
-- 2. Run: supabase db push
-- 3. Verify: VERIFY_hc_encounters.sql
