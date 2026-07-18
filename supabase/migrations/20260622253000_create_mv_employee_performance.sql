-- Migration: Create Materialized View for Employee Performance
-- Purpose: Aggregate KPI scores, star ratings, session counts, and revenue contribution for HR Dashboard
-- Refresh: Every 1 hour via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_employee_performance CASCADE;

-- Create materialized view for Employee Performance
CREATE MATERIALIZED VIEW mv_employee_performance AS
WITH monthly_sessions AS (
  SELECT
    b.tenant_id,
    DATE_TRUNC('month', sl.completed_date)::DATE AS month,
    sl.completed_by_ktv_id AS ktv_id,
    
    -- Session counts
    COUNT(DISTINCT sl.id) AS total_sessions_completed,
    COUNT(DISTINCT b.id) AS total_bookings_served,
    
    -- Average star rating from customers
    ROUND(AVG(sl.rating) FILTER (WHERE sl.rating IS NOT NULL), 2) AS avg_star_rating,
    COUNT(*) FILTER (WHERE sl.rating IS NOT NULL) AS ratings_count,
    
    -- Rating distribution
    COUNT(*) FILTER (WHERE sl.rating = 5) AS five_star_count,
    COUNT(*) FILTER (WHERE sl.rating = 4) AS four_star_count,
    COUNT(*) FILTER (WHERE sl.rating <= 3) AS below_four_count
    
  FROM session_logs sl
  INNER JOIN bookings b ON b.id = sl.booking_id
  WHERE sl.status = 'completed'
    AND sl.completed_date IS NOT NULL
    AND sl.completed_by_ktv_id IS NOT NULL
  GROUP BY b.tenant_id, DATE_TRUNC('month', sl.completed_date)::DATE, sl.completed_by_ktv_id
),
monthly_kpi AS (
  SELECT
    tenant_id,
    month_year AS month,
    ktv_id,
    
    -- KPI metrics
    COALESCE(kpi_achievement_rate, 0) AS kpi_score,
    COALESCE(bonus_amount, 0) AS kpi_amount,
    COALESCE(sessions_completed, 0) AS kpi_sessions,
    COALESCE(customer_satisfaction, 0) AS customer_satisfaction_score
    
  FROM kpi_records
  WHERE month_year IS NOT NULL
    AND ktv_id IS NOT NULL
),
monthly_revenue_contribution AS (
  SELECT
    b.tenant_id,
    DATE_TRUNC('month', r.received_date)::DATE AS month,
    b.assigned_ktv_id AS ktv_id,
    
    -- Revenue metrics (only confirmed bookings)
    SUM(r.amount) FILTER (WHERE r.status = 'confirmed') AS total_revenue_contributed,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed') AS revenue_transaction_count
    
  FROM revenue r
  INNER JOIN bookings b ON b.id = r.booking_id
  WHERE r.received_date IS NOT NULL
    AND b.assigned_ktv_id IS NOT NULL
  GROUP BY b.tenant_id, DATE_TRUNC('month', r.received_date)::DATE, b.assigned_ktv_id
),
monthly_attendance_metrics AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', date)::DATE AS month,
    ktv_id,
    
    -- Attendance metrics
    COUNT(*) FILTER (WHERE status IN ('present', 'late', 'half_day')) AS working_days,
    COUNT(*) FILTER (WHERE status = 'present') AS on_time_days,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_days
    
  FROM attendance
  WHERE date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', date)::DATE, ktv_id
),
ktv_performance_combined AS (
  SELECT
    COALESCE(ms.tenant_id, mk.tenant_id, mrc.tenant_id, mam.tenant_id) AS tenant_id,
    COALESCE(ms.month, mk.month, mrc.month, mam.month) AS month,
    COALESCE(ms.ktv_id, mk.ktv_id, mrc.ktv_id, mam.ktv_id) AS ktv_id,
    u.full_name AS ktv_name,
    u.role AS ktv_role,
    u.phone AS ktv_phone,
    COALESCE(u.status = 'active', false) AS is_active,
    
    -- Session metrics
    COALESCE(ms.total_sessions_completed, 0) AS total_sessions_completed,
    COALESCE(ms.total_bookings_served, 0) AS total_bookings_served,
    
    -- Rating metrics
    COALESCE(ms.avg_star_rating, 0) AS avg_star_rating,
    COALESCE(ms.ratings_count, 0) AS ratings_count,
    COALESCE(ms.five_star_count, 0) AS five_star_count,
    COALESCE(ms.four_star_count, 0) AS four_star_count,
    COALESCE(ms.below_four_count, 0) AS below_four_count,
    
    -- KPI metrics
    COALESCE(mk.kpi_score, 0) AS kpi_score,
    COALESCE(mk.kpi_amount, 0) AS kpi_amount,
    COALESCE(mk.customer_satisfaction_score, 0) AS customer_satisfaction_score,
    
    -- Revenue metrics
    COALESCE(mrc.total_revenue_contributed, 0) AS total_revenue_contributed,
    COALESCE(mrc.revenue_transaction_count, 0) AS revenue_transaction_count,
    
    -- Attendance metrics
    COALESCE(mam.working_days, 0) AS working_days,
    COALESCE(mam.on_time_days, 0) AS on_time_days,
    COALESCE(mam.absent_days, 0) AS absent_days,
    
    -- Productivity metrics (revenue per session, sessions per working day)
    CASE
      WHEN COALESCE(ms.total_sessions_completed, 0) > 0 THEN
        ROUND(COALESCE(mrc.total_revenue_contributed, 0) / NULLIF(ms.total_sessions_completed, 0), 2)
      ELSE 0
    END AS revenue_per_session,
    
    CASE
      WHEN COALESCE(mam.working_days, 0) > 0 THEN
        ROUND(COALESCE(ms.total_sessions_completed, 0)::NUMERIC / NULLIF(mam.working_days, 0), 2)
      ELSE 0
    END AS sessions_per_working_day,
    
    -- Overall performance score (weighted: KPI 40%, Rating 30%, Productivity 30%)
    ROUND(
      (COALESCE(mk.kpi_score, 0) * 0.4 + 
       COALESCE(ms.avg_star_rating, 0) * 20 * 0.3 + 
       LEAST(COALESCE(ms.total_sessions_completed, 0) / NULLIF(COALESCE(mam.working_days, 1), 0) * 10, 100) * 0.3),
      2
    ) AS overall_performance_score,
    
    -- Rank by overall performance within tenant for the month
    RANK() OVER (PARTITION BY COALESCE(ms.tenant_id, mk.tenant_id, mrc.tenant_id, mam.tenant_id), COALESCE(ms.month, mk.month, mrc.month, mam.month) ORDER BY 
      (COALESCE(mk.kpi_score, 0) * 0.4 + 
       COALESCE(ms.avg_star_rating, 0) * 20 * 0.3 + 
       LEAST(COALESCE(ms.total_sessions_completed, 0) / NULLIF(COALESCE(mam.working_days, 1), 0) * 10, 100) * 0.3) DESC
    ) AS performance_rank
    
  FROM monthly_sessions ms
  FULL OUTER JOIN monthly_kpi mk ON mk.tenant_id = ms.tenant_id AND mk.month = ms.month AND mk.ktv_id = ms.ktv_id
  FULL OUTER JOIN monthly_revenue_contribution mrc ON mrc.tenant_id = COALESCE(ms.tenant_id, mk.tenant_id) AND mrc.month = COALESCE(ms.month, mk.month) AND mrc.ktv_id = COALESCE(ms.ktv_id, mk.ktv_id)
  FULL OUTER JOIN monthly_attendance_metrics mam ON mam.tenant_id = COALESCE(ms.tenant_id, mk.tenant_id, mrc.tenant_id) AND mam.month = COALESCE(ms.month, mk.month, mrc.month) AND mam.ktv_id = COALESCE(ms.ktv_id, mk.ktv_id, mrc.ktv_id)
  LEFT JOIN users u ON u.id = COALESCE(ms.ktv_id, mk.ktv_id, mrc.ktv_id, mam.ktv_id)
  
  WHERE COALESCE(ms.tenant_id, mk.tenant_id, mrc.tenant_id, mam.tenant_id) IS NOT NULL
)
SELECT
  tenant_id,
  month,
  ktv_id,
  ktv_name,
  ktv_role,
  ktv_phone,
  is_active,
  
  -- Session metrics
  total_sessions_completed,
  total_bookings_served,
  
  -- Rating metrics
  avg_star_rating,
  ratings_count,
  five_star_count,
  four_star_count,
  below_four_count,
  
  -- KPI metrics
  kpi_score,
  kpi_amount,
  customer_satisfaction_score,
  
  -- Revenue metrics
  total_revenue_contributed,
  revenue_transaction_count,
  
  -- Attendance metrics
  working_days,
  on_time_days,
  absent_days,
  
  -- Productivity metrics
  revenue_per_session,
  sessions_per_working_day,
  
  -- Performance metrics
  overall_performance_score,
  performance_rank,
  
  -- Performance tier (top 10%, top 25%, etc.)
  CASE
    WHEN performance_rank <= (0.1 * COUNT(*) OVER (PARTITION BY tenant_id, month)) THEN 'top_10'
    WHEN performance_rank <= (0.25 * COUNT(*) OVER (PARTITION BY tenant_id, month)) THEN 'top_25'
    WHEN performance_rank <= (0.5 * COUNT(*) OVER (PARTITION BY tenant_id, month)) THEN 'top_50'
    ELSE 'below_50'
  END AS performance_tier,
  
  -- Metadata
  NOW() AS computed_at

FROM ktv_performance_combined

ORDER BY tenant_id, month DESC, performance_rank ASC;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_employee_performance_unique 
  ON mv_employee_performance (tenant_id, month, ktv_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_employee_performance_tenant 
  ON mv_employee_performance (tenant_id, month DESC, ktv_id);

CREATE INDEX idx_mv_employee_performance_rank 
  ON mv_employee_performance (tenant_id, month DESC, performance_rank ASC);

CREATE INDEX idx_mv_employee_performance_score 
  ON mv_employee_performance (tenant_id, overall_performance_score DESC);

CREATE INDEX idx_mv_employee_performance_tier 
  ON mv_employee_performance (tenant_id, performance_tier);

CREATE INDEX idx_mv_employee_performance_recent 
  ON mv_employee_performance (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '12 months');

CREATE INDEX idx_mv_employee_performance_top_performers 
  ON mv_employee_performance (tenant_id, month DESC, performance_rank ASC)
  WHERE performance_rank <= 10;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_employee_performance TO authenticated;
GRANT SELECT ON mv_employee_performance TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_employee_performance IS 
  'Aggregated employee performance metrics including KPI scores, star ratings, session counts, revenue contribution, attendance, productivity metrics, and overall performance rankings. Refreshed hourly. Used by HR Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW mv_employee_performance;
