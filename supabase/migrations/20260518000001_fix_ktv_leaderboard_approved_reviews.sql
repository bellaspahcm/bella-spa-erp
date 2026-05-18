-- Migration: Fix get_ktv_leaderboard to only aggregate approved reviews
-- Date: 2026-05-18

CREATE OR REPLACE FUNCTION public.get_ktv_leaderboard(p_tenant_id uuid, p_month date)
 RETURNS TABLE(ktv_id uuid, full_name text, sessions bigint, average_rating numeric, commissions numeric, total_kpi_bonus numeric, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_start_date DATE := date_trunc('month', p_month)::date;
  v_end_date DATE := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  WITH ktv_stats AS (
    SELECT 
      u.id,
      u.full_name,
      COUNT(sl.id) as sessions_count,
      COALESCE(AVG(COALESCE(sr.rating, sl.rating::numeric)), 5.0) as avg_rating,
      COALESCE(SUM(b.ktv_commission), 0) as commissions_total
    FROM public.users u
    LEFT JOIN public.session_logs sl ON sl.completed_by_ktv_id = u.id 
      AND sl.status = 'completed'
      AND sl.completed_date >= v_start_date
      AND sl.completed_date <= v_end_date
    LEFT JOIN public.session_reviews sr ON sr.session_log_id = sl.id AND sr.status = 'approved'
    LEFT JOIN public.bookings b ON sl.booking_id = b.id
    WHERE u.tenant_id = p_tenant_id AND u.role = 'ktv'
    GROUP BY u.id, u.full_name
  ),
  kpi_stats AS (
    SELECT 
      k.ktv_id,
      COALESCE(SUM(k.bonus_amount), 0) as kpi_bonus
    FROM public.kpi_records k
    WHERE k.tenant_id = p_tenant_id 
      AND k.month_year = v_start_date
    GROUP BY k.ktv_id
  )
  SELECT 
    ks.id as ktv_id,
    ks.full_name,
    ks.sessions_count as sessions,
    ks.avg_rating::numeric as average_rating,
    ks.commissions_total::numeric as commissions,
    COALESCE(kps.kpi_bonus, 0)::numeric as total_kpi_bonus,
    RANK() OVER (ORDER BY ks.sessions_count DESC, ks.commissions_total DESC) as rank
  FROM ktv_stats ks
  LEFT JOIN kpi_stats kps ON ks.id = kps.ktv_id
  ORDER BY rank ASC;
END;
$function$;
