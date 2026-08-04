-- ============================================================================
-- Bella Auto: Analytics RPC Functions
-- Purpose: Real-time analytics for Dashboard
-- Date: 2026-08-04
-- ============================================================================

-- ============================================================================
-- RPC 1: Inventory Trend (Monthly nhập/xuất/tồn kho - 6 months)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_auto_inventory_trend(p_tenant_id UUID)
RETURNS TABLE (
  month TEXT,
  nhap INTEGER,
  xuat INTEGER,
  ton INTEGER
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT 
      generate_series(
        date_trunc('month', NOW()) - INTERVAL '5 months',
        date_trunc('month', NOW()),
        INTERVAL '1 month'
      )::DATE AS month_date
  ),
  -- Nhập kho: count vehicles created in month
  nhap_kho AS (
    SELECT 
      date_trunc('month', created_at)::DATE AS month_date,
      COUNT(*)::INTEGER AS nhap_count
    FROM auto_vehicles
    WHERE tenant_id = p_tenant_id
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', created_at)::DATE
  ),
  -- Xuất kho: count vehicles delivered in month
  xuat_kho AS (
    SELECT 
      date_trunc('month', updated_at)::DATE AS month_date,
      COUNT(*)::INTEGER AS xuat_count
    FROM auto_vehicles
    WHERE tenant_id = p_tenant_id
      AND status = 'delivered'
      AND updated_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', updated_at)::DATE
  )
  SELECT 
    CASE EXTRACT(MONTH FROM m.month_date)::INTEGER
      WHEN 1 THEN 'T1'
      WHEN 2 THEN 'T2'
      WHEN 3 THEN 'T3'
      WHEN 4 THEN 'T4'
      WHEN 5 THEN 'T5'
      WHEN 6 THEN 'T6'
      WHEN 7 THEN 'T7'
      WHEN 8 THEN 'T8'
      WHEN 9 THEN 'T9'
      WHEN 10 THEN 'T10'
      WHEN 11 THEN 'T11'
      WHEN 12 THEN 'T12'
    END AS month,
    COALESCE(n.nhap_count, 0)::INTEGER AS nhap,
    COALESCE(x.xuat_count, 0)::INTEGER AS xuat,
    (
      SELECT COUNT(*)::INTEGER
      FROM auto_vehicles
      WHERE tenant_id = p_tenant_id
        AND status IN ('warehouse', 'showroom', 'allocated', 'in_transit')
        AND created_at <= m.month_date + INTERVAL '1 month' - INTERVAL '1 day'
    ) AS ton
  FROM months m
  LEFT JOIN nhap_kho n ON m.month_date = n.month_date
  LEFT JOIN xuat_kho x ON m.month_date = x.month_date
  ORDER BY m.month_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_auto_inventory_trend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_inventory_trend(UUID) TO service_role;

COMMENT ON FUNCTION get_auto_inventory_trend(UUID) IS 
'Returns 6-month inventory trend: vehicles in (nhap), out (xuat), and stock (ton).';

-- ============================================================================
-- RPC 2: Top Selling Models (Top 5 models by sales volume)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_auto_top_models(
  p_tenant_id UUID, 
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  model TEXT,
  sold BIGINT,
  revenue NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.model AS model,
    COUNT(*)::BIGINT AS sold,
    COALESCE(SUM(b.total_price), 0)::NUMERIC AS revenue
  FROM auto_vehicles v
  INNER JOIN auto_bookings b ON b.vehicle_id = v.id
  WHERE v.tenant_id = p_tenant_id
    AND b.status = 'completed'
    AND v.status = 'delivered'
  GROUP BY v.model
  ORDER BY sold DESC, revenue DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_auto_top_models(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_top_models(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION get_auto_top_models(UUID, INTEGER) IS 
'Returns top selling vehicle models by volume and revenue. Default limit: 5.';

-- ============================================================================
-- RPC 3: Monthly Revenue Trend (6 months)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_auto_revenue_by_month(p_tenant_id UUID)
RETURNS TABLE (
  month TEXT,
  revenue NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT 
      generate_series(
        date_trunc('month', NOW()) - INTERVAL '5 months',
        date_trunc('month', NOW()),
        INTERVAL '1 month'
      )::DATE AS month_date
  ),
  revenue_data AS (
    SELECT 
      date_trunc('month', b.created_at)::DATE AS month_date,
      SUM(b.total_price)::NUMERIC AS total_revenue
    FROM auto_bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.status = 'completed'
      AND b.created_at >= NOW() - INTERVAL '6 months'
    GROUP BY date_trunc('month', b.created_at)::DATE
  )
  SELECT 
    CASE EXTRACT(MONTH FROM m.month_date)::INTEGER
      WHEN 1 THEN 'T1'
      WHEN 2 THEN 'T2'
      WHEN 3 THEN 'T3'
      WHEN 4 THEN 'T4'
      WHEN 5 THEN 'T5'
      WHEN 6 THEN 'T6'
      WHEN 7 THEN 'T7'
      WHEN 8 THEN 'T8'
      WHEN 9 THEN 'T9'
      WHEN 10 THEN 'T10'
      WHEN 11 THEN 'T11'
      WHEN 12 THEN 'T12'
    END AS month,
    COALESCE(r.total_revenue, 0)::NUMERIC AS revenue
  FROM months m
  LEFT JOIN revenue_data r ON m.month_date = r.month_date
  ORDER BY m.month_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_auto_revenue_by_month(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_revenue_by_month(UUID) TO service_role;

COMMENT ON FUNCTION get_auto_revenue_by_month(UUID) IS 
'Returns 6-month revenue trend from completed bookings.';

-- ============================================================================
-- RPC 4: Weekly Deliveries (Last 8 weeks)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_auto_weekly_deliveries(p_tenant_id UUID)
RETURNS TABLE (
  week TEXT,
  deliveries INTEGER
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH weeks AS (
    SELECT 
      generate_series(
        date_trunc('week', NOW()) - INTERVAL '7 weeks',
        date_trunc('week', NOW()),
        INTERVAL '1 week'
      )::DATE AS week_date
  ),
  delivery_data AS (
    SELECT 
      date_trunc('week', updated_at)::DATE AS week_date,
      COUNT(*)::INTEGER AS delivery_count
    FROM auto_vehicles
    WHERE tenant_id = p_tenant_id
      AND status = 'delivered'
      AND updated_at >= NOW() - INTERVAL '8 weeks'
    GROUP BY date_trunc('week', updated_at)::DATE
  )
  SELECT 
    'Tuần ' || (ROW_NUMBER() OVER (ORDER BY w.week_date))::TEXT AS week,
    COALESCE(d.delivery_count, 0)::INTEGER AS deliveries
  FROM weeks w
  LEFT JOIN delivery_data d ON w.week_date = d.week_date
  ORDER BY w.week_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_auto_weekly_deliveries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_weekly_deliveries(UUID) TO service_role;

COMMENT ON FUNCTION get_auto_weekly_deliveries(UUID) IS 
'Returns 8-week vehicle delivery trend.';

-- ============================================================================
-- Test Queries (Comment out before production)
-- ============================================================================

/*
-- Test RPC 1: Inventory Trend
SELECT * FROM get_auto_inventory_trend('your-tenant-id');

-- Test RPC 2: Top Models
SELECT * FROM get_auto_top_models('your-tenant-id', 5);

-- Test RPC 3: Revenue by Month
SELECT * FROM get_auto_revenue_by_month('your-tenant-id');

-- Test RPC 4: Weekly Deliveries
SELECT * FROM get_auto_weekly_deliveries('your-tenant-id');
*/
