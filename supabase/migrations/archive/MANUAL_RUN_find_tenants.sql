-- ============================================================================
-- Find Tenant IDs for Phase 0 Pilot
-- ============================================================================
-- Run this to find available tenants and choose one for testing
-- ============================================================================

-- Option 1: Show all tenants with basic info
SELECT 
  id,
  name,
  email,
  subscription_plan,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 20;

-- Option 2: Show tenants with 'test' or 'dev' in name (good for pilot)
SELECT 
  id,
  name,
  email,
  subscription_plan
FROM tenants
WHERE 
  name ILIKE '%test%' 
  OR name ILIKE '%dev%'
  OR email ILIKE '%test%'
  OR email ILIKE '%dev%'
LIMIT 10;

-- Option 3: Show tenants with most activity (good for realistic testing)
SELECT 
  t.id,
  t.name,
  t.email,
  COUNT(DISTINCT b.id) as booking_count
FROM tenants t
LEFT JOIN bookings b ON b.tenant_id = t.id
GROUP BY t.id, t.name, t.email
ORDER BY booking_count DESC
LIMIT 10;
