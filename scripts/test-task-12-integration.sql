-- =====================================================
-- Task 12 Integration Test SQL Script
-- Service Commission Calculation on Booking Save
-- =====================================================

-- This script provides SQL queries to:
-- 1. Setup test data
-- 2. Verify service items creation
-- 3. Check commission calculations
-- 4. Validate database integrity

-- =====================================================
-- SECTION 1: Pre-Test Setup and Data Verification
-- =====================================================

-- Check if booking_service_items table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'booking_service_items'
) AS table_exists;

-- View table structure
\d booking_service_items;

-- Check tenant commission config
SELECT 
  id AS tenant_id,
  name AS tenant_name,
  enabled_modules,
  (settings->'commission_config'->'service_commission_default')::jsonb AS default_commission
FROM tenants
WHERE enabled_modules @> '["beauty_spa"]'::jsonb
LIMIT 5;

-- Get test KTV (for assignment)
SELECT 
  id AS ktv_id,
  full_name,
  base_salary
FROM users
WHERE role = 'ktv'
  AND tenant_id = '<REPLACE_WITH_TENANT_ID>'
LIMIT 5;

-- Get test packages (beauty_spa)
SELECT 
  id AS package_id,
  name,
  price,
  module_id
FROM packages
WHERE tenant_id = '<REPLACE_WITH_TENANT_ID>'
  AND module_id = 'beauty_spa'
LIMIT 5;

-- Get test customer
SELECT 
  id AS customer_id,
  phone,
  full_name
FROM customers
WHERE tenant_id = '<REPLACE_WITH_TENANT_ID>'
LIMIT 5;

-- =====================================================
-- SECTION 2: Test Data Creation
-- =====================================================

-- Create test customer (if needed)
INSERT INTO customers (
  tenant_id,
  phone,
  full_name,
  email
) VALUES (
  '<REPLACE_WITH_TENANT_ID>',
  '0912345678',
  'Nguyễn Test Task 12',
  'test-task12@example.com'
)
ON CONFLICT (tenant_id, phone) DO UPDATE
  SET full_name = EXCLUDED.full_name
RETURNING id, phone, full_name;

-- =====================================================
-- SECTION 3: Post-Booking Verification Queries
-- =====================================================

-- Query 1: Check service items created for a booking
SELECT 
  bsi.id,
  bsi.booking_id,
  bsi.service_name,
  bsi.quantity,
  bsi.unit_price,
  bsi.subtotal,
  bsi.calculated_commission,
  bsi.override_commission_type,
  bsi.override_commission_value,
  bsi.status,
  bsi.created_at,
  u.full_name AS ktv_name
FROM booking_service_items bsi
LEFT JOIN users u ON bsi.ktv_id = u.id
WHERE bsi.booking_id = '<REPLACE_WITH_BOOKING_ID>'
ORDER BY bsi.created_at;

-- Query 2: Verify commission calculation correctness
-- (For default commission items)
SELECT 
  service_name,
  unit_price,
  quantity,
  subtotal,
  calculated_commission,
  CASE 
    WHEN override_commission_type IS NULL THEN 'Using default commission'
    WHEN override_commission_type = 'fixed' THEN 'Fixed override: ' || override_commission_value::text
    WHEN override_commission_type = 'percentage' THEN 'Percentage override: ' || override_commission_value::text || '% = ' || (subtotal * override_commission_value / 100)::text
  END AS commission_source,
  -- Verify subtotal calculation
  (quantity * unit_price) AS expected_subtotal,
  (quantity * unit_price) = subtotal AS subtotal_correct
FROM booking_service_items
WHERE booking_id = '<REPLACE_WITH_BOOKING_ID>';

-- Query 3: Check total commission for a booking
SELECT 
  booking_id,
  COUNT(*) AS item_count,
  SUM(subtotal) AS total_subtotal,
  SUM(calculated_commission) AS total_commission,
  ARRAY_AGG(service_name) AS services
FROM booking_service_items
WHERE booking_id = '<REPLACE_WITH_BOOKING_ID>'
GROUP BY booking_id;

-- Query 4: Verify booking and service items relationship
SELECT 
  b.id AS booking_id,
  b.status AS booking_status,
  b.full_price,
  b.deposit_amount,
  c.full_name AS customer_name,
  COUNT(bsi.id) AS service_item_count,
  SUM(bsi.subtotal) AS total_service_value,
  SUM(bsi.calculated_commission) AS total_commission
FROM bookings b
LEFT JOIN booking_service_items bsi ON b.id = bsi.booking_id
LEFT JOIN customers c ON b.customer_id = c.id
WHERE b.id = '<REPLACE_WITH_BOOKING_ID>'
GROUP BY b.id, b.status, b.full_price, b.deposit_amount, c.full_name;

-- =====================================================
-- SECTION 4: Database Integrity Checks
-- =====================================================

-- Check 1: All service items have valid booking_id
SELECT 
  COUNT(*) AS orphaned_service_items
FROM booking_service_items bsi
LEFT JOIN bookings b ON bsi.booking_id = b.id
WHERE b.id IS NULL;
-- Expected: 0

-- Check 2: All service items have valid tenant_id
SELECT 
  COUNT(*) AS invalid_tenant_items
FROM booking_service_items bsi
LEFT JOIN tenants t ON bsi.tenant_id = t.id
WHERE t.id IS NULL;
-- Expected: 0

-- Check 3: All service items have valid ktv_id (if not null)
SELECT 
  COUNT(*) AS invalid_ktv_items
FROM booking_service_items bsi
LEFT JOIN users u ON bsi.ktv_id = u.id
WHERE bsi.ktv_id IS NOT NULL
  AND u.id IS NULL;
-- Expected: 0

-- Check 4: All service items have non-negative values
SELECT 
  COUNT(*) AS negative_value_items
FROM booking_service_items
WHERE quantity < 0
   OR unit_price < 0
   OR subtotal < 0
   OR calculated_commission < 0;
-- Expected: 0

-- Check 5: Subtotal matches quantity × unit_price
SELECT 
  COUNT(*) AS incorrect_subtotal_items
FROM booking_service_items
WHERE subtotal != (quantity * unit_price);
-- Expected: 0

-- Check 6: Override commission logic validation
-- (If override_type exists, override_value must exist)
SELECT 
  COUNT(*) AS incomplete_override_items
FROM booking_service_items
WHERE (override_commission_type IS NOT NULL AND override_commission_value IS NULL)
   OR (override_commission_type IS NULL AND override_commission_value IS NOT NULL);
-- Expected: 0

-- =====================================================
-- SECTION 5: Commission Calculation Audit
-- =====================================================

-- Audit all service items commission calculations
-- This query recalculates commission and compares with stored value
WITH commission_audit AS (
  SELECT 
    id,
    service_name,
    subtotal,
    calculated_commission AS stored_commission,
    override_commission_type,
    override_commission_value,
    CASE 
      -- Fixed override
      WHEN override_commission_type = 'fixed' THEN override_commission_value
      -- Percentage override
      WHEN override_commission_type = 'percentage' THEN (subtotal * override_commission_value / 100)
      -- Default commission (assuming 150,000 VND as system default)
      ELSE 150000
    END AS recalculated_commission
  FROM booking_service_items
  WHERE booking_id = '<REPLACE_WITH_BOOKING_ID>'
)
SELECT 
  *,
  (stored_commission = recalculated_commission) AS commission_matches,
  (stored_commission - recalculated_commission) AS difference
FROM commission_audit;

-- =====================================================
-- SECTION 6: Recent Bookings with Service Items
-- =====================================================

-- View recent bookings with service items count
SELECT 
  b.id AS booking_id,
  b.created_at,
  b.status AS booking_status,
  c.full_name AS customer,
  p.name AS package_name,
  b.full_price,
  b.deposit_amount,
  COUNT(bsi.id) AS service_items_count,
  SUM(bsi.calculated_commission) AS total_service_commission
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN packages p ON b.package_id::uuid = p.id
LEFT JOIN booking_service_items bsi ON b.id = bsi.booking_id
WHERE b.tenant_id = '<REPLACE_WITH_TENANT_ID>'
  AND b.created_at > NOW() - INTERVAL '7 days'
GROUP BY b.id, b.created_at, b.status, c.full_name, p.name, b.full_price, b.deposit_amount
ORDER BY b.created_at DESC
LIMIT 20;

-- =====================================================
-- SECTION 7: Commission by KTV (Salary Impact)
-- =====================================================

-- Check how service items affect KTV salary calculations
SELECT 
  u.id AS ktv_id,
  u.full_name AS ktv_name,
  COUNT(bsi.id) AS service_items_count,
  SUM(bsi.calculated_commission) AS total_service_commission,
  DATE_TRUNC('month', bsi.created_at) AS month
FROM booking_service_items bsi
JOIN users u ON bsi.ktv_id = u.id
WHERE bsi.tenant_id = '<REPLACE_WITH_TENANT_ID>'
  AND bsi.status = 'completed'
  AND bsi.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.id, u.full_name, DATE_TRUNC('month', bsi.created_at)
ORDER BY total_service_commission DESC;

-- =====================================================
-- SECTION 8: Cleanup (Optional)
-- =====================================================

-- Delete test service items (CAUTION: Only for test data)
-- DELETE FROM booking_service_items
-- WHERE booking_id = '<REPLACE_WITH_TEST_BOOKING_ID>';

-- Delete test booking (CAUTION: Only for test data)
-- DELETE FROM bookings
-- WHERE id = '<REPLACE_WITH_TEST_BOOKING_ID>';

-- =====================================================
-- SECTION 9: Performance Check
-- =====================================================

-- Check index on booking_service_items
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'booking_service_items';

-- Explain analyze for common query
EXPLAIN ANALYZE
SELECT 
  bsi.*,
  u.full_name AS ktv_name
FROM booking_service_items bsi
LEFT JOIN users u ON bsi.ktv_id = u.id
WHERE bsi.booking_id = '<REPLACE_WITH_BOOKING_ID>';

-- =====================================================
-- END OF TEST SCRIPT
-- =====================================================

-- Usage Instructions:
-- 1. Replace all '<REPLACE_WITH_TENANT_ID>' with actual tenant UUID
-- 2. Replace all '<REPLACE_WITH_BOOKING_ID>' with actual booking UUID after creation
-- 3. Run queries sequentially or as needed for testing
-- 4. Check expected values in comments
-- 5. Document any failures in TASK_12_TESTING_CHECKLIST.md
