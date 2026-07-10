-- ============================================================================
-- Diagnostic: Check Tenant Mismatch Between Metrics and User
-- ============================================================================

-- Step 1: Check which tenant has metrics data
SELECT 
  'Metrics Tenant' as source,
  tenant_id,
  COUNT(*) as record_count,
  MIN(created_at) as first_metric,
  MAX(created_at) as last_metric
FROM decision_engine_metrics
GROUP BY tenant_id;

-- Step 2: Check user's tenant (from users table)
SELECT 
  'User Tenant' as source,
  tenant_id,
  email,
  id as user_id
FROM users
WHERE email = 'admin@jadewellness.spa';

-- Step 3: Check user's tenant (from auth.users metadata)
SELECT 
  'Auth Metadata Tenant' as source,
  raw_user_meta_data->>'tenant_id' as tenant_id,
  email,
  id as user_id
FROM auth.users
WHERE email = 'admin@jadewellness.spa';

-- Step 4: Compare all three
SELECT 
  u.email,
  u.tenant_id as users_table_tenant,
  au.raw_user_meta_data->>'tenant_id' as auth_metadata_tenant,
  (SELECT tenant_id FROM decision_engine_metrics LIMIT 1) as metrics_tenant,
  CASE 
    WHEN u.tenant_id::text = (SELECT tenant_id::text FROM decision_engine_metrics LIMIT 1) THEN '✅ Match'
    ELSE '❌ MISMATCH - This is the problem!'
  END as status
FROM users u
JOIN auth.users au ON au.id = u.id
WHERE u.email = 'admin@jadewellness.spa';

-- ============================================================================
-- SOLUTION OPTIONS:
-- ============================================================================

-- Option 1: Update metrics to match user's tenant
-- (Recommended if you want to keep the user's tenant)
/*
UPDATE decision_engine_metrics
SET tenant_id = (
  SELECT tenant_id 
  FROM users 
  WHERE email = 'admin@jadewellness.spa'
)
WHERE tenant_id = 'ab6ae603-04e8-4e74-b015-ba123f8705cf';
*/

-- Option 2: Insert new metrics for user's tenant
-- (Recommended if you want fresh data)
/*
-- First, get the user's tenant_id
SELECT tenant_id FROM users WHERE email = 'admin@jadewellness.spa';

-- Then run the QUICK_START_METRICS_DASHBOARD.sql with the correct tenant_id
*/

-- Option 3: Update user's tenant to match metrics
-- (NOT recommended - only if metrics tenant is correct)
/*
UPDATE users
SET tenant_id = 'ab6ae603-04e8-4e74-b015-ba123f8705cf'
WHERE email = 'admin@jadewellness.spa';
*/
