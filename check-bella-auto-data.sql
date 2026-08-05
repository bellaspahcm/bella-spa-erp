-- Check if bella_auto_stress tenant exists and has data
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM auto_vehicles WHERE tenant_id = t.id) as vehicles_count,
  (SELECT COUNT(*) FROM auto_brands WHERE tenant_id = t.id) as brands_count,
  (SELECT COUNT(*) FROM auto_models WHERE tenant_id = t.id) as models_count,
  (SELECT COUNT(*) FROM auto_variants WHERE tenant_id = t.id) as variants_count
FROM tenants t
WHERE t.name = 'bella_auto_stress';

-- Check current user's tenant
SELECT 
  u.id,
  u.email,
  u.tenant_id,
  t.name as tenant_name
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE u.id = auth.uid();

-- Check sample vehicles with JOIN
SELECT 
  v.id,
  v.vin,
  v.status,
  v.tenant_id,
  vr.name as variant_name,
  m.name as model_name,
  b.name as brand_name
FROM auto_vehicles v
LEFT JOIN auto_variants vr ON vr.id = v.variant_id
LEFT JOIN auto_models m ON m.id = vr.model_id
LEFT JOIN auto_brands b ON b.id = m.brand_id
WHERE v.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
LIMIT 5;
