-- Migration: Create Materialized View for Monthly P&L Statement
-- Purpose: Aggregate P&L metrics for Finance Dashboard
-- Refresh: Every 1 hour via cron job (financial data changes less frequently)
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_pnl CASCADE;

-- Create materialized view for P&L
CREATE MATERIALIZED VIEW mv_monthly_pnl AS
WITH monthly_revenue AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', received_date)::DATE AS month,
    revenue_type,
    SUM(amount) FILTER (WHERE status = 'confirmed') AS total_amount,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS transaction_count
  FROM revenue
  WHERE received_date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', received_date)::DATE, revenue_type
),
monthly_expenses AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', expense_date)::DATE AS month,
    category,
    SUM(amount) FILTER (WHERE (status = 'approved' OR status = 'paid') AND category != 'salary') AS total_amount,
    COUNT(*) FILTER (WHERE (status = 'approved' OR status = 'paid') AND category != 'salary') AS transaction_count
  FROM expenses
  WHERE expense_date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', expense_date)::DATE, category
),
monthly_salary_expenses AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', expense_date)::DATE AS month,
    SUM(amount) FILTER (WHERE status = 'approved' OR status = 'paid') AS total_salary_expenses
  FROM expenses
  WHERE expense_date IS NOT NULL
    AND category = 'salary'
  GROUP BY tenant_id, DATE_TRUNC('month', expense_date)::DATE
),
monthly_accrued_salaries AS (
  SELECT
    tenant_id,
    month_year AS month,
    SUM(total_salary) AS total_accrued_salaries,
    COUNT(DISTINCT ktv_id) AS ktv_count
  FROM salary_records
  WHERE total_salary IS NOT NULL
  GROUP BY tenant_id, month_year
),
monthly_sessions AS (
  SELECT
    b.tenant_id,
    DATE_TRUNC('month', sl.completed_date)::DATE AS month,
    COUNT(DISTINCT sl.id) AS total_sessions_completed,
    COUNT(DISTINCT b.id) AS total_bookings
  FROM session_logs sl
  INNER JOIN bookings b ON b.id = sl.booking_id
  WHERE sl.status = 'completed'
    AND sl.completed_date IS NOT NULL
  GROUP BY b.tenant_id, DATE_TRUNC('month', sl.completed_date)::DATE
)
SELECT
  COALESCE(mr.tenant_id, me.tenant_id, mas.tenant_id, ms.tenant_id) AS tenant_id,
  COALESCE(mr.month, me.month, mas.month, ms.month) AS month,
  
  -- Revenue breakdown
  COALESCE(SUM(mr.total_amount) FILTER (WHERE mr.revenue_type = 'booking'), 0) AS booking_revenue,
  COALESCE(SUM(mr.total_amount) FILTER (WHERE mr.revenue_type = 'product'), 0) AS product_revenue,
  COALESCE(SUM(mr.total_amount) FILTER (WHERE mr.revenue_type = 'package'), 0) AS package_revenue,
  COALESCE(SUM(mr.total_amount) FILTER (WHERE mr.revenue_type = 'other'), 0) AS other_revenue,
  COALESCE(SUM(mr.total_amount), 0) AS total_revenue,
  COALESCE(SUM(mr.transaction_count), 0) AS revenue_transaction_count,
  
  -- Operating expense breakdown (excluding salary)
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'rent'), 0) AS rent_expense,
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'utilities'), 0) AS utilities_expense,
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'supplies'), 0) AS supplies_expense,
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'marketing'), 0) AS marketing_expense,
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'maintenance'), 0) AS maintenance_expense,
  COALESCE(SUM(me.total_amount) FILTER (WHERE me.category = 'other'), 0) AS other_operating_expense,
  COALESCE(SUM(me.total_amount), 0) AS total_operating_expenses,
  COALESCE(SUM(me.transaction_count), 0) AS operating_expense_transaction_count,
  
  -- Salary expenses (prefer posted expense records, fall back to accrued salaries)
  COALESCE(
    mse.total_salary_expenses,
    mas.total_accrued_salaries,
    0
  ) AS total_ktv_salaries,
  COALESCE(mas.ktv_count, 0) AS ktv_count,
  
  -- P&L calculations
  COALESCE(SUM(mr.total_amount), 0) AS gross_revenue,
  COALESCE(SUM(me.total_amount), 0) + COALESCE(
    mse.total_salary_expenses,
    mas.total_accrued_salaries,
    0
  ) AS total_expenses,
  COALESCE(SUM(mr.total_amount), 0) - (
    COALESCE(SUM(me.total_amount), 0) + COALESCE(
      mse.total_salary_expenses,
      mas.total_accrued_salaries,
      0
    )
  ) AS net_profit,
  
  -- Profit margin percentage
  CASE
    WHEN COALESCE(SUM(mr.total_amount), 0) > 0 THEN
      ROUND(
        (
          COALESCE(SUM(mr.total_amount), 0) - (
            COALESCE(SUM(me.total_amount), 0) + COALESCE(
              mse.total_salary_expenses,
              mas.total_accrued_salaries,
              0
            )
          )
        )::NUMERIC / COALESCE(SUM(mr.total_amount), 1) * 100,
        2
      )
    ELSE 0
  END AS profit_margin_pct,
  
  -- Operational metrics
  COALESCE(ms.total_sessions_completed, 0) AS total_sessions_completed,
  COALESCE(ms.total_bookings, 0) AS total_bookings,
  
  -- Metadata
  NOW() AS computed_at

FROM monthly_revenue mr
FULL OUTER JOIN monthly_expenses me ON me.tenant_id = mr.tenant_id AND me.month = mr.month
FULL OUTER JOIN monthly_salary_expenses mse ON mse.tenant_id = COALESCE(mr.tenant_id, me.tenant_id) AND mse.month = COALESCE(mr.month, me.month)
FULL OUTER JOIN monthly_accrued_salaries mas ON mas.tenant_id = COALESCE(mr.tenant_id, me.tenant_id, mse.tenant_id) AND mas.month = COALESCE(mr.month, me.month, mse.month)
FULL OUTER JOIN monthly_sessions ms ON ms.tenant_id = COALESCE(mr.tenant_id, me.tenant_id, mse.tenant_id, mas.tenant_id) AND ms.month = COALESCE(mr.month, me.month, mse.month, mas.month)

WHERE COALESCE(mr.tenant_id, me.tenant_id, mas.tenant_id, ms.tenant_id) IS NOT NULL

GROUP BY
  COALESCE(mr.tenant_id, me.tenant_id, mas.tenant_id, ms.tenant_id),
  COALESCE(mr.month, me.month, mas.month, ms.month),
  mse.total_salary_expenses,
  mas.total_accrued_salaries,
  mas.ktv_count,
  ms.total_sessions_completed,
  ms.total_bookings;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_monthly_pnl_unique 
  ON mv_monthly_pnl (tenant_id, month);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_monthly_pnl_tenant 
  ON mv_monthly_pnl (tenant_id, month DESC);

CREATE INDEX idx_mv_monthly_pnl_profit 
  ON mv_monthly_pnl (tenant_id, net_profit DESC);

CREATE INDEX idx_mv_monthly_pnl_revenue 
  ON mv_monthly_pnl (tenant_id, total_revenue DESC);

CREATE INDEX idx_mv_monthly_pnl_recent 
  ON mv_monthly_pnl (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '6 months');

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_monthly_pnl TO authenticated;
GRANT SELECT ON mv_monthly_pnl TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_monthly_pnl IS 
  'Aggregated monthly P&L statement with revenue breakdown, operating expenses, KTV salaries, and profit metrics. Refreshed hourly. Used by Finance Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_pnl;
