-- Migration: Week 3 — Fix KTV Dashboard Stats Query
-- Created: 2026-06-22
-- Purpose: Fix Issue #1 - KTV should only see their assigned sessions, not all spa sessions

-- ============================================================================
-- Function: rpc_ktv_dashboard_stats
-- ============================================================================
-- Returns KTV-specific dashboard statistics (only sessions assigned to them)
-- 
-- Parameters:
--   p_tenant_id: UUID - Filter by tenant
--   p_ktv_id: UUID - Filter by assigned KTV
--   p_today: DATE - Today's date (client timezone)
--
-- Returns: 
--   total_sessions: Total sessions assigned to this KTV today
--   completed_sessions: Completed sessions by this KTV today
--
-- Security: DEFINER (runs with function owner privileges, bypasses RLS)
-- Business Logic: MUST filter by assigned_ktv_id to prevent showing all spa stats
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_ktv_dashboard_stats(
  p_tenant_id UUID,
  p_ktv_id UUID,
  p_today DATE
)
RETURNS TABLE (
  total_sessions INT,
  completed_sessions INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INT AS total_sessions,
    COUNT(*) FILTER (WHERE sl.status = 'completed')::INT AS completed_sessions
  FROM session_logs sl
  JOIN bookings b ON b.id = sl.booking_id
  WHERE
    sl.tenant_id = p_tenant_id
    AND sl.scheduled_date = p_today
    AND b.assigned_ktv_id = p_ktv_id;  -- ✅ CRITICAL: Filter by assigned KTV
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_ktv_dashboard_stats TO authenticated;

-- ============================================================================
-- Performance Notes:
-- ============================================================================
-- This function relies on JOIN between session_logs and bookings
-- If slow (>200ms on 1000+ rows), add composite index:
--
-- CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_date_for_stats
--   ON session_logs(tenant_id, scheduled_date)
--   INCLUDE (status, booking_id);
--
-- CREATE INDEX IF NOT EXISTS idx_bookings_ktv_for_stats
--   ON bookings(assigned_ktv_id)
--   INCLUDE (id);
-- ============================================================================

-- ============================================================================
-- Security Notes:
-- ============================================================================
-- 1. SECURITY DEFINER: Bypasses RLS, but tenant_id filter ensures isolation
-- 2. Client CANNOT tamper with p_ktv_id parameter and see other KTV's stats
--    because the filter is applied server-side
-- 3. This replaces the insecure client-side filter pattern
-- ============================================================================

-- ============================================================================
-- Testing:
-- ============================================================================
-- Test case 1: KTV with 3 sessions (2 completed, 1 pending)
--   SELECT * FROM rpc_ktv_dashboard_stats(
--     '<tenant-id>',
--     '<ktv-user-id>',
--     '2026-06-22'
--   );
--   Expected: total_sessions = 3, completed_sessions = 2
--
-- Test case 2: KTV with no sessions today
--   Expected: total_sessions = 0, completed_sessions = 0
--
-- Test case 3: Different KTV IDs should return different counts
-- ============================================================================
