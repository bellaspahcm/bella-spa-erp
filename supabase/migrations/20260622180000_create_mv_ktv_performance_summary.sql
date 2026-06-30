-- Migration: Create Materialized View for KTV Performance Summary
-- Purpose: Aggregate KTV metrics for Operations Dashboard
-- Refresh: Every 10 minutes via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_ktv_performance_summary CASCADE;

-- Create materialized view
CREATE MATERIALIZED VIEW mv_ktv_performance_summary AS
SELECT
  u.id AS ktv_id,
  u.tenant_id,
  u.full_name AS ktv_name,
  u.email AS ktv_email,
  u.phone AS ktv_phone,
  DATE_TRUNC('month', COALESCE(sl.scheduled_date, CURRENT_DATE))::DATE AS month,
  
  -- Session metrics
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.status = 'completed') AS total_sessions_completed,
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.status = 'cancelled') AS total_sessions_cancelled,
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.status = 'no_show') AS total_sessions_no_show,
  COUNT(DISTINCT sl.id) AS total_sessions_all,
  ROUND(
    COALESCE(
      COUNT(DISTINCT sl.id) FILTER (WHERE sl.status = 'completed')::NUMERIC / 
      NULLIF(COUNT(DISTINCT sl.id), 0) * 100,
      0
    ),
    2
  ) AS completion_rate_pct,
  
  -- Rating metrics (from reviews or session ratings)
  ROUND(COALESCE(AVG(sl.rating) FILTER (WHERE sl.rating IS NOT NULL), 0), 2) AS avg_rating,
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.rating >= 4) AS high_ratings_count,
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.rating <= 2) AS low_ratings_count,
  COUNT(DISTINCT sl.id) FILTER (WHERE sl.rating IS NOT NULL) AS total_ratings_count,
  
  -- Revenue metrics (from bookings or session_logs)
  COALESCE(SUM(b.total_amount) FILTER (WHERE sl.status = 'completed'), 0) AS total_revenue,
  COALESCE(AVG(b.total_amount) FILTER (WHERE sl.status = 'completed'), 0) AS avg_revenue_per_session,
  
  -- Commission metrics (from salary_records or calculated)
  COALESCE(SUM(sr.service_commission) FILTER (WHERE sr.month_year = DATE_TRUNC('month', sl.scheduled_date)::DATE), 0) AS total_service_commission,
  COALESCE(SUM(sr.session_bonus) FILTER (WHERE sr.month_year = DATE_TRUNC('month', sl.scheduled_date)::DATE), 0) AS total_session_bonus,
  
  -- Attendance metrics
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present') AS days_present,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'absent') AS days_absent,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'late') AS days_late,
  COUNT(DISTINCT a.id) AS total_attendance_days,
  ROUND(
    COALESCE(
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'present')::NUMERIC / 
      NULLIF(COUNT(DISTINCT a.id), 0) * 100,
      0
    ),
    2
  ) AS attendance_rate_pct,
  
  -- Metadata
  MAX(sl.completed_at) AS last_session_date,
  COUNT(DISTINCT b.customer_id) AS unique_customers_served,
  NOW() AS computed_at

FROM users u
LEFT JOIN session_logs sl ON sl.ktv_id = u.id
LEFT JOIN bookings b ON b.id = sl.booking_id
LEFT JOIN attendance a ON a.user_id = u.id 
  AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', COALESCE(sl.scheduled_date, CURRENT_DATE))
LEFT JOIN salary_records sr ON sr.ktv_id = u.id
  AND sr.month_year = DATE_TRUNC('month', COALESCE(sl.scheduled_date, CURRENT_DATE))::DATE

WHERE u.role = 'ktv'
  AND u.tenant_id IS NOT NULL

GROUP BY 
  u.id, 
  u.tenant_id, 
  u.full_name, 
  u.email, 
  u.phone, 
  DATE_TRUNC('month', COALESCE(sl.scheduled_date, CURRENT_DATE))::DATE;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_ktv_performance_summary_unique 
  ON mv_ktv_performance_summary (ktv_id, month, tenant_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_ktv_performance_summary_tenant 
  ON mv_ktv_performance_summary (tenant_id, month);

CREATE INDEX idx_mv_ktv_performance_summary_month 
  ON mv_ktv_performance_summary (month);

CREATE INDEX idx_mv_ktv_performance_summary_revenue 
  ON mv_ktv_performance_summary (tenant_id, total_revenue DESC);

CREATE INDEX idx_mv_ktv_performance_summary_rating 
  ON mv_ktv_performance_summary (tenant_id, avg_rating DESC);

-- Grant access to authenticated users
GRANT SELECT ON mv_ktv_performance_summary TO authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_ktv_performance_summary IS 
  'Aggregated KTV performance metrics by month. Refresh every 10 minutes. Used by Operations Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ktv_performance_summary;
