-- Inspect RLS policies for real_estate_projects
-- Part of P1.3 Authenticated Tenant Isolation verification

SELECT 
  schemaname,
  tablename,
  policyname,
  qual as "USING_clause",
  with_check as "WITH_CHECK_clause",
  cmd as "command_type"
FROM pg_policies
WHERE tablename = 'real_estate_projects'
ORDER BY policyname;
