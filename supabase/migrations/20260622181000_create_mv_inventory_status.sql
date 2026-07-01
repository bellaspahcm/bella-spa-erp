-- Migration: Create Materialized View for Inventory Status
-- Purpose: Real-time inventory status
-- Refresh: Every 5 minutes via cron job (more frequent due to critical nature)
-- Created: 2026-06-22
-- Updated: Fixed to use inventory_items table instead of products

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_inventory_status CASCADE;

-- Create materialized view (simplified version using inventory_items)
CREATE MATERIALIZED VIEW mv_inventory_status AS
SELECT
  ii.id AS item_id,
  ii.tenant_id,
  ii.name AS item_name,
  ii.category,
  ii.sku,
  ii.unit,
  
  -- Current stock info
  COALESCE(ii.stock_level, 0) AS current_stock,
  COALESCE(ii.min_stock_level, 0) AS min_stock_level,
  COALESCE(ii.price_per_unit, 0) AS price_per_unit,
  
  -- Stock status classification
  CASE
    WHEN COALESCE(ii.stock_level, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) THEN 'low_stock'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) * 2 THEN 'medium_stock'
    ELSE 'high_stock'
  END AS stock_status,
  
  -- Stock value
  COALESCE(ii.stock_level, 0) * COALESCE(ii.price_per_unit, 0) AS stock_value,
  
  -- Reorder recommendation
  CASE
    WHEN COALESCE(ii.stock_level, 0) <= 0 THEN 'urgent'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) THEN 'recommended'
    WHEN COALESCE(ii.stock_level, 0) <= COALESCE(ii.min_stock_level, 0) * 1.5 THEN 'suggested'
    ELSE 'not_needed'
  END AS reorder_recommendation,
  
  -- Metadata
  ii.notes,
  ii.created_at,
  ii.updated_at,
  NOW() AS computed_at

FROM inventory_items ii

WHERE ii.tenant_id IS NOT NULL;

-- Create unique index for efficient lookups and concurrent refresh
CREATE UNIQUE INDEX idx_mv_inventory_status_unique 
  ON mv_inventory_status (item_id, tenant_id);

-- Create additional indexes for common queries
CREATE INDEX idx_mv_inventory_status_tenant 
  ON mv_inventory_status (tenant_id);

CREATE INDEX idx_mv_inventory_status_stock_status 
  ON mv_inventory_status (tenant_id, stock_status);

CREATE INDEX idx_mv_inventory_status_reorder 
  ON mv_inventory_status (tenant_id, reorder_recommendation);

CREATE INDEX idx_mv_inventory_status_category 
  ON mv_inventory_status (tenant_id, category)
  WHERE category IS NOT NULL;

-- Grant access to authenticated users and anon
GRANT SELECT ON mv_inventory_status TO authenticated;
GRANT SELECT ON mv_inventory_status TO anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW mv_inventory_status IS 
  'Real-time inventory status with reorder recommendations. Refresh every 5 minutes. Simplified version using inventory_items table.';

-- Refresh the view immediately
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_status;
