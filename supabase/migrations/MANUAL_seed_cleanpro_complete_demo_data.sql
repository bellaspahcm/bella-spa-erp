-- =====================================================
-- SEED: Complete CleanPro Industrial Services Demo Data
-- =====================================================
-- Creates realistic demo data for Industrial Cleaning module:
-- - 5 Corporate customers
-- - 5 Cleaning workers (NVS)
-- - 8 Service contracts (bookings)
-- - ~64 Work sessions with proper dates (completed, today, upcoming)
-- =====================================================

-- Step 1: Get CleanPro tenant ID
DO $$
DECLARE
  v_tenant_id UUID;
  v_admin_id UUID;
  v_package_office_basic UUID;
  v_package_factory_standard UUID;
  v_customer_1 UUID;
  v_customer_2 UUID;
  v_customer_3 UUID;
  v_customer_4 UUID;
  v_customer_5 UUID;
  v_ktv_1 UUID;
  v_ktv_2 UUID;
  v_ktv_3 UUID;
  v_ktv_4 UUID;
  v_ktv_5 UUID;
  v_booking_1 UUID;
  v_booking_2 UUID;
  v_booking_3 UUID;
  v_booking_4 UUID;
  v_booking_5 UUID;
  v_booking_6 UUID;
  v_booking_7 UUID;
  v_booking_8 UUID;
BEGIN
  -- Get tenant and admin
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name LIKE '%CleanPro%' LIMIT 1;
  SELECT id INTO v_admin_id FROM public.users WHERE email LIKE '%@cleanpro%' AND role = 'admin' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'CleanPro tenant not found. Please create tenant first.';
  END IF;

  -- Get packages
  SELECT id INTO v_package_office_basic FROM public.packages WHERE module_key = 'industrial_cleaning' AND name = 'Office Basic' LIMIT 1;
  SELECT id INTO v_package_factory_standard FROM public.packages WHERE module_key = 'industrial_cleaning' AND name = 'Factory Standard' LIMIT 1;

  -- =============================================================================
  -- CUSTOMERS: 5 Corporate Clients
  -- =============================================================================
  
  -- Customer 1: Công ty TNHH ABC
  INSERT INTO public.customers (
    tenant_id, name_mother, phone, address, status,
    latitude, longitude, created_at
  ) VALUES (
    v_tenant_id,
    'Công ty TNHH ABC',
    '0901234567',
    '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
    'active',
    10.7769, 106.7009,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_customer_1;

  -- Customer 2: Công ty Cổ phần XYZ
  INSERT INTO public.customers (
    tenant_id, name_mother, phone, address, status,
    latitude, longitude, created_at
  ) VALUES (
    v_tenant_id,
    'Công ty Cổ phần XYZ',
    '0902345678',
    '456 Lê Lợi, Quận 3, TP.HCM',
    'active',
    10.7756, 106.6919,
    NOW() - INTERVAL '25 days'
  ) RETURNING id INTO v_customer_2;

  -- Customer 3: Tập đoàn DEF
  INSERT INTO public.customers (
    tenant_id, name_mother, phone, address, status,
    latitude, longitude, created_at
  ) VALUES (
    v_tenant_id,
    'Tập đoàn DEF',
    '0903456789',
    '789 Võ Văn Tần, Quận 3, TP.HCM',
    'active',
    10.7821, 106.6958,
    NOW() - INTERVAL '20 days'
  ) RETURNING id INTO v_customer_3;

  -- Customer 4: Nhà máy GHI
  INSERT INTO public.customers (
    tenant_id, name_mother, phone, address, status,
    latitude, longitude, created_at
  ) VALUES (
    v_tenant_id,
    'Nhà máy GHI',
    '0904567890',
    'Khu Công nghiệp Tân Bình, TP.HCM',
    'active',
    10.8142, 106.6438,
    NOW() - INTERVAL '15 days'
  ) RETURNING id INTO v_customer_4;

  -- Customer 5: Văn phòng JKL
  INSERT INTO public.customers (
    tenant_id, name_mother, phone, address, status,
    latitude, longitude, created_at
  ) VALUES (
    v_tenant_id,
    'Văn phòng JKL',
    '0905678901',
    'Tòa nhà Bitexco, Quận 1, TP.HCM',
    'active',
    10.7718, 106.7045,
    NOW() - INTERVAL '10 days'
  ) RETURNING id INTO v_customer_5;

  -- =============================================================================
  -- WORKERS: 5 Cleaning Staff (NVS)
  -- =============================================================================
  
  -- Worker 1: Nguyễn Thị Mai
  INSERT INTO public.users (
    tenant_id, email, full_name, phone, role, base_salary, created_at
  ) VALUES (
    v_tenant_id,
    'mai.nguyen@cleanpro-v2.com',
    'Nguyễn Thị Mai',
    '0911111111',
    'ktv',
    6000000,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_ktv_1;

  -- Worker 2: Lê Văn Dũng
  INSERT INTO public.users (
    tenant_id, email, full_name, phone, role, base_salary, created_at
  ) VALUES (
    v_tenant_id,
    'dung.le@cleanpro-v2.com',
    'Lê Văn Dũng',
    '0922222222',
    'ktv',
    6000000,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_ktv_2;

  -- Worker 3: Trần Thị Lan
  INSERT INTO public.users (
    tenant_id, email, full_name, phone, role, base_salary, created_at
  ) VALUES (
    v_tenant_id,
    'lan.tran@cleanpro-v2.com',
    'Trần Thị Lan',
    '0933333333',
    'ktv',
    6000000,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_ktv_3;

  -- Worker 4: Phạm Văn Hùng
  INSERT INTO public.users (
    tenant_id, email, full_name, phone, role, base_salary, created_at
  ) VALUES (
    v_tenant_id,
    'hung.pham@cleanpro-v2.com',
    'Phạm Văn Hùng',
    '0944444444',
    'ktv',
    6000000,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_ktv_4;

  -- Worker 5: Võ Thị Hoa
  INSERT INTO public.users (
    tenant_id, email, full_name, phone, role, base_salary, created_at
  ) VALUES (
    v_tenant_id,
    'hoa.vo@cleanpro-v2.com',
    'Võ Thị Hoa',
    '0955555555',
    'ktv',
    6000000,
    NOW() - INTERVAL '30 days'
  ) RETURNING id INTO v_ktv_5;

  -- =============================================================================
  -- BOOKINGS: 8 Service Contracts
  -- =============================================================================
  
  -- Booking 1: Công ty ABC - Office Basic
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_1, v_package_office_basic, 'Office Basic', v_ktv_1,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-001',
    (CURRENT_DATE - INTERVAL '10 days')::date,
    8, 2,
    12000000, 6000000, 'active',
    NOW() - INTERVAL '10 days'
  ) RETURNING id INTO v_booking_1;

  -- Booking 2: Công ty XYZ - Factory Standard
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_2, v_package_factory_standard, 'Factory Standard', v_ktv_2,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-002',
    (CURRENT_DATE - INTERVAL '8 days')::date,
    8, 2,
    18000000, 9000000, 'active',
    NOW() - INTERVAL '8 days'
  ) RETURNING id INTO v_booking_2;

  -- Booking 3: Tập đoàn DEF - Office Basic
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_3, v_package_office_basic, 'Office Basic', v_ktv_3,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-003',
    (CURRENT_DATE - INTERVAL '7 days')::date,
    8, 2,
    12000000, 6000000, 'active',
    NOW() - INTERVAL '7 days'
  ) RETURNING id INTO v_booking_3;

  -- Booking 4: Nhà máy GHI - Factory Standard
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_4, v_package_factory_standard, 'Factory Standard', v_ktv_4,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-004',
    (CURRENT_DATE - INTERVAL '6 days')::date,
    8, 2,
    18000000, 9000000, 'active',
    NOW() - INTERVAL '6 days'
  ) RETURNING id INTO v_booking_4;

  -- Booking 5: Văn phòng JKL - Office Basic
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_5, v_package_office_basic, 'Office Basic', v_ktv_5,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-005',
    (CURRENT_DATE - INTERVAL '5 days')::date,
    8, 2,
    12000000, 6000000, 'active',
    NOW() - INTERVAL '5 days'
  ) RETURNING id INTO v_booking_5;

  -- Booking 6: Công ty ABC (contract 2) - Factory Standard
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_1, v_package_factory_standard, 'Factory Standard', v_ktv_1,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-006',
    (CURRENT_DATE - INTERVAL '4 days')::date,
    8, 2,
    18000000, 9000000, 'active',
    NOW() - INTERVAL '4 days'
  ) RETURNING id INTO v_booking_6;

  -- Booking 7: Công ty XYZ (contract 2) - Office Basic
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_2, v_package_office_basic, 'Office Basic', v_ktv_2,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-007',
    (CURRENT_DATE - INTERVAL '3 days')::date,
    8, 2,
    12000000, 6000000, 'active',
    NOW() - INTERVAL '3 days'
  ) RETURNING id INTO v_booking_7;

  -- Booking 8: Tập đoàn DEF (contract 2) - Factory Standard
  INSERT INTO public.bookings (
    tenant_id, customer_id, package_id, package_name, assigned_ktv_id,
    booking_number, start_date, total_sessions, completed_sessions,
    full_price, deposit_amount, status, created_at
  ) VALUES (
    v_tenant_id, v_customer_3, v_package_factory_standard, 'Factory Standard', v_ktv_3,
    'CL-' || TO_CHAR(NOW(), 'YYMMDD') || '-008',
    (CURRENT_DATE - INTERVAL '2 days')::date,
    8, 2,
    18000000, 9000000, 'active',
    NOW() - INTERVAL '2 days'
  ) RETURNING id INTO v_booking_8;

  -- =============================================================================
  -- SESSION LOGS: 8 sessions per booking = 64 total sessions
  -- Pattern: Sessions 1-2 completed, Session 3 today, Sessions 4-8 future
  -- =============================================================================
  
  -- Helper function to create sessions for a booking
  FOR i IN 1..8 LOOP
    -- Booking 1 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_1, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '09:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Đã hoàn thành ca vệ sinh văn phòng' ELSE NULL END
    );

    -- Booking 2 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_2, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '10:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Đã vệ sinh nhà xưởng sản xuất' ELSE NULL END
    );

    -- Booking 3 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_3, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '11:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Hoàn thành vệ sinh tòa nhà' ELSE NULL END
    );

    -- Booking 4 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_4, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '13:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Vệ sinh khu công nghiệp' ELSE NULL END
    );

    -- Booking 5 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_5, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '14:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Vệ sinh văn phòng cao cấp' ELSE NULL END
    );

    -- Booking 6 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_6, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '15:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Vệ sinh nhà xưởng lớn' ELSE NULL END
    );

    -- Booking 7 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_7, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '16:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Vệ sinh định kỳ' ELSE NULL END
    );

    -- Booking 8 sessions
    INSERT INTO public.session_logs (
      booking_id, session_number, assigned_date, assigned_time, status, completed_date, notes
    ) VALUES (
      v_booking_8, i,
      CASE 
        WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
        WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
        WHEN i = 3 THEN CURRENT_DATE
        WHEN i = 4 THEN (CURRENT_DATE + INTERVAL '1 day')::date
        WHEN i = 5 THEN (CURRENT_DATE + INTERVAL '2 days')::date
        WHEN i = 6 THEN (CURRENT_DATE + INTERVAL '3 days')::date
        WHEN i = 7 THEN (CURRENT_DATE + INTERVAL '7 days')::date
        ELSE (CURRENT_DATE + INTERVAL '14 days')::date
      END,
      '08:00',
      CASE WHEN i <= 2 THEN 'completed' ELSE 'scheduled' END,
      CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date
           WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date
           ELSE NULL END,
      CASE WHEN i <= 2 THEN 'Vệ sinh tổng thể' ELSE NULL END
    );
  END LOOP;

  RAISE NOTICE 'Successfully created CleanPro demo data:';
  RAISE NOTICE '- 5 customers';
  RAISE NOTICE '- 5 workers';
  RAISE NOTICE '- 8 bookings';
  RAISE NOTICE '- 64 sessions (2 completed + 1 today + 5 future per booking)';
END $$;

-- Verification query
SELECT 
  COUNT(DISTINCT c.id) as customer_count,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'ktv') as worker_count,
  COUNT(DISTINCT b.id) as booking_count,
  COUNT(sl.id) as total_sessions,
  COUNT(sl.id) FILTER (WHERE sl.status = 'completed') as completed_sessions,
  COUNT(sl.id) FILTER (WHERE sl.status = 'scheduled' AND sl.assigned_date = CURRENT_DATE) as today_sessions,
  COUNT(sl.id) FILTER (WHERE sl.status = 'scheduled' AND sl.assigned_date > CURRENT_DATE) as future_sessions
FROM public.tenants t
LEFT JOIN public.customers c ON c.tenant_id = t.id
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.bookings b ON b.tenant_id = t.id
LEFT JOIN public.session_logs sl ON sl.booking_id = b.id
WHERE t.name LIKE '%CleanPro%';
