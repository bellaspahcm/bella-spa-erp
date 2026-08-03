-- Check if test data exists
SELECT 
  id,
  email,
  full_name,
  status,
  created_at
FROM partner_applications
WHERE email LIKE 'test%@example.com'
ORDER BY created_at DESC;

-- Count by status
SELECT 
  status,
  COUNT(*) as count
FROM partner_applications
GROUP BY status
ORDER BY status;

-- Check all applications (including non-test)
SELECT 
  email,
  status,
  created_at
FROM partner_applications
ORDER BY created_at DESC
LIMIT 10;
