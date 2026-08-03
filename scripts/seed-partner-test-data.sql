-- ============================================================================
-- Seed Partner Test Data
-- Purpose: Create test applications for development/testing
-- Run: Copy to Supabase Dashboard SQL Editor → Run
-- ============================================================================

-- Clean existing test data (optional)
-- DELETE FROM partner_applications WHERE email LIKE 'test%@example.com';

-- Test Application 1: Pending verification (just registered)
INSERT INTO partner_applications (
  id,
  email,
  phone,
  full_name,
  company_name,
  business_type,
  company_address,
  tax_code,
  status,
  verification_token,
  verification_token_expires_at,
  expected_monthly_sales,
  referral_source
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test1@example.com',
  '+84901234567',
  'Nguyễn Văn A',
  'Công Ty TNHH ABC',
  'individual',
  '123 Nguyễn Huệ, Q1, TP.HCM',
  '0123456789',
  'pending_verification',
  'test-token-123',
  NOW() + INTERVAL '24 hours',
  50000000,
  'social_media'
) ON CONFLICT (id) DO NOTHING;

-- Test Application 2: Verified, pending admin review
INSERT INTO partner_applications (
  id,
  email,
  phone,
  full_name,
  company_name,
  business_type,
  company_address,
  tax_code,
  status,
  email_verified_at,
  expected_monthly_sales,
  referral_source
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'test2@example.com',
  '+84901234568',
  'Trần Thị B',
  'Công Ty CP BDD',
  'company',
  '456 Lê Lợi, Q3, TP.HCM',
  '0987654321',
  'pending_review',
  NOW() - INTERVAL '2 hours',
  100000000,
  'partner_referral'
) ON CONFLICT (id) DO NOTHING;

-- Test Application 3: Approved, pending provisioning
INSERT INTO partner_applications (
  id,
  email,
  phone,
  full_name,
  company_name,
  business_type,
  company_address,
  tax_code,
  status,
  email_verified_at,
  reviewed_at,
  expected_monthly_sales,
  referral_source
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'test3@example.com',
  '+84901234569',
  'Lê Văn C',
  'Doanh Nghiệp CDE',
  'company',
  '789 Hai Bà Trưng, Q1, TP.HCM',
  '1122334455',
  'approved',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 hour',
  200000000,
  'website'
) ON CONFLICT (id) DO NOTHING;

-- Test Application 4: Rejected
INSERT INTO partner_applications (
  id,
  email,
  phone,
  full_name,
  company_name,
  business_type,
  status,
  email_verified_at,
  reviewed_at,
  rejection_reason
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'test4@example.com',
  '+84901234560',
  'Phạm Văn D',
  'Công Ty DEF',
  'individual',
  'rejected',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 days',
  'Thông tin không đầy đủ, vui lòng cung cấp giấy phép kinh doanh'
) ON CONFLICT (id) DO NOTHING;

-- Test Application 5: Need more info
INSERT INTO partner_applications (
  id,
  email,
  phone,
  full_name,
  company_name,
  business_type,
  status,
  email_verified_at,
  reviewed_at,
  additional_info_requested
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'test5@example.com',
  '+84901234561',
  'Hoàng Thị E',
  'Công Ty EFG',
  'company',
  'need_more_info',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day',
  'Vui lòng cung cấp thêm: 1) Giấy phép ĐKKD, 2) CMND/CCCD người đại diện'
) ON CONFLICT (id) DO NOTHING;

-- Add some logs for test data
INSERT INTO partner_application_logs (application_id, action, action_description, performed_by_role)
SELECT id, 'submitted', 'Application submitted', 'partner'
FROM partner_applications 
WHERE email LIKE 'test%@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO partner_application_logs (application_id, action, action_description, performed_by_role)
SELECT id, 'email_verified', 'Email verified successfully', 'system'
FROM partner_applications 
WHERE email LIKE 'test%@example.com' AND email_verified_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verification query
SELECT 
  id, 
  email, 
  full_name,
  company_name,
  status, 
  email_verified_at IS NOT NULL as verified,
  created_at
FROM partner_applications
WHERE email LIKE 'test%@example.com'
ORDER BY created_at DESC;

-- Count by status
SELECT 
  status,
  COUNT(*) as count
FROM partner_applications
WHERE email LIKE 'test%@example.com'
GROUP BY status
ORDER BY status;
