-- Test RPC function directly

-- Step 1: Get tenant ID
SELECT id, name FROM tenants LIMIT 1;

-- Step 2: Test RPC (replace YOUR_TENANT_ID with actual ID from step 1)
SELECT get_booking_engine_metrics(
  'YOUR_TENANT_ID'::UUID,
  NOW() - INTERVAL '7 days',
  NOW()
);

-- Step 3: Check if data exists
SELECT 
  tenant_id,
  provider_type,
  COUNT(*) as total
FROM decision_engine_metrics
GROUP BY tenant_id, provider_type;

-- Step 4: If RPC returns empty, check data for your tenant
-- Replace YOUR_TENANT_ID
SELECT * FROM decision_engine_metrics 
WHERE tenant_id = 'YOUR_TENANT_ID'::UUID
LIMIT 5;
