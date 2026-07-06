-- ============================================================================
-- Overbooking Detection - Database Validation Queries
-- ============================================================================
-- Purpose: Verify data integrity and validate overbooking detection logic
-- Phase: Phase B - Week 1
-- Status: 🔍 Validation
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 1: Check for Existing KTV Double-Bookings (Should be ZERO after fix)
-- ─────────────────────────────────────────────────────────────────────────────
-- This finds sessions where the same KTV is assigned to overlapping time slots

WITH ktv_sessions AS (
  SELECT 
    sl1.id AS session1_id,
    sl2.id AS session2_id,
    b1.assigned_ktv_id,
    sl1.assigned_date,
    sl1.assigned_time AS time1,
    sl2.assigned_time AS time2,
    b1.tenant_id,
    c1.name_mother AS customer1,
    c2.name_mother AS customer2
  FROM session_logs sl1
  JOIN bookings b1 ON sl1.booking_id = b1.id
  JOIN customers c1 ON b1.customer_id = c1.id
  JOIN session_logs sl2 ON sl2.id != sl1.id 
    AND sl2.assigned_date = sl1.assigned_date
  JOIN bookings b2 ON sl2.booking_id = b2.id
    AND b2.assigned_ktv_id = b1.assigned_ktv_id
    AND b2.tenant_id = b1.tenant_id
  JOIN customers c2 ON b2.customer_id = c2.id
  WHERE 
    sl1.status NOT IN ('cancelled', 'completed')
    AND sl2.status NOT IN ('cancelled', 'completed')
    AND b1.assigned_ktv_id IS NOT NULL
    -- Check if time slots overlap (assuming 90 min duration)
    AND (
      (sl1.assigned_time < sl2.assigned_time AND 
       (sl1.assigned_time::time + INTERVAL '90 minutes') > sl2.assigned_time::time)
      OR
      (sl2.assigned_time < sl1.assigned_time AND 
       (sl2.assigned_time::time + INTERVAL '90 minutes') > sl1.assigned_time::time)
    )
)
SELECT 
  COUNT(*) AS total_ktv_conflicts,
  assigned_ktv_id,
  assigned_date,
  STRING_AGG(DISTINCT customer1 || ' (' || time1 || ')', ', ') AS conflicts
FROM ktv_sessions
GROUP BY assigned_ktv_id, assigned_date
ORDER BY total_ktv_conflicts DESC;

-- Expected Result: 0 rows (no conflicts after overbooking detection is enabled)
-- If > 0: Indicates existing conflicts in database that need resolution

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 2: Check for Existing Room Double-Bookings
-- ─────────────────────────────────────────────────────────────────────────────

WITH room_sessions AS (
  SELECT 
    sl1.id AS session1_id,
    sl2.id AS session2_id,
    sl1.booking_resource_id,
    sl1.assigned_date,
    sl1.assigned_time AS time1,
    sl2.assigned_time AS time2,
    b1.tenant_id
  FROM session_logs sl1
  JOIN bookings b1 ON sl1.booking_id = b1.id
  JOIN session_logs sl2 ON sl2.id != sl1.id 
    AND sl2.assigned_date = sl1.assigned_date
    AND sl2.booking_resource_id = sl1.booking_resource_id
  JOIN bookings b2 ON sl2.booking_id = b2.id
    AND b2.tenant_id = b1.tenant_id
  WHERE 
    sl1.booking_resource_id IS NOT NULL
    AND sl1.status NOT IN ('cancelled', 'completed')
    AND sl2.status NOT IN ('cancelled', 'completed')
    -- Check overlap
    AND (
      (sl1.assigned_time < sl2.assigned_time AND 
       (sl1.assigned_time::time + INTERVAL '90 minutes') > sl2.assigned_time::time)
      OR
      (sl2.assigned_time < sl1.assigned_time AND 
       (sl2.assigned_time::time + INTERVAL '90 minutes') > sl1.assigned_time::time)
    )
)
SELECT 
  COUNT(*) AS total_room_conflicts,
  booking_resource_id,
  assigned_date,
  STRING_AGG(DISTINCT time1 || ' & ' || time2, ', ') AS conflict_times
FROM room_sessions
GROUP BY booking_resource_id, assigned_date
ORDER BY total_room_conflicts DESC;

-- Expected Result: 0 rows (no room conflicts)

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 3: KTV Daily Session Counts (Check for overload)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 
  b.assigned_ktv_id,
  u.full_name AS ktv_name,
  sl.assigned_date,
  COUNT(*) AS total_sessions,
  CASE 
    WHEN COUNT(*) >= 10 THEN '🚫 Hard Limit Exceeded'
    WHEN COUNT(*) > 8 THEN '⚠️ Soft Limit Warning'
    ELSE '✅ Normal'
  END AS workload_status
FROM session_logs sl
JOIN bookings b ON sl.booking_id = b.id
LEFT JOIN users u ON b.assigned_ktv_id = u.id
WHERE 
  sl.status NOT IN ('cancelled')
  AND b.assigned_ktv_id IS NOT NULL
  AND sl.assigned_date >= CURRENT_DATE - INTERVAL '7 days' -- Last 7 days
GROUP BY b.assigned_ktv_id, u.full_name, sl.assigned_date
HAVING COUNT(*) > 8 -- Only show potential issues
ORDER BY total_sessions DESC, sl.assigned_date DESC;

-- Expected Result: Few or zero rows (most KTVs should be under 8 sessions/day)
-- If many rows: Indicates workload management issues

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 4: Audit Log - Decision Engine Activity
-- ─────────────────────────────────────────────────────────────────────────────
-- Check if overbooking decisions are being logged

SELECT 
  DATE(created_at) AS decision_date,
  COUNT(*) AS total_decisions,
  COUNT(CASE WHEN new_data->>'decision' = 'approve' THEN 1 END) AS approved,
  COUNT(CASE WHEN new_data->>'decision' = 'reject' THEN 1 END) AS rejected,
  COUNT(CASE WHEN new_data->>'decision' = 'approve_with_warning' THEN 1 END) AS warnings,
  ROUND(AVG((new_data->>'confidence')::numeric), 2) AS avg_confidence
FROM audit_log
WHERE 
  action = 'DECISION'
  AND new_data->>'decisionType' = 'overbooking-check'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY decision_date DESC;

-- Expected Result: 
-- - Should see rows after deployment (Jun 22, 2026)
-- - Approved should be 95%+
-- - Rejected should be <5%
-- - Confidence should be >0.9

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 5: Tenant Isolation Verification
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure decisions respect tenant boundaries

SELECT 
  b.tenant_id,
  t.name AS tenant_name,
  COUNT(DISTINCT sl.id) AS total_sessions,
  COUNT(DISTINCT b.assigned_ktv_id) AS total_ktvs,
  COUNT(DISTINCT sl.booking_resource_id) AS total_rooms
FROM session_logs sl
JOIN bookings b ON sl.booking_id = b.id
JOIN tenants t ON b.tenant_id = t.id
WHERE sl.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY b.tenant_id, t.name
ORDER BY total_sessions DESC;

-- Expected Result: 
-- - Bella Spa (0e66365b...) should have separate counts
-- - Test Beauty Spa (11111111...) should have separate counts
-- - No mixing of data

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 6: Policy Effectiveness - Conflict Prevention Rate
-- ─────────────────────────────────────────────────────────────────────────────

WITH decisions AS (
  SELECT 
    new_data->>'decision' AS decision,
    (new_data->>'conflictCount')::int AS conflict_count,
    created_at
  FROM audit_log
  WHERE 
    action = 'DECISION'
    AND new_data->>'decisionType' = 'overbooking-check'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
),
conflicts_prevented AS (
  SELECT COUNT(*) AS prevented
  FROM decisions
  WHERE decision = 'reject' AND conflict_count > 0
),
total_checks AS (
  SELECT COUNT(*) AS total
  FROM decisions
)
SELECT 
  prevented.prevented AS conflicts_prevented,
  total_checks.total AS total_decisions,
  ROUND(100.0 * prevented.prevented / NULLIF(total_checks.total, 0), 2) AS prevention_rate_percent
FROM conflicts_prevented, total_checks;

-- Expected Result:
-- - Prevention rate should be 1-5% (most bookings are legitimate)
-- - If 0%: No conflicts detected yet (normal if just deployed)
-- - If >10%: Might indicate aggressive blocking or bad data

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 7: Recent Session Creation Activity
-- ─────────────────────────────────────────────────────────────────────────────
-- Monitor session creation patterns

SELECT 
  DATE(sl.created_at) AS creation_date,
  COUNT(*) AS sessions_created,
  COUNT(DISTINCT b.assigned_ktv_id) AS unique_ktvs,
  COUNT(DISTINCT b.customer_id) AS unique_customers,
  COUNT(CASE WHEN sl.status = 'scheduled' THEN 1 END) AS scheduled,
  COUNT(CASE WHEN sl.status = 'cancelled' THEN 1 END) AS cancelled
FROM session_logs sl
JOIN bookings b ON sl.booking_id = b.id
WHERE sl.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(sl.created_at)
ORDER BY creation_date DESC;

-- Expected Result:
-- - Should see daily session creation activity
-- - Cancelled rate should be <10%

-- ─────────────────────────────────────────────────────────────────────────────
-- Query 8: Test Beauty Spa Data Verification
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure Test Beauty Spa has test data

SELECT 
  'Test Beauty Spa' AS tenant,
  COUNT(DISTINCT u.id) AS total_ktvs,
  COUNT(DISTINCT c.id) AS total_customers,
  COUNT(DISTINCT b.id) AS total_bookings,
  COUNT(DISTINCT sl.id) AS total_sessions
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'ktv'
LEFT JOIN customers c ON c.tenant_id = t.id
LEFT JOIN bookings b ON b.tenant_id = t.id
LEFT JOIN session_logs sl ON sl.booking_id = b.id
WHERE t.id = '11111111-1111-1111-1111-111111111111'
GROUP BY t.name;

-- Expected Result:
-- - total_ktvs: Should have at least 2
-- - total_customers: Should have at least 1
-- - total_bookings: Should have at least 1
-- - If zeros: Need to create test data first

-- ============================================================================
-- Usage Instructions
-- ============================================================================
-- 1. Run queries in Supabase SQL Editor or psql
-- 2. Compare results against expected values
-- 3. Document any discrepancies
-- 4. If Query 1-2 show conflicts: Need to clean up existing data
-- 5. If Query 4 shows no activity: Overbooking detection not working
-- 6. If Query 8 shows zeros: Need to create test data
-- ============================================================================
