-- ============================================================================
-- Booking Engine Deployment Verification
-- Run these queries in Supabase SQL Editor to verify deployment
-- ============================================================================

-- Query 1: Check all 4 tables created
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY table_name;
-- Expected: 4 rows

-- Query 2: Check indexes (should be 17 total)
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY tablename, indexname;
-- Expected: 17 rows

-- Query 3: Check RLS policies (should be 4 - one per table)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY tablename, policyname;
-- Expected: 4 rows (tenant isolation policies)

-- Query 4: Check functions (should be 3)
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'expire_old_waitlist_entries',
  'calculate_waitlist_priority',
  'get_available_capacity'
)
ORDER BY routine_name;
-- Expected: 3 rows

-- Query 5: Check table structures
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('waitlist', 'pricing_rules', 'capacity_snapshots', 'booking_events')
ORDER BY table_name, ordinal_position;

-- Query 6: Test capacity function
SELECT * FROM get_available_capacity(
  (SELECT id FROM tenants LIMIT 1),
  CURRENT_DATE,
  'morning'
);
-- Should return 1 row with capacity metrics

-- Query 7: Test priority calculation
SELECT calculate_waitlist_priority(
  (SELECT id FROM customers LIMIT 1),
  (SELECT tenant_id FROM customers LIMIT 1)
);
-- Should return an integer (0-100)

-- ============================================================================
-- Expected Results Summary
-- ============================================================================
-- Tables: 4 (waitlist, pricing_rules, capacity_snapshots, booking_events)
-- Indexes: 17 total
-- RLS Policies: 4 (one per table)
-- Functions: 3 (expire, calculate_priority, get_capacity)
-- ============================================================================
