-- FINANCE AUTOMATION & P&L ENGINE
-- Applied on 2026-05-15 to implement Phase 1 of Financial Automation

-- 1. Schema Updates
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS rating_bonus NUMERIC DEFAULT 0;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE public.revenue ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- 2. Service Performance RPC
CREATE OR REPLACE FUNCTION public.get_service_performance(p_tenant_id UUID)
RETURNS TABLE (
    package_name TEXT,
    total_bookings BIGINT,
    total_revenue NUMERIC,
    total_ktv_cost NUMERIC,
    net_service_profit NUMERIC,
    profit_margin_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as package_name,
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(r.amount), 0) as total_revenue,
        COALESCE(SUM(b.total_sessions * b.ktv_commission), 0) as total_ktv_cost,
        (COALESCE(SUM(r.amount), 0) - COALESCE(SUM(b.total_sessions * b.ktv_commission), 0)) as net_service_profit,
        CASE 
            WHEN COALESCE(SUM(r.amount), 0) > 0 
            THEN ((COALESCE(SUM(r.amount), 0) - COALESCE(SUM(b.total_sessions * b.ktv_commission), 0)) / COALESCE(SUM(r.amount), 0) * 100)
            ELSE 0 
        END as profit_margin_percent
    FROM public.packages p
    LEFT JOIN public.bookings b ON b.package_id = p.id AND b.tenant_id = p_tenant_id
    LEFT JOIN public.revenue r ON r.booking_id = b.id AND r.status = 'confirmed'
    WHERE p.tenant_id = p_tenant_id OR p.tenant_id IS NULL
    GROUP BY p.name, p.id
    ORDER BY total_revenue DESC;
END;
$$;

-- 3. Monthly P&L RPC
DROP FUNCTION IF EXISTS public.get_monthly_pnl(uuid,date);

CREATE OR REPLACE FUNCTION public.get_monthly_pnl(p_tenant_id UUID, p_month DATE)
RETURNS TABLE (
    month_year DATE,
    total_revenue NUMERIC,
    total_operating_expenses NUMERIC,
    total_ktv_salaries NUMERIC,
    net_profit NUMERIC,
    total_bookings BIGINT,
    total_sessions_completed BIGINT,
    is_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := date_trunc('month', p_month);
    v_end_date DATE := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
    v_revenue NUMERIC;
    v_expenses NUMERIC;
    v_salaries NUMERIC;
    v_locked BOOLEAN;
BEGIN
    -- 1. Calculate Revenue
    SELECT COALESCE(SUM(amount), 0) INTO v_revenue
    FROM public.revenue
    WHERE tenant_id = p_tenant_id
      AND status = 'confirmed'
      AND received_date::date >= v_start_date
      AND received_date::date <= v_end_date;

    -- 2. Calculate Operating Expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
    FROM public.expenses
    WHERE tenant_id = p_tenant_id
      AND status = 'approved'
      AND category != 'salary'
      AND expense_date::date >= v_start_date
      AND expense_date::date <= v_end_date;

    -- 3. Calculate KTV Salaries
    SELECT COALESCE(SUM(base_salary + kpi_bonus + service_percentage_bonus + rating_bonus - violations_deduction), 0) INTO v_salaries
    FROM public.salary_records
    WHERE tenant_id = p_tenant_id
      AND month_year = v_start_date;

    -- 4. Check if month is locked
    SELECT EXISTS (
        SELECT 1 FROM public.revenue 
        WHERE tenant_id = p_tenant_id AND is_locked = true AND received_date::date >= v_start_date AND received_date::date <= v_end_date
    ) OR EXISTS (
        SELECT 1 FROM public.salary_records 
        WHERE tenant_id = p_tenant_id AND is_locked = true AND month_year = v_start_date
    ) INTO v_locked;

    RETURN QUERY
    SELECT 
        v_start_date,
        v_revenue,
        v_expenses,
        v_salaries,
        (v_revenue - v_expenses - v_salaries) as net_profit,
        (SELECT COUNT(*) FROM public.bookings WHERE tenant_id = p_tenant_id AND created_at::date >= v_start_date AND created_at::date <= v_end_date) as total_bookings,
        (SELECT COUNT(*) FROM public.session_logs WHERE tenant_id = p_tenant_id AND status = 'completed' AND completed_date::date >= v_start_date AND completed_date::date <= v_end_date) as total_sessions_completed,
        v_locked;
END;
$$;

-- 4. Locking Mechanism RPC
CREATE OR REPLACE FUNCTION public.lock_monthly_records(p_tenant_id UUID, p_month DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := date_trunc('month', p_month);
    v_end_date DATE := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
BEGIN
    -- 1. Lock Revenue
    UPDATE public.revenue
    SET is_locked = true, status = 'confirmed'
    WHERE tenant_id = p_tenant_id
      AND received_date::date >= v_start_date
      AND received_date::date <= v_end_date;

    -- 2. Lock Expenses
    UPDATE public.expenses
    SET is_locked = true, status = 'approved'
    WHERE tenant_id = p_tenant_id
      AND expense_date::date >= v_start_date
      AND expense_date::date <= v_end_date;

    -- 3. Lock Salary Records
    UPDATE public.salary_records
    SET is_locked = true, status = 'approved'
    WHERE tenant_id = p_tenant_id
      AND month_year = v_start_date;
END;
$$;
