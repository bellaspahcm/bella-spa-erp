-- Migration: Create Materialized View for Session Analytics
-- Purpose: Session completion rates, peak hours, and satisfaction metrics
-- Refresh: Every 10 minutes via cron job
-- Created: 2026-06-22
-- Updated: Fixed to use assigned_date, assigned_time, start_time, completed_by_ktv_id

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_session_analytics CASCADE;

-- Create materialized view
CREATE MATERIALIZED VIEW mv_session_analytics AS
SELECT
  sl.tenant_id,
  DATE_TRUNC('day', sl.assigned_date)::DATE AS date,
  
  -- Session counts by status
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'completed') AS completed_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'cancelled') AS cancelled_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'no_show') AS no_show_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'scheduled') AS scheduled_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'in_progress') AS in_progress_sessions,
  
  -- Completion rate
  ROUND(
    COALESCE(
      COUNT(*) FILTER (WHERE sl.status = 'completed')::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100,
      0
    ),
    2
  ) AS completion_rate_pct,
  
  -- Cancellation rate
  ROUND(
    COALESCE(
      COUNT(*) FILTER (WHERE sl.status = 'cancelled')::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100,
      0
    ),
    2
  ) AS cancellation_rate_pct,
  
  -- No-show rate
  ROUND(
    COALESCE(
      COUNT(*) FILTER (WHERE sl.status = 'no_show')::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100,
      0
    ),
    2
  ) AS no_show_rate_pct,
  
  -- By package type (assuming packages table exists with service_category)
  COUNT(*) FILTER (WHERE p.service_category = 'basic' OR p.name ILIKE '%basic%' OR p.name ILIKE '%tiết kiệm%') AS basic_package_sessions,
  COUNT(*) FILTER (WHERE p.service_category = 'premium' OR p.name ILIKE '%premium%' OR p.name ILIKE '%hạnh phúc%') AS premium_package_sessions,
  COUNT(*) FILTER (WHERE p.service_category = 'vip' OR p.name ILIKE '%vip%' OR p.name ILIKE '%toàn diện%') AS vip_package_sessions,
  
  -- By time of day (peak hours analysis) - using assigned_time
  COUNT(*) FILTER (
    WHERE EXTRACT(HOUR FROM sl.assigned_time) BETWEEN 8 AND 11
  ) AS morning_sessions,
  COUNT(*) FILTER (
    WHERE EXTRACT(HOUR FROM sl.assigned_time) BETWEEN 12 AND 16
  ) AS afternoon_sessions,
  COUNT(*) FILTER (
    WHERE EXTRACT(HOUR FROM sl.assigned_time) BETWEEN 17 AND 21
  ) AS evening_sessions,
  
  -- Peak hour (hour with most sessions)
  MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM COALESCE(sl.assigned_time, '12:00'::TIME))) AS peak_hour,
  
  -- Customer satisfaction (from session ratings)
  ROUND(
    COALESCE(AVG(sl.rating) FILTER (WHERE sl.rating IS NOT NULL), 0),
    2
  ) AS avg_satisfaction_rating,
  COUNT(*) FILTER (WHERE sl.rating >= 4) AS high_satisfaction_count,
  COUNT(*) FILTER (WHERE sl.rating = 3) AS medium_satisfaction_count,
  COUNT(*) FILTER (WHERE sl.rating <= 2) AS low_satisfaction_count,
  COUNT(*) FILTER (WHERE sl.rating IS NOT NULL) AS total_ratings,
  
  -- Duration analysis (in minutes) - using start_time and end_time
  ROUND(
    COALESCE(AVG(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) FILTER (WHERE sl.status = 'completed' AND sl.start_time IS NOT NULL AND sl.end_time IS NOT NULL), 0),
    1
  ) AS avg_duration_minutes,
  MAX(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) FILTER (WHERE sl.status = 'completed' AND sl.start_time IS NOT NULL AND sl.end_time IS NOT NULL) AS max_duration_minutes,
  MIN(EXTRACT(EPOCH FROM (sl.end_time - sl.start_time)) / 60) FILTER (WHERE sl.status = 'completed' AND sl.start_time IS NOT NULL AND sl.end_time IS NOT NULL) AS min_duration_minutes,
  
  -- Revenue metrics (using full_price from bookings)
  COALESCE(SUM(b.full_price) FILTER (WHERE sl.status = 'completed'), 0) AS total_revenue,
  COALESCE(AVG(b.full_price) FILTER (WHERE sl.status = 'completed'), 0) AS avg_revenue_per_session,
  
  -- Unique customers and KTVs (using completed_by_ktv_id)
  COUNT(DISTINCT b.customer_id) AS unique_customers,
  COUNT(DISTINCT sl.completed_by_ktv_id) AS unique_ktvs,
  
  -- Service quality indicators
  COUNT(*) FILTER (WHERE sl.status = 'completed' AND sl.rating >= 4) AS successful_quality_sessions,
  ROUND(
    COALESCE(
      COUNT(*) FILTER (WHERE sl.status = 'completed' AND sl.rating >= 4)::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE sl.status = 'completed'), 0) * 100,
      0
    ),
    2
  ) AS quality_success_rate_pct,
  
  -- Metadata
  NOW() AS computed_at

FROM session_logs sl
LEFT JOIN bookings b ON b.id = sl.booking_id
LEFT JOIN packages p ON p.id = b.package_id

WHERE sl.tenant_id IS NOT NULL
  AND sl.assigned_date IS NOT NULL

GROUP BY 
  sl.tenant_id, 
  DATE_TRUNC('day', sl.assigned_date)::DATE;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_session_analytics_unique 
  ON mv_session_analytics (tenant_id, date);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_session_analytics_tenant 
  ON mv_session_analytics (tenant_id);

CREATE INDEX idx_mv_session_analytics_date_range 
  ON mv_session_analytics (tenant_id, date DESC);

CREATE INDEX idx_mv_session_analytics_completion_rate 
  ON mv_session_analytics (tenant_id, completion_rate_pct DESC);

CREATE INDEX idx_mv_session_analytics_satisfaction 
  ON mv_session_analytics (tenant_id, avg_satisfaction_rating DESC);

-- Grant access to authenticated users and anon
GRANT SELECT ON mv_session_analytics TO authenticated;
GRANT SELECT ON mv_session_analytics TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_session_analytics IS 
  'Daily session analytics with completion rates, peak hours, and satisfaction metrics. Refresh every 10 minutes. Uses assigned_date, assigned_time, start_time/end_time, completed_by_ktv_id.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_session_analytics;
