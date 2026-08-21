-- R3 STEP 1: SET PASSWORDS FOR DATABASE ROLES
-- Execute this with admin credentials (postgres superuser)

-- INSTRUCTIONS:
-- 1. Generate 2 secure passwords (32+ chars) using password manager
-- 2. Replace <PASSWORD_1> and <PASSWORD_2> below
-- 3. Execute this script with: psql $DATABASE_URL -f scripts/bdgf/r3-step1-set-passwords.sql
-- 4. Store passwords in your password manager (NOT in git)

-- Set bella_developer password (READ-ONLY role)
ALTER ROLE bella_developer WITH PASSWORD '<PASSWORD_1>';

-- Set bella_migration_executor password (AUTHORIZED MUTATION role)
ALTER ROLE bella_migration_executor WITH PASSWORD '<PASSWORD_2>';

-- Verify roles exist and passwords are set
SELECT 
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb
FROM pg_roles 
WHERE rolname IN ('bella_developer', 'bella_migration_executor')
ORDER BY rolname;

-- Expected output:
-- rolname                    | rolcanlogin | rolsuper | rolcreatedb
-- bella_developer            | t           | f        | f
-- bella_migration_executor   | t           | f        | f
