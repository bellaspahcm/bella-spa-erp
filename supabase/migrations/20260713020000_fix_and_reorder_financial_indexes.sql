-- Migration: Re-order database indexes to place equality columns before range columns, and add session logs index
-- Date: 2026-07-13
-- Purpose: Speed up mv_monthly_pnl, mv_cash_flow, mv_budget_variance, and raw analytics queries

-- 1. Drop sub-optimal indexes
DROP INDEX IF EXISTS public.idx_revenue_monthly_aggregation;
DROP INDEX IF EXISTS public.idx_expenses_monthly_aggregation;

-- 2. Recreate indexes with status (equality) before date (range) columns
CREATE INDEX IF NOT EXISTS idx_revenue_monthly_aggregation 
ON public.revenue (tenant_id, status, received_date, revenue_type, amount);

CREATE INDEX IF NOT EXISTS idx_expenses_monthly_aggregation 
ON public.expenses (tenant_id, status, expense_date, category, amount);

-- 3. Create new index for session logs today's listing / upcoming sessions
CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_date_status 
ON public.session_logs (tenant_id, assigned_date, status) 
WHERE status != 'completed';

-- 4. Refresh operational and financial materialized views to utilize the new indexes
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
