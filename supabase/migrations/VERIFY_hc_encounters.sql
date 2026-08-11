-- ============================================================================
-- Verification Script: hc_encounters Table Structure
-- Run this in Supabase SQL Editor to verify Phase 2 migration
-- ============================================================================

-- 1. Check table exists
SELECT 
    'hc_encounters table' AS check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hc_encounters') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END AS status;

-- 2. Check columns (expect 20+ columns)
SELECT 
    'Column count' AS check_type,
    COUNT(*)::TEXT || ' columns' AS status
FROM information_schema.columns
WHERE table_name = 'hc_encounters';

-- 3. List all columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hc_encounters'
ORDER BY ordinal_position;

-- 4. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'hc_encounters'
ORDER BY indexname;

-- 5. Check RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'hc_encounters'
ORDER BY policyname;

-- 6. Check foreign keys
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name,
    af.attname AS foreign_column_name
FROM pg_constraint AS c
JOIN pg_attribute AS a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute AS af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.contype = 'f'
  AND c.conrelid::regclass::text = 'hc_encounters'
ORDER BY conname;

-- 7. Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'hc_encounters'
ORDER BY trigger_name;

-- Expected results:
-- ✅ Table exists
-- ✅ 20+ columns (id, tenant_id, patient_id, encounter_type, status, period_start, period_end, etc.)
-- ✅ FK to tenants(id)
-- ✅ FK to party_parties(id)
-- ✅ 8-10 indexes (tenant, patient, status, temporal queries)
-- ✅ 2 RLS policies (tenant isolation)
-- ✅ Audit trigger (updated_at auto-update)
