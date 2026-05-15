-- ==========================================
-- GIAI ĐOẠN 1: CHUẨN HÓA ZERO-MOCK & CHAT PERSISTENCE
-- Ngày: 15/05/2026
-- ==========================================

-- 1. Tạo bảng tin nhắn chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'ktv', 'customer')),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chat messages for their tenant"
    ON public.chat_messages FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert chat messages for their tenant"
    ON public.chat_messages FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Loại bỏ các giá trị tenant_id mặc định bị gán cứng
ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.employees ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.customers ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.projects ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.units ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.bookings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.sale_contracts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.expenses ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.salary_records ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.session_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.revenue ALTER COLUMN tenant_id DROP DEFAULT;

-- 3. Hàm RPC: get_dashboard_summary
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_start_date DATE,
    p_end_date DATE,
    p_today DATE,
    p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_customers BIGINT;
    v_customers_prev BIGINT;
    v_today_bookings BIGINT;
    v_yesterday_bookings BIGINT;
    v_total_revenue BIGINT;
    v_prev_revenue BIGINT;
    v_avg_rating NUMERIC;
    v_prev_avg_rating NUMERIC;
    v_prev_start DATE;
    v_prev_end DATE;
BEGIN
    v_prev_start := (p_start_date - INTERVAL '1 month')::DATE;
    v_prev_end := (p_start_date - INTERVAL '1 day')::DATE;

    SELECT COUNT(*) INTO v_total_customers FROM public.customers WHERE tenant_id = p_tenant_id;
    SELECT COUNT(*) INTO v_customers_prev FROM public.customers WHERE tenant_id = p_tenant_id AND created_at < p_start_date;

    SELECT COUNT(*) INTO v_today_bookings FROM public.session_logs 
    WHERE tenant_id = p_tenant_id AND assigned_date = p_today AND status != 'completed';

    SELECT COUNT(*) INTO v_yesterday_bookings FROM public.session_logs 
    WHERE tenant_id = p_tenant_id AND assigned_date = (p_today - INTERVAL '1 day')::DATE AND status != 'completed';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue FROM public.revenue 
    WHERE tenant_id = p_tenant_id AND revenue_date >= p_start_date AND revenue_date <= p_end_date;

    SELECT COALESCE(SUM(amount), 0) INTO v_prev_revenue FROM public.revenue 
    WHERE tenant_id = p_tenant_id AND revenue_date >= v_prev_start AND revenue_date <= v_prev_end;

    SELECT COALESCE(AVG(rating), 5.0) INTO v_avg_rating FROM public.session_reviews 
    WHERE tenant_id = p_tenant_id AND created_at >= p_start_date AND created_at <= (p_end_date + INTERVAL '1 day');

    SELECT COALESCE(AVG(rating), 5.0) INTO v_prev_avg_rating FROM public.session_reviews 
    WHERE tenant_id = p_tenant_id AND created_at >= v_prev_start AND created_at <= (v_prev_end + INTERVAL '1 day');

    RETURN jsonb_build_object(
        'total_customers', v_total_customers,
        'customers_prev', v_customers_prev,
        'today_bookings', v_today_bookings,
        'yesterday_bookings', v_yesterday_bookings,
        'total_revenue', v_total_revenue,
        'prev_revenue', v_prev_revenue,
        'avg_rating', COALESCE(v_avg_rating, 5.0),
        'prev_avg_rating', COALESCE(v_prev_avg_rating, 5.0)
    );
END;
$$;

-- 4. Hàm RPC: get_monthly_performance_v2
CREATE OR REPLACE FUNCTION public.get_monthly_performance_v2(p_tenant_id UUID)
RETURNS TABLE (month_label TEXT, customers_count BIGINT, revenue_amount BIGINT, expense_amount BIGINT, avg_rating NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT generate_series(date_trunc('month', now()) - INTERVAL '5 months', date_trunc('month', now()), '1 month')::date AS m
    )
    SELECT 
        to_char(m, 'TMMon') AS month_label,
        (SELECT COUNT(*) FROM public.customers WHERE tenant_id = p_tenant_id AND date_trunc('month', created_at) <= m) AS customers_count,
        (SELECT COALESCE(SUM(amount), 0) FROM public.revenue WHERE tenant_id = p_tenant_id AND date_trunc('month', revenue_date) = m) AS revenue_amount,
        (SELECT COALESCE(SUM(amount), 0) FROM public.expenses WHERE tenant_id = p_tenant_id AND date_trunc('month', expense_date) = m) AS expense_amount,
        (SELECT COALESCE(AVG(rating), 5.0) FROM public.session_reviews WHERE tenant_id = p_tenant_id AND date_trunc('month', created_at) = m) AS avg_rating
    FROM months
    ORDER BY m ASC;
END;
$$;

-- 5. Hàm RPC: get_important_alerts
CREATE OR REPLACE FUNCTION public.get_important_alerts(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alerts JSONB := '[]'::JSONB;
    v_rec RECORD;
BEGIN
    FOR v_rec IN (
        SELECT b.package_name, b.full_price - b.deposit_amount as remaining, c.name_mother
        FROM public.bookings b
        JOIN public.customers c ON b.customer_id = c.id
        WHERE b.tenant_id = p_tenant_id AND b.deposit_amount < b.full_price
        LIMIT 5
    ) LOOP
        v_alerts := v_alerts || jsonb_build_object(
            'type', 'warning', 'title', 'Thanh toán chưa hoàn tất',
            'message', 'Khách hàng ' || COALESCE(v_rec.name_mother, 'Mẹ') || ' còn thiếu ' || to_char(v_rec.remaining, 'FM999,999,999') || 'đ cho gói ' || COALESCE(v_rec.package_name, 'dịch vụ') || '.',
            'icon', 'alert'
        );
    END LOOP;

    FOR v_rec IN (
        SELECT r.rating, r.note, c.name_mother
        FROM public.session_reviews r
        JOIN public.session_logs sl ON r.session_log_id = sl.id
        JOIN public.bookings b ON sl.booking_id = b.id
        JOIN public.customers c ON b.customer_id = c.id
        WHERE r.tenant_id = p_tenant_id AND r.rating < 4
        ORDER BY r.created_at DESC LIMIT 3
    ) LOOP
        v_alerts := v_alerts || jsonb_build_object(
            'type', 'info', 'title', 'Đánh giá cần chú ý',
            'message', 'Khách hàng ' || COALESCE(v_rec.name_mother, 'Mẹ') || ' đánh giá ' || v_rec.rating || ' sao: "' || COALESCE(v_rec.note, 'Không có bình luận') || '"',
            'icon', 'lightbulb'
        );
    END LOOP;

    RETURN v_alerts;
END;
$$;

-- 6. Hàm RPC: get_customer_total_spent
CREATE OR REPLACE FUNCTION public.get_customer_total_spent(p_customer_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(r.amount), 0)
    INTO v_total
    FROM public.revenue r
    JOIN public.bookings b ON r.booking_id = b.id
    WHERE b.customer_id = p_customer_id;
    
    RETURN v_total;
END;
$$;

-- 7. Hàm RPC: get_chat_customers
CREATE OR REPLACE FUNCTION public.get_chat_customers(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    phone TEXT,
    customer_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_package_name TEXT,
    total_spent BIGINT,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone,
        COALESCE(c.gender_baby, 'Thành viên') as customer_level,
        c.created_at,
        (SELECT b.package_name FROM public.bookings b WHERE b.customer_id = c.id ORDER BY b.created_at DESC LIMIT 1) as last_package_name,
        (SELECT COALESCE(SUM(r.amount), 0) FROM public.revenue r JOIN public.bookings b ON r.booking_id = b.id WHERE b.customer_id = c.id) as total_spent,
        (SELECT COUNT(*) FROM public.chat_messages m WHERE m.customer_id = c.id AND m.is_read = false AND m.sender_type = 'customer') as unread_count
    FROM public.customers c
    WHERE c.tenant_id = p_tenant_id
    ORDER BY (SELECT MAX(m.created_at) FROM public.chat_messages m WHERE m.customer_id = c.id) DESC NULLS LAST, c.created_at DESC;
END;
$$;
