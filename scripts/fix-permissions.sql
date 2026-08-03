-- Fix permissions for partner_applications table
-- Run in Supabase Dashboard SQL Editor

-- Grant SELECT to authenticated users
GRANT SELECT ON public.partner_applications TO authenticated;
GRANT SELECT ON public.partner_application_logs TO authenticated;

-- Verify grants
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('partner_applications', 'partner_application_logs')
AND grantee = 'authenticated';
