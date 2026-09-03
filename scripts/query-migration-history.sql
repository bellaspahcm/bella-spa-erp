-- ============================================================================
-- Query ①: E7 Migration History Verification
-- Purpose: Confirm E7 migration recorded in canonical history
-- ============================================================================

SELECT 
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations 
WHERE version >= '20260822000000' 
ORDER BY version;

-- Expected result:
-- 20260822000000 | logistics_os_domain_kernel | [timestamp]
