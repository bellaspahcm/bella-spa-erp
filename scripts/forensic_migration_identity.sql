-- READ-ONLY FORENSIC: Remote Migration Identity
-- Purpose: Determine exact identity of conflicting versions on remote
-- Date: 2026-08-24
-- NO MODIFICATIONS

-- E1: Remote Identity Check
SELECT *
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260819040000',
  '20260820110000',
  '20260824000000'
)
ORDER BY version;

-- Additional context: All columns for full picture
-- Expected columns: version, name, statements, applied_at, etc.
