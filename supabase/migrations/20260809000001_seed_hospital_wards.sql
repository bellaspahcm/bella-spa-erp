-- ============================================================================
-- SEED HOSPITAL WARDS FOR BELLA HEALTHCARE
-- Created: 09/08/2026
-- Purpose: Populate hc_wards table with departments for testing
-- Tenant: Bella General Hospital (c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d)
-- ============================================================================

-- Insert Hospital Wards
INSERT INTO hc_wards (
  id,
  tenant_id,
  code,
  name,
  created_at
) VALUES
  -- ICU
  (gen_random_uuid(), 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', 'ICU', 'Khoa Hồi Sức Tích Cực (ICU)', now()),
  
  -- Internal Medicine
  (gen_random_uuid(), 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', 'INT-MED', 'Khoa Nội Tổng Hợp', now()),
  
  -- Surgery
  (gen_random_uuid(), 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', 'SURGERY', 'Khoa Phẫu Thuật', now()),
  
  -- Pediatrics
  (gen_random_uuid(), 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', 'PEDS', 'Khoa Nhi', now()),
  
  -- Emergency
  (gen_random_uuid(), 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', 'ER', 'Khoa Cấp Cứu', now());

-- Verify insertion
SELECT 
  id,
  code,
  name
FROM hc_wards
WHERE tenant_id = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'
ORDER BY code;
