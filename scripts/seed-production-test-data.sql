/**
 * Production Test Data Seeding
 * Generate realistic data for stress testing
 * 
 * Scale targets:
 * - 1,000,000 VINs
 * - 10,000,000 journey events
 * - 5,000,000 touchpoints
 * - 100,000 customer journeys
 * - 10,000 rules
 */

-- =====================================================
-- CONFIGURATION
-- =====================================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_test_tenant_code VARCHAR := 'bella_auto_stress_test';
  v_batch_size INT := 10000;
  v_total_vins INT := 1000000;
  v_total_journeys INT := 100000;
  v_total_events INT := 10000000;
  v_total_touchpoints INT := 5000000;
  v_total_rules INT := 10000;
  v_start_time TIMESTAMPTZ;
  v_elapsed INTERVAL;
BEGIN
  v_start_time := clock_timestamp();
  
  RAISE NOTICE '🚀 Starting production test data seeding...';
  RAISE NOTICE 'Target scale: %M VINs, %M journeys, %M events',
    v_total_vins / 1000000.0,
    v_total_journeys / 1000000.0,
    v_total_events / 1000000.0;

  -- =====================================================
  -- 1. CREATE TEST TENANT (if not exists)
  -- =====================================================
  RAISE NOTICE '📦 Step 1: Create test tenant...';
  
  INSERT INTO tenants (
    name,
    status,
    enabled_modules,
    created_at
  ) VALUES (
    v_test_tenant_code,
    'active',
    ARRAY['bella_auto']::TEXT[],
    now()
  )
  ON CONFLICT (name) DO UPDATE
    SET status = 'active',
        enabled_modules = ARRAY['bella_auto']::TEXT[]
  RETURNING id INTO v_tenant_id;
  
  RAISE NOTICE '✅ Tenant created: % (ID: %)', v_test_tenant_code, v_tenant_id;

  -- =====================================================
  -- 2. SEED VINs (1M vehicles)
  -- =====================================================
  RAISE NOTICE '🚗 Step 2: Seeding % million VINs...', v_total_vins / 1000000.0;
  
  -- Create brands if not exist
  INSERT INTO auto_brands (tenant_id, code, name, country_origin)
  SELECT 
    v_tenant_id,
    'BRAND' || g,
    'Test Brand ' || g,
    CASE (g % 5)
      WHEN 0 THEN 'Japan'
      WHEN 1 THEN 'Korea'
      WHEN 2 THEN 'Germany'
      WHEN 3 THEN 'USA'
      ELSE 'China'
    END
  FROM generate_series(1, 20) g
  ON CONFLICT (tenant_id, code) DO NOTHING;
  
  -- Create models
  INSERT INTO auto_models (tenant_id, brand_id, code, name, segment)
  SELECT 
    v_tenant_id,
    b.id,
    'MODEL' || g,
    'Test Model ' || g,
    CASE (g % 4)
      WHEN 0 THEN 'sedan'
      WHEN 1 THEN 'suv'
      WHEN 2 THEN 'truck'
      ELSE 'hatchback'
    END
  FROM generate_series(1, 100) g
  CROSS JOIN LATERAL (
    SELECT id FROM auto_brands WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1
  ) b
  ON CONFLICT (tenant_id, code) DO NOTHING;
  
  -- Create vehicles in batches
  FOR i IN 0..(v_total_vins / v_batch_size - 1) LOOP
    INSERT INTO auto_vehicles (
      tenant_id,
      vin,
      variant_id,
      color_exterior,
      color_interior,
      model_year,
      status,
      acquisition_date,
      acquisition_price,
      current_location,
      created_at
    )
    SELECT
      v_tenant_id,
      'VIN' || LPAD((i * v_batch_size + g)::TEXT, 12, '0'),
      (SELECT id FROM auto_variants WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1),
      CASE (g % 10)
        WHEN 0 THEN 'White'
        WHEN 1 THEN 'Black'
        WHEN 2 THEN 'Silver'
        WHEN 3 THEN 'Gray'
        WHEN 4 THEN 'Red'
        WHEN 5 THEN 'Blue'
        WHEN 6 THEN 'Green'
        WHEN 7 THEN 'Yellow'
        WHEN 8 THEN 'Brown'
        ELSE 'Pearl'
      END,
      'Black',
      2020 + (g % 5),
      CASE (g % 5)
        WHEN 0 THEN 'in_transit'
        WHEN 1 THEN 'warehouse'
        WHEN 2 THEN 'showroom'
        WHEN 3 THEN 'allocated'
        ELSE 'delivered'
      END,
      now() - (random() * 365 || ' days')::INTERVAL,
      500000000 + (random() * 1500000000)::BIGINT,
      'Warehouse A',
      now() - (random() * 365 || ' days')::INTERVAL
    FROM generate_series(1, v_batch_size) g;
    
    IF (i + 1) % 10 = 0 THEN
      RAISE NOTICE '  ⏳ Progress: % / % batches (%%%)',
        i + 1,
        v_total_vins / v_batch_size,
        ROUND((i + 1) * 100.0 / (v_total_vins / v_batch_size), 1);
    END IF;
  END LOOP;
  
  v_elapsed := clock_timestamp() - v_start_time;
  RAISE NOTICE '✅ VINs seeded in %', v_elapsed;
  v_start_time := clock_timestamp();

  -- =====================================================
  -- 3. SEED CUSTOMER JOURNEYS (100K)
  -- =====================================================
  RAISE NOTICE '👥 Step 3: Seeding % thousand customer journeys...', v_total_journeys / 1000;
  
  -- Create customers first
  FOR i IN 0..(v_total_journeys / v_batch_size - 1) LOOP
    INSERT INTO customers (
      tenant_id,
      full_name,
      phone,
      email,
      created_at
    )
    SELECT
      v_tenant_id,
      'Customer ' || (i * v_batch_size + g),
      '0900' || LPAD((i * v_batch_size + g)::TEXT, 6, '0'),
      'customer' || (i * v_batch_size + g) || '@test.com',
      now() - (random() * 730 || ' days')::INTERVAL
    FROM generate_series(1, v_batch_size) g;
  END LOOP;
  
  RAISE NOTICE '  ✅ Customers created';
  
  -- Create journeys
  FOR i IN 0..(v_total_journeys / v_batch_size - 1) LOOP
    INSERT INTO auto_customer_journeys (
      tenant_id,
      customer_id,
      current_stage_id,
      status,
      priority,
      started_at,
      created_at
    )
    SELECT
      v_tenant_id,
      c.id,
      (SELECT id FROM auto_journey_stages WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1),
      CASE (ROW_NUMBER() OVER() % 4)
        WHEN 0 THEN 'active'
        WHEN 1 THEN 'completed'
        WHEN 2 THEN 'lost'
        ELSE 'on_hold'
      END,
      CASE (ROW_NUMBER() OVER() % 3)
        WHEN 0 THEN 'high'
        WHEN 1 THEN 'medium'
        ELSE 'low'
      END,
      now() - (random() * 365 || ' days')::INTERVAL,
      now() - (random() * 365 || ' days')::INTERVAL
    FROM customers c
    WHERE c.tenant_id = v_tenant_id
    ORDER BY c.created_at
    LIMIT v_batch_size
    OFFSET i * v_batch_size;
    
    IF (i + 1) % 5 = 0 THEN
      RAISE NOTICE '  ⏳ Progress: % / % batches', i + 1, v_total_journeys / v_batch_size;
    END IF;
  END LOOP;
  
  v_elapsed := clock_timestamp() - v_start_time;
  RAISE NOTICE '✅ Journeys seeded in %', v_elapsed;
  v_start_time := clock_timestamp();

  -- =====================================================
  -- 4. SEED JOURNEY EVENTS (10M)
  -- =====================================================
  RAISE NOTICE '📊 Step 4: Seeding % million journey events...', v_total_events / 1000000.0;
  RAISE NOTICE '  ⚠️  This will take 10-15 minutes...';
  
  -- Generate events for each journey (avg 100 events per journey)
  FOR i IN 0..(v_total_events / v_batch_size - 1) LOOP
    INSERT INTO auto_journey_events (
      tenant_id,
      journey_id,
      event_type,
      stage_id,
      data,
      occurred_at,
      created_at
    )
    SELECT
      v_tenant_id,
      j.id,
      CASE (ROW_NUMBER() OVER() % 10)
        WHEN 0 THEN 'stage_entered'
        WHEN 1 THEN 'stage_completed'
        WHEN 2 THEN 'test_drive_scheduled'
        WHEN 3 THEN 'quotation_sent'
        WHEN 4 THEN 'deposit_paid'
        WHEN 5 THEN 'vehicle_allocated'
        WHEN 6 THEN 'delivery_scheduled'
        WHEN 7 THEN 'follow_up_call'
        WHEN 8 THEN 'email_sent'
        ELSE 'note_added'
      END,
      (SELECT id FROM auto_journey_stages WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1),
      jsonb_build_object(
        'note', 'Auto-generated test event',
        'value', random() * 1000000
      ),
      now() - (random() * 365 || ' days')::INTERVAL,
      now() - (random() * 365 || ' days')::INTERVAL
    FROM auto_customer_journeys j
    WHERE j.tenant_id = v_tenant_id
    ORDER BY j.created_at
    LIMIT (v_batch_size / 100)
    OFFSET (i * v_batch_size / 100);
    
    IF (i + 1) % 100 = 0 THEN
      v_elapsed := clock_timestamp() - v_start_time;
      RAISE NOTICE '  ⏳ Progress: % / % batches (%%%), elapsed: %',
        i + 1,
        v_total_events / v_batch_size,
        ROUND((i + 1) * 100.0 / (v_total_events / v_batch_size), 1),
        v_elapsed;
    END IF;
  END LOOP;
  
  v_elapsed := clock_timestamp() - v_start_time;
  RAISE NOTICE '✅ Events seeded in %', v_elapsed;

END $$;

RAISE NOTICE '🎉 Production test data seeding COMPLETE!';
RAISE NOTICE 'Next: Run load tests with k6/JMeter';
