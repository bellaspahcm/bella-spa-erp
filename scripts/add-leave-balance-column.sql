-- ============================================================================
-- Add leave_balance column to users table (if not exists)
-- Run this in Supabase SQL Editor FIRST
-- ============================================================================

-- Add leave_balance column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 12;

-- Add comment
COMMENT ON COLUMN users.leave_balance IS 'Annual leave balance in days (for Gate 1 testing)';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'leave_balance';
