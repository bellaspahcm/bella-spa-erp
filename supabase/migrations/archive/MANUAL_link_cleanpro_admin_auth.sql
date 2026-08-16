-- =====================================================
-- Link CleanPro Admin Auth User with Public Users Table
-- =====================================================
-- This script links the manually created auth user with the public.users record
-- =====================================================

-- Step 1: Show current public.users record (should have NULL id from seed script)
SELECT 
  'Current public.users record:' as status,
  id,
  email,
  full_name,
  role,
  tenant_id,
  base_salary
FROM public.users
WHERE email = 'admin@cleanpro-v2.com';

-- Step 2: Show auth.users record (created manually in Supabase Auth Dashboard)
SELECT 
  'Auth user:' as status,
  id as auth_user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'admin@cleanpro-v2.com';

-- Step 3: Update public.users.id to match auth.users.id
UPDATE public.users
SET id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'admin@cleanpro-v2.com'
  LIMIT 1
)
WHERE email = 'admin@cleanpro-v2.com'
  AND id IS NULL;

-- Step 4: Verify the link
SELECT 
  'Verification - Linked user:' as status,
  u.id as user_id,
  u.email,
  u.full_name,
  u.role,
  t.name as tenant_name,
  au.id as auth_user_id,
  CASE 
    WHEN u.id = au.id THEN 'LINKED ✅'
    ELSE 'NOT LINKED ❌'
  END as link_status
FROM public.users u
JOIN public.tenants t ON t.id = u.tenant_id
LEFT JOIN auth.users au ON au.email = u.email
WHERE u.email = 'admin@cleanpro-v2.com';
