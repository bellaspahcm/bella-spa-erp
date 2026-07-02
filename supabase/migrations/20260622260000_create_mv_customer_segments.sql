-- Migration: Create Materialized View for Customer Segmentation (RFM Analysis)
-- Purpose: Aggregate customer RFM (Recency, Frequency, Monetary) scores for segmentation
-- Refresh: Every 6 hours via cron job (customer behavior changes gradually)
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_customer_segments CASCADE;

-- Create materialized view for Customer Segmentation
CREATE MATERIALIZED VIEW mv_customer_segments AS
WITH customer_transactions AS (
  -- Get all confirmed bookings with revenue
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
    b.total_sessions
  FROM customers c
  LEFT JOIN bookings b ON b.customer_id = c.id
  WHERE c.tenant_id IS NOT NULL
    AND (b.id IS NULL OR b.status IN ('booked', 'in_progress', 'completed'))
),
customer_metrics AS (
  -- Calculate Recency, Frequency, Monetary metrics
  SELECT
    tenant_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_since,
    
    -- Recency: Days since last booking (lower is better)
    COALESCE(
      EXTRACT(DAY FROM (NOW() - MAX(booking_date)))::INTEGER,
      EXTRACT(DAY FROM (NOW() - customer_since))::INTEGER
    ) AS days_since_last_booking,
    
    -- Frequency: Total number of bookings
    COUNT(booking_id) FILTER (WHERE booking_id IS NOT NULL) AS total_bookings,
    
    -- Monetary: Total revenue from customer
    COALESCE(SUM(booking_amount), 0) AS total_revenue,
    
    -- Average booking amount
    COALESCE(AVG(booking_amount) FILTER (WHERE booking_id IS NOT NULL), 0) AS avg_booking_amount,
    
    -- Total sessions completed
    COALESCE(SUM(completed_sessions), 0) AS total_sessions_completed,
    
    -- Average sessions per booking
    COALESCE(
      AVG(completed_sessions) FILTER (WHERE booking_id IS NOT NULL),
      0
    ) AS avg_sessions_per_booking,
    
    -- Latest booking date
    MAX(booking_date) AS last_booking_date,
    
    -- Customer lifetime in days
    EXTRACT(DAY FROM (NOW() - customer_since))::INTEGER AS customer_lifetime_days
    
  FROM customer_transactions
  GROUP BY tenant_id, customer_id, customer_name, customer_phone, customer_since
),
rfm_scores AS (
  -- Calculate RFM scores using quartiles (1-4 scale, 4 is best)
  SELECT
    *,
    
    -- Recency Score (inverted: lower days = higher score)
    CASE
      WHEN days_since_last_booking <= 30 THEN 4
      WHEN days_since_last_booking <= 90 THEN 3
      WHEN days_since_last_booking <= 180 THEN 2
      ELSE 1
    END AS recency_score,
    
    -- Frequency Score
    CASE
      WHEN total_bookings >= 5 THEN 4
      WHEN total_bookings >= 3 THEN 3
      WHEN total_bookings >= 1 THEN 2
      ELSE 1
    END AS frequency_score,
    
    -- Monetary Score
    CASE
      WHEN total_revenue >= 20000000 THEN 4  -- >= 20M VND
      WHEN total_revenue >= 10000000 THEN 3  -- >= 10M VND
      WHEN total_revenue >= 5000000 THEN 2   -- >= 5M VND
      ELSE 1
    END AS monetary_score
    
  FROM customer_metrics
),
customer_segments AS (
  -- Assign segment based on RFM scores
  SELECT
    *,
    
    -- Overall RFM Score (average of R, F, M)
    ROUND((recency_score + frequency_score + monetary_score)::NUMERIC / 3, 2) AS rfm_score,
    
    -- Segment assignment based on RFM combination
    CASE
      -- Champions: High R, F, M (best customers)
      WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'Champions'
      
      -- Loyal Customers: High F, M, moderate R
      WHEN frequency_score >= 3 AND monetary_score >= 3 THEN 'Loyal Customers'
      
      -- Potential Loyalists: High R, moderate F, M
      WHEN recency_score >= 4 AND frequency_score >= 2 AND monetary_score >= 2 THEN 'Potential Loyalists'
      
      -- Recent Customers: High R, low F, M
      WHEN recency_score >= 4 AND frequency_score <= 2 AND monetary_score <= 2 THEN 'Recent Customers'
      
      -- Promising: Moderate R, F, M
      WHEN recency_score >= 3 AND frequency_score >= 2 AND monetary_score >= 2 THEN 'Promising'
      
      -- Customers Needing Attention: Moderate R, F, M but declining
      WHEN recency_score = 3 AND frequency_score >= 2 THEN 'Need Attention'
      
      -- About to Sleep: Low R, high F, M (used to be good, now inactive)
      WHEN recency_score <= 2 AND frequency_score >= 3 AND monetary_score >= 3 THEN 'About To Sleep'
      
      -- At Risk: Low R, moderate F, M
      WHEN recency_score <= 2 AND frequency_score >= 2 THEN 'At Risk'
      
      -- Can't Lose Them: Very low R, high F, M (VIP customers going away)
      WHEN recency_score = 1 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'Cannot Lose'
      
      -- Hibernating: Very low R, moderate F, M
      WHEN recency_score = 1 AND frequency_score >= 2 THEN 'Hibernating'
      
      -- Lost: Very low R, low F, M
      WHEN recency_score = 1 AND frequency_score = 1 THEN 'Lost'
      
      -- New Customers: Just signed up, no bookings yet
      WHEN total_bookings = 0 THEN 'New'
      
      ELSE 'Other'
    END AS segment,
    
    -- Segment priority for retention actions (1-5, 1 is highest priority)
    CASE
      WHEN recency_score = 1 AND frequency_score >= 4 AND monetary_score >= 4 THEN 1  -- Cannot Lose
      WHEN recency_score <= 2 AND frequency_score >= 3 AND monetary_score >= 3 THEN 2  -- About To Sleep
      WHEN recency_score <= 2 AND frequency_score >= 2 THEN 3                          -- At Risk
      WHEN recency_score = 3 AND frequency_score >= 2 THEN 4                           -- Need Attention
      ELSE 5
    END AS retention_priority
    
  FROM rfm_scores
)
SELECT
  tenant_id,
  customer_id,
  customer_name,
  customer_phone,
  customer_since,
  customer_lifetime_days,
  
  -- RFM Metrics
  days_since_last_booking,
  total_bookings,
  total_revenue,
  avg_booking_amount,
  total_sessions_completed,
  avg_sessions_per_booking,
  last_booking_date,
  
  -- RFM Scores
  recency_score,
  frequency_score,
  monetary_score,
  rfm_score,
  
  -- Segmentation
  segment,
  retention_priority,
  
  -- Derived insights
  CASE
    WHEN retention_priority <= 2 THEN 'High Risk'
    WHEN retention_priority = 3 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END AS churn_risk_level,
  
  CASE
    WHEN segment IN ('Champions', 'Loyal Customers') THEN 'Reward & Retain'
    WHEN segment IN ('Potential Loyalists', 'Promising') THEN 'Nurture & Upsell'
    WHEN segment IN ('Recent Customers', 'New') THEN 'Onboard & Convert'
    WHEN segment IN ('Need Attention', 'About To Sleep', 'At Risk') THEN 'Re-engage Urgently'
    WHEN segment IN ('Cannot Lose', 'Hibernating') THEN 'Win Back Campaign'
    WHEN segment = 'Lost' THEN 'Sunset or Archive'
    ELSE 'Monitor'
  END AS recommended_action,
  
  -- Metadata
  NOW() AS computed_at

FROM customer_segments

ORDER BY tenant_id, rfm_score DESC, total_revenue DESC;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_customer_segments_unique 
  ON mv_customer_segments (tenant_id, customer_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_customer_segments_tenant_segment 
  ON mv_customer_segments (tenant_id, segment, rfm_score DESC);

CREATE INDEX idx_mv_customer_segments_rfm_score 
  ON mv_customer_segments (tenant_id, rfm_score DESC, total_revenue DESC);

CREATE INDEX idx_mv_customer_segments_churn_risk 
  ON mv_customer_segments (tenant_id, churn_risk_level, retention_priority ASC);

CREATE INDEX idx_mv_customer_segments_segment 
  ON mv_customer_segments (segment, tenant_id);

CREATE INDEX idx_mv_customer_segments_revenue 
  ON mv_customer_segments (tenant_id, total_revenue DESC)
  WHERE total_revenue > 0;

CREATE INDEX idx_mv_customer_segments_recent_activity 
  ON mv_customer_segments (tenant_id, last_booking_date DESC NULLS LAST)
  WHERE last_booking_date IS NOT NULL;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_customer_segments TO authenticated;
GRANT SELECT ON mv_customer_segments TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_customer_segments IS 
  'Customer segmentation using RFM (Recency, Frequency, Monetary) analysis. Includes 11 predefined segments (Champions, Loyal, At Risk, Lost, etc.) with churn risk levels and recommended retention actions. Refreshed every 6 hours. Used by Customer Intelligence Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;
