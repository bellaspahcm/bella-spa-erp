-- KTV MOBILE-FIRST EXPERIENCE
-- Applied on 2026-05-15 to implement Phase 2

-- 1. Schema Updates for Session Timing
ALTER TABLE public.session_logs ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.session_logs ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.session_logs.status IS 'Status of the session: completed, in_progress, pending, cancelled, scheduled';

-- 2. KTV Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_ktv_leaderboard(p_tenant_id UUID, p_month DATE)
RETURNS TABLE (
    ktv_id UUID,
    full_name TEXT,
    total_sessions BIGINT,
    average_rating NUMERIC,
    total_commission NUMERIC,
    rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := date_trunc('month', p_month);
    v_end_date DATE := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
BEGIN
    RETURN QUERY
    WITH ktv_stats AS (
        SELECT 
            u.id,
            u.full_name,
            COUNT(sl.id) as sessions,
            COALESCE(AVG(sr.rating_bonus), 0) as avg_rating,
            COALESCE(SUM(b.ktv_commission), 0) as commissions
        FROM public.users u
        LEFT JOIN public.session_logs sl ON sl.completed_by_ktv_id = u.id 
            AND sl.status = 'completed'
            AND sl.completed_date::date >= v_start_date
            AND sl.completed_date::date <= v_end_date
        LEFT JOIN public.bookings b ON sl.booking_id = b.id
        LEFT JOIN public.salary_records sr ON sr.user_id = u.id AND sr.month_year = v_start_date
        WHERE u.tenant_id = p_tenant_id AND u.role = 'ktv'
        GROUP BY u.id, u.full_name
    )
    SELECT 
        ks.id,
        ks.full_name,
        ks.sessions,
        ks.avg_rating,
        ks.commissions,
        RANK() OVER (ORDER BY ks.sessions DESC, ks.commissions DESC) as rank
    FROM ktv_stats ks
    ORDER BY rank ASC;
END;
$$;
