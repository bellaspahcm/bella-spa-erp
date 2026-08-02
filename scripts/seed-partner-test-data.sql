-- ============================================================================
-- Seed Test Data for Partner Registration E2E Test
-- ============================================================================

-- NOTE: Run this AFTER user_roles table exists

-- 1. Create test admin user role (replace YOUR_USER_ID with actual auth.users.id)
-- Get your user ID: SELECT id FROM auth.users WHERE email = 'your@email.com';

-- INSERT INTO user_roles (user_id, role_name, tenant_id)
-- VALUES 
--   ('YOUR_USER_ID', 'admin', NULL),
--   ('YOUR_USER_ID', 'super_admin', NULL);

-- 2. Create test partner application (draft)
INSERT INTO partner_applications (
  applicant_type,
  full_name,
  email,
  phone,
  company_name,
  tax_code,
  address,
  city,
  status
) VALUES (
  'agency',
  'Test Agency Partner',
  'test.partner@example.com',
  '+84901234567',
  'Test Real Estate Agency',
  '0123456789',
  '123 Test Street',
  'Ho Chi Minh City',
  'draft'
) ON CONFLICT DO NOTHING;

-- 3. Create test partner application (pending verification - email verified)
INSERT INTO partner_applications (
  applicant_type,
  full_name,
  email,
  phone,
  company_name,
  tax_code,
  address,
  city,
  status,
  submitted_at,
  email_verified_at,
  email_verification_token
) VALUES (
  'company',
  'Test Company Partner',
  'verified.partner@example.com',
  '+84987654321',
  'Test Real Estate Company Ltd',
  '9876543210',
  '456 Verified Street',
  'Hanoi',
  'pending_verification',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 hour',
  'test-token-verified'
) ON CONFLICT DO NOTHING;

-- 4. Verify data
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM partner_applications WHERE email LIKE '%@example.com';
  RAISE NOTICE '✅ Created % test partner applications', v_count;
END $$;

-- ============================================================================
-- Manual Test Steps
-- ============================================================================

-- 1. Get test application IDs:
SELECT id, full_name, email, status FROM partner_applications WHERE email LIKE '%@example.com';

-- 2. Test approve API:
-- POST /api/admin/partner-applications/{id}/approve
-- Body: { "notes": "Test approval" }

-- 3. Test reject API:
-- POST /api/admin/partner-applications/{id}/reject
-- Body: { "reason": "Test rejection", "category": "other" }

-- 4. Test request-info API:
-- POST /api/admin/partner-applications/{id}/request-info
-- Body: { "message": "Please upload clearer documents" }

-- 5. Check logs:
SELECT * FROM partner_application_logs ORDER BY created_at DESC LIMIT 10;
