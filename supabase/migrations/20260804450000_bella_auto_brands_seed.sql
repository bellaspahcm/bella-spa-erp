-- ============================================================================
-- Bella Auto: Brands, Models, and Variants Seed
-- Purpose: Seed Vietnamese market car brands/models/variants
-- Timestamp: 20260804400000
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID := 'f8504953-03c0-43dc-ad03-1b0febd58caf'; -- bella_auto_stress_test
  
  -- Brand IDs
  v_brand_toyota UUID := gen_random_uuid();
  v_brand_honda UUID := gen_random_uuid();
  v_brand_mazda UUID := gen_random_uuid();
  v_brand_ford UUID := gen_random_uuid();
  
  -- Model IDs
  v_model_vios UUID := gen_random_uuid();
  v_model_camry UUID := gen_random_uuid();
  v_model_fortuner UUID := gen_random_uuid();
  v_model_civic UUID := gen_random_uuid();
  v_model_crv UUID := gen_random_uuid();
  v_model_cx5 UUID := gen_random_uuid();
  v_model_ranger UUID := gen_random_uuid();
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Bella Auto Brands/Models/Variants Seed';
  RAISE NOTICE '========================================';

  -- =========================================================================
  -- 1. BRANDS
  -- =========================================================================
  INSERT INTO public.auto_brands (id, tenant_id, name, country_of_origin, is_active)
  VALUES
    (v_brand_toyota, v_tenant_id, 'Toyota', 'Japan', true),
    (v_brand_honda, v_tenant_id, 'Honda', 'Japan', true),
    (v_brand_mazda, v_tenant_id, 'Mazda', 'Japan', true),
    (v_brand_ford, v_tenant_id, 'Ford', 'USA', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  
  RAISE NOTICE '✓ Created 4 brands';

  -- =========================================================================
  -- 2. MODELS
  -- =========================================================================
  -- Toyota Models
  INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment, is_active)
  VALUES
    (v_model_vios, v_tenant_id, v_brand_toyota, 'Vios', 'B-Sedan', true),
    (v_model_camry, v_tenant_id, v_brand_toyota, 'Camry', 'D-Sedan', true),
    (v_model_fortuner, v_tenant_id, v_brand_toyota, 'Fortuner', 'SUV 7 chỗ', true)
  ON CONFLICT (tenant_id, brand_id, name) DO NOTHING;
  
  -- Honda Models
  INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment, is_active)
  VALUES
    (v_model_civic, v_tenant_id, v_brand_honda, 'Civic', 'C-Sedan', true),
    (v_model_crv, v_tenant_id, v_brand_honda, 'CR-V', 'SUV 5 chỗ', true)
  ON CONFLICT (tenant_id, brand_id, name) DO NOTHING;
  
  -- Mazda Models
  INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment, is_active)
  VALUES
    (v_model_cx5, v_tenant_id, v_brand_mazda, 'CX-5', 'SUV 5 chỗ', true)
  ON CONFLICT (tenant_id, brand_id, name) DO NOTHING;
  
  -- Ford Models
  INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment, is_active)
  VALUES
    (v_model_ranger, v_tenant_id, v_brand_ford, 'Ranger', 'Bán tải', true)
  ON CONFLICT (tenant_id, brand_id, name) DO NOTHING;
  
  RAISE NOTICE '✓ Created 7 models';

  -- =========================================================================
  -- 3. VARIANTS
  -- =========================================================================
  -- Toyota Vios Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_vios, 'Vios 1.5E MT', 2024, 'gasoline', 'manual', '{"engine": "1.5L", "price": 458000000, "features": ["ABS", "EBD", "2 airbags"]}'::jsonb, true),
    (v_tenant_id, v_model_vios, 'Vios 1.5E CVT', 2024, 'gasoline', 'cvt', '{"engine": "1.5L", "price": 490000000, "features": ["ABS", "EBD", "2 airbags", "CVT"]}'::jsonb, true),
    (v_tenant_id, v_model_vios, 'Vios 1.5G CVT', 2024, 'gasoline', 'cvt', '{"engine": "1.5L", "price": 545000000, "features": ["ABS", "EBD", "4 airbags", "Màn hình cảm ứng"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Toyota Camry Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_camry, 'Camry 2.0G', 2024, 'gasoline', 'automatic', '{"engine": "2.0L", "price": 1235000000, "features": ["ABS", "EBD", "7 airbags", "Cruise control"]}'::jsonb, true),
    (v_tenant_id, v_model_camry, 'Camry 2.5Q', 2024, 'gasoline', 'automatic', '{"engine": "2.5L", "price": 1415000000, "features": ["ABS", "EBD", "9 airbags", "Sunroof", "Leather seats"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Toyota Fortuner Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_fortuner, 'Fortuner 2.4G MT', 2024, 'diesel', 'manual', '{"engine": "2.4L Turbo Diesel", "price": 1055000000, "features": ["ABS", "4WD", "7 seats"]}'::jsonb, true),
    (v_tenant_id, v_model_fortuner, 'Fortuner 2.7V AT', 2024, 'gasoline', 'automatic', '{"engine": "2.7L", "price": 1380000000, "features": ["ABS", "2WD", "7 seats", "Leather seats"]}'::jsonb, true),
    (v_tenant_id, v_model_fortuner, 'Fortuner 2.8V 4x4 AT', 2024, 'diesel', 'automatic', '{"engine": "2.8L Turbo Diesel", "price": 1545000000, "features": ["ABS", "4WD", "7 seats", "Leather", "Sunroof"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Honda Civic Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_civic, 'Civic 1.5 Turbo', 2024, 'gasoline', 'cvt', '{"engine": "1.5L Turbo", "price": 830000000, "features": ["Turbo", "Honda Sensing", "LED lights"]}'::jsonb, true),
    (v_tenant_id, v_model_civic, 'Civic RS', 2024, 'gasoline', 'cvt', '{"engine": "1.5L Turbo", "price": 930000000, "features": ["Sport mode", "Red interior", "18 wheels"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Honda CR-V Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_crv, 'CR-V 1.5L Turbo', 2024, 'gasoline', 'cvt', '{"engine": "1.5L Turbo", "price": 1050000000, "features": ["Turbo", "7 seats", "Panoramic sunroof"]}'::jsonb, true),
    (v_tenant_id, v_model_crv, 'CR-V 1.5L RS', 2024, 'gasoline', 'cvt', '{"engine": "1.5L Turbo", "price": 1250000000, "features": ["Sport package", "Black trim", "LED matrix"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Mazda CX-5 Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_cx5, 'CX-5 2.0L Luxury', 2024, 'gasoline', 'automatic', '{"engine": "2.0L", "price": 839000000, "features": ["SkyActiv", "i-Activsense", "Leather"]}'::jsonb, true),
    (v_tenant_id, v_model_cx5, 'CX-5 2.5L Premium', 2024, 'gasoline', 'automatic', '{"engine": "2.5L Turbo", "price": 1049000000, "features": ["Turbo", "AWD", "Bose sound", "HUD"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  -- Ford Ranger Variants
  INSERT INTO public.auto_variants (tenant_id, model_id, name, year, fuel_type, transmission, specs_json, is_active)
  VALUES
    (v_tenant_id, v_model_ranger, 'Ranger XLS AT', 2024, 'diesel', 'automatic', '{"engine": "2.0L Turbo Diesel", "price": 779000000, "features": ["4x2", "Double cab", "Sync 3"]}'::jsonb, true),
    (v_tenant_id, v_model_ranger, 'Ranger Wildtrak 4x4', 2024, 'diesel', 'automatic', '{"engine": "2.0L Bi-Turbo", "price": 1099000000, "features": ["4x4", "Off-road mode", "Leather"]}'::jsonb, true)
  ON CONFLICT (tenant_id, model_id, name, year) DO NOTHING;
  
  RAISE NOTICE '✓ Created 19 variants';

  -- =========================================================================
  -- SUMMARY
  -- =========================================================================
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Brands/Models/Variants Seed Completed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ 4 Brands (Toyota, Honda, Mazda, Ford)';
  RAISE NOTICE '  ✓ 7 Models (Vios, Camry, Fortuner, Civic, CR-V, CX-5, Ranger)';
  RAISE NOTICE '  ✓ 19 Variants (various trims)';
  RAISE NOTICE '========================================';
END $$;
