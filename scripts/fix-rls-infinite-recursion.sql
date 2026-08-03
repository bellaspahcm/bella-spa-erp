-- ============================================================================
-- Fix RLS Infinite Recursion for user_roles Table
-- Problem: "Admins can view all roles" policy checks user_roles to verify admin,
--          but checking user_roles triggers the policy again → infinite loop
-- Solution: Simplify policies to avoid circular dependency
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON user_roles;

-- Keep only the simple policy (users can view their own roles)
-- This one doesn't cause recursion because it uses auth.uid() directly

-- Add new policy: authenticated users can view all roles (temporary - for admin APIs)
-- This is less secure but prevents infinite recursion
-- TODO: Implement proper SECURITY DEFINER function for role checks
CREATE POLICY "Authenticated users can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Add policy: Only service role can insert/update/delete roles
-- This prevents regular users from modifying roles
CREATE POLICY "Only service role can modify roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Grant necessary permissions
GRANT SELECT ON user_roles TO authenticated;

-- Verification query
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- Expected: 3 policies
-- 1. "Users can view own roles" - SELECT with auth.uid() check
-- 2. "Authenticated users can view all roles" - SELECT with true
-- 3. "Only service role can modify roles" - ALL with false (blocks modifications)

-- Note: Role modifications should be done via direct SQL by admins
-- or through server-side functions with elevated privileges
