-- Migration: Create Materialized View for Customer Lifetime Value (LTV)
-- Purpose: Calculate customer LTV, cohort analysis, and revenue projections
-- Refresh: Every 6 hours via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_customer_ltv CASCADE;

-- Create materialized view for Customer LTV
CREATE MATERIALIZED VIEW mv_customer_ltv AS
WITH customer_cohorts AS (
  -- Assign customers to cohorts by signup month
  SELECT
    tenant_id,
    id AS customer_id,
    name_mother AS customer_name,
    phone AS customer_phone,
    created_at AS customer_since,
    DATE_TRUNC('month', created_at)::DATE AS cohort_month,
    EXTRACT(YEAR FROM created_at)::INTEGER AS cohort_year,
    EXTRACT(MONTH FROM created_at)::INTEGER AS cohort_month_num
  FROM customers
  WHERE tenant_id IS NOT NULL
),
customer_revenue AS (
  -- Calculate total revenue per customer
  SELECT
    c.tenant_id,
    c.customer_id,
    b.id AS booking_id,
    b.created_at AS booking_date,
    b.status AS booking_status,
    COALESCE(b.full_price, 0) AS booking_amount,
    b.completed_sessions,
    b.total_sessions,
    DATE_TRUNC('month', b.created_at)::DATE AS booking_month
  FROM customer_cohorts c
  LEFT JOIN bookings b ON b.customer_id = c.customer_id
  WHERE b.id IS NULL OR b.status IN ('booked', 'in_progress', 'completed')
),
customer_lifetime_metrics AS (
  -- Calculate lifetime metrics per customer
  SELECT
    cc.tenant_id,
    cc.customer_id,
    cc.customer_name,
    cc.customer_phone,
    cc.customer_since,
    cc.cohort_month,
    cc.cohort_year,
    cc.cohort_month_num,
    
    -- Lifetime metrics
    COUNT(cr.booking_id) FILTER (WHERE cr.booking_id IS NOT NULL) AS total_bookings,
    COALESCE(SUM(cr.booking_amount), 0) AS lifetime_revenue,
    COALESCE(AVG(cr.booking_amount) FILTER (WHERE cr.booking_id IS NOT NULL), 0) AS avg_order_value,
    COALESCE(SUM(cr.completed_sessions), 0) AS total_sessions,
    
    -- First and last purchase dates
    MIN(cr.booking_date) AS first_purchase_date,
    MAX(cr.booking_date) AS last_purchase_date,
    
    -- Customer age in months
    EXTRACT(MONTH FROM AGE(NOW(), cc.customer_since))::INTEGER AS customer_age_months,
    
    -- Active months (months with at least one booking)
    COUNT(DISTINCT cr.booking_month) FILTER (WHERE cr.booking_id IS NOT NULL) AS active_months,
    
    -- Days since first purchase
    COALESCE(
      EXTRACT(DAY FROM (NOW() - MIN(cr.booking_date)))::INTEGER,
      EXTRACT(DAY FROM (NOW() - cc.customer_since))::INTEGER
    ) AS days_since_first_purchase,
    
    -- Days since last purchase
    COALESCE(
      EXTRACT(DAY FROM (NOW() - MAX(cr.booking_date)))::INTEGER,
      EXTRACT(DAY FROM (NOW() - cc.customer_since))::INTEGER
    ) AS days_since_last_purchase
    
  FROM customer_cohorts cc
  LEFT JOIN customer_revenue cr ON cr.customer_id = cc.customer_id
  GROUP BY 
    cc.tenant_id, 
    cc.customer_id, 
    cc.customer_name, 
    cc.customer_phone, 
    cc.customer_since,
    cc.cohort_month, 
    cc.cohort_year, 
    cc.cohort_month_num
),
cohort_benchmarks AS (
  -- Calculate cohort-level benchmarks for LTV projection
  SELECT
    tenant_id,
    cohort_month,
    
    COUNT(DISTINCT customer_id) AS cohort_size,
    AVG(lifetime_revenue) AS avg_cohort_ltv,
    AVG(total_bookings) AS avg_cohort_bookings,
    AVG(avg_order_value) AS avg_cohort_order_value,
    AVG(active_months) AS avg_cohort_active_months,
    
    -- Cohort retention rate (customers still active)
    ROUND(
      COUNT(DISTINCT customer_id) FILTER (WHERE days_since_last_purchase <= 90)::NUMERIC / 
      NULLIF(COUNT(DISTINCT customer_id), 0) * 100,
      2
    ) AS cohort_retention_rate_pct,
    
    -- Average customer lifespan in months
    AVG(customer_age_months) AS avg_customer_lifespan_months
    
  FROM customer_lifetime_metrics
  GROUP BY tenant_id, cohort_month
),
customer_ltv_calculations AS (
  -- Calculate LTV and projected LTV
  SELECT
    clm.*,
    cb.cohort_size,
    cb.avg_cohort_ltv,
    cb.avg_cohort_bookings,
    cb.avg_cohort_order_value,
    cb.avg_cohort_active_months,
    cb.cohort_retention_rate_pct,
    cb.avg_customer_lifespan_months,
    
    -- Current LTV (actual revenue to date)
    clm.lifetime_revenue AS current_ltv,
    
    -- Projected LTV using cohort benchmarks
    -- Formula: avg_order_value * (avg_cohort_bookings / avg_cohort_active_months) * 12 months
    CASE
      WHEN clm.total_bookings >= 2 AND clm.active_months >= 2 THEN
        -- Use customer's own metrics if they have enough history
        ROUND(
          clm.avg_order_value * 
          (clm.total_bookings::NUMERIC / NULLIF(clm.active_months, 0)) * 
          12,
          2
        )
      WHEN cb.avg_cohort_active_months > 0 THEN
        -- Use cohort benchmarks for newer customers
        ROUND(
          cb.avg_cohort_order_value * 
          (cb.avg_cohort_bookings / NULLIF(cb.avg_cohort_active_months, 0)) * 
          12,
          2
        )
      ELSE
        clm.lifetime_revenue
    END AS projected_annual_ltv,
    
    -- LTV confidence score (0-100)
    CASE
      WHEN clm.total_bookings >= 5 AND clm.active_months >= 6 THEN 100
      WHEN clm.total_bookings >= 3 AND clm.active_months >= 3 THEN 80
      WHEN clm.total_bookings >= 2 AND clm.active_months >= 2 THEN 60
      WHEN clm.total_bookings >= 1 THEN 40
      ELSE 20
    END AS ltv_confidence_score,
    
    -- Customer value tier
    CASE
      WHEN clm.lifetime_revenue >= 50000000 THEN 'VIP'        -- >= 50M VND
      WHEN clm.lifetime_revenue >= 20000000 THEN 'High Value' -- >= 20M VND
      WHEN clm.lifetime_revenue >= 10000000 THEN 'Medium Value' -- >= 10M VND
      WHEN clm.lifetime_revenue >= 5000000 THEN 'Standard'    -- >= 5M VND
      WHEN clm.lifetime_revenue > 0 THEN 'Low Value'
      ELSE 'Prospect'
    END AS customer_value_tier,
    
    -- Purchase frequency (bookings per month)
    CASE
      WHEN clm.active_months > 0 THEN
        ROUND(clm.total_bookings::NUMERIC / NULLIF(clm.active_months, 0), 2)
      ELSE 0
    END AS purchase_frequency,
    
    -- Customer activity status
    CASE
      WHEN clm.days_since_last_purchase <= 30 THEN 'Active'
      WHEN clm.days_since_last_purchase <= 90 THEN 'Moderately Active'
      WHEN clm.days_since_last_purchase <= 180 THEN 'Inactive'
      ELSE 'Dormant'
    END AS activity_status
    
  FROM customer_lifetime_metrics clm
  INNER JOIN cohort_benchmarks cb ON cb.tenant_id = clm.tenant_id AND cb.cohort_month = clm.cohort_month
)
SELECT
  tenant_id,
  customer_id,
  customer_name,
  customer_phone,
  customer_since,
  cohort_month,
  cohort_year,
  cohort_month_num,
  
  -- Cohort Metrics
  cohort_size,
  avg_cohort_ltv,
  cohort_retention_rate_pct,
  avg_customer_lifespan_months,
  
  -- Customer Lifetime Metrics
  total_bookings,
  lifetime_revenue,
  avg_order_value,
  total_sessions,
  first_purchase_date,
  last_purchase_date,
  customer_age_months,
  active_months,
  days_since_first_purchase,
  days_since_last_purchase,
  
  -- LTV Calculations
  current_ltv,
  projected_annual_ltv,
  ltv_confidence_score,
  customer_value_tier,
  purchase_frequency,
  activity_status,
  
  -- Rank within cohort
  RANK() OVER (
    PARTITION BY tenant_id, cohort_month 
    ORDER BY lifetime_revenue DESC
  ) AS cohort_ltv_rank,
  
  -- Rank within tenant (all customers)
  RANK() OVER (
    PARTITION BY tenant_id 
    ORDER BY lifetime_revenue DESC
  ) AS tenant_ltv_rank,
  
  -- Percentile within tenant
  ROUND(
    PERCENT_RANK() OVER (
      PARTITION BY tenant_id 
      ORDER BY lifetime_revenue
    ) * 100,
    2
  ) AS ltv_percentile,
  
  -- Metadata
  NOW() AS computed_at

FROM customer_ltv_calculations

ORDER BY tenant_id, lifetime_revenue DESC, customer_id;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_customer_ltv_unique 
  ON mv_customer_ltv (tenant_id, customer_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_customer_ltv_tenant_cohort 
  ON mv_customer_ltv (tenant_id, cohort_month DESC, lifetime_revenue DESC);

CREATE INDEX idx_mv_customer_ltv_value_tier 
  ON mv_customer_ltv (tenant_id, customer_value_tier, lifetime_revenue DESC);

CREATE INDEX idx_mv_customer_ltv_activity_status 
  ON mv_customer_ltv (tenant_id, activity_status, last_purchase_date DESC NULLS LAST);

CREATE INDEX idx_mv_customer_ltv_high_value 
  ON mv_customer_ltv (tenant_id, lifetime_revenue DESC)
  WHERE customer_value_tier IN ('VIP', 'High Value');

CREATE INDEX idx_mv_customer_ltv_cohort_analysis 
  ON mv_customer_ltv (cohort_month DESC, tenant_id, cohort_ltv_rank ASC);

CREATE INDEX idx_mv_customer_ltv_projected 
  ON mv_customer_ltv (tenant_id, projected_annual_ltv DESC)
  WHERE ltv_confidence_score >= 60;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_customer_ltv TO authenticated;
GRANT SELECT ON mv_customer_ltv TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_customer_ltv IS 
  'Customer Lifetime Value (LTV) analysis with cohort benchmarking, projected annual LTV, value tiers (VIP/High/Medium/Standard/Low/Prospect), purchase frequency, and activity status. Refreshed every 6 hours. Used by Customer Intelligence Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_ltv;
