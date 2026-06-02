-- Migration: Blended KTV monthly rating
DROP FUNCTION IF EXISTS public.get_ktv_leaderboard(uuid, date);

-- Replaces the hard-coded COALESCE(..., 5.0) fallback with a real formula:
--   composite = 0.6 * customer_rating + 0.4 * discipline_score
-- Customer rating: AVG of approved session_reviews.rating in the month.
-- Discipline score: starts at 5.0 and is penalised by attendance violations.
--
-- Late-streak penalty (uses gaps-and-islands on consecutive late shifts):
--   1 ngày liên tiếp  → -0.3
--   2 ngày liên tiếp  → -0.7
--   3 ngày liên tiếp  → -1.3
--   ≥4 ngày liên tiếp → -2.0
-- Plus: each isolated late day outside the longest streak → -0.2
-- Plus: each absent day → -1.0
-- Floor at 1.0 (a KTV can never be rated below 1 star).
--
-- If a KTV has zero sessions AND zero attendance records in the month,
-- composite_rating is returned as NULL so the UI can render '—' instead
-- of misleading 5.0.

CREATE OR REPLACE FUNCTION public.get_ktv_leaderboard(p_tenant_id uuid, p_month date)
 RETURNS TABLE(
   ktv_id uuid,
   full_name text,
   sessions bigint,
   average_rating numeric,        -- composite (kept name for backward compat)
   customer_rating numeric,       -- 60% raw component
   discipline_score numeric,      -- 40% raw component
   late_days int,
   absent_days int,
   max_late_streak int,
   commissions numeric,
   total_kpi_bonus numeric,
   rank bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_start_date DATE := date_trunc('month', p_month)::date;
  v_end_date   DATE := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  WITH
  -- 1. Session + review aggregates per KTV
  ktv_sessions AS (
    SELECT
      u.id AS ktv_id,
      u.full_name,
      COUNT(sl.id) AS sessions_count,
      -- Customer rating: only approved reviews count. NULL when none exist.
      AVG(sr.rating)::numeric AS customer_rating_raw,
      COALESCE(SUM(b.ktv_commission), 0) AS commissions_total
    FROM public.users u
    LEFT JOIN public.session_logs sl
           ON sl.completed_by_ktv_id = u.id
          AND sl.status = 'completed'
          AND sl.completed_date BETWEEN v_start_date AND v_end_date
    LEFT JOIN public.session_reviews sr
           ON sr.session_log_id = sl.id
          AND sr.status = 'approved'
    LEFT JOIN public.bookings b ON sl.booking_id = b.id
    WHERE u.tenant_id = p_tenant_id AND u.role = 'ktv'
    GROUP BY u.id, u.full_name
  ),

  -- 2. Attendance counts per KTV
  ktv_attendance AS (
    SELECT
      a.ktv_id,
      COUNT(*) AS total_records,
      COUNT(*) FILTER (WHERE a.status = 'late')    AS late_days,
      COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_days
    FROM public.attendance a
    WHERE a.tenant_id = p_tenant_id
      AND a.date BETWEEN v_start_date AND v_end_date
    GROUP BY a.ktv_id
  ),

  -- 3. Longest consecutive-late streak per KTV (gaps-and-islands).
  --    'Consecutive' = consecutive ATTENDANCE ROWS (not calendar days),
  --    so a KTV who is scheduled Mon-Wed-Fri and is late all three
  --    times counts as a 3-streak even though calendar dates skip.
  late_runs AS (
    SELECT
      ranked.ktv_id AS lr_ktv_id,
      (ranked.rn_all - ranked.rn_late) AS run_id
    FROM (
      SELECT
        a.ktv_id,
        a.date,
        a.status,
        ROW_NUMBER() OVER (PARTITION BY a.ktv_id ORDER BY a.date) AS rn_all,
        ROW_NUMBER() OVER (PARTITION BY a.ktv_id, (a.status = 'late') ORDER BY a.date) AS rn_late
      FROM public.attendance a
      WHERE a.tenant_id = p_tenant_id
        AND a.date BETWEEN v_start_date AND v_end_date
    ) ranked
    WHERE ranked.status = 'late'
  ),
  late_streaks AS (
    SELECT lr.lr_ktv_id AS ls_ktv_id, COUNT(*) AS streak_len
    FROM late_runs lr
    GROUP BY lr.lr_ktv_id, lr.run_id
  ),
  ktv_late_streak AS (
    SELECT ls.ls_ktv_id AS kls_ktv_id, MAX(ls.streak_len) AS max_late_streak
    FROM late_streaks ls
    GROUP BY ls.ls_ktv_id
  ),

  -- 4. Discipline score with floor at 1.0
  ktv_discipline AS (
    SELECT
      ks.ktv_id,
      COALESCE(ka.late_days,   0) AS late_days,
      COALESCE(ka.absent_days, 0) AS absent_days,
      COALESCE(kls.max_late_streak, 0) AS max_late_streak,
      COALESCE(ka.total_records, 0) AS total_records,
      GREATEST(
        5.0
        - CASE
            WHEN COALESCE(kls.max_late_streak, 0) >= 4 THEN 2.0
            WHEN kls.max_late_streak = 3 THEN 1.3
            WHEN kls.max_late_streak = 2 THEN 0.7
            WHEN kls.max_late_streak = 1 THEN 0.3
            ELSE 0
          END
        - (GREATEST(COALESCE(ka.late_days, 0) - COALESCE(kls.max_late_streak, 0), 0) * 0.2)
        - (COALESCE(ka.absent_days, 0) * 1.0),
        1.0
      )::numeric AS discipline_raw
    FROM ktv_sessions ks
    LEFT JOIN ktv_attendance   ka  ON ka.ktv_id  = ks.ktv_id
    LEFT JOIN ktv_late_streak  kls ON kls.kls_ktv_id = ks.ktv_id
  ),

  -- 5. KPI bonuses (unchanged from previous version)
  kpi_stats AS (
    SELECT k.ktv_id, COALESCE(SUM(k.bonus_amount), 0) AS kpi_bonus
    FROM public.kpi_records k
    WHERE k.tenant_id = p_tenant_id
      AND k.month_year = v_start_date
    GROUP BY k.ktv_id
  ),

  -- 6. Blend customer (60%) + discipline (40%) → composite
  ktv_composite AS (
    SELECT
      ks.ktv_id,
      ks.full_name,
      ks.sessions_count,
      ks.customer_rating_raw,
      kd.discipline_raw,
      kd.late_days,
      kd.absent_days,
      kd.max_late_streak,
      ks.commissions_total,
      CASE
        -- No activity at all → no rating yet
        WHEN ks.sessions_count = 0 AND kd.total_records = 0 THEN NULL
        -- Has attendance/sessions but no customer review yet → pure discipline
        WHEN ks.customer_rating_raw IS NULL THEN kd.discipline_raw
        -- Has both → weighted blend
        ELSE ROUND(0.6 * ks.customer_rating_raw + 0.4 * kd.discipline_raw, 2)
      END AS composite_rating
    FROM ktv_sessions ks
    LEFT JOIN ktv_discipline kd ON kd.ktv_id = ks.ktv_id
  )

  SELECT
    kc.ktv_id,
    kc.full_name,
    kc.sessions_count                                AS sessions,
    kc.composite_rating                              AS average_rating,
    ROUND(kc.customer_rating_raw, 2)                 AS customer_rating,
    ROUND(kc.discipline_raw, 2)                      AS discipline_score,
    kc.late_days::int                                AS late_days,
    kc.absent_days::int                              AS absent_days,
    kc.max_late_streak::int                          AS max_late_streak,
    kc.commissions_total::numeric                    AS commissions,
    COALESCE(kps.kpi_bonus, 0)::numeric              AS total_kpi_bonus,
    -- Rank: by composite (DESC, NULLs last) → sessions DESC → commissions DESC
    RANK() OVER (
      ORDER BY
        kc.composite_rating DESC NULLS LAST,
        kc.sessions_count DESC,
        kc.commissions_total DESC
    ) AS rank
  FROM ktv_composite kc
  LEFT JOIN kpi_stats kps ON kc.ktv_id = kps.ktv_id
  ORDER BY rank ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_ktv_leaderboard(uuid, date) TO authenticated, service_role;
