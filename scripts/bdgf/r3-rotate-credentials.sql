-- R3 Credential Rotation SQL Script
-- Run this in Supabase Dashboard SQL Editor (requires superuser/service role)
--
-- SECURITY NOTICE:
-- 1. Generate new passwords using secure random generator
-- 2. DO NOT commit generated passwords to git
-- 3. Update .env with new passwords immediately after execution
-- 4. Revoke/destroy old passwords

-- Generate new secure passwords (you must replace these with actual secure values)
-- Use: node -e "console.log(require('crypto').randomBytes(32).toString('base64url').slice(0, 32))"

-- Step 1: Rotate bella_developer password
ALTER USER bella_developer WITH PASSWORD '<NEW_PASSWORD_1>';

-- Step 2: Rotate bella_migration_executor password  
ALTER USER bella_migration_executor WITH PASSWORD '<NEW_PASSWORD_2>';

-- Verification queries (run after rotation)
-- These should return 't' (true) if passwords were changed

SELECT  
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole
FROM pg_roles
WHERE rolname IN ('bella_developer', 'bella_migration_executor');

-- Expected output:
-- bella_developer        | t | f | f | f
-- bella_migration_executor | t | f | f | f

-- After running this script:
-- 1. Update DATABASE_URL in .env with new bella_developer password
-- 2. Update DATABASE_EXECUTOR_URL in .env with new bella_migration_executor password
-- 3. Test with: node scripts/bdgf/r3-simple-test.mjs
-- 4. Destroy this SQL script or redact passwords from it
