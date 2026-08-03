-- ============================================================================
-- Add Admin User Role
-- Purpose: Assign admin role to enable partner application approval
-- Run: Copy to Supabase Dashboard SQL Editor → Run
-- ============================================================================

-- Step 1: Find your user ID
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Step 2: Add admin role (replace YOUR_USER_ID)
INSERT INTO user_roles (user_id, role_name, tenant_id)
VALUES 
  ('YOUR_USER_ID', 'admin', NULL)
ON CONFLICT (user_id, role_name, tenant_id) DO NOTHING;

-- Optional: Add super_admin role for full access
-- INSERT INTO user_roles (user_id, role_name, tenant_id)
-- VALUES 
--   ('YOUR_USER_ID', 'super_admin', NULL)
-- ON CONFLICT (user_id, role_name, tenant_id) DO NOTHING;

-- Step 3: Verify
SELECT 
  ur.user_id,
  u.email,
  ur.role_name,
  ur.tenant_id,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.user_id = 'YOUR_USER_ID';

-- Check all admin users
SELECT 
  u.email,
  ur.role_name,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role_name IN ('admin', 'super_admin')
ORDER BY ur.created_at DESC;
