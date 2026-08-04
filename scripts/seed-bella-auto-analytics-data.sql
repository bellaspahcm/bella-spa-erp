-- ============================================================================
-- Seed Bella Auto Analytics Data (For Charts)
-- Run this in Supabase SQL Editor after basic seed
-- Creates realistic dated records for last 6 months
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_variant_ids UUID[];
  v_month_offset INTEGER;
  v_target_date DATE;
  v_vehicles_to_create INTEGER;
  v_vehicles_to_deliver INTEGER;
  v_vehicle_ids UUID[];
BEGIN
  -- Find bella_auto_stress tenant
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE name = 'bella_auto_stress';

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant bella_auto_stress not found';
  END IF;

  -- Get existing variant IDs
  SELECT ARRAY_AGG(id) INTO v_variant_ids
  FROM public.auto_variants
  WHERE tenant_id = v_tenant_id
  LIMIT 20;

  RAISE NOTICE 'Creating analytics data for tenant: %', v_tenant_id;
  RAISE NOTICE 'Using % variants', ARRAY_LENGTH(v_variant_ids, 1);

  -- Loop through last 6 months
  FOR v_month_offset IN 0..5 LOOP
    v_target_date := (DATE_TRUNC('month', NOW()) - (v_month_offset || ' months')::INTERVAL)::DATE;
    v_vehicles_to_create := 100 + (v_month_offset * 20); -- More in recent months
    v_vehicles_to_deliver := 50 + (v_month_offset * 10);

    RAISE NOTICE 'Month %: % (Create: %, Deliver: %)', 
      6 - v_month_offset, 
      TO_CHAR(v_target_date, 'YYYY-MM'),
      v_vehicles_to_create,
      v_vehicles_to_deliver;

    -- Create vehicles for this month (nhập kho)
    INSERT INTO public.auto_vehicles (
      tenant_id,
      variant_id,
      vin,
      chassis_number,
      engine_number,
      color_exterior,
      color_interior,
      model_year,
      list_price,
      cost_price,
      status,
      location_note,
      created_at,
      updated_at
    )
    SELECT 
      v_tenant_id,
      v_variant_ids[1 + (i % ARRAY_LENGTH(v_variant_ids, 1))],
      'AN' || TO_CHAR(v_target_date, 'YYYYMM') || LPAD(i::TEXT, 9, '0'),
      'CH' || v_month_offset || '-' || i,
      'EN' || v_month_offset || '-' || i,
      (ARRAY['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue'])[1 + (i % 6)],
      'Black',
      2024,
      500000000 + (i % 10) * 50000000,
      450000000 + (i % 10) * 45000000,
      CASE 
        WHEN i <= v_vehicles_to_deliver THEN 'delivered'
        ELSE (ARRAY['warehouse', 'showroom', 'allocated'])[1 + (i % 3)]
      END,
      'Analytics seed location',
      v_target_date + (i % 28 || ' days')::INTERVAL,
      v_target_date + (i % 28 || ' days')::INTERVAL + INTERVAL '1 day'
    FROM generate_series(1, v_vehicles_to_create) AS i;

  END LOOP;

  RAISE NOTICE '✅ Analytics data created successfully';
  RAISE NOTICE 'Total vehicles in system: %', (SELECT COUNT(*) FROM public.auto_vehicles WHERE tenant_id = v_tenant_id);
END $$;

-- Verify results
SELECT 
  TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
  COUNT(*) FILTER (WHERE status NOT IN ('delivered')) AS nhap_kho,
  COUNT(*) FILTER (WHERE status = 'delivered') AS da_giao,
  SUM(list_price) / 1000000000 AS total_value_billion_vnd
FROM public.auto_vehicles
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'bella_auto_stress')
  AND created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
