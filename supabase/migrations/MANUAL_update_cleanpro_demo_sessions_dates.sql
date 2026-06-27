-- =====================================================
-- UPDATE: CleanPro Demo Sessions with Realistic Dates
-- =====================================================
-- This script updates session_logs assigned_date to show:
-- 1. Completed sessions (past dates)
-- 2. In-progress sessions (today)
-- 3. Upcoming scheduled sessions (future dates)
-- =====================================================

-- Step 1: Verify CleanPro tenant exists
SELECT 
  id,
  name,
  enabled_modules->>'industrial_cleaning' as has_cleaning_module
FROM public.tenants 
WHERE name LIKE '%CleanPro%'
LIMIT 1;

-- Step 2: Show current session dates for CleanPro bookings
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
)
SELECT 
  sl.id,
  sl.session_number,
  sl.assigned_date,
  sl.status,
  b.booking_number,
  c.name_mother as customer_name
FROM public.session_logs sl
JOIN public.bookings b ON b.id = sl.booking_id
JOIN public.customers c ON c.id = b.customer_id
WHERE b.tenant_id = (SELECT id FROM cleanpro_tenant)
ORDER BY b.booking_number, sl.session_number;

-- Step 3: Update session dates to realistic timeline
-- Using CURRENT_DATE to make it dynamic
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
),
cleaning_bookings AS (
  SELECT id, booking_number
  FROM public.bookings 
  WHERE tenant_id = (SELECT id FROM cleanpro_tenant)
)
UPDATE public.session_logs sl
SET assigned_date = CASE 
  -- First 2 sessions: completed (2 and 1 days ago)
  WHEN sl.session_number = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
  WHEN sl.session_number = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
  
  -- Session 3: today (in progress or scheduled today)
  WHEN sl.session_number = 3 THEN CURRENT_DATE
  
  -- Remaining sessions: future dates (1, 2, 3, 7, 14 days ahead)
  WHEN sl.session_number = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
  WHEN sl.session_number = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
  WHEN sl.session_number = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
  WHEN sl.session_number = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
  WHEN sl.session_number = 8 THEN (CURRENT_DATE + INTERVAL '14 days')::date
  
  -- Any remaining sessions: spread out weekly
  ELSE (CURRENT_DATE + INTERVAL '21 days')::date
END
WHERE sl.booking_id IN (SELECT id FROM cleaning_bookings);

-- Step 4: Update session statuses to match dates
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
),
cleaning_bookings AS (
  SELECT id FROM public.bookings 
  WHERE tenant_id = (SELECT id FROM cleanpro_tenant)
)
UPDATE public.session_logs sl
SET 
  status = CASE 
    WHEN sl.session_number <= 2 THEN 'completed'
    WHEN sl.session_number = 3 AND sl.assigned_time::time < CURRENT_TIME THEN 'in_progress'
    WHEN sl.session_number = 3 THEN 'scheduled'
    ELSE 'scheduled'
  END,
  completed_date = CASE 
    WHEN sl.session_number <= 2 THEN sl.assigned_date
    ELSE NULL
  END
WHERE sl.booking_id IN (SELECT id FROM cleaning_bookings);

-- Step 5: Verify updated dates
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
)
SELECT 
  sl.id,
  sl.session_number,
  sl.assigned_date,
  sl.assigned_time,
  sl.status,
  sl.completed_date,
  b.booking_number,
  c.name_mother as customer_name,
  u.full_name as assigned_ktv
FROM public.session_logs sl
JOIN public.bookings b ON b.id = sl.booking_id
JOIN public.customers c ON c.id = b.customer_id
LEFT JOIN public.users u ON u.id = b.assigned_ktv_id
WHERE b.tenant_id = (SELECT id FROM cleanpro_tenant)
ORDER BY sl.assigned_date, sl.assigned_time, b.booking_number, sl.session_number;

-- Step 6: Update booking completed_sessions count
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
),
cleaning_bookings AS (
  SELECT id FROM public.bookings 
  WHERE tenant_id = (SELECT id FROM cleanpro_tenant)
)
UPDATE public.bookings b
SET completed_sessions = (
  SELECT COUNT(*)
  FROM public.session_logs sl
  WHERE sl.booking_id = b.id
    AND sl.status = 'completed'
)
WHERE b.id IN (SELECT id FROM cleaning_bookings);

-- Step 7: Final summary
WITH cleanpro_tenant AS (
  SELECT id FROM public.tenants 
  WHERE name LIKE '%CleanPro%'
  LIMIT 1
)
SELECT 
  COUNT(*) FILTER (WHERE sl.status = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'in_progress') as in_progress_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'scheduled' AND sl.assigned_date = CURRENT_DATE) as today_scheduled,
  COUNT(*) FILTER (WHERE sl.status = 'scheduled' AND sl.assigned_date > CURRENT_DATE) as future_scheduled,
  COUNT(*) as total_sessions
FROM public.session_logs sl
JOIN public.bookings b ON b.id = sl.booking_id
WHERE b.tenant_id = (SELECT id FROM cleanpro_tenant);
