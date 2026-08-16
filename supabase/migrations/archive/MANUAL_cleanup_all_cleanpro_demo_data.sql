-- =====================================================
-- COMPLETE CLEANUP: All CleanPro Demo Data
-- =====================================================
-- This script removes ALL CleanPro V2 demo tenants and related data
-- Safe: Only targets tenants with name containing "CleanPro Industrial Services V2 [DEMO]"
-- Does NOT touch Bella ERP or Beauty Spa data
-- =====================================================

-- Step 1: Show what will be deleted (for verification)
SELECT 
  'Tenants to be deleted:' as action,
  id,
  name,
  enabled_modules->>'industrial_cleaning' as is_cleaning
FROM public.tenants 
WHERE name LIKE '%CleanPro Industrial Services V2 [DEMO]%'
ORDER BY name;

-- Step 2: Delete all related data for each CleanPro tenant
DO $$
DECLARE
  tenant_record RECORD;
  total_deleted INTEGER := 0;
BEGIN
  -- Loop through all CleanPro demo tenants
  FOR tenant_record IN 
    SELECT id, name 
    FROM public.tenants 
    WHERE name LIKE '%CleanPro Industrial Services V2 [DEMO]%'
  LOOP
    RAISE NOTICE 'Cleaning up tenant: % (ID: %)', tenant_record.name, tenant_record.id;
    
    -- Delete session logs
    DELETE FROM public.session_logs WHERE tenant_id = tenant_record.id;
    
    -- Delete revenue
    DELETE FROM public.revenue WHERE tenant_id = tenant_record.id;
    
    -- Delete expenses
    DELETE FROM public.expenses WHERE tenant_id = tenant_record.id;
    
    -- Delete bookings
    DELETE FROM public.bookings WHERE tenant_id = tenant_record.id;
    
    -- Delete customers
    DELETE FROM public.customers WHERE tenant_id = tenant_record.id;
    
    -- Delete users
    DELETE FROM public.users WHERE tenant_id = tenant_record.id;
    
    -- Delete tenant
    DELETE FROM public.tenants WHERE id = tenant_record.id;
    
    total_deleted := total_deleted + 1;
  END LOOP;
  
  RAISE NOTICE 'Total tenants deleted: %', total_deleted;
END $$;

-- Step 3: Verify all CleanPro tenants are gone
SELECT 
  'Remaining CleanPro tenants (should be 0):' as verification,
  COUNT(*) as count
FROM public.tenants 
WHERE name LIKE '%CleanPro Industrial Services V2 [DEMO]%';

-- Step 4: Final verification - Bella and Beauty Spa intact
SELECT 
  'Final Verification - All Active Tenants:' as status,
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
