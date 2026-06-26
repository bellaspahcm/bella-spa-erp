-- =====================================================
-- SAFE CLEANUP: Delete CleanPro V2 Demo Users Only
-- =====================================================
-- This script ONLY deletes users with @cleanpro-v2.com emails
-- Does NOT touch Bella ERP or Beauty Spa users
-- =====================================================

-- Step 1: Show what will be deleted (for verification)
SELECT 
  'Users to be deleted:' as action,
  email, 
  full_name, 
  role,
  tenant_id
FROM public.users 
WHERE email LIKE '%@cleanpro-v2.com'
ORDER BY email;

-- Step 2: Actually delete CleanPro V2 demo users
DELETE FROM public.users 
WHERE email LIKE '%@cleanpro-v2.com';

-- Step 3: Verify deletion (should return 0 rows)
SELECT 
  'Remaining CleanPro users (should be 0):' as verification,
  COUNT(*) as count
FROM public.users 
WHERE email LIKE '%@cleanpro-v2.com';

-- =====================================================
-- Add metadata column to bookings table
-- =====================================================

-- Step 4: Add metadata column (if not exists)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bookings.metadata IS 'Flexible JSON storage for booking context (package details, facility notes, special requirements, emergency bookings, etc.)';

-- Step 5: Verify column was added
SELECT 
  'bookings' as table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'bookings' 
  AND column_name = 'metadata';

-- =====================================================
-- Final Verification: Bella and Beauty Spa UNTOUCHED
-- =====================================================

-- Count users by tenant module (to confirm Bella/Beauty intact)
SELECT 
  t.name as tenant_name,
  t.enabled_modules->>'industrial_cleaning' as is_cleaning,
  t.enabled_modules->>'babycare' as is_bella,
  t.enabled_modules->>'beauty_spa' as is_beauty,
  COUNT(u.id) as user_count
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id
WHERE t.status = 'active'
GROUP BY t.id, t.name, t.enabled_modules
ORDER BY t.name;
