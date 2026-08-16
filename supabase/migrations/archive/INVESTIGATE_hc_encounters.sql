-- ============================================================================
-- INVESTIGATION: Existing hc_encounters Table
-- DO NOT DROP - Investigate first
-- ============================================================================

-- 1. Record count
SELECT 
    'Record count' AS metric,
    COUNT(*)::TEXT AS value
FROM hc_encounters;

-- 2. Complete schema
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hc_encounters'
ORDER BY ordinal_position;

-- 3. Sample records (first 10)
SELECT *
FROM hc_encounters
LIMIT 10;

-- 4. Foreign keys
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

-- 5. Indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'hc_encounters'
ORDER BY indexname;

-- 6. RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'hc_encounters'
ORDER BY policyname;

-- 7. Triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'hc_encounters'
ORDER BY trigger_name;

-- 8. Tenant distribution (if records exist)
SELECT 
    t.name AS tenant_name,
    COUNT(e.id) AS encounter_count
FROM hc_encounters e
LEFT JOIN tenants t ON e.tenant_id = t.id
GROUP BY t.name
ORDER BY encounter_count DESC;

-- 9. Status distribution
SELECT 
    status,
    COUNT(*) AS count
FROM hc_encounters
GROUP BY status
ORDER BY count DESC;

-- 10. Date range (if records exist)
SELECT 
    MIN(created_at) AS first_encounter,
    MAX(created_at) AS last_encounter,
    COUNT(DISTINCT DATE(created_at)) AS days_with_encounters
FROM hc_encounters
WHERE created_at IS NOT NULL;
