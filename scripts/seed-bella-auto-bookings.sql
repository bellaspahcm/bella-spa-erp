-- ============================================================================
-- Bella Auto — Seed Data: Bookings & Deposit Management
-- Dependencies: Requires customers, auto_vehicles, auto_variants, auto_models
-- ============================================================================

-- Get bella_auto tenant
DO $$
DECLARE
  v_tenant_id UUID;
  v_customer_id_1 UUID;
  v_customer_id_2 UUID;
  v_customer_id_3 UUID;
  v_vehicle_id_1 UUID;
  v_vehicle_id_2 UUID;
  v_vehicle_id_3 UUID;
  v_variant_id UUID;
BEGIN
  -- Get tenant
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name = 'Bella Auto' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "Bella Auto" not found. Run seed-bella-auto-tenant.sql first.';
  END IF;

  RAISE NOTICE 'Using tenant: %', v_tenant_id;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1. Create customers (reuse existing customers table for Bella Auto)
  -- ══════════════════════════════════════════════════════════════════════════
  
  INSERT INTO public.customers (id, tenant_id, phone, name_mother, address, status)
  VALUES 
    (gen_random_uuid(), v_tenant_id, '0901234567', 'Nguyễn Văn A', '123 Đường ABC, Quận 1, TP.HCM', 'active'),
    (gen_random_uuid(), v_tenant_id, '0902345678', 'Trần Thị B', '456 Đường DEF, Quận 3, TP.HCM', 'active'),
    (gen_random_uuid(), v_tenant_id, '0903456789', 'Lê Văn C', '789 Đường GHI, Quận 7, TP.HCM', 'active')
  ON CONFLICT (phone) DO NOTHING
  RETURNING id INTO v_customer_id_1;

  -- Get customer IDs if already exist
  SELECT id INTO v_customer_id_1 FROM public.customers WHERE phone = '0901234567' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer_id_2 FROM public.customers WHERE phone = '0902345678' AND tenant_id = v_tenant_id;
  SELECT id INTO v_customer_id_3 FROM public.customers WHERE phone = '0903456789' AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Customer IDs: %, %, %', v_customer_id_1, v_customer_id_2, v_customer_id_3;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2. Get existing vehicles (assume seed-bella-auto-vehicles.sql already run)
  -- ══════════════════════════════════════════════════════════════════════════
  
  SELECT id INTO v_vehicle_id_1 FROM public.auto_vehicles 
  WHERE tenant_id = v_tenant_id AND vin = 'AN20260803000000001' LIMIT 1;
  
  SELECT id INTO v_vehicle_id_2 FROM public.auto_vehicles 
  WHERE tenant_id = v_tenant_id AND vin = 'AN20260803000000002' LIMIT 1;
  
  SELECT id INTO v_vehicle_id_3 FROM public.auto_vehicles 
  WHERE tenant_id = v_tenant_id AND vin = 'AN20260803000000003' LIMIT 1;

  IF v_vehicle_id_1 IS NULL THEN
    RAISE EXCEPTION 'Vehicles not found. Run seed-bella-auto-vehicles.sql first.';
  END IF;

  RAISE NOTICE 'Vehicle IDs: %, %, %', v_vehicle_id_1, v_vehicle_id_2, v_vehicle_id_3;

  -- Get variant_id from first vehicle
  SELECT variant_id INTO v_variant_id FROM public.auto_vehicles WHERE id = v_vehicle_id_1;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3. Create bookings with various deposit statuses
  -- ══════════════════════════════════════════════════════════════════════════

  -- Booking 1: Chưa cọc (unpaid)
  INSERT INTO public.auto_bookings (
    tenant_id,
    customer_id,
    variant_id,
    vehicle_id,
    color_exterior,
    booking_number,
    total_price,
    deposit_amount,
    deposit_paid,
    payment_status,
    status
  ) VALUES (
    v_tenant_id,
    v_customer_id_1,
    v_variant_id,
    v_vehicle_id_1,
    'Đen ánh kim',
    'BK-BA-20260805-0001',
    2439000000,
    50000000,
    0,
    'unpaid',
    'pending'
  ) ON CONFLICT (tenant_id, booking_number) DO NOTHING;

  -- Booking 2: Cọc 1 phần (partially_paid)
  INSERT INTO public.auto_bookings (
    tenant_id,
    customer_id,
    variant_id,
    vehicle_id,
    color_exterior,
    booking_number,
    total_price,
    deposit_amount,
    deposit_paid,
    payment_status,
    status
  ) VALUES (
    v_tenant_id,
    v_customer_id_2,
    v_variant_id,
    v_vehicle_id_2,
    'Trắng ngọc trai',
    'BK-BA-20260805-0002',
    2450000000,
    50000000,
    25000000,
    'partially_paid',
    'confirmed'
  ) ON CONFLICT (tenant_id, booking_number) DO NOTHING;

  -- Booking 3: Đã cọc đủ (fully_paid)
  INSERT INTO public.auto_bookings (
    tenant_id,
    customer_id,
    variant_id,
    vehicle_id,
    color_exterior,
    booking_number,
    total_price,
    deposit_amount,
    deposit_paid,
    payment_status,
    status
  ) VALUES (
    v_tenant_id,
    v_customer_id_3,
    v_variant_id,
    v_vehicle_id_3,
    'Xanh dương đậm',
    'BK-BA-20260805-0003',
    2439000000,
    50000000,
    50000000,
    'fully_paid',
    'confirmed'
  ) ON CONFLICT (tenant_id, booking_number) DO NOTHING;

  -- Booking 4: Chưa cọc, chưa có VIN (unpaid, no vehicle allocated)
  INSERT INTO public.auto_bookings (
    tenant_id,
    customer_id,
    variant_id,
    vehicle_id,
    color_exterior,
    booking_number,
    total_price,
    deposit_amount,
    deposit_paid,
    payment_status,
    status
  ) VALUES (
    v_tenant_id,
    v_customer_id_1,
    v_variant_id,
    NULL, -- Chưa phân bổ VIN
    'Đỏ ruby',
    'BK-BA-20260805-0004',
    2450000000,
    50000000,
    0,
    'unpaid',
    'pending'
  ) ON CONFLICT (tenant_id, booking_number) DO NOTHING;

  -- Booking 5: Cọc 70% (partially_paid)
  INSERT INTO public.auto_bookings (
    tenant_id,
    customer_id,
    variant_id,
    vehicle_id,
    color_exterior,
    booking_number,
    total_price,
    deposit_amount,
    deposit_paid,
    payment_status,
    status
  ) VALUES (
    v_tenant_id,
    v_customer_id_2,
    v_variant_id,
    NULL,
    'Xám titan',
    'BK-BA-20260805-0005',
    2439000000,
    50000000,
    35000000,
    'partially_paid',
    'confirmed'
  ) ON CONFLICT (tenant_id, booking_number) DO NOTHING;

  RAISE NOTICE '✅ Seeded 5 bookings successfully';

END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Verification Queries
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name = 'Bella Auto' LIMIT 1;
  
  SELECT COUNT(*) INTO v_count FROM public.auto_bookings WHERE tenant_id = v_tenant_id;
  RAISE NOTICE '📊 Total bookings: %', v_count;
  
  SELECT COUNT(*) INTO v_count FROM public.auto_bookings 
  WHERE tenant_id = v_tenant_id AND deposit_paid = 0;
  RAISE NOTICE '   - Chưa cọc: %', v_count;
  
  SELECT COUNT(*) INTO v_count FROM public.auto_bookings 
  WHERE tenant_id = v_tenant_id AND deposit_paid > 0 AND deposit_paid < deposit_amount;
  RAISE NOTICE '   - Cọc 1 phần: %', v_count;
  
  SELECT COUNT(*) INTO v_count FROM public.auto_bookings 
  WHERE tenant_id = v_tenant_id AND deposit_paid >= deposit_amount;
  RAISE NOTICE '   - Đã cọc đủ: %', v_count;
END $$;
