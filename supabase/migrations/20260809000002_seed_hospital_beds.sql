-- ============================================================================
-- SEED HOSPITAL BEDS FOR BELLA HEALTHCARE
-- Created: 09/08/2026
-- Purpose: Populate hc_beds table with available beds for testing
-- Tenant: Bella General Hospital (c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d)
-- Schema: id, tenant_id, room_id, ward_id, bed_code, bed_type, status, daily_rate, current_admission_id, current_patient_id, updated_at
-- ============================================================================

-- Get ward IDs first
DO $$
DECLARE
  v_tenant_id UUID := 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';
  v_icu_ward_id UUID;
  v_int_med_ward_id UUID;
  v_surgery_ward_id UUID;
  v_peds_ward_id UUID;
BEGIN
  -- Lookup ward IDs
  SELECT id INTO v_icu_ward_id FROM hc_wards WHERE tenant_id = v_tenant_id AND code = 'ICU';
  SELECT id INTO v_int_med_ward_id FROM hc_wards WHERE tenant_id = v_tenant_id AND code = 'INT-MED';
  SELECT id INTO v_surgery_ward_id FROM hc_wards WHERE tenant_id = v_tenant_id AND code = 'SURGERY';
  SELECT id INTO v_peds_ward_id FROM hc_wards WHERE tenant_id = v_tenant_id AND code = 'PEDS';

  -- Insert ICU Beds (6 beds, all available)
  INSERT INTO hc_beds (id, tenant_id, room_id, ward_id, bed_code, bed_type, status, daily_rate, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-01', 'icu', 'available', 500000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-02', 'icu', 'available', 500000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-03', 'icu', 'available', 500000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-04', 'icu', 'available', 500000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-05', 'icu', 'available', 500000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_icu_ward_id, 'ICU-BED-06', 'icu', 'available', 500000, now());

  -- Insert Internal Medicine Beds (10 beds, all available)
  INSERT INTO hc_beds (id, tenant_id, room_id, ward_id, bed_code, bed_type, status, daily_rate, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-A01', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-A02', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-A03', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-A04', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-B01', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-B02', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-B03', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-B04', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-C01', 'standard', 'available', 200000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_int_med_ward_id, 'INT-C02', 'standard', 'available', 200000, now());

  -- Insert Surgery Beds (8 beds, all available)
  INSERT INTO hc_beds (id, tenant_id, room_id, ward_id, bed_code, bed_type, status, daily_rate, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-A01', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-A02', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-A03', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-A04', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-B01', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-B02', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-B03', 'standard', 'available', 250000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_surgery_ward_id, 'SUR-B04', 'standard', 'available', 250000, now());

  -- Insert Pediatrics Beds (6 beds, all available)
  INSERT INTO hc_beds (id, tenant_id, room_id, ward_id, bed_code, bed_type, status, daily_rate, updated_at) VALUES
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-01', 'pediatric', 'available', 220000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-02', 'pediatric', 'available', 220000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-03', 'pediatric', 'available', 220000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-04', 'pediatric', 'available', 220000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-05', 'pediatric', 'available', 220000, now()),
    (gen_random_uuid(), v_tenant_id, gen_random_uuid(), v_peds_ward_id, 'PED-06', 'pediatric', 'available', 220000, now());

  RAISE NOTICE 'Successfully seeded % beds across % wards', 
    (SELECT COUNT(*) FROM hc_beds WHERE tenant_id = v_tenant_id),
    (SELECT COUNT(*) FROM hc_wards WHERE tenant_id = v_tenant_id);
END $$;

-- Verify insertion
SELECT 
  w.code AS ward_code,
  b.status,
  COUNT(*) as bed_count
FROM hc_beds b
JOIN hc_wards w ON w.id = b.ward_id
WHERE b.tenant_id = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'
GROUP BY w.code, b.status
ORDER BY w.code, b.status;
