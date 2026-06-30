-- Migration: Create Materialized View for Inventory Status
-- Purpose: Real-time inventory status with stock forecasting
-- Refresh: Every 5 minutes via cron job (more frequent due to critical nature)
-- Created: 2026-06-22

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_inventory_status CASCADE;

-- Create materialized view
CREATE MATERIALIZED VIEW mv_inventory_status AS
SELECT
  p.id AS product_id,
  p.tenant_id,
  p.name AS product_name,
  p.category,
  p.sku,
  p.unit_of_measure,
  
  -- Current stock info
  COALESCE(i.quantity, 0) AS current_stock,
  COALESCE(i.reorder_point, 0) AS reorder_point,
  COALESCE(i.reorder_quantity, 0) AS reorder_quantity,
  COALESCE(i.max_stock_level, 0) AS max_stock_level,
  
  -- Stock status classification
  CASE
    WHEN COALESCE(i.quantity, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(i.quantity, 0) <= COALESCE(i.reorder_point, 0) THEN 'low_stock'
    WHEN COALESCE(i.quantity, 0) <= COALESCE(i.reorder_point, 0) * 2 THEN 'medium_stock'
    ELSE 'high_stock'
  END AS stock_status,
  
  -- Stock value
  COALESCE(i.quantity, 0) * COALESCE(p.cost_price, 0) AS stock_value,
  
  -- Usage metrics (last 30 days)
  COALESCE(
    (SELECT SUM(ps.quantity_used) 
     FROM product_usage ps 
     WHERE ps.product_id = p.id 
       AND ps.created_at >= NOW() - INTERVAL '30 days'
       AND ps.tenant_id = p.tenant_id),
    0
  ) AS usage_last_30_days,
  
  -- Average daily usage (last 30 days)
  COALESCE(
    (SELECT SUM(ps.quantity_used) / 30.0
     FROM product_usage ps 
     WHERE ps.product_id = p.id 
       AND ps.created_at >= NOW() - INTERVAL '30 days'
       AND ps.tenant_id = p.tenant_id),
    0
  ) AS avg_daily_usage,
  
  -- Forecasted days until stockout
  CASE
    WHEN COALESCE(
      (SELECT SUM(ps.quantity_used) / 30.0
       FROM product_usage ps 
       WHERE ps.product_id = p.id 
         AND ps.created_at >= NOW() - INTERVAL '30 days'
         AND ps.tenant_id = p.tenant_id),
      0
    ) > 0 THEN
      ROUND(
        COALESCE(i.quantity, 0) / 
        NULLIF(
          (SELECT SUM(ps.quantity_used) / 30.0
           FROM product_usage ps 
           WHERE ps.product_id = p.id 
             AND ps.created_at >= NOW() - INTERVAL '30 days'
             AND ps.tenant_id = p.tenant_id),
          0
        )
      )::INTEGER
    ELSE NULL
  END AS days_until_stockout,
  
  -- Supplier information
  s.id AS supplier_id,
  s.name AS supplier_name,
  s.contact_person AS supplier_contact,
  s.phone AS supplier_phone,
  s.email AS supplier_email,
  COALESCE(s.lead_time_days, 7) AS supplier_lead_time_days,
  
  -- Reorder recommendation
  CASE
    WHEN COALESCE(i.quantity, 0) <= 0 THEN 'urgent'
    WHEN COALESCE(i.quantity, 0) <= COALESCE(i.reorder_point, 0) THEN 'recommended'
    WHEN COALESCE(
      (SELECT SUM(ps.quantity_used) / 30.0
       FROM product_usage ps 
       WHERE ps.product_id = p.id 
         AND ps.created_at >= NOW() - INTERVAL '30 days'
         AND ps.tenant_id = p.tenant_id),
      0
    ) > 0 
    AND (
      COALESCE(i.quantity, 0) / 
      NULLIF(
        (SELECT SUM(ps.quantity_used) / 30.0
         FROM product_usage ps 
         WHERE ps.product_id = p.id 
           AND ps.created_at >= NOW() - INTERVAL '30 days'
           AND ps.tenant_id = p.tenant_id),
        0
      )
    ) <= COALESCE(s.lead_time_days, 7) THEN 'suggested'
    ELSE 'not_needed'
  END AS reorder_recommendation,
  
  -- Suggested reorder date (current_date + (days_until_stockout - lead_time))
  CASE
    WHEN COALESCE(
      (SELECT SUM(ps.quantity_used) / 30.0
       FROM product_usage ps 
       WHERE ps.product_id = p.id 
         AND ps.created_at >= NOW() - INTERVAL '30 days'
         AND ps.tenant_id = p.tenant_id),
      0
    ) > 0 THEN
      (CURRENT_DATE + (
        ROUND(
          COALESCE(i.quantity, 0) / 
          NULLIF(
            (SELECT SUM(ps.quantity_used) / 30.0
             FROM product_usage ps 
             WHERE ps.product_id = p.id 
               AND ps.created_at >= NOW() - INTERVAL '30 days'
               AND ps.tenant_id = p.tenant_id),
            0
          )
        )::INTEGER - COALESCE(s.lead_time_days, 7)
      ))::DATE
    ELSE NULL
  END AS suggested_reorder_date,
  
  -- Last transactions
  i.last_restock_date,
  i.last_restock_quantity,
  (SELECT MAX(ps.created_at) 
   FROM product_usage ps 
   WHERE ps.product_id = p.id 
     AND ps.tenant_id = p.tenant_id) AS last_usage_date,
  
  -- Metadata
  i.updated_at AS inventory_updated_at,
  NOW() AS computed_at

FROM products p
LEFT JOIN inventory i ON i.product_id = p.id AND i.tenant_id = p.tenant_id
LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id

WHERE p.tenant_id IS NOT NULL
  AND p.is_active = TRUE;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_inventory_status_unique 
  ON mv_inventory_status (product_id, tenant_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_inventory_status_tenant 
  ON mv_inventory_status (tenant_id);

CREATE INDEX idx_mv_inventory_status_stock_status 
  ON mv_inventory_status (tenant_id, stock_status);

CREATE INDEX idx_mv_inventory_status_reorder 
  ON mv_inventory_status (tenant_id, reorder_recommendation);

CREATE INDEX idx_mv_inventory_status_category 
  ON mv_inventory_status (tenant_id, category);

CREATE INDEX idx_mv_inventory_status_stockout 
  ON mv_inventory_status (tenant_id, days_until_stockout)
  WHERE days_until_stockout IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON mv_inventory_status TO authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_inventory_status IS 
  'Real-time inventory status with stock forecasting and reorder recommendations. Refresh every 5 minutes. Used by Operations Dashboard.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
