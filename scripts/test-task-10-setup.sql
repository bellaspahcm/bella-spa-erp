-- ============================================
-- Task 10 Test Data Setup Script
-- ============================================
-- Purpose: Create test data for Task 10 (Service Items Management)
-- Run this script in Supabase SQL Editor before manual testing
-- ============================================

-- STEP 1: Create Test Tenant
-- Note: Using gen_random_uuid() with fixed seed for reproducible testing
INSERT INTO public.tenants (
  id, 
  name, 
  email,
  enabled_modules,
  commission_config,
  status
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Test Beauty Spa - Task 10',
  'test.beauty@example.com',
  '{"beauty_spa": true, "babycare": false}'::jsonb,
  '{
    "service_commission_default": {
      "type": "fixed",
      "value": 150000
    },
    "product_sales_commission_default": {
      "type": "percentage",
      "value": 10
    },
    "position_multipliers": {
      "junior": 1.0,
      "senior": 1.2,
      "lead": 1.5
    },
    "seniority_bonus_rates": {
      "0_to_1_year": 0.00,
      "1_to_3_years": 0.05,
      "3_to_5_years": 0.10,
      "5_plus_years": 0.15
    }
  }'::jsonb,
  'active'
)
ON CONFLICT (id) DO UPDATE
SET 
  enabled_modules = EXCLUDED.enabled_modules,
  commission_config = EXCLUDED.commission_config;

-- STEP 2: Create Test Users (Admin + KTV)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  tenant_id,
  status
) VALUES 
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'admin.beauty@test.com',
    'Admin Test Beauty',
    'admin',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'ktv1.beauty@test.com',
    'KTV Nguyễn Văn A',
    'ktv',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'ktv2.beauty@test.com',
    'KTV Trần Thị B',
    'ktv',
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name;

-- STEP 3: Create Test Customer
INSERT INTO public.customers (
  id,
  phone,
  name_mother,
  name_baby,
  address,
  tenant_id,
  status
) VALUES (
  '55555555-5555-5555-5555-555555555555'::uuid,
  '0901234567',
  'Chị Nguyễn Thị Test',
  'Bé Test',
  '123 Đường Test, Quận Test, TP.HCM',
  '11111111-1111-1111-1111-111111111111'::uuid,
  'active'
)
ON CONFLICT (phone, tenant_id) DO UPDATE
SET name_mother = EXCLUDED.name_mother;

-- STEP 4: Create Test Packages (Beauty Spa Services)
INSERT INTO public.packages (
  id,
  name,
  description,
  price,
  total_sessions,
  tenant_id,
  status
) VALUES 
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    'Gói Massage Thư Giãn',
    'Massage toàn thân giúp thư giãn và giảm stress',
    500000,
    10,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  ),
  (
    '77777777-7777-7777-7777-777777777777'::uuid,
    'Gói Chăm Sóc Da Mặt',
    'Chăm sóc da mặt chuyên sâu với mặt nạ collagen',
    300000,
    8,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  ),
  (
    '88888888-8888-8888-8888-888888888888'::uuid,
    'Gói Làm Nail Cao Cấp',
    'Làm nail đẹp với sơn gel và vẽ họa tiết',
    200000,
    1,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET price = EXCLUDED.price;

-- STEP 5: Create Test Bookings
INSERT INTO public.bookings (
  id,
  booking_number,
  customer_id,
  package_id,
  status,
  deposit_amount,
  full_price,
  start_date,
  total_sessions,
  completed_sessions,
  tenant_id
) VALUES 
  (
    '99999999-9999-9999-9999-999999999999'::uuid,
    'BK-BEAUTY-TEST-001',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '66666666-6666-6666-6666-666666666666'::uuid,
    'booked',
    100000,
    500000,
    '2026-06-01',
    10,
    3,
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'BK-BEAUTY-TEST-002',
    '55555555-5555-5555-5555-555555555555'::uuid,
    '77777777-7777-7777-7777-777777777777'::uuid,
    'in_progress',
    50000,
    300000,
    '2026-06-10',
    8,
    5,
    '11111111-1111-1111-1111-111111111111'::uuid
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status;

-- STEP 6: Create Test Session Logs (for completed sessions)
INSERT INTO public.session_logs (
  id,
  booking_id,
  session_number,
  assigned_date,
  completed_date,
  completed_by_ktv_id,
  address,
  status,
  tenant_id
) VALUES 
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    1,
    '2026-06-01',
    '2026-06-01',
    '33333333-3333-3333-3333-333333333333'::uuid,
    '123 Đường Test, Quận Test, TP.HCM',
    'completed',
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    2,
    '2026-06-03',
    '2026-06-03',
    '44444444-4444-4444-4444-444444444444'::uuid,
    '123 Đường Test, Quận Test, TP.HCM',
    'completed',
    '11111111-1111-1111-1111-111111111111'::uuid
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    1,
    '2026-06-10',
    '2026-06-10',
    '33333333-3333-3333-3333-333333333333'::uuid,
    '123 Đường Test, Quận Test, TP.HCM',
    'completed',
    '11111111-1111-1111-1111-111111111111'::uuid
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify tenant created with commission config
SELECT 
  id, 
  name, 
  enabled_modules,
  commission_config
FROM public.tenants 
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Verify users created
SELECT 
  id, 
  email, 
  full_name, 
  role 
FROM public.users 
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Verify customer created
SELECT 
  id, 
  phone, 
  name_mother 
FROM public.customers 
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Verify packages created
SELECT 
  id, 
  name, 
  price 
FROM public.packages 
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Verify bookings created
SELECT 
  id, 
  booking_number, 
  status,
  customers.name_mother,
  packages.name as package_name
FROM public.bookings
LEFT JOIN public.customers ON bookings.customer_id = customers.id
LEFT JOIN public.packages ON bookings.package_id = packages.id
WHERE bookings.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Verify session logs created
SELECT 
  id, 
  booking_id, 
  session_number,
  status,
  users.full_name as ktv_name
FROM public.session_logs
LEFT JOIN public.users ON session_logs.completed_by_ktv_id = users.id
WHERE session_logs.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- ============================================
-- CLEANUP (Run this to remove test data)
-- ============================================

/*
DELETE FROM public.booking_service_items WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.session_logs WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.bookings WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.packages WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.customers WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.users WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.tenants WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;
*/

-- ============================================
-- TESTING URLS
-- ============================================

-- After running this script, access these URLs for testing:
-- 
-- 1. Service Management Page:
--    /dashboard/bookings/99999999-9999-9999-9999-999999999999/services
-- 
-- 2. Booking Detail:
--    /dashboard/bookings/99999999-9999-9999-9999-999999999999
-- 
-- 3. All Bookings:
--    /dashboard/bookings
--
-- Login credentials (if using static login):
-- Email: admin.beauty@test.com
-- (Set up auth user separately or use existing admin account)
