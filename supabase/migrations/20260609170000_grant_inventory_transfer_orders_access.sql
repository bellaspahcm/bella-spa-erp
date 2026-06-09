-- Grant base table privileges for inventory transfer orders.
-- RLS policies remain the authorization boundary:
-- - HQ admins can manage all transfer orders through public.is_hq_admin().
-- - Branch users can only access orders for their requester_tenant_id.

GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_transfer_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_transfer_orders TO service_role;
