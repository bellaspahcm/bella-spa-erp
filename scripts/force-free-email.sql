-- Force free a specific email by archiving ALL users with that email
-- Run this in Supabase SQL Editor

-- Step 1: Check current state
SELECT 
  id,
  full_name,
  email,
  resignation_date,
  created_at
FROM users
WHERE email = 'baphouseshop@gmail.com'
ORDER BY created_at DESC;

-- Step 2: Archive ALL instances of this email (even without resignation_date)
-- UNCOMMENT to execute:
/*
UPDATE users
SET 
  email = CONCAT(EXTRACT(EPOCH FROM NOW())::bigint * 1000, '.deleted.', email),
  resignation_date = COALESCE(resignation_date, CURRENT_DATE)
WHERE email = 'baphouseshop@gmail.com';
*/

-- Step 3: Verify email is freed
/*
SELECT 
  id,
  full_name,
  email,
  resignation_date
FROM users
WHERE email LIKE '%baphouseshop%'
ORDER BY created_at DESC;
*/
