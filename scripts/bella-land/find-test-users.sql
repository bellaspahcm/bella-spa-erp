-- Find users from different tenants for P1.3 testing
-- Need: 2 admin/manager users from different tenants

SELECT 
  u.id,
  u.email,
  u.tenant_id,
  t.name as tenant_name,
  u.role
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.role IN ('admin', 'manager')
  AND u.email IS NOT NULL
ORDER BY u.tenant_id, u.email
LIMIT 20;
