-- =====================================================
-- VERIFY: CleanPro Admin User Link
-- =====================================================
-- Quick verification that auth user and public user are linked correctly
-- =====================================================

-- Simple check: Are IDs matching?
SELECT 
  'ID Match Status' as check_type,
  CASE 
    WHEN au.id = pu.id THEN '✅ MATCHED'
    WHEN pu.id IS NULL THEN '❌ PUBLIC USER MISSING'
    ELSE '❌ MISMATCH'
  END as result
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
WHERE au.email = 'admin@cleanpro-v2.com';

-- Tenant check
SELECT 
  'Tenant Assignment' as check_type,
  CASE 
    WHEN pu.tenant_id IS NOT NULL THEN '✅ HAS TENANT'
    ELSE '❌ NO TENANT'
  END as result,
  t.name as tenant_name
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
LEFT JOIN public.tenants t ON t.id = pu.tenant_id
WHERE au.email = 'admin@cleanpro-v2.com';

-- Role check
SELECT 
  'User Role' as check_type,
  CASE 
    WHEN pu.role = 'admin' THEN '✅ ADMIN ROLE'
    WHEN pu.role IS NULL THEN '❌ NO ROLE'
    ELSE '⚠️ ROLE: ' || pu.role
  END as result
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
WHERE au.email = 'admin@cleanpro-v2.com';
