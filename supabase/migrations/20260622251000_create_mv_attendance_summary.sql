-- Migration: Create Materialized View for Attendance Summary
-- Purpose: Aggregate attendance rates, absences, and on-time metrics for HR Dashboard
-- Refresh: Every 1 hour via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_attendance_summary CASCADE;

-- Create materialized view for Attendance Summary
CREATE MATERIALIZED VIEW mv_attendance_summary AS
WITH monthly_attendance AS (
  SELECT
    a.tenant_id,
    DATE_TRUNC('month', a.date)::DATE AS month,
    a.ktv_id,
    u.full_name AS ktv_name,
    u.role AS ktv_role,
    
    -- Attendance metrics
    COUNT(*) AS total_days,
    COUNT(*) FILTER (WHERE a.status = 'present') AS days_present,
    COUNT(*) FILTER (WHERE a.status = 'absent') AS days_absent,
    COUNT(*) FILTER (WHERE a.status = 'late') AS days_late,
    COUNT(*) FILTER (WHERE a.status = 'half_day') AS days_half_day,
    
    -- Working days calculation (present + late + half_day)
    COUNT(*) FILTER (WHERE a.status IN ('present', 'late', 'half_day')) AS working_days,
    
    -- On-time rate
    ROUND(
      COUNT(*) FILTER (WHERE a.status = 'present')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE a.status IN ('present', 'late')), 0) * 100,
      2
    ) AS on_time_rate_pct,
    
    -- Attendance rate (working days / total days)
    ROUND(
      COUNT(*) FILTER (WHERE a.status IN ('present', 'late', 'half_day'))::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS attendance_rate_pct,
    
    -- Average check-in time for late arrivals
    AVG(EXTRACT(EPOCH FROM (a.check_in_time - '08:30:00'::TIME)) / 60) FILTER (WHERE a.status = 'late') AS avg_late_minutes
    
  FROM attendance a
  INNER JOIN users u ON u.id = a.ktv_id
  WHERE a.date IS NOT NULL
  GROUP BY a.tenant_id, DATE_TRUNC('month', a.date)::DATE, a.ktv_id, u.full_name, u.role
),
ktv_performance_scores AS (
  SELECT
    ma.tenant_id,
    ma.month,
    ma.ktv_id,
    ma.ktv_name,
    ma.ktv_role,
    ma.total_days,
    ma.days_present,
    ma.days_absent,
    ma.days_late,
    ma.days_half_day,
    ma.working_days,
    ma.on_time_rate_pct,
    ma.attendance_rate_pct,
    ma.avg_late_minutes,
    
    -- Performance score (0-100): weighted average of attendance (70%) and on-time (30%)
    ROUND(
      (COALESCE(ma.attendance_rate_pct, 0) * 0.7 + COALESCE(ma.on_time_rate_pct, 0) * 0.3),
      2
    ) AS attendance_performance_score,
    
    -- Rank within tenant for the month
    RANK() OVER (PARTITION BY ma.tenant_id, ma.month ORDER BY 
      (COALESCE(ma.attendance_rate_pct, 0) * 0.7 + COALESCE(ma.on_time_rate_pct, 0) * 0.3) DESC
    ) AS performance_rank
    
  FROM monthly_attendance ma
)
SELECT
  tenant_id,
  month,
  ktv_id,
  ktv_name,
  ktv_role,
  
  -- Attendance counts
  total_days,
  days_present,
  days_absent,
  days_late,
  days_half_day,
  working_days,
  
  -- Rates
  on_time_rate_pct,
  attendance_rate_pct,
  avg_late_minutes,
  
  -- Performance metrics
  attendance_performance_score,
  performance_rank,
  
  -- Status flag
  CASE
    WHEN attendance_rate_pct >= 95 THEN 'excellent'
    WHEN attendance_rate_pct >= 85 THEN 'good'
    WHEN attendance_rate_pct >= 75 THEN 'fair'
    ELSE 'poor'
  END AS attendance_status,
  
  -- Metadata
  NOW() AS computed_at

FROM ktv_performance_scores

ORDER BY tenant_id, month DESC, performance_rank ASC;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_attendance_summary_unique 
  ON mv_attendance_summary (tenant_id, month, ktv_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_attendance_summary_tenant 
  ON mv_attendance_summary (tenant_id, month DESC, ktv_id);

CREATE INDEX idx_mv_attendance_summary_performance 
  ON mv_attendance_summary (tenant_id, month DESC, attendance_performance_score DESC);

CREATE INDEX idx_mv_attendance_summary_status 
  ON mv_attendance_summary (tenant_id, attendance_status);

CREATE INDEX idx_mv_attendance_summary_recent 
  ON mv_attendance_summary (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '12 months');

CREATE INDEX idx_mv_attendance_summary_absences 
  ON mv_attendance_summary (tenant_id, days_absent DESC)
  WHERE days_absent > 0;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_attendance_summary TO authenticated;
GRANT SELECT ON mv_attendance_summary TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_attendance_summary IS 
  'Aggregated attendance summary by KTV with attendance rates, on-time rates, absences, late arrivals, and performance scores. Refreshed hourly. Used by HR Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_summary;
