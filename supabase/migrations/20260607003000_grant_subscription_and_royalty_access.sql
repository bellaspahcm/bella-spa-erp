-- Grant table privileges required before RLS policies can apply.
-- Fixes settings tabs failing with "permission denied" for subscription and
-- royalty invoice tables when called through authenticated app sessions.

REVOKE ALL ON TABLE public.subscription_invoices FROM anon;
REVOKE ALL ON TABLE public.franchise_royalty_invoices FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.franchise_royalty_invoices TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.franchise_royalty_invoices TO service_role;

NOTIFY pgrst, 'reload schema';
