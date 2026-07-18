-- Migration: Create Materialized View for Inventory Status
-- Purpose: Real-time inventory status with full field mapping matching code expectations
-- Refresh: Every 5 minutes via cron job (more frequent due to critical nature)
-- Created: 2026-06-22
-- Updated: 2026-07-18 - Rebuilt with correct schema matching MvInventoryStatus TypeScript type

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_inventory_status CASCADE;

-- Create materialized view with full schema matching code expectations
CREATE MATERIALIZED VIEW mv_inventory_status AS
WITH usage_stats AS (
  -- Calculate usage from inventory_logs (negative change_amount = usage/consumption)
  SELECT
    il.item_id,
    il.tenant_id,
    COALESCE(SUM(CASE WHEN il.change_amount < 0 AND il.created_at >= NOW() - INTERVAL '30 days' THEN ABS(il.change_amount) ELSE 0 END), 0) AS usage_last_30_days,
    MAX(CASE WHEN il.change_amount > 0 THEN il.created_at ELSE NULL END) AS last_restock_date,
    MAX(CASE WHEN il.change_amount > 0 THEN il.change_amount ELSE NULL END) AS last_restock_quantity,
    MAX(CASE WHEN il.change_amount < 0 THEN il.created_at ELSE NULL END) AS last_usage_date
  FROM inventory_logs il
  GROUP BY il.item_id, il.tenant_id
)
SELECT
  -- Core IDs mapped to code expectations
  ii.id AS product_id,
  ii.tenant_id,
  ii.name AS product_name,
  COALESCE(NULLIF(ii.category, ''), 'Không phân loại') AS category,
  ii.sku,
  ii.unit AS unit_of_measure,

  -- Stock levels
  COALESCE(ii.stock_level, 0) AS current_stock,
  COALESCE(ii.min_stock_level, 0) AS reorder_point,
  GREATEST(COALESCE(ii.min_stock_level, 0) * 2, 20) AS reorder_quantity,
  GREATEST(COALESCE(ii.min_stock_level, 0) * 4, 50) AS max_stock_level,

  -- Stock status
  CASE
    WHEN COALESCE(ii.stock_level, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) THEN 'low_stock'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) * 2 THEN 'medium_stock'
    ELSE 'high_stock'
  END::text AS stock_status,

  -- Financial
  COALESCE(ii.stock_level, 0) * COALESCE(ii.price_per_unit, 0) AS stock_value,

  -- Usage metrics
  COALESCE(us.usage_last_30_days, 0) AS usage_last_30_days,
  ROUND(COALESCE(us.usage_last_30_days, 0) / 30.0, 2) AS avg_daily_usage,
  CASE
    WHEN COALESCE(us.usage_last_30_days, 0) > 0
    THEN ROUND(COALESCE(ii.stock_level, 0) / (COALESCE(us.usage_last_30_days, 0) / 30.0))::integer
    ELSE NULL
  END AS days_until_stockout,

  -- Supplier info (null since no supplier table exists yet)
  NULL::uuid AS supplier_id,
  NULL::text AS supplier_name,
  NULL::text AS supplier_contact,
  NULL::text AS supplier_phone,
  NULL::text AS supplier_email,
  7 AS supplier_lead_time_days,

  -- Reorder recommendation
  CASE
    WHEN COALESCE(ii.stock_level, 0) <= 0 THEN 'urgent'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) THEN 'urgent'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) * 1.5 THEN 'recommended'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) * 2 THEN 'suggested'
    ELSE 'not_needed'
  END::text AS reorder_recommendation,

  -- Suggested reorder date (lead time based)
  CASE
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0)
    THEN CURRENT_DATE::text
    WHEN COALESCE(us.usage_last_30_days, 0) > 0
    THEN (CURRENT_DATE + INTERVAL '1 day' * GREATEST(0, ROUND(COALESCE(ii.stock_level, 0) / (COALESCE(us.usage_last_30_days, 0) / 30.0)) - 7))::text
    ELSE NULL
  END AS suggested_reorder_date,

  -- Metadata
  us.last_restock_date,
  us.last_restock_quantity,
  us.last_usage_date,
  ii.updated_at AS inventory_updated_at,
  NOW() AS computed_at

FROM inventory_items ii
LEFT JOIN usage_stats us ON us.item_id = ii.id AND us.tenant_id = ii.tenant_id

WHERE ii.tenant_id IS NOT NULL;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_inventory_status_product_id
  ON mv_inventory_status (product_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_inventory_status_tenant
  ON mv_inventory_status (tenant_id, stock_status);

CREATE INDEX idx_mv_inventory_status_reorder
  ON mv_inventory_status (tenant_id, reorder_recommendation);

-- Grant access to authenticated users and anon
GRANT SELECT ON mv_inventory_status TO authenticated;
GRANT SELECT ON mv_inventory_status TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_inventory_status IS
  'Real-time inventory status with full reorder recommendations, supplier info placeholders, and usage stats from inventory_logs. Refresh every 5 minutes.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
