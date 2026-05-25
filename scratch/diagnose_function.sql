-- Diagnostic query — kiểm tra TOÀN BỘ overload của get_reconciliation_report
-- Paste vào Supabase SQL Editor và Run

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS is_security_definer,
  array_to_string(p.proacl, ', ') AS permissions,
  obj_description(p.oid, 'pg_proc') AS comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE '%reconciliation%';
