-- Hotfix for Meta Ads account cleanup.
-- RLS policies already restrict deletion to admin/super_admin tenant users;
-- this grant allows those policies to be evaluated for DELETE statements.

GRANT DELETE ON public.marketing_meta_ad_account_tokens TO authenticated, service_role;
GRANT DELETE ON public.marketing_meta_ad_accounts TO authenticated, service_role;
