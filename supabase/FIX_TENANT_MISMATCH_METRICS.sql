-- ============================================================================
-- Fix: Update Metrics Tenant to Match User Tenant
-- ============================================================================
-- Problem: Metrics inserted with tenant 'ab6ae603-04e8-4e74-b015-ba123f8705cf'
--          but user 'admin@jadewellness.spa' has different tenant_id
-- Solution: Update all metrics to match user's tenant_id

-- Step 1: Show current situation (BEFORE fix)
SELECT 
  'BEFORE FIX' as stage,
  u.email,
  u.tenant_id as user_tenant,
  m.tenant_id as metrics_tenant,
  COUNT(m.*) as metrics_count,
  CASE 
    WHEN u.tenant_id::text = m.tenant_id::text THEN '✅ Match'
    ELSE '❌ MISMATCH'
  END as status
FROM users u
CROSS JOIN (
  SELECT DISTINCT tenant_id 
  FROM decision_engine_metrics
) m
WHERE u.email = 'admin@jadewellness.spa'
GROUP BY u.email, u.tenant_id, m.tenant_id;

-- Step 2: Update metrics to match user's tenant
UPDATE decision_engine_metrics
SET tenant_id = (
  SELECT tenant_id 
  FROM users 
  WHERE email = 'admin@jadewellness.spa'
)
WHERE tenant_id = 'ab6ae603-04e8-4e74-b015-ba123f8705cf';

-- Step 3: Verify fix (AFTER)
SELECT 
  'AFTER FIX' as stage,
  u.email,
  u.tenant_id as user_tenant,
  (SELECT DISTINCT tenant_id FROM decision_engine_metrics LIMIT 1) as metrics_tenant,
  COUNT(m.*) as metrics_count,
  CASE 
    WHEN u.tenant_id::text = (SELECT tenant_id::text FROM decision_engine_metrics LIMIT 1) THEN '✅ Match'
    ELSE '❌ Still Mismatch'
  END as status
FROM users u
CROSS JOIN decision_engine_metrics m
WHERE u.email = 'admin@jadewellness.spa'
GROUP BY u.email, u.tenant_id;

-- Step 4: Test RPC function with correct tenant
SELECT 
  'RPC Test' as test_name,
  *
FROM get_booking_engine_metrics(
  (SELECT tenant_id FROM users WHERE email = 'admin@jadewellness.spa'),
  NOW() - INTERVAL '7 days',
  NOW()
);

-- ============================================================================
-- Expected Result:
-- ============================================================================
-- BEFORE: ❌ MISMATCH (28 metrics with wrong tenant)
-- AFTER:  ✅ Match (28 metrics with correct tenant)
-- RPC:    Returns assignment_success_rate: 88.89%, conflict_rate: 70%, etc.
