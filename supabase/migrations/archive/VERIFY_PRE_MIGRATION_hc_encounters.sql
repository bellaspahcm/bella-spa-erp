-- ============================================================================
-- PRE-MIGRATION VERIFICATION: hc_encounters
-- Run this BEFORE executing migration to establish baseline
-- ============================================================================

-- 1. Record count (MUST match post-migration)
SELECT 'Total Records' AS metric, COUNT(*)::TEXT AS value
FROM hc_encounters;

-- 2. Tenant distribution (verify multi-tenant data)
SELECT 
    'Tenant Distribution' AS metric,
    t.name AS tenant_name,
    COUNT(e.id)::TEXT AS record_count
FROM hc_encounters e
LEFT JOIN tenants t ON e.tenant_id = t.id
GROUP BY t.name
ORDER BY COUNT(e.id) DESC;

-- 3. Status distribution (for enum mapping verification)
SELECT 
    'Status Values' AS metric,
    status,
    COUNT(*)::TEXT AS count
FROM hc_encounters
GROUP BY status
ORDER BY COUNT(*) DESC;

-- 4. Encounter class distribution (for enum mapping verification)
SELECT 
    'Encounter Class Values' AS metric,
    encounter_class,
    COUNT(*)::TEXT AS count
FROM hc_encounters
GROUP BY encounter_class
ORDER BY COUNT(*) DESC;

-- 5. NULL patient_party_id check (MUST be 0)
SELECT 
    'NULL Patient References' AS metric,
    COUNT(*)::TEXT AS value
FROM hc_encounters
WHERE patient_party_id IS NULL;

-- 6. Orphaned patient_party_id (MUST be 0)
SELECT 
    'Orphaned Patient References' AS metric,
    COUNT(*)::TEXT AS value
FROM hc_encounters e
LEFT JOIN party_parties p ON e.patient_party_id = p.id
WHERE p.id IS NULL;

-- 7. Orphaned doctor_party_id (excluding NULL)
SELECT 
    'Orphaned Doctor References' AS metric,
    COUNT(*)::TEXT AS value
FROM hc_encounters e
LEFT JOIN party_parties p ON e.doctor_party_id = p.id
WHERE e.doctor_party_id IS NOT NULL AND p.id IS NULL;

-- 8. Orphaned tenant_id (MUST be 0)
SELECT 
    'Orphaned Tenant References' AS metric,
    COUNT(*)::TEXT AS value
FROM hc_encounters e
LEFT JOIN tenants t ON e.tenant_id = t.id
WHERE t.id IS NULL;

-- 9. Temporal data coverage (for period mapping)
SELECT 
    'Temporal Data Coverage' AS metric,
    'scheduled_at' AS field,
    COUNT(*)::TEXT || ' non-null' AS value
FROM hc_encounters
WHERE scheduled_at IS NOT NULL
UNION ALL
SELECT 
    'Temporal Data Coverage',
    'arrived_at',
    COUNT(*)::TEXT || ' non-null'
FROM hc_encounters
WHERE arrived_at IS NOT NULL
UNION ALL
SELECT 
    'Temporal Data Coverage',
    'started_at',
    COUNT(*)::TEXT || ' non-null'
FROM hc_encounters
WHERE started_at IS NOT NULL
UNION ALL
SELECT 
    'Temporal Data Coverage',
    'finished_at',
    COUNT(*)::TEXT || ' non-null'
FROM hc_encounters
WHERE finished_at IS NOT NULL
UNION ALL
SELECT 
    'Temporal Data Coverage',
    'completed_at',
    COUNT(*)::TEXT || ' non-null'
FROM hc_encounters
WHERE completed_at IS NOT NULL;

-- 10. Date range (for validation)
SELECT 
    'Date Range' AS metric,
    'created_at' AS field,
    MIN(created_at)::TEXT || ' to ' || MAX(created_at)::TEXT AS value
FROM hc_encounters;

-- 11. Existing foreign key constraints
SELECT 
    'Foreign Key Constraints' AS metric,
    conname AS constraint_name,
    confrelid::regclass::TEXT AS references_table
FROM pg_constraint
WHERE conrelid = 'hc_encounters'::regclass
  AND contype = 'f'
ORDER BY conname;

-- 12. Existing indexes
SELECT 
    'Indexes' AS metric,
    indexname AS index_name,
    indexdef AS definition
FROM pg_indexes
WHERE tablename = 'hc_encounters'
ORDER BY indexname;

-- 13. RLS status (should be enabled but no policies)
SELECT 
    'RLS Enabled' AS metric,
    relrowsecurity::TEXT AS value
FROM pg_class
WHERE relname = 'hc_encounters';

SELECT 
    'RLS Policies Count' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_policies
WHERE tablename = 'hc_encounters';

-- ============================================================================
-- EXPECTED RESULTS:
-- Total Records: 8254
-- Tenant Distribution: Bella Medical Clinic (8251), Bella General Hospital (3)
-- NULL checks: ALL 0
-- Orphaned references: ALL 0
-- RLS Enabled: true
-- RLS Policies: 0 (SECURITY ISSUE - will fix in Phase G)
-- ============================================================================
