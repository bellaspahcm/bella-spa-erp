-- Migration: Create Materialized View for Budget Variance Analysis
-- Purpose: Compare actual vs budgeted expenses for Finance Dashboard
-- Refresh: Every 1 hour via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_budget_variance CASCADE;

-- Create materialized view for Budget Variance
-- Note: Assumes a 'budgets' table exists with columns: tenant_id, month, category, budgeted_amount
-- If budgets table doesn't exist yet, this view will have zero budget data until populated
CREATE MATERIALIZED VIEW mv_budget_variance AS
WITH monthly_actual_expenses AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', expense_date)::DATE AS month,
    category,
    SUM(amount) FILTER (WHERE status = 'approved' OR status = 'paid') AS actual_amount,
    COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') AS transaction_count
  FROM expenses
  WHERE expense_date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', expense_date)::DATE, category
),
monthly_budgets AS (
  -- If budgets table exists, join it here
  -- For now, return zero budgets (will be populated later when budgets feature is implemented)
  SELECT
    ae.tenant_id,
    ae.month,
    ae.category,
    0::NUMERIC AS budgeted_amount
  FROM monthly_actual_expenses ae
)
SELECT
  COALESCE(ae.tenant_id, mb.tenant_id) AS tenant_id,
  COALESCE(ae.month, mb.month) AS month,
  COALESCE(ae.category, mb.category) AS category,
  
  -- Budget and actual amounts
  COALESCE(mb.budgeted_amount, 0) AS budgeted_amount,
  COALESCE(ae.actual_amount, 0) AS actual_amount,
  COALESCE(ae.transaction_count, 0) AS transaction_count,
  
  -- Variance (negative = over budget, positive = under budget)
  COALESCE(mb.budgeted_amount, 0) - COALESCE(ae.actual_amount, 0) AS variance_amount,
  
  -- Variance percentage
  CASE
    WHEN COALESCE(mb.budgeted_amount, 0) > 0 THEN
      ROUND(
        ((COALESCE(mb.budgeted_amount, 0) - COALESCE(ae.actual_amount, 0))::NUMERIC / 
         COALESCE(mb.budgeted_amount, 1)) * 100,
        2
      )
    ELSE 0
  END AS variance_pct,
  
  -- Utilization percentage (actual / budget)
  CASE
    WHEN COALESCE(mb.budgeted_amount, 0) > 0 THEN
      ROUND(
        (COALESCE(ae.actual_amount, 0)::NUMERIC / COALESCE(mb.budgeted_amount, 1)) * 100,
        2
      )
    ELSE 0
  END AS utilization_pct,
  
  -- Status flag
  CASE
    WHEN COALESCE(mb.budgeted_amount, 0) = 0 THEN 'no_budget'
    WHEN COALESCE(ae.actual_amount, 0) > COALESCE(mb.budgeted_amount, 0) THEN 'over_budget'
    WHEN COALESCE(ae.actual_amount, 0) >= COALESCE(mb.budgeted_amount, 0) * 0.9 THEN 'near_budget'
    ELSE 'under_budget'
  END AS budget_status,
  
  -- Metadata
  NOW() AS computed_at

FROM monthly_actual_expenses ae
FULL OUTER JOIN monthly_budgets mb ON mb.tenant_id = ae.tenant_id AND mb.month = ae.month AND mb.category = ae.category

WHERE COALESCE(ae.tenant_id, mb.tenant_id) IS NOT NULL;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_budget_variance_unique 
  ON mv_budget_variance (tenant_id, month, category);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_budget_variance_tenant 
  ON mv_budget_variance (tenant_id, month DESC, category);

CREATE INDEX idx_mv_budget_variance_status 
  ON mv_budget_variance (tenant_id, budget_status);

CREATE INDEX idx_mv_budget_variance_over_budget 
  ON mv_budget_variance (tenant_id, variance_amount ASC)
  WHERE budget_status = 'over_budget';

CREATE INDEX idx_mv_budget_variance_recent 
  ON mv_budget_variance (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '6 months');

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_budget_variance TO authenticated;
GRANT SELECT ON mv_budget_variance TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_budget_variance IS 
  'Budget variance analysis comparing actual expenses vs budgeted amounts by category. Includes variance amount, percentage, and status flags. Refreshed hourly. Used by Finance Dashboard. Note: Requires budgets table to be implemented for budget data.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_budget_variance;
