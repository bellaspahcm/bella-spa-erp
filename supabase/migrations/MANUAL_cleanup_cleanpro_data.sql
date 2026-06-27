-- =====================================================
-- CLEANUP: Delete all CleanPro demo data
-- =====================================================
-- Run this BEFORE running the seed script if you need to reset data
-- =====================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get CleanPro tenant ID
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name LIKE '%CleanPro%' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'CleanPro tenant not found. Nothing to clean up.';
    RETURN;
  END IF;

  RAISE NOTICE 'Starting cleanup for tenant: %', v_tenant_id;

  -- Delete in reverse order of foreign key dependencies
  
  -- 1. Delete session_logs
  DELETE FROM public.session_logs WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted session_logs';
  
  -- 2. Delete bookings
  DELETE FROM public.bookings WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted bookings';
  
  -- 3. Delete customers
  DELETE FROM public.customers WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Deleted customers';
  
  -- 4. Delete users (KTV/workers)
  DELETE FROM public.users WHERE tenant_id = v_tenant_id AND role = 'ktv';
  RAISE NOTICE 'Deleted KTV users';
  
  RAISE NOTICE 'Cleanup completed successfully for CleanPro tenant';
END $$;

-- Verification: Should show 0 for all counts
SELECT 
  COUNT(DISTINCT c.id) as customer_count,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'ktv') as worker_count,
  COUNT(DISTINCT b.id) as booking_count,
  COUNT(sl.id) as total_sessions
FROM public.tenants t
LEFT JOIN public.customers c ON c.tenant_id = t.id
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.bookings b ON b.tenant_id = t.id
LEFT JOIN public.session_logs sl ON sl.tenant_id = t.id
WHERE t.name LIKE '%CleanPro%';
