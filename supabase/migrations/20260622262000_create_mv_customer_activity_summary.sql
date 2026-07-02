-- Migration: Create Materialized View for Customer Activity Summary
-- Purpose: Aggregate customer activity metrics for churn risk analysis
-- Refresh: Every 6 hours via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_customer_activity_summary CASCADE;

-- Create materialized view for Customer Activity Summary
CREATE MATERIALIZED VIEW mv_customer_activity_summary AS
WITH customer_bookings AS (
  -- Get all bookings per customer
  SELECT
    c.tenant_id,
    c.id AS customer_id,
    c.name_mother AS customer_name,
    c.phone AS customer_phone,
    c.created_at AS customer_since,
    b.id AS booking_id,
    b.created_at AS booking_date,
    b.status AS booking_status,
    COALESCE(b.full_price, 0) AS booking_amount,
    b.completed_sessions,
    b.total_sessions,
    DATE_TRUNC('month', b.created_at)::DATE AS booking_month
  FROM customers c
  LEFT JOIN bookings b ON b.customer_id = c.id
  WHERE c.tenant_id IS NOT NULL
    AND (b.id IS NULL OR b.status IN ('booked', 'in_progress', 'completed'))
),
customer_session_reviews AS (
  -- Get session review metrics per customer
  SELECT
    sl.tenant_id,
    b.customer_id,
    sr.id AS review_id,
    sr.rating AS review_rating,
    sr.created_at AS review_date
  FROM session_reviews sr
  INNER JOIN session_logs sl ON sl.id = sr.session_log_id
  INNER JOIN bookings b ON b.id = sl.booking_id
  WHERE sr.status = 'approved'
),
recent_activity_trends AS (
  -- Calculate activity trends over last 3 periods (90-day windows)
  SELECT
    tenant_id,
    customer_id,
    
    -- Period 1: Last 90 days
    COUNT(booking_id) FILTER (
      WHERE booking_date >= (NOW() - INTERVAL '90 days')
    ) AS bookings_last_90_days,
    COALESCE(
      SUM(booking_amount) FILTER (
        WHERE booking_date >= (NOW() - INTERVAL '90 days')
      ),
      0
    ) AS revenue_last_90_days,
    
    -- Period 2: 90-180 days ago
    COUNT(booking_id) FILTER (
      WHERE booking_date >= (NOW() - INTERVAL '180 days')
        AND booking_date < (NOW() - INTERVAL '90 days')
    ) AS bookings_90_180_days_ago,
    COALESCE(
      SUM(booking_amount) FILTER (
        WHERE booking_date >= (NOW() - INTERVAL '180 days')
          AND booking_date < (NOW() - INTERVAL '90 days')
      ),
      0
    ) AS revenue_90_180_days_ago,
    
    -- Period 3: 180-270 days ago
    COUNT(booking_id) FILTER (
      WHERE booking_date >= (NOW() - INTERVAL '270 days')
        AND booking_date < (NOW() - INTERVAL '180 days')
    ) AS bookings_180_270_days_ago,
    COALESCE(
      SUM(booking_amount) FILTER (
        WHERE booking_date >= (NOW() - INTERVAL '270 days')
          AND booking_date < (NOW() - INTERVAL '180 days')
      ),
      0
    ) AS revenue_180_270_days_ago
    
  FROM customer_bookings
  GROUP BY tenant_id, customer_id
),
customer_activity_metrics AS (
  -- Calculate comprehensive activity metrics
  SELECT
    cb.tenant_id,
    cb.customer_id,
    cb.customer_name,
    cb.customer_phone,
    cb.customer_since,
    
    -- Overall metrics
    COUNT(cb.booking_id) FILTER (WHERE cb.booking_id IS NOT NULL) AS total_bookings,
    COALESCE(SUM(cb.booking_amount), 0) AS total_revenue,
    COALESCE(AVG(cb.booking_amount) FILTER (WHERE cb.booking_id IS NOT NULL), 0) AS avg_booking_amount,
    COALESCE(SUM(cb.completed_sessions), 0) AS total_sessions_completed,
    
    -- Temporal metrics
    MIN(cb.booking_date) AS first_booking_date,
    MAX(cb.booking_date) AS last_booking_date,
    COALESCE(
      EXTRACT(DAY FROM (NOW() - MAX(cb.booking_date)))::INTEGER,
      EXTRACT(DAY FROM (NOW() - cb.customer_since))::INTEGER
    ) AS days_since_last_booking,
    EXTRACT(DAY FROM (NOW() - cb.customer_since))::INTEGER AS customer_lifetime_days,
    
    -- Active months
    COUNT(DISTINCT cb.booking_month) FILTER (WHERE cb.booking_id IS NOT NULL) AS active_months,
    
    -- Average booking frequency (bookings per month)
    CASE
      WHEN COUNT(DISTINCT cb.booking_month) FILTER (WHERE cb.booking_id IS NOT NULL) > 0 THEN
        ROUND(
          COUNT(cb.booking_id) FILTER (WHERE cb.booking_id IS NOT NULL)::NUMERIC / 
          NULLIF(COUNT(DISTINCT cb.booking_month) FILTER (WHERE cb.booking_id IS NOT NULL), 0),
          2
        )
      ELSE 0
    END AS avg_bookings_per_month,
    
    -- Session completion rate
    CASE
      WHEN SUM(cb.total_sessions) > 0 THEN
        ROUND(
          COALESCE(SUM(cb.completed_sessions), 0)::NUMERIC / 
          NULLIF(SUM(cb.total_sessions), 0) * 100,
          2
        )
      ELSE 0
    END AS session_completion_rate_pct,
    
    -- Review metrics
    COUNT(DISTINCT csr.review_id) AS total_reviews,
    COALESCE(AVG(csr.review_rating), 0) AS avg_review_rating,
    
    -- Recent activity trends
    rat.bookings_last_90_days,
    rat.revenue_last_90_days,
    rat.bookings_90_180_days_ago,
    rat.revenue_90_180_days_ago,
    rat.bookings_180_270_days_ago,
    rat.revenue_180_270_days_ago,
    
    -- Activity trend indicators
    CASE
      WHEN rat.bookings_90_180_days_ago > 0 THEN
        ROUND(
          (rat.bookings_last_90_days - rat.bookings_90_180_days_ago)::NUMERIC / 
          NULLIF(rat.bookings_90_180_days_ago, 0) * 100,
          2
        )
      ELSE NULL
    END AS booking_frequency_change_pct,
    
    CASE
      WHEN rat.revenue_90_180_days_ago > 0 THEN
        ROUND(
          (rat.revenue_last_90_days - rat.revenue_90_180_days_ago)::NUMERIC / 
          NULLIF(rat.revenue_90_180_days_ago, 0) * 100,
          2
        )
      ELSE NULL
    END AS revenue_change_pct
    
  FROM customer_bookings cb
  LEFT JOIN customer_session_reviews csr ON csr.customer_id = cb.customer_id
  INNER JOIN recent_activity_trends rat ON rat.tenant_id = cb.tenant_id AND rat.customer_id = cb.customer_id
  GROUP BY 
    cb.tenant_id, 
    cb.customer_id, 
    cb.customer_name, 
    cb.customer_phone, 
    cb.customer_since,
    rat.bookings_last_90_days,
    rat.revenue_last_90_days,
    rat.bookings_90_180_days_ago,
    rat.revenue_90_180_days_ago,
    rat.bookings_180_270_days_ago,
    rat.revenue_180_270_days_ago
),
churn_risk_calculation AS (
  -- Calculate churn risk score
  SELECT
    *,
    
    -- Churn risk factors (0-100 scale, higher = higher risk)
    
    -- Factor 1: Recency (40% weight)
    CASE
      WHEN days_since_last_booking <= 30 THEN 0
      WHEN days_since_last_booking <= 60 THEN 20
      WHEN days_since_last_booking <= 90 THEN 40
      WHEN days_since_last_booking <= 180 THEN 70
      ELSE 100
    END AS recency_risk_score,
    
    -- Factor 2: Booking frequency decline (30% weight)
    CASE
      WHEN booking_frequency_change_pct IS NULL THEN 0  -- Not enough data
      WHEN booking_frequency_change_pct >= 50 THEN 0    -- Growing 50%+
      WHEN booking_frequency_change_pct >= 0 THEN 20    -- Stable or slight growth
      WHEN booking_frequency_change_pct >= -25 THEN 40  -- Declining up to 25%
      WHEN booking_frequency_change_pct >= -50 THEN 70  -- Declining 25-50%
      ELSE 100                                          -- Declining 50%+
    END AS frequency_decline_risk_score,
    
    -- Factor 3: Revenue decline (20% weight)
    CASE
      WHEN revenue_change_pct IS NULL THEN 0           -- Not enough data
      WHEN revenue_change_pct >= 50 THEN 0             -- Growing 50%+
      WHEN revenue_change_pct >= 0 THEN 20             -- Stable or slight growth
      WHEN revenue_change_pct >= -25 THEN 40           -- Declining up to 25%
      WHEN revenue_change_pct >= -50 THEN 70           -- Declining 25-50%
      ELSE 100                                         -- Declining 50%+
    END AS revenue_decline_risk_score,
    
    -- Factor 4: Session satisfaction decline (10% weight)
    CASE
      WHEN avg_review_rating = 0 THEN 50               -- No reviews (moderate risk)
      WHEN avg_review_rating >= 4.5 THEN 0             -- Very satisfied
      WHEN avg_review_rating >= 4.0 THEN 20            -- Satisfied
      WHEN avg_review_rating >= 3.5 THEN 40            -- Moderately satisfied
      WHEN avg_review_rating >= 3.0 THEN 70            -- Dissatisfied
      ELSE 100                                         -- Very dissatisfied
    END AS satisfaction_risk_score
    
  FROM customer_activity_metrics
)
SELECT
  tenant_id,
  customer_id,
  customer_name,
  customer_phone,
  customer_since,
  customer_lifetime_days,
  
  -- Activity Metrics
  total_bookings,
  total_revenue,
  avg_booking_amount,
  total_sessions_completed,
  session_completion_rate_pct,
  first_booking_date,
  last_booking_date,
  days_since_last_booking,
  active_months,
  avg_bookings_per_month,
  
  -- Review Metrics
  total_reviews,
  avg_review_rating,
  
  -- Recent Activity Trends
  bookings_last_90_days,
  revenue_last_90_days,
  bookings_90_180_days_ago,
  revenue_90_180_days_ago,
  bookings_180_270_days_ago,
  revenue_180_270_days_ago,
  booking_frequency_change_pct,
  revenue_change_pct,
  
  -- Churn Risk Factors
  recency_risk_score,
  frequency_decline_risk_score,
  revenue_decline_risk_score,
  satisfaction_risk_score,
  
  -- Overall Churn Risk Score (weighted average)
  ROUND(
    (recency_risk_score * 0.4 + 
     frequency_decline_risk_score * 0.3 + 
     revenue_decline_risk_score * 0.2 + 
     satisfaction_risk_score * 0.1),
    2
  ) AS churn_risk_score,
  
  -- Churn Risk Level
  CASE
    WHEN ROUND(
      (recency_risk_score * 0.4 + 
       frequency_decline_risk_score * 0.3 + 
       revenue_decline_risk_score * 0.2 + 
       satisfaction_risk_score * 0.1),
      2
    ) >= 70 THEN 'High'
    WHEN ROUND(
      (recency_risk_score * 0.4 + 
       frequency_decline_risk_score * 0.3 + 
       revenue_decline_risk_score * 0.2 + 
       satisfaction_risk_score * 0.1),
      2
    ) >= 40 THEN 'Medium'
    ELSE 'Low'
  END AS churn_risk_level,
  
  -- Recommended Retention Actions
  CASE
    WHEN ROUND(
      (recency_risk_score * 0.4 + 
       frequency_decline_risk_score * 0.3 + 
       revenue_decline_risk_score * 0.2 + 
       satisfaction_risk_score * 0.1),
      2
    ) >= 70 THEN ARRAY[
      'Urgent: Personal call from manager',
      'Exclusive VIP discount offer',
      'Survey: Why are you leaving?',
      'Win-back campaign'
    ]
    WHEN ROUND(
      (recency_risk_score * 0.4 + 
       frequency_decline_risk_score * 0.3 + 
       revenue_decline_risk_score * 0.2 + 
       satisfaction_risk_score * 0.1),
      2
    ) >= 40 THEN ARRAY[
      'Re-engagement email campaign',
      'Special promotion offer',
      'Request feedback',
      'Schedule follow-up call'
    ]
    ELSE ARRAY[
      'Regular newsletter',
      'Loyalty rewards reminder',
      'New service announcements'
    ]
  END AS recommended_retention_actions,
  
  -- Metadata
  NOW() AS computed_at

FROM churn_risk_calculation

ORDER BY tenant_id, churn_risk_score DESC, total_revenue DESC;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_customer_activity_summary_unique 
  ON mv_customer_activity_summary (tenant_id, customer_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_customer_activity_summary_churn_risk 
  ON mv_customer_activity_summary (tenant_id, churn_risk_level, churn_risk_score DESC);

CREATE INDEX idx_mv_customer_activity_summary_high_risk 
  ON mv_customer_activity_summary (tenant_id, churn_risk_score DESC)
  WHERE churn_risk_level = 'High';

CREATE INDEX idx_mv_customer_activity_summary_recent_activity 
  ON mv_customer_activity_summary (tenant_id, days_since_last_booking ASC, total_revenue DESC);

CREATE INDEX idx_mv_customer_activity_summary_declining 
  ON mv_customer_activity_summary (tenant_id, booking_frequency_change_pct ASC NULLS LAST)
  WHERE booking_frequency_change_pct < 0;

CREATE INDEX idx_mv_customer_activity_summary_revenue_trend 
  ON mv_customer_activity_summary (tenant_id, revenue_change_pct ASC NULLS LAST);

CREATE INDEX idx_mv_customer_activity_summary_satisfaction 
  ON mv_customer_activity_summary (tenant_id, avg_review_rating ASC)
  WHERE total_reviews > 0;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_customer_activity_summary TO authenticated;
GRANT SELECT ON mv_customer_activity_summary TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_customer_activity_summary IS 
  'Customer activity summary with churn risk analysis. Calculates churn risk score (0-100) using weighted factors: recency (40%), frequency decline (30%), revenue decline (20%), satisfaction (10%). Includes recommended retention actions for High/Medium/Low risk levels. Refreshed every 6 hours. Used by Customer Intelligence Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_activity_summary;
