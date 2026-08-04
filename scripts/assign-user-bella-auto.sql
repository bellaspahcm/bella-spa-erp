-- ============================================================================
-- Assign User to Bella Auto Stress Tenant
-- Run this in Supabase SQL Editor Dashboard
-- ============================================================================

-- Step 1: Find available users and their current tenants
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.tenant_id as current_tenant_id,
  t.name as current_tenant_name
FROM auth.users u
LEFT JOIN public.users p ON p.id = u.id
LEFT JOIN public.tenants t ON t.id = p.tenant_id
ORDER BY u.email;

-- Result will show something like:
-- | id (uuid) | email | full_name | current_tenant_id | current_tenant_name |
-- | abc-123   | admin@example.com | Admin | xyz-789 | beauty_spa |

-- ============================================================================
-- Step 2: Find Bella Auto Stress tenant ID
-- ============================================================================
SELECT id, name 
FROM public.tenants 
WHERE name = 'bella_auto_stress';

-- Result will show:
-- | id (uuid) | name |
-- | def-456 | bella_auto_stress |

-- ============================================================================
-- Step 3: Check if tenant has data
-- ============================================================================
SELECT 
  (SELECT COUNT(*) FROM public.auto_vehicles WHERE tenant_id = 'REPLACE_WITH_BELLA_AUTO_TENANT_ID') as vehicles,
  (SELECT COUNT(*) FROM public.customers WHERE tenant_id = 'REPLACE_WITH_BELLA_AUTO_TENANT_ID') as customers,
  (SELECT COUNT(*) FROM public.auto_customer_journeys WHERE tenant_id = 'REPLACE_WITH_BELLA_AUTO_TENANT_ID') as journeys;

-- Expected result if seed ran successfully:
-- | vehicles | customers | journeys |
-- | 50000    | 5000      | 5000     |

-- ============================================================================
-- Step 4: Update user to assign to Bella Auto tenant
-- REPLACE PLACEHOLDERS BEFORE RUNNING!
-- ============================================================================

-- Option A: Update existing user profile
UPDATE public.users
SET tenant_id = 'REPLACE_WITH_BELLA_AUTO_TENANT_ID' -- From Step 2
WHERE id = 'REPLACE_WITH_USER_ID'; -- From Step 1

-- Option B: Create new user profile if not exists
INSERT INTO public.users (id, tenant_id, full_name, role, status)
VALUES (
  'REPLACE_WITH_USER_ID', -- From Step 1 (auth.users.id)
  'REPLACE_WITH_BELLA_AUTO_TENANT_ID', -- From Step 2
  'Admin', -- Or use actual name
  'admin',
  'active'
)
ON CONFLICT (id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id;

-- ============================================================================
-- Step 5: Verify update
-- ============================================================================
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.tenant_id,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM public.auto_vehicles WHERE tenant_id = p.tenant_id) as vehicle_count
FROM auth.users u
JOIN public.users p ON p.id = u.id
JOIN public.tenants t ON t.id = p.tenant_id
WHERE u.id = 'REPLACE_WITH_USER_ID'; -- From Step 1

-- Expected result:
-- | id | email | full_name | tenant_id | tenant_name | vehicle_count |
-- | abc-123 | admin@example.com | Admin | def-456 | bella_auto_stress | 50000 |

-- ============================================================================
-- IMPORTANT: After running this SQL
-- ============================================================================
-- 1. Logout from application
-- 2. Login again with the same email
-- 3. Navigate to /dashboard/bella-auto
-- 4. Dashboard should now show 50,000 vehicles and charts with data
-- ============================================================================
