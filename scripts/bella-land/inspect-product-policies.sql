-- ============================================================================
-- P5.5 Defect Investigation: Inspect real_estate_products RLS Policies
-- Purpose: Verify actual policies on production DB before remediation
-- Date: 2026-09-11
-- ============================================================================

-- QUERY 1: Check if RLS is enabled on real_estate_products
-- Expected: rowsecurity = true
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'real_estate_products';

-- QUERY 2: List ALL policies on real_estate_products
-- Expected: Only 'products_tenant_read' (SELECT), no UPDATE policy
SELECT 
  policyname,
  cmd AS command,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'real_estate_products'
ORDER BY cmd, policyname;

-- QUERY 3: Check for UPDATE policy specifically (hypothesis: should be EMPTY)
-- If this returns 0 rows, hypothesis confirmed
SELECT 
  policyname,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'real_estate_products'
AND cmd = 'UPDATE';

-- QUERY 4: Compare with re_reservations (should have UPDATE policy)
-- Expected: Has UPDATE policy for user's own reservations
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 're_reservations'
ORDER BY cmd, policyname;

-- QUERY 5: Check pattern used by real_estate_projects (for consistency)
-- Expected: Uses "tenant_id IN (SELECT tenant_id FROM users...)" pattern
SELECT 
  policyname,
  cmd,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'real_estate_projects'
ORDER BY cmd;

-- QUERY 6: Verify canonical helper function exists
-- Expected: get_auth_tenant_id function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_auth_tenant_id';

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 
-- If QUERY 3 returns 0 rows:
--   ✅ Hypothesis CONFIRMED: No UPDATE policy exists
--   → Proceed with minimal UPDATE-only migration
--
-- If QUERY 3 returns policy but defect persists:
--   ⚠️  Policy exists but may be insufficient
--   → Investigate policy expression (qual/with_check)
--   → May need to modify existing policy instead of adding new
--
-- Pattern Decision (based on QUERY 5):
--   If real_estate_projects uses "tenant_id IN (SELECT...)" pattern:
--   → Use same pattern for real_estate_products UPDATE policy
--   → Maintains consistency within Real Estate vertical
-- ============================================================================
