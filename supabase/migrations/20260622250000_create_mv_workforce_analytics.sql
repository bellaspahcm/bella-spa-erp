-- Migration: Create Materialized View for Workforce Analytics
-- Purpose: Aggregate headcount, turnover, tenure, and role distribution for HR Dashboard
-- Refresh: Every 1 hour via cron job (HR data changes less frequently)
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_workforce_analytics CASCADE;

-- Create materialized view for Workforce Analytics
CREATE MATERIALIZED VIEW mv_workforce_analytics AS
WITH monthly_headcount AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', created_at)::DATE AS month,
    role,
    COUNT(DISTINCT id) AS new_hires,
    COUNT(DISTINCT id) FILTER (WHERE status = 'active') AS active_count
  FROM users
  WHERE role IN ('ktv', 'manager', 'admin')
  GROUP BY tenant_id, DATE_TRUNC('month', created_at)::DATE, role
),
monthly_terminations AS (
  SELECT
    tenant_id,
    DATE_TRUNC('month', updated_at)::DATE AS month,
    role,
    COUNT(DISTINCT id) AS termination_count
  FROM users
  WHERE role IN ('ktv', 'manager', 'admin')
    AND status != 'active'
    AND updated_at IS NOT NULL
  GROUP BY tenant_id, DATE_TRUNC('month', updated_at)::DATE, role
),
current_headcount AS (
  SELECT
    tenant_id,
    role,
    COUNT(DISTINCT id) FILTER (WHERE status = 'active') AS current_active_count,
    COUNT(DISTINCT id) AS total_ever_hired,
    AVG(EXTRACT(YEAR FROM AGE(NOW(), created_at)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), created_at)))::NUMERIC AS avg_tenure_months
  FROM users
  WHERE role IN ('ktv', 'manager', 'admin')
  GROUP BY tenant_id, role
),
role_distribution AS (
  SELECT
    tenant_id,
    role,
    COUNT(DISTINCT id) FILTER (WHERE status = 'active') AS active_count,
    ROUND(
      COUNT(DISTINCT id) FILTER (WHERE status = 'active')::NUMERIC / 
      NULLIF(SUM(COUNT(DISTINCT id) FILTER (WHERE status = 'active')) OVER (PARTITION BY tenant_id), 0) * 100,
      2
    ) AS role_percentage
  FROM users
  WHERE role IN ('ktv', 'manager', 'admin')
  GROUP BY tenant_id, role
)
SELECT
  COALESCE(mh.tenant_id, mt.tenant_id, ch.tenant_id, rd.tenant_id) AS tenant_id,
  COALESCE(mh.month, mt.month, DATE_TRUNC('month', NOW())::DATE) AS month,
  COALESCE(mh.role, mt.role, ch.role, rd.role) AS role,
  
  -- Headcount metrics
  COALESCE(mh.new_hires, 0) AS new_hires,
  COALESCE(mt.termination_count, 0) AS terminations,
  COALESCE(ch.current_active_count, 0) AS current_headcount,
  COALESCE(ch.total_ever_hired, 0) AS total_ever_hired,
  
  -- Turnover rate (terminations / avg headcount * 100)
  CASE
    WHEN COALESCE(ch.current_active_count, 0) > 0 THEN
      ROUND(
        COALESCE(mt.termination_count, 0)::NUMERIC / 
        COALESCE(ch.current_active_count, 1) * 100,
        2
      )
    ELSE 0
  END AS turnover_rate_pct,
  
  -- Average tenure in months
  COALESCE(ch.avg_tenure_months, 0) AS avg_tenure_months,
  
  -- Role distribution
  COALESCE(rd.role_percentage, 0) AS role_distribution_pct,
  
  -- Metadata
  NOW() AS computed_at

FROM monthly_headcount mh
FULL OUTER JOIN monthly_terminations mt ON mt.tenant_id = mh.tenant_id AND mt.month = mh.month AND mt.role = mh.role
FULL OUTER JOIN current_headcount ch ON ch.tenant_id = COALESCE(mh.tenant_id, mt.tenant_id) AND ch.role = COALESCE(mh.role, mt.role)
FULL OUTER JOIN role_distribution rd ON rd.tenant_id = COALESCE(mh.tenant_id, mt.tenant_id, ch.tenant_id) AND rd.role = COALESCE(mh.role, mt.role, ch.role)

WHERE COALESCE(mh.tenant_id, mt.tenant_id, ch.tenant_id, rd.tenant_id) IS NOT NULL;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_workforce_analytics_unique 
  ON mv_workforce_analytics (tenant_id, month, role);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_workforce_analytics_tenant 
  ON mv_workforce_analytics (tenant_id, month DESC, role);

CREATE INDEX idx_mv_workforce_analytics_turnover 
  ON mv_workforce_analytics (tenant_id, turnover_rate_pct DESC);

CREATE INDEX idx_mv_workforce_analytics_headcount 
  ON mv_workforce_analytics (tenant_id, current_headcount DESC);

CREATE INDEX idx_mv_workforce_analytics_recent 
  ON mv_workforce_analytics (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '12 months');

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_workforce_analytics TO authenticated;
GRANT SELECT ON mv_workforce_analytics TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_workforce_analytics IS 
  'Aggregated workforce analytics with headcount trends, turnover rates, average tenure, and role distribution. Refreshed hourly. Used by HR Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW mv_workforce_analytics;
