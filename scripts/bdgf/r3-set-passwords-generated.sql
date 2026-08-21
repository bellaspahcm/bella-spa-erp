-- Set passwords for R3 roles
ALTER ROLE bella_developer WITH PASSWORD '[REDACTED — ROTATED 2026-08-20]';
ALTER ROLE bella_migration_executor WITH PASSWORD '[REDACTED — ROTATED 2026-08-20]';

-- Verify
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('bella_developer', 'bella_migration_executor');
