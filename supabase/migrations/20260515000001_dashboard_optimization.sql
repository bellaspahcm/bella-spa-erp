-- Migration: Dashboard Optimization with SQL Functions
-- Description: Centralizes dashboard calculations into database functions for accuracy and performance.

-- 1. Function to get summary stats for a date range
CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_start_date DATE, 
    p_end_date DATE,
    p_today DATE
)
RETURNS JSON AS $$
DECLARE
    v_total_customers INT;
    v_customers_prev INT;
    v_today_bookings INT;
    v_yesterday_bookings INT;
    v_total_revenue DECIMAL;
    v_prev_revenue DECIMAL;
    v_avg_rating DECIMAL;
    v_prev_avg_rating DECIMAL;
    v_yesterday DATE := p_today - INTERVAL '1 day';
    v_prev_month_start DATE := p_start_date - INTERVAL '1 month';
    v_prev_month_end DATE := p_start_date - INTERVAL '1 day';
BEGIN
    -- Total Customers
    SELECT count(*) INTO v_total_customers FROM customers;
    SELECT count(*) INTO v_customers_prev FROM customers WHERE created_at < p_start_date;

    -- Today Bookings (from session_logs)
    SELECT count(*) INTO v_today_bookings FROM session_logs WHERE assigned_date = p_today;
    SELECT count(*) INTO v_yesterday_bookings FROM session_logs WHERE assigned_date = v_yesterday;

    -- Revenue
    SELECT COALESCE(sum(amount), 0) INTO v_total_revenue FROM revenue 
    WHERE received_date >= p_start_date AND received_date <= p_end_date;
    
    SELECT COALESCE(sum(amount), 0) INTO v_prev_revenue FROM revenue 
    WHERE received_date >= v_prev_month_start AND received_date <= v_prev_month_end;

    -- Ratings
    SELECT COALESCE(avg(rating), 5.0) INTO v_avg_rating FROM session_reviews 
    WHERE created_at >= p_start_date AND created_at <= p_end_date;
    
    SELECT COALESCE(avg(rating), 5.0) INTO v_prev_avg_rating FROM session_reviews 
    WHERE created_at >= v_prev_month_start AND created_at <= v_prev_month_end;

    RETURN json_build_object(
        'total_customers', v_total_customers,
        'customers_prev', v_customers_prev,
        'today_bookings', v_today_bookings,
        'yesterday_bookings', v_yesterday_bookings,
        'total_revenue', v_total_revenue,
        'prev_revenue', v_prev_revenue,
        'avg_rating', ROUND(v_avg_rating, 1),
        'prev_avg_rating', ROUND(v_prev_avg_rating, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to get monthly performance for last 6 months
CREATE OR REPLACE FUNCTION get_monthly_performance_v2()
RETURNS TABLE (
    month_label TEXT,
    month_start DATE,
    customers_count INT,
    revenue_amount DECIMAL,
    expense_amount DECIMAL,
    avg_rating DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT 
            to_char(d, 'T') || extract(month from d) as label,
            date_trunc('month', d)::date as m_start,
            (date_trunc('month', d) + interval '1 month' - interval '1 day')::date as m_end
        FROM generate_series(
            date_trunc('month', current_date) - interval '5 months',
            date_trunc('month', current_date),
            interval '1 month'
        ) d
    )
    SELECT 
        m.label,
        m.m_start,
        (SELECT count(*)::int FROM session_logs s WHERE s.assigned_date >= m.m_start AND s.assigned_date <= m.m_end),
        (SELECT COALESCE(sum(amount), 0) FROM revenue r WHERE r.received_date >= m.m_start AND r.received_date <= m.m_end),
        (SELECT COALESCE(sum(amount), 0) FROM expenses e WHERE e.expense_date >= m.m_start AND e.expense_date <= m.m_end),
        (SELECT COALESCE(avg(rating), 5.0) FROM session_reviews sr WHERE sr.created_at >= m.m_start AND sr.created_at <= m.m_end)
    FROM months m
    ORDER BY m.m_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
