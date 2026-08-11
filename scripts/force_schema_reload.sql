-- ============================================================================
-- Force PostgREST Schema Cache Reload
-- ============================================================================
-- Run this in Supabase SQL Editor when schema changes not appearing in API
-- ============================================================================

-- Method 1: Send notification to PostgREST (standard way)
NOTIFY pgrst, 'reload schema';

-- Method 2: Send notification to reload config (backup)
NOTIFY pgrst, 'reload config';

-- Method 3: Verify tables exist (sanity check)
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('persons', 'students', 'courses', 'enrollments')
ORDER BY table_name;

-- Expected output:
-- table_name   | column_count
-- courses      | 11
-- enrollments  | 15
-- persons      | 17
-- students     | 21

-- ============================================================================
-- If tables exist but PostgREST still not seeing them:
-- 1. Wait 60 seconds for auto-refresh
-- 2. Restart PostgREST service (Supabase Dashboard → API Settings)
-- 3. Contact Supabase support (schema cache issue)
-- ============================================================================
