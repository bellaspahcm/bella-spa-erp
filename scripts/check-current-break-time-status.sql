-- Quick Check: Current Break Time Status (Read-Only)
-- Purpose: See what tenants currently have for break time config
-- Safe to run - NO MODIFICATIONS

-- 1. Check active tenants
SELECT 
  id,
  name,
  status,
  metadata->'capacity_config' as capacity_config
FROM tenants
WHERE status = 'active'
ORDER BY name
LIMIT 10;

-- 2. Count tenants by config status
SELECT 
  'Total Active Tenants' as metric,
  COUNT(*) as count
FROM tenants
WHERE status = 'active'

UNION ALL

SELECT 
  'Has capacity_config',
  COUNT(*)
FROM tenants
WHERE status = 'active'
  AND metadata->'capacity_config' IS NOT NULL

UNION ALL

SELECT 
  'enforceBreakTimes enabled',
  COUNT(*)
FROM tenants
WHERE status = 'active'
  AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean = true

UNION ALL

SELECT 
  'minBreakMinutes >= 15',
  COUNT(*)
FROM tenants
WHERE status = 'active'
  AND (metadata->'capacity_config'->>'minBreakMinutes')::int >= 15;

-- 3. Show one example tenant config
SELECT 
  '=== EXAMPLE TENANT CONFIG ===' as section;
  
SELECT 
  id,
  name,
  metadata->'capacity_config' as full_config,
  (metadata->'capacity_config'->>'minBreakMinutes') as min_break_minutes,
  (metadata->'capacity_config'->>'enforceBreakTimes') as enforce_break_times,
  (metadata->'capacity_config'->>'workingHoursStart') as work_start,
  (metadata->'capacity_config'->>'workingHoursEnd') as work_end
FROM tenants
WHERE status = 'active'
LIMIT 1;
