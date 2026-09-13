-- Setup test users for P1.3 authentication
-- Option 1: Check if test users already have auth records
-- Option 2: Create new test users if needed

-- Check auth.users for test accounts
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.last_sign_in_at,
  u.tenant_id,
  u.role
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE au.email IN (
  'loadtest-realestate@test.local',
  'loadtest-healthcare@test.local'
)
ORDER BY au.email;
