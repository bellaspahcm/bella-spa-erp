-- Tìm KTV Quang trong tất cả các tenant
SELECT 
  u.id,
  u.full_name,
  u.role,
  t.name AS tenant_name,
  t.id AS tenant_id
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.full_name ILIKE '%Quang%'
  AND u.role = 'ktv'
ORDER BY u.full_name;
