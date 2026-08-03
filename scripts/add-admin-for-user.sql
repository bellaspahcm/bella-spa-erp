-- ============================================================================
-- Add Admin Role for admin.realestate@bellagroup.vn
-- Run in Supabase Dashboard SQL Editor
-- ============================================================================

-- Step 1: Get user ID
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'admin.realestate@bellagroup.vn';

-- Copy the id (UUID) from result above, then run:

-- Step 2: Add admin role (replace the UUID below with actual user ID)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin.realestate@bellagroup.vn';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: admin.realestate@bellagroup.vn';
  END IF;
  
  -- Add admin role
  INSERT INTO user_roles (user_id, role_name, tenant_id)
  VALUES (v_user_id, 'admin', NULL)
  ON CONFLICT (user_id, role_name, tenant_id) DO NOTHING;
  
  RAISE NOTICE 'Admin role added for user: %', v_user_id;
END $$;

-- Step 3: Verify
SELECT 
  u.email,
  ur.role_name,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'admin.realestate@bellagroup.vn';

-- Expected output: 1 row with role_name = 'admin'
