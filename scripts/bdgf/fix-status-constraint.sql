-- Fix conflicting status constraints on bella_migration_approval
-- Drop old constraint that doesn't allow 'executing'
ALTER TABLE bella_migration_approval 
  DROP CONSTRAINT IF EXISTS bella_migration_approval_status_check;

-- Keep the newer status_valid constraint which includes execution states
-- status_valid already exists with: 'requested', 'approved', 'executing', 'executed', 'execution_failed', 'revoked', 'expired', 'rejected'

-- Verify
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bella_migration_approval'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%';
