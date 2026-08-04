-- ============================================================================
-- Bella Auto: Minimal Demo Data (no bookings - simplified)
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID := 'f8504953-03c0-43dc-ad03-1b0febd58caf';
  v_sales_user_id UUID := 'de9b9b38-b89e-4e22-b39f-130a05dfcc55';
  
  v_c1 UUID := gen_random_uuid();
  v_c2 UUID := gen_random_uuid();
  v_c3 UUID := gen_random_uuid();
  
  v_vios UUID;
  v_fortuner UUID;
BEGIN
  -- Customers
  INSERT INTO customers (id, tenant_id, phone, name_mother, address, status)
  VALUES
    (v_c1, v_tenant_id, '0901234567', 'Nguyễn Văn An', '123 Lê Lợi, Q1, TP.HCM', 'active'),
    (v_c2, v_tenant_id, '0912345678', 'Trần Thị Bích', '456 Nguyễn Huệ, Q1, TP.HCM', 'active'),
    (v_c3, v_tenant_id, '0923456789', 'Lê Minh Công', '789 Trần Hưng Đạo, Q5, TP.HCM', 'active')
  ON CONFLICT (id) DO NOTHING;
  
  -- Profiles
  INSERT INTO auto_customer_profiles (id, tenant_id, customer_id, preferred_brands, budget_range, purchasing_purpose)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_c1, ARRAY['Toyota'], '1000-1500', 'family'),
    (gen_random_uuid(), v_tenant_id, v_c2, ARRAY['Toyota'], '400-600', 'commute'),
    (gen_random_uuid(), v_tenant_id, v_c3, ARRAY['Honda'], '400-600', 'commute')
  ON CONFLICT (tenant_id, customer_id) DO NOTHING;
  
  -- Get variants
  SELECT id INTO v_vios FROM auto_variants WHERE tenant_id = v_tenant_id AND name ILIKE '%Vios%CVT%' LIMIT 1;
  SELECT id INTO v_fortuner FROM auto_variants WHERE tenant_id = v_tenant_id AND name ILIKE '%Fortuner%2.7%' LIMIT 1;
  
  -- Vehicles
  INSERT INTO auto_vehicles (id, tenant_id, variant_id, vin, engine_number, color_exterior, model_year, list_price, status)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_vios, 'VNVIOS24000000001', 'VIO001', 'Trắng', 2024, 490000000, 'showroom'),
    (gen_random_uuid(), v_tenant_id, v_vios, 'VNVIOS24000000002', 'VIO002', 'Bạc', 2024, 490000000, 'showroom'),
    (gen_random_uuid(), v_tenant_id, v_fortuner, 'VNFORTU2400000001', 'FOR001', 'Đen', 2024, 1380000000, 'showroom')
  ON CONFLICT (tenant_id, vin) DO NOTHING;
  
  -- Leads
  INSERT INTO auto_leads (id, tenant_id, customer_id, source, preferred_variant_id, budget_limit, assigned_sales_agent_id, assigned_at, status)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_c1, 'facebook_ads', v_fortuner, 1400000000, v_sales_user_id, NOW() - INTERVAL '7 days', 'negotiating'),
    (gen_random_uuid(), v_tenant_id, v_c2, 'showroom', v_vios, 500000000, v_sales_user_id, NOW() - INTERVAL '3 days', 'contacted')
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '✅ Seeded: 3 customers, 3 vehicles, 2 leads';
END $$;
