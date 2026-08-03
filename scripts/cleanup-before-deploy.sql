-- ============================================================================
-- Cleanup Before Deploy
-- Run this FIRST if you get "already exists" errors
-- ============================================================================

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS partner_application_logs CASCADE;
DROP TABLE IF EXISTS partner_applications CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- Drop types
DROP TYPE IF EXISTS partner_application_status CASCADE;
DROP TYPE IF EXISTS partner_applicant_type CASCADE;
DROP TYPE IF EXISTS partner_application_log_action CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_partner_application_updated_at() CASCADE;
DROP FUNCTION IF EXISTS log_partner_application_status_change() CASCADE;
DROP FUNCTION IF EXISTS generate_email_verification_token() CASCADE;
DROP FUNCTION IF EXISTS generate_activation_token() CASCADE;
DROP FUNCTION IF EXISTS verify_partner_application_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_application_stats(UUID) CASCADE;

-- Verify cleanup
SELECT 
  'Tables' as object_type,
  COUNT(*) as remaining_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('partner_applications', 'partner_application_logs', 'user_roles')

UNION ALL

SELECT 
  'Types' as object_type,
  COUNT(*) as remaining_count
FROM pg_type 
WHERE typname IN ('partner_application_status', 'partner_applicant_type', 'partner_application_log_action');

-- Expected: All counts should be 0
-- If 0, proceed to run apply-all-migrations.sql
