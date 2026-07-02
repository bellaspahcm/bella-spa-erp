-- Migration: Create RPC Functions for Demand History
-- Purpose: Fetch historical service and package demand for forecasting
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- FUNCTION: Get Service Demand History
-- ============================================================================
-- Returns daily service demand (completed sessions) for the past N days

CREATE OR REPLACE FUNCTION public.get_service_demand_history(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  service_id UUID,
  service_name TEXT,
  demand BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      '1 day'::interval
    )::date AS date
  ),
  services AS (
    SELECT 
      s.id AS service_id,
      s.name AS service_name
    FROM public.services s
    WHERE s.tenant_id = p_tenant_id
      AND s.is_active = TRUE
  ),
  daily_demand AS (
    SELECT
      DATE(sess.check_in_time) AS date,
      ssd.service_id,
      COUNT(DISTINCT sess.id) AS demand
    FROM public.sessions sess
    JOIN public.session_service_details ssd ON sess.id = ssd.session_id
    WHERE 
      sess.tenant_id = p_tenant_id
      AND sess.status = 'completed'
      AND sess.check_in_time IS NOT NULL
      AND DATE(sess.check_in_time) >= p_start_date
      AND DATE(sess.check_in_time) <= p_end_date
    GROUP BY DATE(sess.check_in_time), ssd.service_id
  )
  SELECT
    ds.date,
    s.service_id,
    s.service_name,
    COALESCE(dd.demand, 0) AS demand
  FROM date_series ds
  CROSS JOIN services s
  LEFT JOIN daily_demand dd ON ds.date = dd.date AND s.service_id = dd.service_id
  WHERE EXISTS (
    -- Only include services that have at least some demand in the period
    SELECT 1 FROM daily_demand dd2 
    WHERE dd2.service_id = s.service_id 
    LIMIT 1
  )
  ORDER BY ds.date, s.service_name;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Package Demand History
-- ============================================================================
-- Returns daily package demand (confirmed/completed bookings) for the past N days

CREATE OR REPLACE FUNCTION public.get_package_demand_history(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  package_id UUID,
  package_name TEXT,
  demand BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      '1 day'::interval
    )::date AS date
  ),
  packages AS (
    SELECT 
      p.id AS package_id,
      p.name AS package_name
    FROM public.packages p
    WHERE p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
  ),
  daily_demand AS (
    SELECT
      DATE(b.created_at) AS date,
      b.package_id,
      COUNT(DISTINCT b.id) AS demand
    FROM public.bookings b
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
      AND DATE(b.created_at) >= p_start_date
      AND DATE(b.created_at) <= p_end_date
    GROUP BY DATE(b.created_at), b.package_id
  )
  SELECT
    ds.date,
    pkg.package_id,
    pkg.package_name,
    COALESCE(dd.demand, 0) AS demand
  FROM date_series ds
  CROSS JOIN packages pkg
  LEFT JOIN daily_demand dd ON ds.date = dd.date AND pkg.package_id = dd.package_id
  WHERE EXISTS (
    -- Only include packages that have at least some demand in the period
    SELECT 1 FROM daily_demand dd2 
    WHERE dd2.package_id = pkg.package_id 
    LIMIT 1
  )
  ORDER BY ds.date, pkg.package_name;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Item Demand Summary (Aggregated)
-- ============================================================================
-- Returns aggregated demand metrics for all services/packages

CREATE OR REPLACE FUNCTION public.get_item_demand_summary(
  p_tenant_id UUID,
  p_item_type VARCHAR(50), -- 'service' or 'package'
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  total_demand BIGINT,
  avg_daily_demand NUMERIC,
  peak_demand BIGINT,
  peak_demand_date DATE,
  trend_7d NUMERIC, -- 7-day trend (percentage change)
  trend_30d NUMERIC -- 30-day trend (percentage change)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF p_item_type = 'service' THEN
    RETURN QUERY
    WITH service_demand AS (
      SELECT * FROM public.get_service_demand_history(p_tenant_id, p_start_date, p_end_date)
    ),
    aggregated AS (
      SELECT
        sd.service_id AS item_id,
        sd.service_name AS item_name,
        SUM(sd.demand) AS total_demand,
        AVG(sd.demand) AS avg_daily_demand,
        MAX(sd.demand) AS peak_demand,
        (ARRAY_AGG(sd.date ORDER BY sd.demand DESC))[1] AS peak_demand_date
      FROM service_demand sd
      GROUP BY sd.service_id, sd.service_name
    ),
    recent_7d AS (
      SELECT
        sd.service_id,
        AVG(sd.demand) AS avg_demand_7d
      FROM service_demand sd
      WHERE sd.date >= p_end_date - INTERVAL '7 days'
      GROUP BY sd.service_id
    ),
    previous_7d AS (
      SELECT
        sd.service_id,
        AVG(sd.demand) AS avg_demand_prev_7d
      FROM service_demand sd
      WHERE sd.date >= p_end_date - INTERVAL '14 days'
        AND sd.date < p_end_date - INTERVAL '7 days'
      GROUP BY sd.service_id
    ),
    recent_30d AS (
      SELECT
        sd.service_id,
        AVG(sd.demand) AS avg_demand_30d
      FROM service_demand sd
      WHERE sd.date >= p_end_date - INTERVAL '30 days'
      GROUP BY sd.service_id
    ),
    previous_30d AS (
      SELECT
        sd.service_id,
        AVG(sd.demand) AS avg_demand_prev_30d
      FROM service_demand sd
      WHERE sd.date >= p_end_date - INTERVAL '60 days'
        AND sd.date < p_end_date - INTERVAL '30 days'
      GROUP BY sd.service_id
    )
    SELECT
      agg.item_id,
      agg.item_name,
      agg.total_demand,
      ROUND(agg.avg_daily_demand, 2) AS avg_daily_demand,
      agg.peak_demand,
      agg.peak_demand_date,
      ROUND(
        CASE 
          WHEN COALESCE(p7d.avg_demand_prev_7d, 0) > 0 THEN
            ((r7d.avg_demand_7d - p7d.avg_demand_prev_7d) / p7d.avg_demand_prev_7d * 100)
          ELSE 0
        END,
        2
      ) AS trend_7d,
      ROUND(
        CASE 
          WHEN COALESCE(p30d.avg_demand_prev_30d, 0) > 0 THEN
            ((r30d.avg_demand_30d - p30d.avg_demand_prev_30d) / p30d.avg_demand_prev_30d * 100)
          ELSE 0
        END,
        2
      ) AS trend_30d
    FROM aggregated agg
    LEFT JOIN recent_7d r7d ON agg.item_id = r7d.service_id
    LEFT JOIN previous_7d p7d ON agg.item_id = p7d.service_id
    LEFT JOIN recent_30d r30d ON agg.item_id = r30d.service_id
    LEFT JOIN previous_30d p30d ON agg.item_id = p30d.service_id
    ORDER BY agg.total_demand DESC;
  
  ELSE -- p_item_type = 'package'
    RETURN QUERY
    WITH package_demand AS (
      SELECT * FROM public.get_package_demand_history(p_tenant_id, p_start_date, p_end_date)
    ),
    aggregated AS (
      SELECT
        pd.package_id AS item_id,
        pd.package_name AS item_name,
        SUM(pd.demand) AS total_demand,
        AVG(pd.demand) AS avg_daily_demand,
        MAX(pd.demand) AS peak_demand,
        (ARRAY_AGG(pd.date ORDER BY pd.demand DESC))[1] AS peak_demand_date
      FROM package_demand pd
      GROUP BY pd.package_id, pd.package_name
    ),
    recent_7d AS (
      SELECT
        pd.package_id,
        AVG(pd.demand) AS avg_demand_7d
      FROM package_demand pd
      WHERE pd.date >= p_end_date - INTERVAL '7 days'
      GROUP BY pd.package_id
    ),
    previous_7d AS (
      SELECT
        pd.package_id,
        AVG(pd.demand) AS avg_demand_prev_7d
      FROM package_demand pd
      WHERE pd.date >= p_end_date - INTERVAL '14 days'
        AND pd.date < p_end_date - INTERVAL '7 days'
      GROUP BY pd.package_id
    ),
    recent_30d AS (
      SELECT
        pd.package_id,
        AVG(pd.demand) AS avg_demand_30d
      FROM package_demand pd
      WHERE pd.date >= p_end_date - INTERVAL '30 days'
      GROUP BY pd.package_id
    ),
    previous_30d AS (
      SELECT
        pd.package_id,
        AVG(pd.demand) AS avg_demand_prev_30d
      FROM package_demand pd
      WHERE pd.date >= p_end_date - INTERVAL '60 days'
        AND pd.date < p_end_date - INTERVAL '30 days'
      GROUP BY pd.package_id
    )
    SELECT
      agg.item_id,
      agg.item_name,
      agg.total_demand,
      ROUND(agg.avg_daily_demand, 2) AS avg_daily_demand,
      agg.peak_demand,
      agg.peak_demand_date,
      ROUND(
        CASE 
          WHEN COALESCE(p7d.avg_demand_prev_7d, 0) > 0 THEN
            ((r7d.avg_demand_7d - p7d.avg_demand_prev_7d) / p7d.avg_demand_prev_7d * 100)
          ELSE 0
        END,
        2
      ) AS trend_7d,
      ROUND(
        CASE 
          WHEN COALESCE(p30d.avg_demand_prev_30d, 0) > 0 THEN
            ((r30d.avg_demand_30d - p30d.avg_demand_prev_30d) / p30d.avg_demand_prev_30d * 100)
          ELSE 0
        END,
        2
      ) AS trend_30d
    FROM aggregated agg
    LEFT JOIN recent_7d r7d ON agg.item_id = r7d.package_id
    LEFT JOIN previous_7d p7d ON agg.item_id = p7d.package_id
    LEFT JOIN recent_30d r30d ON agg.item_id = r30d.package_id
    LEFT JOIN previous_30d p30d ON agg.item_id = p30d.package_id
    ORDER BY agg.total_demand DESC;
  END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.get_service_demand_history IS 
  'Returns daily service demand (completed sessions) for forecasting. Fills in zero-demand days.';

COMMENT ON FUNCTION public.get_package_demand_history IS 
  'Returns daily package demand (confirmed/completed bookings) for forecasting. Fills in zero-demand days.';

COMMENT ON FUNCTION public.get_item_demand_summary IS 
  'Returns aggregated demand metrics for all services/packages including trends and peak demand dates.';
