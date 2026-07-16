-- Check break time buffer status
-- Run this in Supabase SQL Editor

-- 1. Check tenant config
SELECT 
  name,
  metadata->'capacity_config' as capacity_config
FROM tenants
WHERE name ILIKE '%bella%'
LIMIT 1;

-- 2. Check if bookings exist with <15 min gap
WITH booking_times AS (
  SELECT 
    b.id,
    b.assigned_ktv_id,
    u.full_name as ktv_name,
    b.start_date,
    b.preferred_time,
    b.status,
    LEAD(b.preferred_time) OVER (PARTITION BY b.assigned_ktv_id ORDER BY b.start_date, b.preferred_time) as next_time
  FROM bookings b
  JOIN users u ON u.id = b.assigned_ktv_id
  WHERE b.start_date::date = CURRENT_DATE
    AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'deposit_pending')
)
SELECT 
  ktv_name,
  preferred_time as time1,
  next_time as time2,
  EXTRACT(EPOCH FROM (next_time::time - preferred_time::time)) / 60 as gap_minutes
FROM booking_times
WHERE next_time IS NOT NULL
  AND EXTRACT(EPOCH FROM (next_time::time - preferred_time::time)) / 60 < 15
ORDER BY ktv_name, preferred_time;

-- 3. Check Decision Engine adapter registration
SELECT 
  'Decision Engine should check capacity_config' as note,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce
FROM tenants
WHERE name ILIKE '%bella%';
