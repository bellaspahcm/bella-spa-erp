-- One-time SQL script to archive emails of soft-deleted users
-- Run this in Supabase SQL Editor

-- Show users that will be updated
SELECT 
  id,
  full_name,
  email,
  resignation_date,
  CONCAT(EXTRACT(EPOCH FROM NOW())::bigint * 1000, '.deleted.', email) as new_email
FROM users
WHERE resignation_date IS NOT NULL
  AND email NOT LIKE '%.deleted.%'
ORDER BY resignation_date DESC;

-- Update emails (uncomment to execute)
/*
UPDATE users
SET email = CONCAT(EXTRACT(EPOCH FROM NOW())::bigint * 1000, '.deleted.', email)
WHERE resignation_date IS NOT NULL
  AND email NOT LIKE '%.deleted.%';
*/

-- Verify update
/*
SELECT 
  id,
  full_name,
  email,
  resignation_date
FROM users
WHERE resignation_date IS NOT NULL
ORDER BY resignation_date DESC;
*/
