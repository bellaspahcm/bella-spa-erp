-- ============================================================================
-- DEPLOY RPC TO PRODUCTION
-- Chạy script này trên Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- RPC #1: rpc_mobile_today_sessions
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
    AND sl.assigned_date = p_today
    AND sl.status != 'completed'
    AND (p_ktv_id IS NULL OR b.assigned_ktv_id = p_ktv_id)
  ORDER BY sl.assigned_time ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION rpc_mobile_today_sessions TO authenticated;

-- ============================================================================
-- RPC #2: rpc_ktv_dashboard_stats
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
    AND sl.assigned_date = p_today
    AND b.assigned_ktv_id = p_ktv_id;
$$;

GRANT EXECUTE ON FUNCTION rpc_ktv_dashboard_stats TO authenticated;

-- ============================================================================
-- VERIFY DEPLOYMENT
-- ============================================================================
SELECT 
  routine_name, 
  routine_type,
  routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('rpc_mobile_today_sessions', 'rpc_ktv_dashboard_stats')
ORDER BY routine_name;

-- Kết quả mong đợi: 2 rows
-- rpc_mobile_today_sessions  | FUNCTION | t
-- rpc_ktv_dashboard_stats    | FUNCTION | t
