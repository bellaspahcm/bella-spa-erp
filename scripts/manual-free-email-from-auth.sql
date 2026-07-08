-- ============================================================================
-- Manual cleanup: Delete user from auth.users to free email for reuse
-- ============================================================================
-- Use this script when employee deletion fails to free the email in auth.users
-- 
-- IMPORTANT: Run this in Supabase Dashboard > SQL Editor with CAUTION
-- This permanently deletes the authentication record
-- 
-- Steps:
-- 1. Find the auth user ID by email
-- 2. Delete from auth.users (this frees the email)
-- 3. Verify deletion
-- ============================================================================

-- Step 1: Find user by email (replace with actual email)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'baphouseshop@gmail.com';

-- If user found, copy the UUID 'id' value above

-- Step 2: Delete from auth.users (DANGER: Replace <USER_UUID> with actual UUID)
-- DELETE FROM auth.users WHERE id = '<USER_UUID>';

-- Example:
-- DELETE FROM auth.users WHERE id = '12345678-1234-1234-1234-123456789abc';

-- Step 3: Verify deletion - should return 0 rows
SELECT COUNT(*) as remaining_count
FROM auth.users
WHERE email = 'baphouseshop@gmail.com';

-- Expected: remaining_count = 0

-- Step 4: Now you can create new employee with this email in the UI
