-- ============================================================================
-- REAL ESTATE MODULE - DEMO DATA SEEDER
-- ============================================================================
-- Purpose: Create demo data for testing and development
-- Usage: Run in Supabase Dashboard → SQL Editor
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'REAL ESTATE DEMO DATA SEEDER'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Variables (Replace with your tenant ID)
DO $$
DECLARE
  v_tenant_id UUID := 'YOUR_TENANT_ID_HERE'; -- ⚠️ REPLACE THIS
  v_project_id UUID;
  v_product_ids UUID[];
  v_customer_ids UUID[];
  v_lead_ids UUID[];
  v_agent_id UUID := 'YOUR_AGENT_USER_ID'; -- ⚠️ REPLACE THIS
BEGIN
  
  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % does not exist. Please update v_tenant_id variable.', v_tenant_id;
  END IF;
  
  RAISE NOTICE '✓ Using tenant: %', v_tenant_id;
  
  -- ============================================================================
  -- 1. CREATE PROJECT
  -- ============================================================================
  
  INSERT INTO real_estate_projects (
    tenant_id, project_code, project_name, location,
    total_units, developer, description, status,
    launch_date, completion_date
  ) VALUES (
    v_tenant_id,
    'BELLA-GARDENS-2026',
    'Bella Gardens Residence',
    'District 7, Ho Chi Minh City',
    120,
    'Bella Development Co., Ltd',
    'Premium residential development with modern amenities',
    'selling',
    '2026-01-01',
    '2027-12-31'
  ) RETURNING id INTO v_project_id;
  
  RAISE NOTICE '✓ Created project: Bella Gardens (%)', v_project_id;
  
  -- ============================================================================
  -- 2. CREATE PRODUCTS (20 apartments)
  -- ============================================================================
  
  -- Block A: 10 apartments
  FOR i IN 1..10 LOOP
    INSERT INTO real_estate_products (
      tenant_id, project_id,
      product_code, product_type, unit_code,
      block, floor, floor_number,
      area_m2, direction,
      base_price, floor_price, unit_price,
      status
    ) VALUES (
      v_tenant_id, v_project_id,
      'A' || LPAD(i::TEXT, 3, '0'),
      'apartment',
      'A' || LPAD(i::TEXT, 3, '0'),
      'A',
      CASE WHEN i <= 5 THEN 'Floor ' || i ELSE 'Floor ' || (i - 5) END,
      CASE WHEN i <= 5 THEN i ELSE i - 5 END,
      70.0 + (i * 2.5), -- 72.5 to 95 sqm
      CASE WHEN i % 4 = 0 THEN 'North' WHEN i % 4 = 1 THEN 'South' WHEN i % 4 = 2 THEN 'East' ELSE 'West' END,
      1800000000 + (i * 50000000), -- 1.85B to 2.3B
      1600000000 + (i * 45000000),
      1800000000 + (i * 50000000),
      CASE 
        WHEN i <= 6 THEN 'available'
        WHEN i <= 8 THEN 'reserved'
        ELSE 'sold'
      END
    );
  END LOOP;
  
  -- Block B: 10 villas
  FOR i IN 1..10 LOOP
    INSERT INTO real_estate_products (
      tenant_id, project_id,
      product_code, product_type, unit_code,
      block, floor, floor_number,
      area_m2, direction,
      base_price, floor_price, unit_price,
      status
    ) VALUES (
      v_tenant_id, v_project_id,
      'B' || LPAD(i::TEXT, 3, '0'),
      'villa',
      'B' || LPAD(i::TEXT, 3, '0'),
      'B',
      'Ground',
      1,
      150.0 + (i * 5), -- 155 to 200 sqm
      'South',
      4000000000 + (i * 100000000), -- 4.1B to 5B
      3500000000 + (i * 90000000),
      4000000000 + (i * 100000000),
      CASE 
        WHEN i <= 7 THEN 'available'
        WHEN i <= 9 THEN 'reserved'
        ELSE 'sold'
      END
    );
  END LOOP;
  
  RAISE NOTICE '✓ Created 20 products (10 apartments + 10 villas)';
  
  -- ============================================================================
  -- 3. CREATE CUSTOMERS (5 customers)
  -- ============================================================================
  
  INSERT INTO re_customers (tenant_id, name, phone, email, tags)
  VALUES 
    (v_tenant_id, 'Nguyễn Văn An', '0901234567', 'nva@example.com', ARRAY['vip', 'investor']),
    (v_tenant_id, 'Trần Thị Bình', '0902345678', 'ttb@example.com', ARRAY['first_time_buyer']),
    (v_tenant_id, 'Lê Minh Châu', '0903456789', 'lmc@example.com', ARRAY['cash_buyer']),
    (v_tenant_id, 'Phạm Thị Dung', '0904567890', 'ptd@example.com', ARRAY['family']),
    (v_tenant_id, 'Hoàng Văn Em', '0905678901', 'hve@example.com', ARRAY['young_professional'])
  RETURNING ARRAY_AGG(id) INTO v_customer_ids;
  
  RAISE NOTICE '✓ Created 5 customers';
  
  -- ============================================================================
  -- 4. CREATE LEADS (8 leads in various states)
  -- ============================================================================
  
  INSERT INTO re_leads (tenant_id, name, phone, email, state, source, assigned_to)
  VALUES 
    (v_tenant_id, 'Võ Thị Phương', '0906789012', 'vtp@example.com', 'NEW', 'walk_in', NULL),
    (v_tenant_id, 'Đặng Văn Quang', '0907890123', 'dvq@example.com', 'ASSIGNED', 'online', v_agent_id),
    (v_tenant_id, 'Bùi Thị Hương', '0908901234', 'bth@example.com', 'CONTACTED', 'referral', v_agent_id),
    (v_tenant_id, 'Lý Minh Tâm', '0909012345', 'lmt@example.com', 'QUALIFIED', 'event', v_agent_id),
    (v_tenant_id, 'Mai Văn Tuấn', '0900123456', 'mvt@example.com', 'VISIT_SCHEDULED', 'partner', v_agent_id),
    (v_tenant_id, 'Ngô Thị Vân', '0901230123', 'ntv@example.com', 'NEGOTIATING', 'walk_in', v_agent_id),
    (v_tenant_id, 'Trịnh Văn Xuân', '0902340234', 'tvx@example.com', 'CONVERTED', 'online', v_agent_id),
    (v_tenant_id, 'Phan Thị Yến', '0903450345', 'pty@example.com', 'LOST', 'online', v_agent_id)
  RETURNING ARRAY_AGG(id) INTO v_lead_ids;
  
  RAISE NOTICE '✓ Created 8 leads (various states)';
  
  -- ============================================================================
  -- 5. CREATE RESERVATIONS (3 active)
  -- ============================================================================
  
  -- Get some available products
  SELECT ARRAY_AGG(id) INTO v_product_ids
  FROM (
    SELECT id FROM real_estate_products 
    WHERE tenant_id = v_tenant_id AND status = 'available' 
    LIMIT 3
  ) sub;
  
  IF ARRAY_LENGTH(v_product_ids, 1) >= 3 THEN
    -- Reservation 1: Pending deposit
    INSERT INTO re_reservations (
      tenant_id, product_id, customer_id,
      deposit_amount, status
    ) VALUES (
      v_tenant_id, v_product_ids[1], v_customer_ids[1],
      50000000, 'pending_deposit'
    );
    
    -- Reservation 2: Deposited
    INSERT INTO re_reservations (
      tenant_id, product_id, customer_id,
      deposit_amount, status, deposited_at
    ) VALUES (
      v_tenant_id, v_product_ids[2], v_customer_ids[2],
      50000000, 'deposited', NOW()
    );
    
    -- Reservation 3: Cancelled
    INSERT INTO re_reservations (
      tenant_id, product_id, customer_id,
      deposit_amount, status, cancelled_at, notes
    ) VALUES (
      v_tenant_id, v_product_ids[3], v_customer_ids[3],
      50000000, 'cancelled', NOW() - INTERVAL '2 days', 'Customer changed mind'
    );
    
    RAISE NOTICE '✓ Created 3 reservations';
  END IF;
  
  -- ============================================================================
  -- 6. CREATE BOOKINGS (2 examples)
  -- ============================================================================
  
  -- Booking 1: Confirmed
  INSERT INTO re_bookings (
    tenant_id, product_id, customer_id,
    booking_fee, state, submitted_at, confirmed_at
  ) VALUES (
    v_tenant_id, v_product_ids[1], v_customer_ids[1],
    100000000, 'CONFIRMED', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'
  );
  
  -- Booking 2: Pending approval
  INSERT INTO re_bookings (
    tenant_id, product_id, customer_id,
    booking_fee, state, submitted_at
  ) VALUES (
    v_tenant_id, v_product_ids[2], v_customer_ids[2],
    100000000, 'PENDING_APPROVAL', NOW() - INTERVAL '1 day'
  );
  
  RAISE NOTICE '✓ Created 2 bookings';
  
  -- ============================================================================
  -- 7. CREATE CONTRACTS (1 active)
  -- ============================================================================
  
  INSERT INTO re_contracts (
    tenant_id, product_id, customer_id,
    contract_number, contract_price,
    state, signed_date, start_date, activated_at,
    installments
  ) VALUES (
    v_tenant_id, v_product_ids[1], v_customer_ids[1],
    'CT-2026-001',
    2000000000,
    'ACTIVE',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    jsonb_build_array(
      jsonb_build_object('installmentNumber', 1, 'dueDate', '2026-09-01', 'percentage', 33.33, 'amount', 666666667, 'milestoneLabel', 'Đợt 1 - Ký hợp đồng'),
      jsonb_build_object('installmentNumber', 2, 'dueDate', '2026-12-01', 'percentage', 33.33, 'amount', 666666667, 'milestoneLabel', 'Đợt 2 - Bàn giao thô'),
      jsonb_build_object('installmentNumber', 3, 'dueDate', '2027-03-01', 'percentage', 33.34, 'amount', 666666666, 'milestoneLabel', 'Đợt 3 - Hoàn công')
    )
  );
  
  RAISE NOTICE '✓ Created 1 contract with installments';
  
  -- ============================================================================
  -- 8. CREATE TRANSACTIONS (2 payments)
  -- ============================================================================
  
  INSERT INTO re_transactions (
    tenant_id, customer_id,
    transaction_type, amount, transaction_date,
    payment_method, reference_number, status
  ) VALUES 
    (v_tenant_id, v_customer_ids[1], 'deposit', 50000000, NOW() - INTERVAL '15 days', 'bank_transfer', 'TXN-001', 'completed'),
    (v_tenant_id, v_customer_ids[1], 'installment', 666666667, NOW() - INTERVAL '5 days', 'bank_transfer', 'TXN-002', 'completed');
  
  RAISE NOTICE '✓ Created 2 transactions';
  
  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ DEMO DATA SEEDED SUCCESSFULLY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Tenant: %', v_tenant_id;
  RAISE NOTICE 'Project: Bella Gardens (%)', v_project_id;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Data Created:';
  RAISE NOTICE '  • 1 Project';
  RAISE NOTICE '  • 20 Products (10 apartments + 10 villas)';
  RAISE NOTICE '  • 5 Customers';
  RAISE NOTICE '  • 8 Leads (various states)';
  RAISE NOTICE '  • 3 Reservations';
  RAISE NOTICE '  • 2 Bookings';
  RAISE NOTICE '  • 1 Contract (with installments)';
  RAISE NOTICE '  • 2 Transactions';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Test Now:';
  RAISE NOTICE '  1. Navigate to /dashboard/real-estate';
  RAISE NOTICE '  2. View products list';
  RAISE NOTICE '  3. Check dashboard stats';
  RAISE NOTICE '  4. Test booking flow';
  RAISE NOTICE '';
  
END $$;
