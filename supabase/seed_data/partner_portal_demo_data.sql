-- =====================================================
-- Partner Portal Demo/Test Data
-- Purpose: Seed data for testing Partner Portal features
-- Run this AFTER applying main migration
-- =====================================================

-- This script assumes:
-- 1. Main migration (20260802000000_real_estate_partner_portal.sql) is applied
-- 2. You have a tenant_id to use (replace 'YOUR_TENANT_ID' below)
-- 3. You have a partner user_id (replace 'YOUR_PARTNER_USER_ID' below)

-- =====================================================
-- VARIABLES (Update these before running)
-- =====================================================

-- Replace these with actual UUIDs from your database:
\set tenant_id 'YOUR_TENANT_ID'
\set partner_user_id 'YOUR_PARTNER_USER_ID'
\set admin_user_id 'YOUR_ADMIN_USER_ID'

-- =====================================================
-- PROJECTS
-- =====================================================

INSERT INTO public.real_estate_projects (
  id,
  tenant_id,
  name,
  code,
  location,
  developer,
  total_units,
  metadata,
  created_by
) VALUES
  (
    gen_random_uuid(),
    :tenant_id,
    'Bella Riverside',
    'BELLA-RV',
    'Quận 7, TP.HCM',
    'Bella Land Development',
    500,
    '{"description": "Dự án căn hộ cao cấp ven sông", "amenities": ["Hồ bơi", "Gym", "Công viên", "Trường học"]}'::jsonb,
    :admin_user_id
  ),
  (
    gen_random_uuid(),
    :tenant_id,
    'Bella Garden City',
    'BELLA-GC',
    'Quận 2, TP.HCM',
    'Bella Land Development',
    800,
    '{"description": "Khu đô thị sinh thái thông minh", "amenities": ["Sky bar", "Tennis court", "Kids zone", "BBQ area"]}'::jsonb,
    :admin_user_id
  )
ON CONFLICT (tenant_id, code) DO NOTHING;

-- =====================================================
-- PRODUCTS (Sample Units)
-- =====================================================

WITH projects AS (
  SELECT id, code FROM public.real_estate_projects WHERE tenant_id = :tenant_id
)
INSERT INTO public.real_estate_products (
  id,
  tenant_id,
  project_id,
  product_code,
  product_type,
  block,
  floor,
  area,
  unit_price,
  status,
  metadata,
  created_by
) 
SELECT
  gen_random_uuid(),
  :tenant_id,
  p.id,
  'S1.05.' || LPAD(unit_num::text, 2, '0'),
  'apartment',
  'S1',
  '5',
  65.5 + (unit_num * 2.5),
  2500000000 + (unit_num * 50000000),
  CASE 
    WHEN unit_num <= 3 THEN 'available'::public.re_product_status
    WHEN unit_num <= 5 THEN 'booked'::public.re_product_status
    ELSE 'deposited'::public.re_product_status
  END,
  jsonb_build_object(
    'view', CASE WHEN unit_num % 2 = 0 THEN 'River view' ELSE 'City view' END,
    'interior', CASE WHEN unit_num <= 4 THEN 'Basic' ELSE 'Premium' END
  ),
  :admin_user_id
FROM projects p
CROSS JOIN generate_series(1, 10) AS unit_num
WHERE p.code = 'BELLA-RV'
ON CONFLICT (tenant_id, product_code) DO NOTHING;

-- Add Villa units
WITH projects AS (
  SELECT id FROM public.real_estate_projects WHERE tenant_id = :tenant_id AND code = 'BELLA-GC'
)
INSERT INTO public.real_estate_products (
  id,
  tenant_id,
  project_id,
  product_code,
  product_type,
  block,
  floor,
  area,
  unit_price,
  status,
  metadata,
  created_by
)
SELECT
  gen_random_uuid(),
  :tenant_id,
  p.id,
  'V-' || LPAD(villa_num::text, 3, '0'),
  'villa',
  NULL,
  NULL,
  180 + (villa_num * 10),
  8000000000 + (villa_num * 200000000),
  CASE 
    WHEN villa_num <= 2 THEN 'available'::public.re_product_status
    ELSE 'booked'::public.re_product_status
  END,
  jsonb_build_object(
    'land_area', 200 + (villa_num * 20),
    'bedrooms', 4,
    'bathrooms', 5,
    'pool', true
  ),
  :admin_user_id
FROM projects p
CROSS JOIN generate_series(1, 5) AS villa_num
ON CONFLICT (tenant_id, product_code) DO NOTHING;

-- =====================================================
-- RESERVATIONS (Active bookings by partner)
-- =====================================================

WITH partner_products AS (
  SELECT id, product_code 
  FROM public.real_estate_products 
  WHERE tenant_id = :tenant_id 
    AND status = 'booked'::public.re_product_status
  LIMIT 3
)
INSERT INTO public.re_reservations (
  id,
  tenant_id,
  product_id,
  user_id,
  customer_id,
  status,
  expires_at,
  metadata,
  created_by
)
SELECT
  gen_random_uuid(),
  :tenant_id,
  pp.id,
  :partner_user_id,
  NULL, -- No customer record yet
  'active'::public.re_reservation_status,
  NOW() + INTERVAL '24 hours',
  jsonb_build_object(
    'customerName', 'Khách hàng ' || ROW_NUMBER() OVER (),
    'customerPhone', '0901234' || LPAD((ROW_NUMBER() OVER ())::text, 3, '0'),
    'depositAmount', 50000000,
    'depositProofUrl', 'https://storage.example.com/deposit_' || pp.product_code || '.jpg'
  ),
  :partner_user_id
FROM partner_products pp;

-- =====================================================
-- COMMISSION LEDGER (Transaction history)
-- =====================================================

WITH partner_reservations AS (
  SELECT 
    r.id AS reservation_id,
    r.product_id,
    p.unit_price
  FROM public.re_reservations r
  JOIN public.real_estate_products p ON p.id = r.product_id
  WHERE r.tenant_id = :tenant_id
    AND r.user_id = :partner_user_id
  LIMIT 5
)
INSERT INTO public.re_commission_ledger (
  id,
  tenant_id,
  user_id,
  product_id,
  reservation_id,
  transaction_type,
  base_amount,
  commission_rate,
  commission_amount,
  status,
  earned_date,
  approved_date,
  paid_date,
  notes,
  metadata,
  created_by
)
SELECT
  gen_random_uuid(),
  :tenant_id,
  :partner_user_id,
  pr.product_id,
  pr.reservation_id,
  'booking'::public.re_transaction_type,
  pr.unit_price,
  2.0, -- 2% commission rate
  pr.unit_price * 0.02,
  CASE 
    WHEN ROW_NUMBER() OVER () <= 2 THEN 'paid'::public.re_commission_status
    WHEN ROW_NUMBER() OVER () <= 4 THEN 'approved'::public.re_commission_status
    ELSE 'pending'::public.re_commission_status
  END,
  CURRENT_DATE - (ROW_NUMBER() OVER ()) * INTERVAL '7 days',
  CASE 
    WHEN ROW_NUMBER() OVER () <= 4 THEN CURRENT_DATE - (ROW_NUMBER() OVER ()) * INTERVAL '5 days'
    ELSE NULL
  END,
  CASE 
    WHEN ROW_NUMBER() OVER () <= 2 THEN CURRENT_DATE - (ROW_NUMBER() OVER ()) * INTERVAL '3 days'
    ELSE NULL
  END,
  'Commission for booking confirmation',
  jsonb_build_object('payment_method', 'bank_transfer'),
  :admin_user_id
FROM partner_reservations pr;

-- =====================================================
-- DOCUMENTS (Sales Kit)
-- =====================================================

WITH projects AS (
  SELECT id, code, name FROM public.real_estate_projects WHERE tenant_id = :tenant_id
)
INSERT INTO public.re_documents (
  id,
  tenant_id,
  project_id,
  title,
  description,
  document_type,
  file_url,
  file_name,
  file_size_bytes,
  version,
  is_latest,
  metadata,
  created_by
)
SELECT
  gen_random_uuid(),
  :tenant_id,
  p.id,
  doc.title,
  doc.description,
  doc.doc_type,
  'https://storage.example.com/' || p.code || '/' || doc.filename,
  doc.filename,
  doc.size,
  '1.0',
  true,
  '{}'::jsonb,
  :admin_user_id
FROM projects p
CROSS JOIN (
  VALUES
    ('Brochure ' || p.name, 'Brochure dự án đầy đủ với hình ảnh 3D', 'brochure'::public.re_document_type, 'brochure.pdf', 15728640),
    ('Bảng giá tháng 8/2026', 'Bảng giá chính thức có hiệu lực từ 01/08/2026', 'price_list'::public.re_document_type, 'price_list_08_2026.xlsx', 524288),
    ('Giấy phép xây dựng', 'Giấy phép xây dựng số 123/GP-XD', 'legal_docs'::public.re_document_type, 'building_permit.pdf', 2097152),
    ('Chính sách ưu đãi ngân hàng', 'Các gói vay hỗ trợ từ ngân hàng liên kết', 'bank_policy'::public.re_document_type, 'bank_offers.pdf', 1048576),
    ('Hợp đồng mẫu', 'Hợp đồng mua bán mẫu', 'contract_template'::public.re_document_type, 'contract_template.docx', 204800)
) AS doc(title, description, doc_type, filename, size);

-- =====================================================
-- PARTNER LEADS (Customer database)
-- =====================================================

INSERT INTO public.re_partner_leads (
  id,
  tenant_id,
  user_id,
  name,
  phone,
  email,
  budget,
  status,
  protected_until,
  notes,
  metadata,
  created_by
) VALUES
  (
    gen_random_uuid(),
    :tenant_id,
    :partner_user_id,
    'Phạm Minh Trí',
    '0912345678',
    'tri.pham@gmail.com',
    '3.0 - 5.0 tỷ',
    'interested',
    NOW() + INTERVAL '30 days',
    'Quan tâm căn 2 phòng ngủ view sông, muốn xem nhà mẫu cuối tuần này',
    '{"source": "Facebook Ads", "preference": "River view"}'::jsonb,
    :partner_user_id
  ),
  (
    gen_random_uuid(),
    :tenant_id,
    :partner_user_id,
    'Trần Thị Mai',
    '0909876543',
    'mai.tran@yahoo.com',
    '1.5 - 3.0 tỷ',
    'registered',
    NOW() + INTERVAL '30 days',
    'Đăng ký nhận thông tin chính sách chiết khấu',
    '{"source": "Zalo", "preference": "Affordable price"}'::jsonb,
    :partner_user_id
  ),
  (
    gen_random_uuid(),
    :tenant_id,
    :partner_user_id,
    'Nguyễn Văn Long',
    '0898765432',
    NULL,
    '5.0 - 10.0 tỷ',
    'booking',
    NOW() + INTERVAL '30 days',
    'Đã giữ chỗ căn S1.05.08, đang chờ duyệt',
    '{"source": "Referral", "preference": "Large space"}'::jsonb,
    :partner_user_id
  )
ON CONFLICT (tenant_id, phone) DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Count records created
SELECT 
  'Projects' AS table_name, 
  COUNT(*) AS count 
FROM public.real_estate_projects 
WHERE tenant_id = :tenant_id

UNION ALL

SELECT 
  'Products' AS table_name, 
  COUNT(*) AS count 
FROM public.real_estate_products 
WHERE tenant_id = :tenant_id

UNION ALL

SELECT 
  'Reservations' AS table_name, 
  COUNT(*) AS count 
FROM public.re_reservations 
WHERE tenant_id = :tenant_id

UNION ALL

SELECT 
  'Commissions' AS table_name, 
  COUNT(*) AS count 
FROM public.re_commission_ledger 
WHERE tenant_id = :tenant_id

UNION ALL

SELECT 
  'Documents' AS table_name, 
  COUNT(*) AS count 
FROM public.re_documents 
WHERE tenant_id = :tenant_id

UNION ALL

SELECT 
  'Leads' AS table_name, 
  COUNT(*) AS count 
FROM public.re_partner_leads 
WHERE tenant_id = :tenant_id;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Partner Portal demo data seeded successfully!';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '   - 2 Projects';
  RAISE NOTICE '   - 15 Products (10 apartments + 5 villas)';
  RAISE NOTICE '   - 3 Active reservations';
  RAISE NOTICE '   - 5 Commission records';
  RAISE NOTICE '   - 10 Documents (5 per project)';
  RAISE NOTICE '   - 3 Partner leads';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next: Login as partner user and visit /partner/dashboard';
END $$;
