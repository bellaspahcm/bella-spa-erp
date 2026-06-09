-- Reassert inventory transfer order table privileges and reload PostgREST.
-- This keeps RLS as the authorization boundary while ensuring the API role
-- has base table privileges before policies are evaluated.

REVOKE ALL ON TABLE public.inventory_transfer_orders FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_transfer_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_transfer_orders TO service_role;

COMMENT ON TABLE public.inventory_transfer_orders
IS 'Internal inventory transfer orders. Authenticated users receive base table privileges, while RLS limits HQ users to global access and branch users to requester_tenant_id.';

NOTIFY pgrst, 'reload schema';
