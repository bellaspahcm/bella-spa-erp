-- Migration: Create Materialized View for Payroll Summary
-- Purpose: Aggregate salary breakdown, bonuses, and deductions for HR Dashboard
-- Refresh: Every 1 hour via cron job
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_payroll_summary CASCADE;

-- Create materialized view for Payroll Summary
CREATE MATERIALIZED VIEW mv_payroll_summary AS
WITH monthly_payroll AS (
  SELECT
    sr.tenant_id,
    sr.month_year AS month,
    sr.ktv_id,
    u.full_name AS ktv_name,
    u.role AS ktv_role,
    
    -- Salary components
    COALESCE(sr.base_salary, 0) AS base_salary,
    COALESCE(sr.session_bonus, 0) AS session_bonus,
    COALESCE(sr.kpi_bonus, 0) AS kpi_bonus,
    COALESCE(sr.rating_bonus, 0) AS rating_bonus,
    COALESCE(sr.service_percentage_bonus, 0) AS service_percentage_bonus,
    COALESCE(sr.violations_deduction, 0) AS violations_deduction,
    COALESCE(sr.other_adjustments, 0) AS other_adjustments,
    COALESCE(sr.total_salary, 0) AS total_salary,
    
    -- Session metrics
    COALESCE(sr.total_sessions, 0) AS total_sessions,
    
    -- Status
    sr.status AS payroll_status,
    sr.published_at,
    sr.confirmed_at
    
  FROM salary_records sr
  INNER JOIN users u ON u.id = sr.ktv_id
  WHERE sr.month_year IS NOT NULL
),
payroll_aggregates AS (
  SELECT
    tenant_id,
    month,
    
    -- Count of KTVs
    COUNT(DISTINCT ktv_id) AS total_ktvs,
    COUNT(DISTINCT ktv_id) FILTER (WHERE payroll_status IN ('published', 'confirmed', 'finalized')) AS ktvs_paid,
    COUNT(DISTINCT ktv_id) FILTER (WHERE payroll_status = 'draft') AS ktvs_draft,
    
    -- Salary totals
    SUM(base_salary) AS total_base_salary,
    SUM(session_bonus) AS total_session_bonus,
    SUM(kpi_bonus) AS total_kpi_bonus,
    SUM(rating_bonus) AS total_rating_bonus,
    SUM(service_percentage_bonus) AS total_service_percentage_bonus,
    SUM(violations_deduction) AS total_violations_deduction,
    SUM(other_adjustments) AS total_other_adjustments,
    SUM(total_salary) AS total_payroll_cost,
    
    -- Session totals
    SUM(total_sessions) AS total_sessions_all_ktvs,
    
    -- Averages
    ROUND(AVG(base_salary), 2) AS avg_base_salary,
    ROUND(AVG(total_salary), 2) AS avg_total_salary,
    ROUND(AVG(total_sessions), 2) AS avg_sessions_per_ktv,
    
    -- Salary per session (efficiency metric)
    CASE
      WHEN SUM(total_sessions) > 0 THEN
        ROUND(SUM(total_salary) / NULLIF(SUM(total_sessions), 0), 2)
      ELSE 0
    END AS avg_salary_per_session
    
  FROM monthly_payroll
  GROUP BY tenant_id, month
),
ktv_payroll_details AS (
  SELECT
    mp.tenant_id,
    mp.month,
    mp.ktv_id,
    mp.ktv_name,
    mp.ktv_role,
    mp.base_salary,
    mp.session_bonus,
    mp.kpi_bonus,
    mp.rating_bonus,
    mp.service_percentage_bonus,
    mp.violations_deduction,
    mp.other_adjustments,
    mp.total_salary,
    mp.total_sessions,
    mp.payroll_status,
    mp.published_at,
    mp.confirmed_at,
    
    -- Rank by total salary within tenant for the month
    RANK() OVER (PARTITION BY mp.tenant_id, mp.month ORDER BY mp.total_salary DESC) AS salary_rank,
    
    -- Percentage of total payroll
    ROUND(
      mp.total_salary::NUMERIC / 
      NULLIF(SUM(mp.total_salary) OVER (PARTITION BY mp.tenant_id, mp.month), 0) * 100,
      2
    ) AS payroll_share_pct,
    
    -- Bonus percentage (bonuses / base salary * 100)
    CASE
      WHEN mp.base_salary > 0 THEN
        ROUND(
          ((mp.session_bonus + mp.kpi_bonus + mp.rating_bonus + mp.service_percentage_bonus)::NUMERIC / 
           mp.base_salary) * 100,
          2
        )
      ELSE 0
    END AS bonus_to_base_pct,
    
    -- Net salary (after deductions)
    mp.total_salary - mp.violations_deduction AS net_salary
    
  FROM monthly_payroll mp
)
SELECT
  kpd.tenant_id,
  kpd.month,
  kpd.ktv_id,
  kpd.ktv_name,
  kpd.ktv_role,
  
  -- Salary components
  kpd.base_salary,
  kpd.session_bonus,
  kpd.kpi_bonus,
  kpd.rating_bonus,
  kpd.service_percentage_bonus,
  kpd.violations_deduction,
  kpd.other_adjustments,
  kpd.total_salary,
  kpd.net_salary,
  
  -- Session metrics
  kpd.total_sessions,
  
  -- Derived metrics
  kpd.salary_rank,
  kpd.payroll_share_pct,
  kpd.bonus_to_base_pct,
  
  -- Status
  kpd.payroll_status,
  kpd.published_at,
  kpd.confirmed_at,
  
  -- Aggregates (same for all KTVs in same tenant/month)
  pa.total_ktvs,
  pa.ktvs_paid,
  pa.ktvs_draft,
  pa.total_base_salary,
  pa.total_session_bonus,
  pa.total_kpi_bonus,
  pa.total_rating_bonus,
  pa.total_service_percentage_bonus,
  pa.total_violations_deduction,
  pa.total_other_adjustments,
  pa.total_payroll_cost,
  pa.total_sessions_all_ktvs,
  pa.avg_base_salary,
  pa.avg_total_salary,
  pa.avg_sessions_per_ktv,
  pa.avg_salary_per_session,
  
  -- Metadata
  NOW() AS computed_at

FROM ktv_payroll_details kpd
INNER JOIN payroll_aggregates pa ON pa.tenant_id = kpd.tenant_id AND pa.month = kpd.month

ORDER BY kpd.tenant_id, kpd.month DESC, kpd.salary_rank ASC;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_payroll_summary_unique 
  ON mv_payroll_summary (tenant_id, month, ktv_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_payroll_summary_tenant 
  ON mv_payroll_summary (tenant_id, month DESC, ktv_id);

CREATE INDEX idx_mv_payroll_summary_salary_rank 
  ON mv_payroll_summary (tenant_id, month DESC, salary_rank ASC);

CREATE INDEX idx_mv_payroll_summary_status 
  ON mv_payroll_summary (tenant_id, payroll_status);

CREATE INDEX idx_mv_payroll_summary_recent 
  ON mv_payroll_summary (month DESC)
  WHERE month >= (CURRENT_DATE - INTERVAL '12 months');

CREATE INDEX idx_mv_payroll_summary_high_earners 
  ON mv_payroll_summary (tenant_id, total_salary DESC)
  WHERE salary_rank <= 10;

-- Grant access to authenticated and anon users (read-only)
GRANT SELECT ON mv_payroll_summary TO authenticated;
GRANT SELECT ON mv_payroll_summary TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_payroll_summary IS 
  'Aggregated payroll summary by KTV with salary breakdown (base, bonuses, deductions), session counts, salary rankings, and payroll aggregates. Refreshed hourly. Used by HR Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payroll_summary;
