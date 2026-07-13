-- Migration: Optimize Database Indexes for Financial and Session Aggregations
-- Date: 2026-07-13
-- Purpose: Speed up mv_monthly_pnl, mv_cash_flow, mv_budget_variance, and raw analytics queries

-- 1. Optimize revenue monthly/period aggregation (P&L & Cash Flow views, revenue breakdowns)
CREATE INDEX IF NOT EXISTS idx_revenue_monthly_aggregation 
ON public.revenue (tenant_id, received_date, status, revenue_type, amount);

-- 2. Optimize expenses monthly/period aggregation (P&L & Cash Flow views, expense breakdowns)
CREATE INDEX IF NOT EXISTS idx_expenses_monthly_aggregation 
ON public.expenses (tenant_id, expense_date, status, category, amount);

-- 3. Optimize salary records monthly/period aggregation (P&L salary expense fallback)
CREATE INDEX IF NOT EXISTS idx_salary_records_monthly_aggregation 
ON public.salary_records (tenant_id, month_year, total_salary, ktv_id);

-- 4. Optimize session logs monthly/period aggregation (Completed sessions count)
CREATE INDEX IF NOT EXISTS idx_session_logs_monthly_aggregation 
ON public.session_logs (status, completed_date, booking_id);

-- 5. Optimize bookings monthly/period aggregation (Bookings count, joins)
CREATE INDEX IF NOT EXISTS idx_bookings_monthly_aggregation 
ON public.bookings (id, tenant_id);

-- 6. Refresh the operational and finance materialized views safely to apply/utilize the new indexes immediately
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_operational_materialized_views') THEN
    RAISE NOTICE 'Refreshing operational materialized views...';
    PERFORM refresh_operational_materialized_views();
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_finance_mvs') THEN
    RAISE NOTICE 'Refreshing finance materialized views...';
    PERFORM 1 FROM refresh_all_finance_mvs();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
