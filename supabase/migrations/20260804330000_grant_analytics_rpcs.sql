-- ============================================================================
-- Re-grant permissions for Bella Auto Analytics RPCs
-- Date: 2026-08-04
-- ============================================================================

-- Ensure authenticated users can execute all Bella Auto analytics RPCs
GRANT EXECUTE ON FUNCTION get_auto_inventory_trend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_inventory_trend(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_auto_inventory_trend(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION get_auto_top_models(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_top_models(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_auto_top_models(UUID, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION get_auto_revenue_by_month(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_revenue_by_month(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_auto_revenue_by_month(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION get_auto_weekly_deliveries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auto_weekly_deliveries(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_auto_weekly_deliveries(UUID) TO service_role;
