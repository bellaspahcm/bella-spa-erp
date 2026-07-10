-- ============================================================================
-- Fix: Add tenant_id to user metadata
-- ============================================================================
-- Problem: API returns "Tenant ID not found" because user.user_metadata.tenant_id is missing
-- Solution: Update auth.users metadata with tenant_id from users table

-- Step 1: Check current user metadata
SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'tenant_id' as tenant_id_in_metadata
FROM auth.users
LIMIT 5;

-- Step 2: Update user metadata with tenant_id from users table
UPDATE auth.users au
SET raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('tenant_id', u.tenant_id::text)
FROM users u
WHERE au.id = u.id
  AND u.tenant_id IS NOT NULL
  AND (au.raw_user_meta_data->>'tenant_id' IS NULL 
       OR au.raw_user_meta_data->>'tenant_id' != u.tenant_id::text);

-- Step 3: Verify fix
SELECT 
  au.id,
  au.email,
  u.tenant_id as users_table_tenant,
  au.raw_user_meta_data->>'tenant_id' as metadata_tenant,
  CASE 
    WHEN au.raw_user_meta_data->>'tenant_id' = u.tenant_id::text THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as status
FROM auth.users au
JOIN users u ON au.id = u.id
LIMIT 10;

-- Step 4: If you need to set a specific tenant for testing
-- Uncomment and replace YOUR_USER_EMAIL and YOUR_TENANT_ID

-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"tenant_id": "YOUR_TENANT_ID"}'::jsonb
-- WHERE email = 'YOUR_USER_EMAIL';
