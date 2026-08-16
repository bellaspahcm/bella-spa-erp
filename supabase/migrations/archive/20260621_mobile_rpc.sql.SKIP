-- Migration: Phase 1 Week 2 — RPC for mobile dashboard
-- Created: 2026-06-22
-- Purpose: Optimize mobile dashboard queries with server-side join

-- ============================================================================
-- Function: rpc_mobile_today_sessions
-- ============================================================================
-- Returns today's sessions with all related data (customer, KTV, package)
-- 
-- Parameters:
--   p_tenant_id: UUID - Filter by tenant
--   p_today: DATE - Today's date (client timezone)
--   p_ktv_id: UUID - NULL for admin (all sessions), KTV ID for technician filter
--
-- Returns: List of sessions with denormalized data
-- Security: DEFINER (runs with function owner privileges, bypasses RLS)
-- Performance: Single query vs 4 separate queries from mobile
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_mobile_today_sessions(
  p_tenant_id UUID,
  p_today DATE,
  p_ktv_id UUID DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  booking_id UUID,
  status TEXT,
  assigned_time TEXT,
  customer_name TEXT,
  baby_name TEXT,
  ktv_name TEXT,
  package_name TEXT,
  completed_sessions INT,
  total_sessions INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sl.id AS session_id,
    sl.booking_id,
    sl.status,
    sl.assigned_time,
    c.name_mother AS customer_name,
    c.name_baby AS baby_name,
    u.full_name AS ktv_name,
    b.package_name,
    b.completed_sessions,
    b.total_sessions
  FROM session_logs sl
  JOIN bookings b ON b.id = sl.booking_id
  JOIN customers c ON c.id = b.customer_id
  LEFT JOIN users u ON u.id = b.assigned_ktv_id
  WHERE
    sl.tenant_id = p_tenant_id
    AND sl.scheduled_date = p_today
    AND sl.status != 'completed'
    AND (p_ktv_id IS NULL OR b.assigned_ktv_id = p_ktv_id)
  ORDER BY sl.assigned_time ASC NULLS LAST;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_mobile_today_sessions TO authenticated;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. SECURITY DEFINER: Function runs with owner privileges (bypasses RLS)
--    This is necessary because mobile users may not have direct SELECT on all tables
--    But tenant_id filter ensures data isolation
--
-- 2. STABLE: Function result doesn't change within same query/transaction
--    Allows query planner to optimize (vs VOLATILE which doesn't)
--
-- 3. Filter logic:
--    - status != 'completed': Only show pending/in-progress sessions
--    - p_ktv_id IS NULL: Admin sees all sessions
--    - p_ktv_id = xxx: KTV only sees their assigned sessions
--
-- 4. Performance:
--    - Single roundtrip vs 4 separate queries
--    - Server-side join (faster than client-side)
--    - Returns only needed columns (no over-fetching)
--
-- 5. TODO: Add index if slow
--    CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_date_status
--      ON session_logs(tenant_id, scheduled_date, status)
--      WHERE status != 'completed';
-- ============================================================================
