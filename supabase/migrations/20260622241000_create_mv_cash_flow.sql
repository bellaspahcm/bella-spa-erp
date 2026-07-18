-- Migration: Create Materialized View for Cash Flow Statement
-- Purpose: Track cash inflows/outflows for Finance Dashboard
-- Refresh: Every 1 hour via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_cash_flow CASCADE;

-- Create materialized view for Cash Flow
CREATE MATERIALIZED VIEW mv_cash_flow AS
WITH monthly_cash_inflows AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', received_date)::DATE AS month,
    payment_method,
    revenue_type,
    SUM(amount) FILTER (WHERE status = 'confirmed') AS total_inflow,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS transaction_count
  FROM revenue
  WHERE received_date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', received_date)::DATE, payment_method, revenue_type
),
monthly_cash_outflows AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', expense_date)::DATE AS month,
    COALESCE(accounting_metadata->>'payment_method', 'bank_transfer') AS payment_method,
    category,
    SUM(amount) FILTER (WHERE status = 'paid') AS total_outflow,
    COUNT(*) FILTER (WHERE status = 'paid') AS transaction_count
  FROM expenses
  WHERE expense_date IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', expense_date)::DATE, COALESCE(accounting_metadata->>'payment_method', 'bank_transfer'), category
),
monthly_summary AS (
  SELECT
    COALESCE(ci.tenant_id, co.tenant_id) AS tenant_id,
    COALESCE(ci.month, co.month) AS month,
    
    -- Cash inflows by method
    COALESCE(SUM(ci.total_inflow) FILTER (WHERE ci.payment_method = 'cash'), 0) AS cash_inflow,
    COALESCE(SUM(ci.total_inflow) FILTER (WHERE ci.payment_method = 'bank_transfer'), 0) AS bank_transfer_inflow,
    COALESCE(SUM(ci.total_inflow) FILTER (WHERE ci.payment_method = 'momo'), 0) AS momo_inflow,
    COALESCE(SUM(ci.total_inflow) FILTER (WHERE ci.payment_method = 'zalo_pay'), 0) AS zalo_pay_inflow,
    COALESCE(SUM(ci.total_inflow) FILTER (WHERE ci.payment_method = 'card'), 0) AS card_inflow,
    COALESCE(SUM(ci.total_inflow), 0) AS total_inflow,
    COALESCE(SUM(ci.transaction_count), 0) AS inflow_transaction_count,
    
    -- Cash outflows by method
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.payment_method = 'cash'), 0) AS cash_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.payment_method = 'bank_transfer'), 0) AS bank_transfer_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.payment_method = 'momo'), 0) AS momo_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.payment_method = 'zalo_pay'), 0) AS zalo_pay_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.payment_method = 'card'), 0) AS card_outflow,
    COALESCE(SUM(co.total_outflow), 0) AS total_outflow,
    COALESCE(SUM(co.transaction_count), 0) AS outflow_transaction_count,
    
    -- Cash outflows by category
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'salary'), 0) AS salary_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'rent'), 0) AS rent_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'utilities'), 0) AS utilities_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'supplies'), 0) AS supplies_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'marketing'), 0) AS marketing_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'maintenance'), 0) AS maintenance_outflow,
    COALESCE(SUM(co.total_outflow) FILTER (WHERE co.category = 'other'), 0) AS other_outflow
    
  FROM monthly_cash_inflows ci
  FULL OUTER JOIN monthly_cash_outflows co ON co.tenant_id = ci.tenant_id AND co.month = ci.month
  
  GROUP BY
    COALESCE(ci.tenant_id, co.tenant_id),
    COALESCE(ci.month, co.month)
)
SELECT
  tenant_id,
  month,
  
  -- Inflows
  cash_inflow,
  bank_transfer_inflow,
  momo_inflow,
  zalo_pay_inflow,
  card_inflow,
  total_inflow,
  inflow_transaction_count,
  
  -- Outflows
  cash_outflow,
  bank_transfer_outflow,
  momo_outflow,
  zalo_pay_outflow,
  card_outflow,
  total_outflow,
  outflow_transaction_count,
  
  -- Outflows by category
  salary_outflow,
  rent_outflow,
  utilities_outflow,
  supplies_outflow,
  marketing_outflow,
  maintenance_outflow,
  other_outflow,
  
  -- Net cash flow
  (total_inflow - total_outflow) AS net_cash_flow,
  
  -- Cumulative cash flow (requires window function, calculated per tenant)
  SUM(total_inflow - total_outflow) OVER (
    PARTITION BY tenant_id 
    ORDER BY month 
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_cash_flow,
  
  -- Burn rate (negative net cash flow)
  CASE
    WHEN (total_inflow - total_outflow) < 0 THEN ABS(total_inflow - total_outflow)
    ELSE 0
  END AS burn_rate,
  
  -- Cash flow ratio (inflow / outflow)
  CASE
    WHEN total_outflow > 0 THEN ROUND((total_inflow::NUMERIC / total_outflow), 2)
    ELSE NULL
  END AS cash_flow_ratio,
  
  -- Metadata
  NOW() AS computed_at

FROM monthly_summary
WHERE tenant_id IS NOT NULL;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_cash_flow_unique 
  ON mv_cash_flow (tenant_id, month);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_cash_flow_tenant 
  ON mv_cash_flow (tenant_id, month DESC);

CREATE INDEX idx_mv_cash_flow_net 
  ON mv_cash_flow (tenant_id, net_cash_flow DESC);

CREATE INDEX idx_mv_cash_flow_burn_rate 
  ON mv_cash_flow (tenant_id, burn_rate DESC);

CREATE INDEX idx_mv_cash_flow_recent 
  ON mv_cash_flow (month DESC);

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_cash_flow TO authenticated;
GRANT SELECT ON mv_cash_flow TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_cash_flow IS 
  'Monthly cash flow statement tracking inflows/outflows by payment method and category. Includes burn rate, cumulative cash flow, and cash flow ratio. Refreshed hourly. Used by Finance Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cash_flow;
