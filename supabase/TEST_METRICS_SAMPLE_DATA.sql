-- ============================================================================
-- Test Metrics Sample Data
-- ============================================================================
-- Purpose: Insert sample metrics to test Booking Engine Dashboard
-- Usage: Replace YOUR_TENANT_ID with actual tenant ID from tenants table
--
-- Step 1: Find your tenant ID
-- SELECT id, name FROM tenants LIMIT 1;
--
-- Step 2: Replace YOUR_TENANT_ID below with actual ID
--
-- Step 3: Run this script in Supabase SQL Editor
-- ============================================================================

-- Clean up existing test data (optional)
-- DELETE FROM decision_engine_metrics WHERE tenant_id = 'YOUR_TENANT_ID';

-- ============================================================================
-- Sample Metrics: Capacity Management Provider
-- ============================================================================

-- Scenario 1: Successful capacity checks (available)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Morning slots (low utilization)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.4, 
   '{"utilization_percent": 45, "buffer_used_percent": 5, "current_bookings": 3, "max_bookings": 8}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.3, 
   '{"utilization_percent": 50, "buffer_used_percent": 8, "current_bookings": 4, "max_bookings": 8}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.5, 
   '{"utilization_percent": 60, "buffer_used_percent": 12, "current_bookings": 5, "max_bookings": 8}', 
   false, false, false),
  
  -- Afternoon slots (medium utilization)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.6, 
   '{"utilization_percent": 70, "buffer_used_percent": 15, "current_bookings": 6, "max_bookings": 8}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.4, 
   '{"utilization_percent": 75, "buffer_used_percent": 18, "current_bookings": 6, "max_bookings": 8}', 
   false, false, false),
  
  -- Peak hours (high utilization)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.7, 
   '{"utilization_percent": 85, "buffer_used_percent": 25, "current_bookings": 7, "max_bookings": 8}', 
   false, false, false);

-- Scenario 2: Capacity full (rejected bookings)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Peak hours fully booked
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', false, 'full', 0.5, 
   '{"utilization_percent": 100, "buffer_used_percent": 90, "current_bookings": 8, "max_bookings": 8}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', false, 'full', 0.6, 
   '{"utilization_percent": 95, "buffer_used_percent": 85, "current_bookings": 8, "max_bookings": 8}', 
   false, false, false);

-- Scenario 3: Manager override (skip capacity check)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- VIP customer, capacity overridden
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'capacity_management', 'checkCapacity', true, 'available', 0.2, 
   '{"utilization_percent": 100, "buffer_used_percent": 100, "current_bookings": 9, "max_bookings": 8, "override_reason": "VIP customer emergency"}', 
   true, false, false);

-- ============================================================================
-- Sample Metrics: Conflict Detection Provider
-- ============================================================================

-- Scenario 1: No conflicts detected
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Clean bookings (no overlaps)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.6, 
   '{"conflicts_count": 0, "severity": "none", "checked_types": ["customer_double_booking", "room_conflict", "equipment_conflict"]}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.7, 
   '{"conflicts_count": 0, "severity": "none", "checked_types": ["customer_double_booking", "room_conflict"]}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.5, 
   '{"conflicts_count": 0, "severity": "none", "checked_types": ["customer_double_booking"]}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.8, 
   '{"conflicts_count": 0, "severity": "none", "checked_types": ["room_conflict", "equipment_conflict"]}', 
   false, false, false);

-- Scenario 2: Warning conflicts (allowed but flagged)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Close bookings (< 30 min gap, warning)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'conflict_warning', 0.9, 
   '{"conflicts_count": 1, "severity": "warning", "blocking_conflicts": 0, "warning_conflicts": 1, "conflicts": [{"type": "customer_close_bookings", "severity": "warning", "message": "Customer has another booking within 30 minutes"}]}', 
   false, false, false),
  
  -- Room turnover time short (< 15 min, warning)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'conflict_warning', 0.7, 
   '{"conflicts_count": 1, "severity": "warning", "blocking_conflicts": 0, "warning_conflicts": 1, "conflicts": [{"type": "room_turnover_time", "severity": "warning", "message": "Room turnover time less than 15 minutes"}]}', 
   false, false, false);

-- Scenario 3: Blocking conflicts (rejected bookings)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Customer double-booking (blocking)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 0.8, 
   '{"conflicts_count": 1, "severity": "blocking", "blocking_conflicts": 1, "warning_conflicts": 0, "conflicts": [{"type": "customer_double_booking", "severity": "blocking", "message": "Customer already has a booking at this time"}]}', 
   false, false, false),
  
  -- Room unavailable (blocking)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 1.0, 
   '{"conflicts_count": 1, "severity": "blocking", "blocking_conflicts": 1, "warning_conflicts": 0, "conflicts": [{"type": "room_unavailable", "severity": "blocking", "message": "Requested room is already booked"}]}', 
   false, false, false),
  
  -- Multiple conflicts (2 blocking)
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 1.2, 
   '{"conflicts_count": 2, "severity": "blocking", "blocking_conflicts": 2, "warning_conflicts": 0, "conflicts": [{"type": "customer_double_booking", "severity": "blocking"}, {"type": "equipment_unavailable", "severity": "blocking"}]}', 
   false, false, false);

-- Scenario 4: Manager override (skip conflict check)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Emergency override
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.1, 
   '{"conflicts_count": 0, "severity": "none", "override_reason": "Manager override for VIP customer"}', 
   false, true, false);

-- ============================================================================
-- Sample Metrics: Auto Assignment Provider
-- ============================================================================

-- Scenario 1: Successful auto-assignments
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- High confidence assignment
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 1.8, 
   '{"confidence": 0.92, "assigned_ktv_id": "ktv-001", "alternatives_count": 5, "top_score": 92, "second_score": 78}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 2.1, 
   '{"confidence": 0.85, "assigned_ktv_id": "ktv-002", "alternatives_count": 6, "top_score": 85, "second_score": 72}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 1.5, 
   '{"confidence": 0.88, "assigned_ktv_id": "ktv-003", "alternatives_count": 4, "top_score": 88, "second_score": 75}', 
   false, false, false),
  
  -- Medium confidence assignment
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 2.3, 
   '{"confidence": 0.75, "assigned_ktv_id": "ktv-004", "alternatives_count": 8, "top_score": 75, "second_score": 68}', 
   false, false, false),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 1.9, 
   '{"confidence": 0.78, "assigned_ktv_id": "ktv-005", "alternatives_count": 7, "top_score": 78, "second_score": 70}', 
   false, false, false),
  
  -- Preferred KTV assigned
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'assigned', 1.2, 
   '{"confidence": 0.95, "assigned_ktv_id": "ktv-preferred", "alternatives_count": 3, "top_score": 95, "second_score": 80, "is_preferred": true}', 
   false, false, false);

-- Scenario 2: Manual assignment (override)
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- Manager manually assigned KTV
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'manual', 0.2, 
   '{"confidence": null, "assigned_ktv_id": null, "alternatives_count": 0, "override_reason": "Manager manually selected KTV"}', 
   false, false, true),
  
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', true, 'manual', 0.3, 
   '{"confidence": null, "assigned_ktv_id": null, "alternatives_count": 0, "override_reason": "Customer requested specific KTV"}', 
   false, false, true);

-- Scenario 3: No suitable KTV found
INSERT INTO decision_engine_metrics (
  tenant_id,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  metadata,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
) VALUES
  -- All KTVs at capacity
  ('cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa', 'auto_assignment', 'assignKtv', false, 'no_assignment', 1.5, 
   '{"confidence": 0, "assigned_ktv_id": null, "alternatives_count": 0, "reason": "All KTVs at maximum capacity"}', 
   false, false, false);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Query 1: Count metrics by provider type
SELECT 
  provider_type,
  COUNT(*) AS total_operations,
  AVG(execution_time_ms) AS avg_time_ms,
  COUNT(*) FILTER (WHERE success = true) AS successful,
  COUNT(*) FILTER (WHERE success = false) AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 1) AS success_rate_percent
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
GROUP BY provider_type
ORDER BY provider_type;

-- Expected output:
-- provider_type        | total | avg_time_ms | successful | failed | success_rate_percent
-- ---------------------|-------|-------------|------------|--------|---------------------
-- auto_assignment      | 9     | 1.4         | 8          | 1      | 88.9
-- capacity_management  | 9     | 0.5         | 7          | 2      | 77.8
-- conflict_detection   | 10    | 0.8         | 6          | 4      | 60.0

-- Query 2: Assignment stats
SELECT 
  COUNT(*) AS total_assignments,
  COUNT(*) FILTER (WHERE success = true AND outcome = 'assigned') AS auto_assigned,
  COUNT(*) FILTER (WHERE outcome = 'manual') AS manual_assigned,
  ROUND(AVG((metadata->>'confidence')::NUMERIC), 2) AS avg_confidence,
  ROUND(AVG(execution_time_ms), 1) AS avg_time_ms
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
  AND provider_type = 'auto_assignment';

-- Expected output:
-- total | auto_assigned | manual_assigned | avg_confidence | avg_time_ms
-- ------|---------------|-----------------|----------------|-------------
-- 9     | 6             | 2               | 0.86           | 1.4

-- Query 3: Conflict stats
SELECT 
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE outcome = 'no_conflicts') AS no_conflicts,
  COUNT(*) FILTER (WHERE outcome LIKE '%warning%') AS warning_conflicts,
  COUNT(*) FILTER (WHERE outcome LIKE '%blocking%') AS blocking_conflicts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome LIKE '%blocking%') / COUNT(*), 1) AS blocking_rate_percent
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
  AND provider_type = 'conflict_detection';

-- Expected output:
-- total_checks | no_conflicts | warning_conflicts | blocking_conflicts | blocking_rate_percent
-- -------------|--------------|-------------------|--------------------|-----------------------
-- 10           | 5            | 2                 | 3                  | 30.0

-- Query 4: Capacity stats
SELECT 
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE outcome = 'available') AS available,
  COUNT(*) FILTER (WHERE outcome = 'full') AS full,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome = 'full') / COUNT(*), 1) AS full_rate_percent,
  ROUND(AVG((metadata->>'utilization_percent')::NUMERIC), 1) AS avg_utilization_percent
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
  AND provider_type = 'capacity_management';

-- Expected output:
-- total_checks | available | full | full_rate_percent | avg_utilization_percent
-- -------------|-----------|------|-------------------|------------------------
-- 9            | 7         | 2    | 22.2              | 75.6

-- Query 5: Override stats
SELECT 
  COUNT(*) AS total_operations,
  COUNT(*) FILTER (WHERE was_capacity_skipped = true) AS capacity_skipped,
  COUNT(*) FILTER (WHERE was_conflict_skipped = true) AS conflict_skipped,
  COUNT(*) FILTER (WHERE was_assignment_skipped = true) AS assignment_skipped,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE was_capacity_skipped = true 
       OR was_conflict_skipped = true 
       OR was_assignment_skipped = true
  ) / COUNT(*), 1) AS override_rate_percent
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa';

-- Expected output:
-- total | capacity_skipped | conflict_skipped | assignment_skipped | override_rate_percent
-- ------|------------------|------------------|--------------------|-----------------------
-- 28    | 1                | 1                | 2                  | 14.3

-- Query 6: Performance by provider (P95, P99)
SELECT 
  provider_type,
  COUNT(*) AS operations,
  ROUND(AVG(execution_time_ms), 1) AS avg_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms), 1) AS p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 1) AS p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms), 1) AS p99_ms,
  ROUND(MAX(execution_time_ms), 1) AS max_ms
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
GROUP BY provider_type
ORDER BY avg_ms DESC;

-- Expected output:
-- provider_type        | operations | avg_ms | p50_ms | p95_ms | p99_ms | max_ms
-- ---------------------|------------|--------|--------|--------|--------|--------
-- auto_assignment      | 9          | 1.4    | 1.8    | 2.3    | 2.3    | 2.3
-- conflict_detection   | 10         | 0.8    | 0.8    | 1.2    | 1.2    | 1.2
-- capacity_management  | 9          | 0.5    | 0.5    | 0.7    | 0.7    | 0.7

-- Query 7: Recent metrics (last 10)
SELECT 
  created_at,
  provider_type,
  operation,
  success,
  outcome,
  execution_time_ms,
  was_capacity_skipped,
  was_conflict_skipped,
  was_assignment_skipped
FROM decision_engine_metrics
WHERE tenant_id = 'cb4f1343-7da4-4a8b-89fe-34a8c8aeadfa'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- Next Steps
-- ============================================================================
-- 1. Replace 'YOUR_TENANT_ID' with actual tenant ID
-- 2. Run this script in Supabase SQL Editor
-- 3. Verify all queries return expected results
-- 4. Open dashboard: http://localhost:3000/dashboard/admin/booking-engine
-- 5. Verify dashboard displays metrics correctly:
--    - Assignment Success: ~88.9%
--    - Auto-Assignment Rate: ~66.7% (6 auto / 3 manual)
--    - Conflict Rate: ~40% (4 conflicts / 10 checks)
--    - Capacity Full Rate: ~22.2% (2 full / 9 checks)
--    - Performance: Avg 0.9ms, P95 2.0ms
-- ============================================================================
