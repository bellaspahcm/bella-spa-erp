-- ============================================================================
-- TEST DATA GENERATOR FOR MOBILE APP DEVICE TESTING
-- ============================================================================
-- Purpose: Generate realistic test data for device testing Phase 1
-- Usage: Run this script in Supabase SQL Editor
-- Target: Staging environment (NEVER run on production)
-- 
-- What this creates:
-- - 1 test tenant (Bella Spa Hà Nội - Test)
-- - 3 test KTV users with credentials
-- - 5 test customers with babies
-- - 10 test bookings with sessions
-- - Realistic session distribution (past, today, future)
-- 
-- ⚠️ WARNING: This will INSERT data. Only run on staging/test environment.
-- ============================================================================

-- ============================================================================
-- CONFIGURATION
-- ============================================================================
-- Change these values to match your environment
\set test_tenant_name 'Bella Spa Hà Nội - Test'
\set test_admin_email 'admin-test@bellaspa.vn'
\set test_ktv1_email 'ktv1-test@bellaspa.vn'
\set test_ktv2_email 'ktv2-test@bellaspa.vn'
\set test_ktv3_email 'ktv3-test@bellaspa.vn'
\set test_password 'BellaTest2026!'

-- ============================================================================
-- STEP 1: CREATE TEST TENANT
-- ============================================================================
-- Creates a test tenant with realistic settings

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Insert test tenant
  INSERT INTO tenants (
    name,
    slug,
    status,
    subscription_tier,
    subscription_status,
    trial_ends_at,
    settings
  ) VALUES (
    'Bella Spa Hà Nội - Test',
    'bella-ha-noi-test',
    'active',
    'premium',
    'active',
    NOW() + INTERVAL '30 days',
    jsonb_build_object(
      'timezone', 'Asia/Ho_Chi_Minh',
      'currency', 'VND',
      'locale', 'vi-VN',
      'business_hours', jsonb_build_object(
        'monday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'tuesday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'wednesday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'thursday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'friday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'saturday', jsonb_build_object('open', '08:00', 'close', '20:00'),
        'sunday', jsonb_build_object('open', '09:00', 'close', '18:00')
      )
    )
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = NOW()
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE 'Test tenant created: %', v_tenant_id;
END $$;

-- ============================================================================
-- STEP 2: CREATE TEST USERS (Admin + 3 KTVs)
-- ============================================================================
-- Creates users in Supabase Auth and users table

-- NOTE: You need to create these users manually in Supabase Dashboard > Authentication
-- Then run the following to link them to the test tenant:

-- Get test tenant ID for manual linking
SELECT id AS test_tenant_id, name, slug 
FROM tenants 
WHERE slug = 'bella-ha-noi-test';

-- After creating users in Supabase Auth Dashboard, run this:
-- (Replace <user-id> with actual IDs from auth.users)

/*
-- Link Admin User
UPDATE users 
SET 
  tenant_id = (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  role = 'admin',
  full_name = 'Admin Test',
  is_suspended = false
WHERE email = 'admin-test@bellaspa.vn';

-- Link KTV 1
UPDATE users 
SET 
  tenant_id = (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  role = 'technician',
  full_name = 'Nguyễn Thị Hoa',
  is_suspended = false
WHERE email = 'ktv1-test@bellaspa.vn';

-- Link KTV 2
UPDATE users 
SET 
  tenant_id = (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  role = 'technician',
  full_name = 'Trần Thị Mai',
  is_suspended = false
WHERE email = 'ktv2-test@bellaspa.vn';

-- Link KTV 3
UPDATE users 
SET 
  tenant_id = (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  role = 'technician',
  full_name = 'Lê Thị Lan',
  is_suspended = false
WHERE email = 'ktv3-test@bellaspa.vn';
*/

-- ============================================================================
-- STEP 3: CREATE TEST CUSTOMERS
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_customer4_id UUID;
  v_customer5_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'bella-ha-noi-test';

  -- Customer 1: VIP with multiple packages
  INSERT INTO customers (
    tenant_id,
    name_mother,
    name_baby,
    phone_mother,
    address,
    tier,
    notes
  ) VALUES (
    v_tenant_id,
    'Nguyễn Thị Thanh',
    'Bé An',
    '0901234567',
    '123 Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
    'vip',
    'Khách hàng VIP - Đã mua 3 gói'
  ) RETURNING id INTO v_customer1_id;

  -- Customer 2: Regular customer
  INSERT INTO customers (
    tenant_id,
    name_mother,
    name_baby,
    phone_mother,
    address,
    tier,
    notes
  ) VALUES (
    v_tenant_id,
    'Trần Thị Hương',
    'Bé Minh',
    '0902345678',
    '456 Trần Duy Hưng, Cầu Giấy, Hà Nội',
    'regular',
    'Khách hàng thân thiết'
  ) RETURNING id INTO v_customer2_id;

  -- Customer 3: New customer
  INSERT INTO customers (
    tenant_id,
    name_mother,
    name_baby,
    phone_mother,
    address,
    tier,
    notes
  ) VALUES (
    v_tenant_id,
    'Phạm Thị Lan',
    'Bé Hà',
    '0903456789',
    '789 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    'regular',
    'Khách hàng mới - Lần đầu sử dụng dịch vụ'
  ) RETURNING id INTO v_customer3_id;

  -- Customer 4: Customer with twins
  INSERT INTO customers (
    tenant_id,
    name_mother,
    name_baby,
    phone_mother,
    address,
    tier,
    notes
  ) VALUES (
    v_tenant_id,
    'Lê Thị Mai',
    'Bé Đức & Bé Anh',
    '0904567890',
    '321 Láng Hạ, Đống Đa, Hà Nội',
    'regular',
    'Sinh đôi - Cần 2 KTV cùng lúc'
  ) RETURNING id INTO v_customer4_id;

  -- Customer 5: Premium customer
  INSERT INTO customers (
    tenant_id,
    name_mother,
    name_baby,
    phone_mother,
    address,
    tier,
    notes
  ) VALUES (
    v_tenant_id,
    'Hoàng Thị Thu',
    'Bé Linh',
    '0905678901',
    '654 Kim Mã, Ba Đình, Hà Nội',
    'premium',
    'Ưu tiên KTV giỏi nhất'
  ) RETURNING id INTO v_customer5_id;

  RAISE NOTICE 'Created 5 test customers';
END $$;

-- ============================================================================
-- STEP 4: CREATE TEST PACKAGES
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_package1_id UUID;
  v_package2_id UUID;
  v_package3_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'bella-ha-noi-test';

  -- Package 1: Basic (10 sessions)
  INSERT INTO packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    session_multiplier,
    is_active
  ) VALUES (
    v_tenant_id,
    'Combo Mẹ & Bé Tiết Kiệm',
    'Gói cơ bản 10 ca - Phù hợp khách hàng mới',
    10,
    3500000,
    1.0,
    true
  ) RETURNING id INTO v_package1_id;

  -- Package 2: Premium (20 sessions with 1.5x)
  INSERT INTO packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    session_multiplier,
    is_active
  ) VALUES (
    v_tenant_id,
    'Combo Mẹ & Bé Hạnh Phúc',
    'Gói nâng cao 20 ca - Hệ số 1.5x',
    20,
    7000000,
    1.5,
    true
  ) RETURNING id INTO v_package2_id;

  -- Package 3: VIP (30 sessions with 2.0x)
  INSERT INTO packages (
    tenant_id,
    name,
    description,
    total_sessions,
    price,
    session_multiplier,
    is_active
  ) VALUES (
    v_tenant_id,
    'Combo Mẹ & Bé VIP Toàn Diện',
    'Gói VIP 30 ca - Hệ số 2.0x',
    30,
    12000000,
    2.0,
    true
  ) RETURNING id INTO v_package3_id;

  RAISE NOTICE 'Created 3 test packages';
END $$;

-- ============================================================================
-- STEP 5: CREATE TEST BOOKINGS & SESSIONS
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_ktv1_id UUID;
  v_ktv2_id UUID;
  v_ktv3_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_customer4_id UUID;
  v_customer5_id UUID;
  v_package1_id UUID;
  v_package2_id UUID;
  v_package3_id UUID;
  v_booking_id UUID;
  v_today DATE;
BEGIN
  -- Get IDs
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'bella-ha-noi-test';
  SELECT id INTO v_ktv1_id FROM users WHERE email = 'ktv1-test@bellaspa.vn';
  SELECT id INTO v_ktv2_id FROM users WHERE email = 'ktv2-test@bellaspa.vn';
  SELECT id INTO v_ktv3_id FROM users WHERE email = 'ktv3-test@bellaspa.vn';
  SELECT id INTO v_customer1_id FROM customers WHERE name_mother = 'Nguyễn Thị Thanh' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer2_id FROM customers WHERE name_mother = 'Trần Thị Hương' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer3_id FROM customers WHERE name_mother = 'Phạm Thị Lan' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer4_id FROM customers WHERE name_mother = 'Lê Thị Mai' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer5_id FROM customers WHERE name_mother = 'Hoàng Thị Thu' AND tenant_id = v_tenant_id;
  SELECT id INTO v_package1_id FROM packages WHERE name = 'Combo Mẹ & Bé Tiết Kiệm' AND tenant_id = v_tenant_id;
  SELECT id INTO v_package2_id FROM packages WHERE name = 'Combo Mẹ & Bé Hạnh Phúc' AND tenant_id = v_tenant_id;
  SELECT id INTO v_package3_id FROM packages WHERE name = 'Combo Mẹ & Bé VIP Toàn Diện' AND tenant_id = v_tenant_id;
  
  v_today := CURRENT_DATE;

  -- ──────────────────────────────────────────────────────────────────
  -- Booking 1: Customer 1 (VIP) - Basic Package - Assigned to KTV1
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    package_id,
    package_name,
    total_sessions,
    completed_sessions,
    assigned_ktv_id,
    status,
    deposit_amount,
    final_amount,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer1_id,
    v_package1_id,
    'Combo Mẹ & Bé Tiết Kiệm',
    10,
    3, -- 3 completed, 7 remaining
    v_ktv1_id,
    'active',
    1000000,
    3500000,
    'Gói đầu tiên của khách VIP'
  ) RETURNING id INTO v_booking_id;

  -- Create sessions for Booking 1
  -- Past session (completed)
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today - 2, '09:00', 'completed', 'Ca đã hoàn thành');
  
  -- Yesterday session (completed)
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today - 1, '10:00', 'completed', 'Ca đã hoàn thành');
  
  -- Today sessions (in progress + pending)
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '08:30', 'in_progress', 'Ca đang thực hiện');
  
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '14:00', 'scheduled', 'Ca chiều hôm nay');

  -- ──────────────────────────────────────────────────────────────────
  -- Booking 2: Customer 2 - Premium Package - Assigned to KTV2
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    package_id,
    package_name,
    total_sessions,
    completed_sessions,
    assigned_ktv_id,
    status,
    deposit_amount,
    final_amount,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer2_id,
    v_package2_id,
    'Combo Mẹ & Bé Hạnh Phúc',
    20,
    5,
    v_ktv2_id,
    'active',
    2000000,
    7000000,
    'Khách hàng thân thiết'
  ) RETURNING id INTO v_booking_id;

  -- Today sessions for KTV2
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '09:00', 'scheduled', 'Ca sáng');
  
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '15:00', 'scheduled', 'Ca chiều');

  -- ──────────────────────────────────────────────────────────────────
  -- Booking 3: Customer 3 (New) - Basic Package - Assigned to KTV1
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    package_id,
    package_name,
    total_sessions,
    completed_sessions,
    assigned_ktv_id,
    status,
    deposit_amount,
    final_amount,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer3_id,
    v_package1_id,
    'Combo Mẹ & Bé Tiết Kiệm',
    10,
    0,
    v_ktv1_id,
    'active',
    500000,
    3500000,
    'Khách hàng mới - Lần đầu'
  ) RETURNING id INTO v_booking_id;

  -- Today session for KTV1 (second session)
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '10:30', 'scheduled', 'Ca đầu tiên của khách mới');

  -- ──────────────────────────────────────────────────────────────────
  -- Booking 4: Customer 4 (Twins) - VIP Package - Assigned to KTV3
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    package_id,
    package_name,
    total_sessions,
    completed_sessions,
    assigned_ktv_id,
    status,
    deposit_amount,
    final_amount,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer4_id,
    v_package3_id,
    'Combo Mẹ & Bé VIP Toàn Diện',
    30,
    10,
    v_ktv3_id,
    'active',
    5000000,
    12000000,
    'Sinh đôi - Cần 2 KTV'
  ) RETURNING id INTO v_booking_id;

  -- Today sessions for KTV3
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '08:00', 'scheduled', 'Ca sáng sớm');
  
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '16:00', 'scheduled', 'Ca chiều');

  -- ──────────────────────────────────────────────────────────────────
  -- Booking 5: Customer 5 (Premium) - Premium Package - Assigned to KTV2
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    package_id,
    package_name,
    total_sessions,
    completed_sessions,
    assigned_ktv_id,
    status,
    deposit_amount,
    final_amount,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer5_id,
    v_package2_id,
    'Combo Mẹ & Bé Hạnh Phúc',
    20,
    8,
    v_ktv2_id,
    'active',
    2500000,
    7000000,
    'Khách ưu tiên KTV giỏi'
  ) RETURNING id INTO v_booking_id;

  -- Today session for KTV2 (third session)
  INSERT INTO session_logs (tenant_id, booking_id, scheduled_date, assigned_time, status, notes)
  VALUES (v_tenant_id, v_booking_id, v_today, '11:00', 'in_progress', 'Ca đang thực hiện');

  RAISE NOTICE 'Created 5 test bookings with sessions';
  RAISE NOTICE 'Today sessions distribution: KTV1=3, KTV2=3, KTV3=2';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check test tenant
SELECT id, name, slug, status FROM tenants WHERE slug = 'bella-ha-noi-test';

-- Check test users
SELECT id, email, role, full_name, tenant_id 
FROM users 
WHERE email LIKE '%test@bellaspa.vn%'
ORDER BY email;

-- Check test customers
SELECT c.id, c.name_mother, c.name_baby, c.tier, t.name as tenant_name
FROM customers c
JOIN tenants t ON t.id = c.tenant_id
WHERE t.slug = 'bella-ha-noi-test'
ORDER BY c.created_at;

-- Check test packages
SELECT p.id, p.name, p.total_sessions, p.session_multiplier, t.name as tenant_name
FROM packages p
JOIN tenants t ON t.id = p.tenant_id
WHERE t.slug = 'bella-ha-noi-test'
ORDER BY p.session_multiplier;

-- Check test bookings
SELECT 
  b.id,
  c.name_mother,
  b.package_name,
  b.total_sessions,
  b.completed_sessions,
  u.full_name as ktv_name,
  b.status
FROM bookings b
JOIN customers c ON c.id = b.customer_id
JOIN users u ON u.id = b.assigned_ktv_id
JOIN tenants t ON t.id = b.tenant_id
WHERE t.slug = 'bella-ha-noi-test'
ORDER BY b.created_at;

-- Check today's sessions by KTV
SELECT 
  u.full_name as ktv_name,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE sl.status = 'completed') as completed,
  COUNT(*) FILTER (WHERE sl.status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE sl.status = 'scheduled') as scheduled
FROM session_logs sl
JOIN bookings b ON b.id = sl.booking_id
JOIN users u ON u.id = b.assigned_ktv_id
JOIN tenants t ON t.id = sl.tenant_id
WHERE t.slug = 'bella-ha-noi-test'
  AND sl.scheduled_date = CURRENT_DATE
GROUP BY u.full_name
ORDER BY u.full_name;

-- Test RPC: Today sessions for KTV1
SELECT * FROM rpc_mobile_today_sessions(
  (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  CURRENT_DATE,
  (SELECT id FROM users WHERE email = 'ktv1-test@bellaspa.vn')
);

-- Test RPC: KTV1 dashboard stats
SELECT * FROM rpc_ktv_dashboard_stats(
  (SELECT id FROM tenants WHERE slug = 'bella-ha-noi-test'),
  (SELECT id FROM users WHERE email = 'ktv1-test@bellaspa.vn'),
  CURRENT_DATE
);

-- ============================================================================
-- CLEANUP (if needed)
-- ============================================================================
-- ⚠️ DANGER: This will DELETE all test data. Only run if you want to reset.

/*
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'bella-ha-noi-test';
  
  -- Delete in reverse order (foreign keys)
  DELETE FROM session_logs WHERE tenant_id = v_tenant_id;
  DELETE FROM bookings WHERE tenant_id = v_tenant_id;
  DELETE FROM customers WHERE tenant_id = v_tenant_id;
  DELETE FROM packages WHERE tenant_id = v_tenant_id;
  DELETE FROM users WHERE tenant_id = v_tenant_id;
  DELETE FROM tenants WHERE id = v_tenant_id;
  
  RAISE NOTICE 'All test data deleted for tenant: %', v_tenant_id;
END $$;
*/

-- ============================================================================
-- TEST USER CREDENTIALS
-- ============================================================================
-- You need to create these users manually in Supabase Dashboard > Authentication

/*
EMAIL                    | PASSWORD          | ROLE        | FULL NAME
-------------------------|-------------------|-------------|------------------
admin-test@bellaspa.vn   | BellaTest2026!    | admin       | Admin Test
ktv1-test@bellaspa.vn    | BellaTest2026!    | technician  | Nguyễn Thị Hoa
ktv2-test@bellaspa.vn    | BellaTest2026!    | technician  | Trần Thị Mai
ktv3-test@bellaspa.vn    | BellaTest2026!    | technician  | Lê Thị Lan

After creating in Auth Dashboard, run the UPDATE statements in STEP 2 to link them to tenant.
*/

-- ============================================================================
-- EXPECTED TEST RESULTS
-- ============================================================================

/*
TODAY'S SESSION DISTRIBUTION:
- KTV1 (Nguyễn Thị Hoa): 3 sessions (1 in_progress, 2 scheduled)
- KTV2 (Trần Thị Mai): 3 sessions (1 in_progress, 2 scheduled)
- KTV3 (Lê Thị Lan): 2 sessions (2 scheduled)

DASHBOARD STATS:
- KTV1: total=3, completed=0
- KTV2: total=3, completed=0
- KTV3: total=2, completed=0
- Admin: total=8, completed=0 (sees all)

DEVICE TESTING SCENARIOS:
1. Login as KTV1 → Should see 3 sessions (their own)
2. Login as KTV2 → Should see 3 sessions (their own)
3. Login as KTV3 → Should see 2 sessions (their own)
4. Login as Admin → Should see 8 sessions (all spa)
5. Pull-to-refresh → Should reload data
6. Check-in session → Status should change to in_progress
7. Check-out session → Status should change to completed
8. View completed sessions → Should show in history
*/
