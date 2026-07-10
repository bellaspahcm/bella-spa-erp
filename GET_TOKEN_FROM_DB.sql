-- =====================================================
-- GET AUTH TOKEN FROM DATABASE
-- Chạy trong Supabase SQL Editor
-- =====================================================

-- Step 1: List all users (để biết email của bạn)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
LIMIT 10;

-- Step 2: Sau khi biết user ID, chạy query này để tạo token mới
-- (Thay YOUR_USER_ID bằng ID từ query trên)

-- CẢNH BÁO: Token này chỉ dùng để test, không dùng trong production!
