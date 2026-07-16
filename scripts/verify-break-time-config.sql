-- Script: Verify Break Time Configuration
-- Purpose: Check if tenants have capacity_config enabled
-- Usage: Run in Supabase SQL Editor or psql

-- =====================================================
-- 1. Check Current State
-- =====================================================

SELECT 
  '=== CURRENT CONFIGURATION ===' as section;

SELECT 
  COUNT(*) as total_active_tenants
FROM tenants 
WHERE status = 'active';

SELECT 
  COUNT(*) as tenants_with_capacity_config
FROM tenants 
WHERE status = 'active'
  AND metadata->'capacity_config' IS NOT NULL;

SELECT 
  COUNT(*) as tenants_with_break_time_enabled
FROM tenants 
WHERE status = 'active'
  AND metadata->'capacity_config' IS NOT NULL
  AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean = true;

-- =====================================================
-- 2. Show Detailed Configuration per Tenant
-- =====================================================

SELECT 
  '=== TENANT CONFIGURATION DETAILS ===' as section;

SELECT 
  id,
  name,
  status,
  CASE 
    WHEN metadata->'capacity_config' IS NULL THEN '❌ Not Configured'
    WHEN (metadata->'capacity_config'->>'enforceBreakTimes')::boolean = false THEN '⚠️ Disabled'
    WHEN (metadata->'capacity_config'->>'enforceBreakTimes')::boolean = true THEN '✅ Enabled'
    ELSE '🟡 Unknown'
  END as break_time_status,
  COALESCE(
    (metadata->'capacity_config'->>'minBreakMinutes')::text,
    'Not Set'
  ) as min_break_minutes,
  COALESCE(
    metadata->'capacity_config'->>'workingHoursStart',
    'Not Set'
  ) as work_start,
  COALESCE(
    metadata->'capacity_config'->>'workingHoursEnd',
    'Not Set'
  ) as work_end,
  metadata->'capacity_config' as full_config
FROM tenants
WHERE status = 'active'
ORDER BY name;

-- =====================================================
-- 3. Identify Tenants Needing Configuration
-- =====================================================

SELECT 
  '=== TENANTS NEEDING CONFIGURATION ===' as section;

SELECT 
  id,
  name,
  CASE 
    WHEN metadata->'capacity_config' IS NULL THEN 'Missing capacity_config'
    WHEN metadata->'capacity_config'->>'minBreakMinutes' IS NULL THEN 'Missing minBreakMinutes'
    WHEN (metadata->'capacity_config'->>'minBreakMinutes')::int < 15 THEN 'minBreakMinutes < 15'
    WHEN (metadata->'capacity_config'->>'enforceBreakTimes')::boolean IS NOT TRUE THEN 'enforceBreakTimes not enabled'
    ELSE 'Unknown issue'
  END as issue
FROM tenants
WHERE status = 'active'
  AND (
    metadata->'capacity_config' IS NULL
    OR metadata->'capacity_config'->>'minBreakMinutes' IS NULL
    OR (metadata->'capacity_config'->>'minBreakMinutes')::int < 15
    OR (metadata->'capacity_config'->>'enforceBreakTimes')::boolean IS NOT TRUE
  );

-- =====================================================
-- 4. Summary Statistics
-- =====================================================

SELECT 
  '=== SUMMARY STATISTICS ===' as section;

WITH stats AS (
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (
      WHERE metadata->'capacity_config' IS NOT NULL
    ) as has_config,
    COUNT(*) FILTER (
      WHERE metadata->'capacity_config' IS NOT NULL
        AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean = true
    ) as enabled,
    COUNT(*) FILTER (
      WHERE metadata->'capacity_config' IS NOT NULL
        AND (metadata->'capacity_config'->>'minBreakMinutes')::int >= 15
    ) as proper_break_time
  FROM tenants
  WHERE status = 'active'
)
SELECT 
  total as total_tenants,
  has_config as configured,
  ROUND(has_config::numeric / total * 100, 1) || '%' as config_percentage,
  enabled as break_time_enabled,
  ROUND(enabled::numeric / total * 100, 1) || '%' as enabled_percentage,
  proper_break_time as proper_break_time_count,
  ROUND(proper_break_time::numeric / total * 100, 1) || '%' as proper_break_percentage
FROM stats;

-- =====================================================
-- 5. Test Query for Booking Decision Service
-- =====================================================

SELECT 
  '=== TEST: What booking-decision.service.ts will see ===' as section;

WITH test_tenant AS (
  SELECT 
    id,
    name,
    metadata
  FROM tenants
  WHERE status = 'active'
  LIMIT 1
)
SELECT 
  id as tenant_id,
  name as tenant_name,
  metadata->'capacity_config' as capacity_config,
  COALESCE(
    (metadata->'capacity_config'->>'minBreakMinutes')::int,
    15
  ) as resolved_min_break_minutes,
  COALESCE(
    (metadata->'capacity_config'->>'enforceBreakTimes')::boolean,
    true
  ) as resolved_enforce_break_times,
  CASE 
    WHEN COALESCE((metadata->'capacity_config'->>'enforceBreakTimes')::boolean, true) = true 
    THEN '✅ Will enforce break time'
    ELSE '❌ Will NOT enforce break time'
  END as enforcement_status
FROM test_tenant;
